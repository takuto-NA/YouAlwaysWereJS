/**
 * Why this module matters:
 * - Shields KuzuDB WASM specifics from the rest of the app so LangGraph agents can call a stable API.
 * - Serialises filesystem work to avoid race conditions when multiple automated actions run.
 */
import { logDebug, logWarning, getErrorMessage } from "../utils/errorHandler";

const KUZU_DB_DIR = "/database";
const KUZU_DB_PATH = `${KUZU_DB_DIR}/persistent.db`;
const KUZU_WORKER_PATH = "/kuzu-wasm/kuzu_wasm_worker.js";
const KUZU_MODULE_PATH = "/kuzu-wasm/index.js";
const BASE_PATH = import.meta.env?.BASE_URL ?? "/";

const KUZU_LOG_CONTEXT = "KuzuClient";
const FILESYSTEM_RETRY_DELAY_MS = 50;
const MAX_STRING_EXTRACTION_DEPTH = 5;
const DEFAULT_PREVIEW_LIMIT = 25;
const MIN_COLUMN_TOKENS = 2;

interface KuzuFileSystem {
  mkdir(path: string): Promise<void>;
  unlink(path: string): Promise<void>;
  mountIdbfs(path: string): Promise<void>;
  syncfs(populate: boolean): Promise<void>;
  unmount(path: string): Promise<void>;
  writeFile?(path: string, content: string): Promise<void>;
}

interface KuzuDatabase {
  close(): Promise<void>;
}

interface KuzuQueryResultHandle {
  getColumnNames(): Promise<string[]>;
  getAllObjects(): Promise<QueryRow[]>;
  close(): Promise<void>;
}

interface KuzuConnection {
  query(sql: string): Promise<KuzuQueryResultHandle>;
  close(): Promise<void>;
}

interface KuzuModule {
  Database: new (path: string) => KuzuDatabase;
  Connection: new (db: KuzuDatabase) => KuzuConnection;
  FS: KuzuFileSystem;
  setWorkerPath?(path: string): void;
}

interface KuzuExecutionContext {
  kuzu: KuzuModule;
  db: KuzuDatabase;
  conn: KuzuConnection;
}

const ERROR_CODES = {
  FILE_EXISTS: "EEXIST",
  INVALID_ARGUMENT: "EINVAL",
  NO_ENTITY: "ENOENT",
  RESOURCE_BUSY: "EBUSY",
} as const;

const ERROR_ERRNO = {
  FILE_EXISTS: 17,
  FILE_EXISTS_NEGATIVE: -17,
  NOT_A_DIRECTORY: 20,
  RESOURCE_BUSY: 16,
  RESOURCE_BUSY_NEGATIVE: -16,
  NO_SPACE: 28,
  NO_SPACE_NEGATIVE: -28,
  NO_ENTITY: 2,
  NO_ENTITY_NEGATIVE: -2,
} as const;

export const KUZU_DEMO_FLAG = "kuzuDemoInitialized";
const KUZU_FALLBACK_TABLES_KEY = "kuzuFallbackTables";

const CSV_SEED_DATA: Record<string, string> = {
  "user.csv": `Adam,30
Karissa,40
Zhang,50
Noura,25`,
  "city.csv": `Waterloo,150000
Kitchener,200000
Guelph,75000`,
  "follows.csv": `Adam,Karissa,2020
Adam,Zhang,2020
Karissa,Zhang,2021
Zhang,Noura,2022`,
  "lives-in.csv": `Adam,Waterloo
Karissa,Waterloo
Zhang,Kitchener
Noura,Guelph`,
};

const FIRST_RUN_QUERIES = [
  "CREATE NODE TABLE User(name STRING, age INT64, PRIMARY KEY (name))",
  "CREATE NODE TABLE City(name STRING, population INT64, PRIMARY KEY (name))",
  "CREATE REL TABLE Follows(FROM User TO User, since INT64)",
  "CREATE REL TABLE LivesIn(FROM User TO City)",
  "COPY User FROM 'user.csv'",
  "COPY City FROM 'city.csv'",
  "COPY Follows FROM 'follows.csv'",
  "COPY LivesIn FROM 'lives-in.csv'",
];

export type QueryRow = Record<string, unknown>;

export interface QueryResult {
  columns: string[];
  rows: QueryRow[];
}

export interface TableInfo {
  name: string;
  type?: string;
  raw: QueryRow;
  columns?: Array<{ name: string; type: string }>;
}

export interface TableSchema {
  table: TableInfo;
  columns: QueryResult;
}

export interface TablePreview {
  table: TableInfo;
  result: QueryResult | null;
  error?: string;
}

export interface SeedDemoOptions {
  signal?: AbortSignal;
  onLog?: (message: string) => void;
  kuzuInstance?: KuzuModule;
}

let kuzuModulePromise: Promise<KuzuModule> | null = null;
let catalogProceduresSupported: boolean | null = null;
let operationQueue: Promise<void> = Promise.resolve();

function ensureBrowserEnvironment() {
  if (typeof window === "undefined") {
    throw new Error("Kuzu WASM client requires a browser environment.");
  }
}

function resolveAssetUrl(relativePath: string): string {
  const normalized = relativePath.startsWith("/") ? relativePath.slice(1) : relativePath;
  const base = BASE_PATH.endsWith("/") ? BASE_PATH : `${BASE_PATH}/`;
  if (typeof window === "undefined") {
    return `${base}${normalized}`;
  }
  return new URL(`${base}${normalized}`, window.location.origin).href;
}

export async function loadKuzuModule(): Promise<KuzuModule> {
  ensureBrowserEnvironment();
  if (!kuzuModulePromise) {
    kuzuModulePromise = (async () => {
      const moduleUrl = resolveAssetUrl(KUZU_MODULE_PATH);
      const importedModule: unknown = await import(/* @vite-ignore */ moduleUrl);
      const kuzuCandidate =
        (importedModule as { default?: KuzuModule }).default ?? (importedModule as KuzuModule);
      const kuzu = kuzuCandidate as KuzuModule;
      if (typeof kuzu.setWorkerPath === "function") {
        kuzu.setWorkerPath(resolveAssetUrl(KUZU_WORKER_PATH));
      }
      return kuzu;
    })();
  }
  return kuzuModulePromise;
}

export async function runWithConnection<T>(task: (ctx: KuzuExecutionContext) => Promise<T>): Promise<T> {
  const resultPromise = operationQueue.catch(() => undefined).then(async () => {
    const kuzu = await loadKuzuModule();
    await ensureDirectory(kuzu, KUZU_DB_DIR);
    await remountIdbfs(kuzu, KUZU_DB_DIR);
    await syncFs(kuzu, true);

    const db = new kuzu.Database(KUZU_DB_PATH);
    const conn = new kuzu.Connection(db);

    try {
      return await task({ kuzu, db, conn });
    } finally {
      try {
        await conn.close();
      } catch (error) {
        logWarning(KUZU_LOG_CONTEXT, "Failed to close connection", { error });
      }
      try {
        await db.close();
      } catch (error) {
        logWarning(KUZU_LOG_CONTEXT, "Failed to close database", { error });
      }

      await syncFs(kuzu, false);
      await safeUnmount(kuzu, KUZU_DB_DIR);
    }
  });

  operationQueue = resultPromise
    .then(() => undefined)
    .catch(() => undefined);

  return resultPromise;
}

export interface NormalizedCypherStatement {
  statement: string;
  didRewrite: boolean;
}

export async function executeQuery(
  sql: string,
  options: { skipNormalization?: boolean } = {}
): Promise<QueryResult> {
  return runWithConnection(async ({ conn }) => {
    const normalization = options.skipNormalization
      ? { statement: sql, didRewrite: false }
      : normalizeCypherStatement(sql);
    if (normalization.didRewrite) {
      logDebug(KUZU_LOG_CONTEXT, "Normalized Cypher statement for Kuzu compatibility", {
        original: sql,
        normalized: normalization.statement,
      });
    }
    return runQuery(conn, normalization.statement);
  });
}

export function normalizeCypherStatement(statement: string): NormalizedCypherStatement {
  const { masked, literals } = maskStringLiterals(statement);
  let didRewrite = false;

  let transformed = masked.replace(/\bDATETIME\s*\(\s*([^)]*?)\s*\)/gi, (_match, arg) => {
    didRewrite = true;
    const trimmedArg = typeof arg === "string" ? arg.trim() : "";
    if (trimmedArg.length === 0) {
      return "CURRENT_TIMESTAMP()";
    }

    const literalMatch = /^__KUZU_LITERAL_(\d+)__$/.exec(trimmedArg);
    if (literalMatch) {
      const literalIndex = Number.parseInt(literalMatch[1], 10);
      if (!Number.isNaN(literalIndex) && literalIndex >= 0 && literalIndex < literals.length) {
        const literalValue = literals[literalIndex];
        const unquoted = literalValue.replace(/^['"`]/, "").replace(/['"`]$/, "");
        const keyword = unquoted.trim().toLowerCase();
        if (keyword.length === 0) {
          return "CURRENT_TIMESTAMP()";
        }
        if (keyword === "now" || keyword === "current_timestamp") {
          return "CURRENT_TIMESTAMP()";
        }
      }
    } else if (/^(now|current_timestamp)$/i.test(trimmedArg)) {
      return "CURRENT_TIMESTAMP()";
    }

    return `CAST(${trimmedArg} AS TIMESTAMP)`;
  });

  transformed = transformed.replace(/\bDATETIME\b/gi, () => {
    didRewrite = true;
    return "TIMESTAMP";
  });

  const restored = restoreStringLiterals(transformed, literals);
  if (restored === statement) {
    return {
      statement,
      didRewrite: false,
    };
  }
  return {
    statement: restored,
    didRewrite,
  };
}

function maskStringLiterals(sql: string): { masked: string; literals: string[] } {
  const literals: string[] = [];
  const masked = sql.replace(
    /'([^']|'')*'|"([^"]|"")*"|`([^`]|``)*`/g,
    (match: string) => {
      const token = `__KUZU_LITERAL_${literals.length}__`;
      literals.push(match);
      return token;
    }
  );
  return { masked, literals };
}

function restoreStringLiterals(masked: string, literals: string[]): string {
  return masked.replace(/__KUZU_LITERAL_(\d+)__/g, (match, indexString: string) => {
    const index = Number.parseInt(indexString, 10);
    if (Number.isNaN(index) || index < 0 || index >= literals.length) {
      return match;
    }
    return literals[index];
  });
}

export async function seedDemoData(options: SeedDemoOptions = {}): Promise<void> {
  const { signal, onLog, kuzuInstance } = options;
  const log = (message: string) => {
    if (signal?.aborted) {
      throw new Error("RUN_ABORTED");
    }
    onLog?.(message);
  };

  await queueOperation(async () => {
    const kuzu = kuzuInstance ?? (await loadKuzuModule());

    if (typeof kuzu.FS.writeFile !== "function") {
      throw new Error("Kuzu FS.writeFile is unavailable in this environment.");
    }

    log("Writing CSV seed files into the in-memory FS...");
    for (const [filename, csv] of Object.entries(CSV_SEED_DATA)) {
      if (signal?.aborted) throw new Error("RUN_ABORTED");
      await kuzu.FS.writeFile(`/${filename}`, csv);
      log(`- ${filename} written (${csv.split("\n").length} rows)`);
    }

    if (signal?.aborted) throw new Error("RUN_ABORTED");
    log(`Preparing mount point ${KUZU_DB_DIR}...`);
    await ensureDirectory(kuzu, KUZU_DB_DIR);
    await remountIdbfs(kuzu, KUZU_DB_DIR);
    log("Mounted. Creating database and executing setup queries...");

    await removeStaleDatabaseFile(kuzu);

    const db = new kuzu.Database(KUZU_DB_PATH);
    const conn = new kuzu.Connection(db);

    try {
      for (const query of FIRST_RUN_QUERIES) {
        if (signal?.aborted) throw new Error("RUN_ABORTED");
        log(`Executing: ${query}`);
        await runQuery(conn, query);
      }
      const checkNodes = await runQuery(conn, "MATCH (n) RETURN COUNT(*) AS count");
      const checkRels = await runQuery(conn, "MATCH ()-[r]->() RETURN COUNT(*) AS count");
      logDebug(KUZU_LOG_CONTEXT, "Seed demo data counts", {
        nodes: extractCount(checkNodes.rows),
        rels: extractCount(checkRels.rows),
      });
    } finally {
      try {
        await conn.close();
      } catch (error) {
        logWarning(KUZU_LOG_CONTEXT, "Failed to close connection during seeding", { error });
      }
      try {
        await db.close();
      } catch (error) {
        logWarning(KUZU_LOG_CONTEXT, "Failed to close database during seeding", { error });
      }
    }

    log("Syncing filesystem to IndexedDB...");
    await syncFs(kuzu, false);
    await safeUnmount(kuzu, KUZU_DB_DIR);
    log("Database persisted to IndexedDB.");

    const fallbackTables = buildFallbackTables();
    replaceFallbackTables(fallbackTables);
  });
}

async function queueOperation<T>(task: () => Promise<T>): Promise<T> {
  const resultPromise = operationQueue.catch(() => undefined).then(task);
  operationQueue = resultPromise
    .then(() => undefined)
    .catch(() => undefined);
  return resultPromise;
}

export async function listTables(): Promise<TableInfo[]> {
  return runWithConnection(async ({ conn }) => {
    const resultFromShow = await tryShowTables(conn);
    if (resultFromShow) {
      replaceFallbackTables(resultFromShow);
      return resultFromShow;
    }

    const resultFromNodeRel = await tryNodeRelTables(conn);
    if (resultFromNodeRel.length > 0) {
      replaceFallbackTables(resultFromNodeRel);
      return resultFromNodeRel;
    }

    const fallback = loadFallbackTables();
    if (fallback.length > 0) {
      return fallback;
    }

    const labelTables = await listTablesViaLabelScan(conn);
    if (labelTables.length > 0) {
      replaceFallbackTables(labelTables);
      return labelTables;
    }

    return labelTables;
  });
}

async function tryShowTables(conn: KuzuConnection): Promise<TableInfo[] | null> {
  if (catalogProceduresSupported === false) {
    return null;
  }
  if (catalogProceduresSupported === null) {
    catalogProceduresSupported = true;
  }
  const tableQueries = ["CALL DB.SHOW_TABLES();", "CALL DB.SHOW_TABLES()"];
  for (const sql of tableQueries) {
    try {
      const result = await runQuery(conn, sql);
      return result.rows.map((row) => ({
        name: resolveTableName(row),
        type: resolveTableType(row),
        raw: row,
      }));
    } catch {
      catalogProceduresSupported = false;
    }
  }
  return null;
}

async function tryNodeRelTables(conn: KuzuConnection): Promise<TableInfo[]> {
  if (catalogProceduresSupported === false) {
    return [];
  }
  if (catalogProceduresSupported === null) {
    catalogProceduresSupported = true;
  }
  try {
    const nodeResult = await runQuery(conn, "CALL DB.SHOW_NODE_TABLES();");
    const relResult = await runQuery(conn, "CALL DB.SHOW_REL_TABLES();");
    const list: TableInfo[] = [
      ...nodeResult.rows.map((row) => ({
        name: resolveTableName(row),
        type: "NODE",
        raw: row,
      })),
      ...relResult.rows.map((row) => ({
        name: resolveTableName(row),
        type: "REL",
        raw: row,
      })),
    ];
    if (list.length > 0) {
      return list;
    }
  } catch {
    catalogProceduresSupported = false;
  }
  return [];
}

// eslint-disable-next-line max-lines-per-function -- Legacy fallback logic to be modularised in a follow-up refactor.
async function listTablesViaLabelScan(conn: KuzuConnection): Promise<TableInfo[]> {
  const nodeResult = await runLabelQuery(conn);
  let relResult: QueryResult | null = null;
  if (nodeResult.rows.length > 0) {
    try {
      relResult = await runQuery(
        conn,
        `MATCH ()-[r]->()
         WITH DISTINCT type(r) AS relType
         WHERE relType IS NOT NULL AND relType <> ''
         RETURN relType AS tableName
         ORDER BY tableName`
      );
    } catch (error) {
      logWarning(KUZU_LOG_CONTEXT, "Failed to list rel types, falling back to nodes only", { error });
    }
  }

  const map = new Map<string, TableInfo>();

  for (const row of nodeResult.rows) {
    const raw = (row as Record<string, unknown>).tableName;
    const rawString =
      raw && typeof raw === "object" && "toString" in (raw as Record<string, unknown>)
        ? (raw as { toString(): string }).toString()
        : raw;
    logDebug(KUZU_LOG_CONTEXT, "Node label row parsing", {
      row,
      typeofRaw: typeof raw,
      rawValue: raw,
      rawString,
    });
    const name = extractString(row.tableName ?? row["tableName"]);
    if (!name) {
      logWarning(KUZU_LOG_CONTEXT, "Unable to resolve node table name", { row });
      continue;
    }
    map.set(name, { name, type: "NODE", raw: row });
  }

  if (relResult) {
    for (const row of relResult.rows) {
      const name = extractString(row.tableName ?? row["tableName"]);
      if (!name) {
        logWarning(KUZU_LOG_CONTEXT, "Unable to resolve rel table name", { row });
        continue;
      }
      if (map.has(name)) {
        const existing = map.get(name)!;
        map.set(name, { ...existing, type: existing.type ?? "REL" });
      } else {
        map.set(name, { name, type: "REL", raw: row });
      }
    }
  }

  if (map.size === 0) {
    logDebug(KUZU_LOG_CONTEXT, "No node labels discovered", {
      columns: nodeResult.columns,
      rows: nodeResult.rows,
    });
    if (relResult) {
      logDebug(KUZU_LOG_CONTEXT, "No rel types discovered", {
        columns: relResult.columns,
        rows: relResult.rows,
      });
    }
  }

  return Array.from(map.values());
}

export async function describeTable(table: TableInfo): Promise<TableSchema> {
  return runWithConnection(async ({ conn }) => {
    try {
      const sql = `DESCRIBE TABLE ${quoteIdentifier(table.name)};`;
      const columns = await runQuery(conn, sql);
      return { table, columns };
    } catch (error) {
      const fallback = findFallbackTable(table.name);
      if (fallback?.columns && fallback.columns.length > 0) {
        return {
          table,
          columns: {
            columns: ["column", "type"],
            rows: fallback.columns.map((column) => ({
              column: column.name,
              type: column.type,
            })),
          },
        };
      }
      throw error;
    }
  });
}

export async function previewTable(table: TableInfo, limit = DEFAULT_PREVIEW_LIMIT): Promise<TablePreview> {
  return runWithConnection(async ({ conn }) => {
    const label = quoteIdentifier(table.name);
    const nodeQueries = [
      `MATCH (n:${label}) RETURN n AS node LIMIT ${limit}`,
      `MATCH (n:\`${table.name}\`) RETURN n AS node LIMIT ${limit}`, // fallback without escaping
    ];

    const relQueries = [
      `MATCH (source)-[edge:${label}]->(target)
       RETURN source AS source, edge AS edge, target AS target LIMIT ${limit}`,
      `MATCH (source)-[edge:\`${table.name}\`]->(target)
       RETURN source AS source, edge AS edge, target AS target LIMIT ${limit}`,
    ];

    const queries: Array<{ sql: string; type: "node" | "rel" }> = [];

    const normalizedType = table.type?.toUpperCase();
    if (!normalizedType || normalizedType === "NODE") {
      for (const sql of nodeQueries) {
        queries.push({ sql, type: "node" });
      }
    }
    if (!normalizedType || normalizedType === "REL") {
      for (const sql of relQueries) {
        queries.push({ sql, type: "rel" });
      }
    }

    let lastError: unknown = null;
    for (const query of queries) {
      try {
        const result = await runQuery(conn, query.sql);
        const normalizedRows = result.rows.map((row) => normalizePreviewRow(row));
        return {
          table,
          result: {
            columns: result.columns,
            rows: normalizedRows,
          },
        };
      } catch (error) {
        lastError = error;
      }
    }
    return {
      table,
      result: null,
      error: lastError instanceof Error ? lastError.message : String(lastError ?? "Unknown error"),
    };
  });
}

export function quoteIdentifier(identifier: string): string {
  return `\`${identifier.replace(/`/g, "``")}\``;
}

async function runQuery(conn: KuzuConnection, sql: string): Promise<QueryResult> {
  const queryResult = await conn.query(sql);
  try {
    let columns: string[] = [];
    try {
      columns = await queryResult.getColumnNames();
    } catch (error) {
      logWarning(KUZU_LOG_CONTEXT, "Failed to get column names", { error, sql });
    }
    const rows: QueryRow[] = await queryResult.getAllObjects();
    if (columns.length === 0 && rows.length > 0) {
      columns = Object.keys(rows[0]);
    }
    return { columns, rows };
  } finally {
    try {
      await queryResult.close();
    } catch (error) {
      logWarning(KUZU_LOG_CONTEXT, "Failed to close query result", { error, sql });
    }
  }
}

function resolveTableName(row: QueryRow): string {
  const candidates = ["tableName", "name", "TABLE_NAME", "table", "id"];
  for (const key of candidates) {
    const value = row[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  const firstKey = Object.keys(row)[0];
  const value = firstKey ? row[firstKey] : undefined;
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return "UnknownTable";
}

function resolveTableType(row: QueryRow): string | undefined {
  const candidates = ["tableType", "type", "TABLE_TYPE", "category"];
  for (const key of candidates) {
    const value = row[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

function buildFallbackTables(): TableInfo[] {
  const tables: TableInfo[] = [];
  for (const query of FIRST_RUN_QUERIES) {
    const trimmed = query.trim();
    if (/^CREATE\s+NODE\s+TABLE/i.test(trimmed)) {
      const name = extractTableName(trimmed);
      if (name) {
        tables.push({
          name,
          type: "NODE",
          raw: { tableName: name, type: "NODE" },
          columns: parseTableColumns(trimmed),
        });
      }
    } else if (/^CREATE\s+REL\s+TABLE/i.test(trimmed)) {
      const name = extractTableName(trimmed);
      if (name) {
        tables.push({
          name,
          type: "REL",
          raw: { tableName: name, type: "REL" },
          columns: parseTableColumns(trimmed),
        });
      }
    }
  }
  return tables;
}

function extractTableName(query: string): string | null {
  const match = query.match(/TABLE\s+([A-Za-z0-9_]+)/i);
  return match ? match[1] : null;
}

function parseTableColumns(createStatement: string): Array<{ name: string; type: string }> {
  const match = createStatement.match(/\((.*)\)/s);
  if (!match) return [];
  const inside = match[1];
  const segments = inside.split(",").map((segment) => segment.trim());
  const columns: Array<{ name: string; type: string }> = [];
  for (const segment of segments) {
    if (!segment || /^PRIMARY\s+KEY/i.test(segment)) {
      continue;
    }
    const tokens = segment.split(/\s+/);
    if (tokens.length >= MIN_COLUMN_TOKENS) {
      const [name, ...typeTokens] = tokens;
      columns.push({ name, type: typeTokens.join(" ") });
    }
  }
  return columns;
}

function normalizeTableName(name: string): string {
  return name.trim().toLowerCase();
}

function tableToStorageShape(table: TableInfo) {
  return {
    name: table.name,
    type: table.type,
    columns: table.columns,
  };
}

function writeFallbackTables(tables: TableInfo[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      KUZU_FALLBACK_TABLES_KEY,
      JSON.stringify(tables.map(tableToStorageShape))
    );
  } catch (error) {
    logWarning(KUZU_LOG_CONTEXT, "Failed to write fallback tables", { error });
  }
}

function storeFallbackTables(tables: TableInfo[]) {
  if (!Array.isArray(tables) || tables.length === 0) {
    writeFallbackTables([]);
    return;
  }

  try {
    const existing = loadFallbackTables();
    const merged = new Map<string, TableInfo>();

    for (const table of existing) {
      merged.set(normalizeTableName(table.name), table);
    }

    for (const table of tables) {
      merged.set(normalizeTableName(table.name), {
        name: table.name,
        type: table.type,
        raw: table.raw,
        columns: table.columns,
      });
    }

    writeFallbackTables(Array.from(merged.values()));
  } catch (error) {
    logWarning(KUZU_LOG_CONTEXT, "Failed to store fallback tables", { error });
  }
}

function replaceFallbackTables(tables: TableInfo[]) {
  writeFallbackTables(tables);
}

function loadFallbackTables(): TableInfo[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KUZU_FALLBACK_TABLES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || !item.name) return null;
        const name = String(item.name);
        const type = item.type ? String(item.type) : undefined;
        return {
          name,
          type,
          raw: { tableName: name, type },
          columns: Array.isArray(item.columns)
            ? item.columns
                .map((column: unknown) => {
                  if (!column || typeof column !== "object") {
                    return null;
                  }
                  const columnRecord = column as Record<string, unknown>;
                  const columnName = columnRecord.name;
                  if (typeof columnName !== "string" || columnName.length === 0) {
                    return null;
                  }
                  const columnType = columnRecord.type;
                  return {
                    name: columnName,
                    type: typeof columnType === "string" ? columnType : "",
                  };
                })
                .filter(Boolean)
            : undefined,
        } as TableInfo;
      })
      .filter((entry): entry is TableInfo => Boolean(entry));
  } catch (error) {
    logWarning(KUZU_LOG_CONTEXT, "Failed to load fallback tables", { error });
    return [];
  }
}

function findFallbackTable(name: string): TableInfo | undefined {
  const target = normalizeTableName(name);
  return loadFallbackTables().find((table) => normalizeTableName(table.name) === target);
}

function removeFallbackTable(name: string) {
  try {
    const existing = loadFallbackTables();
    const filtered = existing.filter(
      (table) => normalizeTableName(table.name) !== normalizeTableName(name)
    );
    writeFallbackTables(filtered);
  } catch (error) {
    logWarning(KUZU_LOG_CONTEXT, "Failed to remove fallback table", { error, name });
  }
}

export function applyDdlStatementToCache(statement: string) {
  const statements = statement
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  for (const part of statements) {
    if (/^CREATE\s+(?:NODE|REL)\s+TABLE/i.test(part)) {
      const name = extractTableName(part);
      if (!name) {
        continue;
      }
      const isRel = /^CREATE\s+REL\s+TABLE/i.test(part);
      const table: TableInfo = {
        name,
        type: isRel ? "REL" : "NODE",
        raw: { tableName: name, type: isRel ? "REL" : "NODE" },
        columns: parseTableColumns(part),
      };
      storeFallbackTables([table]);
      continue;
    }

    if (/^DROP\s+TABLE/i.test(part)) {
      const name = extractTableName(part);
      if (!name) {
        continue;
      }
      removeFallbackTable(name);
      continue;
    }

    if (/^ALTER\s+TABLE/i.test(part)) {
      const name = extractTableName(part);
      if (!name) {
        continue;
      }
      removeFallbackTable(name);
    }
  }
}

export function getCachedTables(): TableInfo[] {
  return loadFallbackTables();
}


function normalizePreviewRow(row: QueryRow): QueryRow {
  const normalized: QueryRow = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[key] = normalizePreviewValue(value);
  }
  return normalized;
}

function normalizePreviewValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizePreviewValue(item));
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;

    if ("value" in obj && Object.keys(obj).length === 1) {
      return normalizePreviewValue(obj.value);
    }

    if ("_properties" in obj) {
      const result: Record<string, unknown> = {};
      result.properties = normalizePreviewValue(obj._properties);
      if ("_src" in obj) {
        result.source = normalizePreviewValue(obj._src);
      }
      if ("_dst" in obj) {
        result.target = normalizePreviewValue(obj._dst);
      }
      if ("_id" in obj) {
        result.id = normalizePreviewValue(obj._id);
      }
      if (Object.keys(result).length === 1 && "properties" in result) {
        return result.properties;
      }
      return result;
    }

    const plain: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(obj)) {
      plain[key.replace(/^_/, "")] = normalizePreviewValue(nested);
    }
    if (Object.keys(plain).length > 0) {
      return plain;
    }
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

function extractString(value: unknown, depth = 0): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return value.length > 0 ? value : null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (depth > MAX_STRING_EXTRACTION_DEPTH) {
    return null;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const resolved = extractString(entry, depth + 1);
      if (resolved) {
        return resolved;
      }
    }
    return null;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;

    if ("value" in record) {
      const nested = extractString(record.value, depth + 1);
      if (nested) {
        return nested;
      }
    }

    if ("name" in record) {
      const nested = extractString(record.name, depth + 1);
      if (nested) {
        return nested;
      }
    }

    for (const entry of Object.values(record)) {
      const nested = extractString(entry, depth + 1);
      if (nested) {
        return nested;
      }
    }

    const stringLike = extractStringFromObject(record);
    if (stringLike) {
      return stringLike;
    }
  }

  return null;
}

function extractStringFromObject(value: Record<string, unknown>): string | null {
  const jsonCandidate = (value as { toJSON?: () => unknown }).toJSON;
  if (typeof jsonCandidate === "function") {
    const jsonResult = jsonCandidate.call(value);
    if (typeof jsonResult === "string" && jsonResult.length > 0 && jsonResult !== "[object Object]") {
      return jsonResult;
    }
  }

  const stringCandidate = (value as { toString?: () => unknown }).toString;
  if (typeof stringCandidate === "function") {
    const strResult = stringCandidate.call(value);
    if (typeof strResult === "string" && strResult.length > 0 && strResult !== "[object Object]") {
      return strResult;
    }
  }

  return null;
}

function extractCount(rows: QueryRow[]): number {
  if (!rows || rows.length === 0) return 0;
  const row = rows[0];
  const candidates = ["count", "COUNT", "total", "value"];
  for (const key of candidates) {
    const value = row[key];
    if (typeof value === "number") return value;
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  const firstValue = Object.values(row)[0];
  const parsed = Number(firstValue);
  return Number.isNaN(parsed) ? 0 : parsed;
}



async function runLabelQuery(conn: KuzuConnection): Promise<QueryResult> {
  try {
    const result = await runQuery(
      conn,
      `MATCH (n)
       WITH labels(n) AS labelsVec
       WHERE labelsVec IS NOT NULL AND labelsVec <> []
       RETURN DISTINCT labelsVec`
    );

    if (!result.rows || result.rows.length === 0) {
      return { columns: ["tableName"], rows: [] };
    }

    const rows: QueryRow[] = [];
    for (const row of result.rows) {
      const labelsVec = row.labelsVec ?? row["labelsVec"] ?? row["labels(n)"];
      if (Array.isArray(labelsVec)) {
        for (const label of labelsVec) {
          const name = extractString(label);
          if (name) {
            rows.push({ tableName: name });
          }
        }
      } else {
        const name = extractString(labelsVec);
        if (name) {
          rows.push({ tableName: name });
        }
      }
    }

    const unique = new Map<string, QueryRow>();
    for (const row of rows) {
      const name = extractString(row.tableName);
      if (name && !unique.has(name)) {
        unique.set(name, { tableName: name });
      }
    }

    return { columns: ["tableName"], rows: Array.from(unique.values()) };
  } catch (error) {
    logWarning(KUZU_LOG_CONTEXT, "runLabelQuery failed, returning empty result", { error });
    return { columns: ["tableName"], rows: [] };
  }
}

async function removeStaleDatabaseFile(kuzu: KuzuModule) {
  try {
    await kuzu.FS.unlink(KUZU_DB_PATH);
  } catch (error) {
    const { message, code, errno } = readErrorDetails(error);
    const isMissingFile =
      message.includes("No such file") ||
      code === ERROR_CODES.NO_ENTITY ||
      errno === ERROR_ERRNO.NO_ENTITY ||
      errno === ERROR_ERRNO.NO_ENTITY_NEGATIVE;
    if (!isMissingFile) {
      throw error;
    }
  }
}

async function ensureDirectory(kuzu: KuzuModule, path: string) {
  try {
    await kuzu.FS.mkdir(path);
  } catch (error) {
    if (!isExistsError(error)) {
      throw error;
    }
  }
}

async function remountIdbfs(kuzu: KuzuModule, path: string) {
  await safeUnmount(kuzu, path);
  try {
    await kuzu.FS.mountIdbfs(path);
  } catch (error) {
    if (isResourceBusy(error)) {
      await delay(FILESYSTEM_RETRY_DELAY_MS);
      await safeUnmount(kuzu, path, false);
      await kuzu.FS.mountIdbfs(path);
    } else {
      throw error;
    }
  }
}

async function syncFs(kuzu: KuzuModule, populate: boolean) {
  try {
    await kuzu.FS.syncfs(populate);
  } catch (error) {
    logWarning(KUZU_LOG_CONTEXT, "FS.syncfs failed", { error, populate });
  }
}

async function safeUnmount(kuzu: KuzuModule, path: string, warn = true) {
  try {
    await kuzu.FS.unmount(path);
  } catch (error) {
    if (isNotMountedError(error)) {
      return;
    }
    if (isResourceBusy(error)) {
      if (warn) {
        logWarning(KUZU_LOG_CONTEXT, "Unmount busy, retrying", { path, error });
      }
      await delay(FILESYSTEM_RETRY_DELAY_MS);
      return safeUnmount(kuzu, path, false);
    }
    throw error;
  }
}

function readErrorDetails(error: unknown): { message: string; code: string; errno?: number } {
  const message = getErrorMessage(error);
  if (!error || typeof error !== "object") {
    return { message, code: "" };
  }
  const record = error as Record<string, unknown>;
  const code = typeof record.code === "string" ? record.code : "";
  const errno = typeof record.errno === "number" ? record.errno : undefined;
  return { message, code, errno };
}

function isExistsError(error: unknown): boolean {
  const { message, code, errno } = readErrorDetails(error);
  return (
    message.includes("File exists") ||
    code === ERROR_CODES.FILE_EXISTS ||
    errno === ERROR_ERRNO.FILE_EXISTS ||
    errno === ERROR_ERRNO.FILE_EXISTS_NEGATIVE ||
    errno === ERROR_ERRNO.NOT_A_DIRECTORY
  );
}

function isNotMountedError(error: unknown): boolean {
  const { message, code, errno } = readErrorDetails(error);
  return (
    message.includes("not mounted") ||
    message.includes("No such device") ||
    message.includes("No mount point") ||
    message.includes("Invalid argument") ||
    code === ERROR_CODES.INVALID_ARGUMENT ||
    code === ERROR_CODES.NO_ENTITY ||
    errno === ERROR_ERRNO.NO_SPACE ||
    errno === ERROR_ERRNO.NO_SPACE_NEGATIVE ||
    errno === ERROR_ERRNO.NO_ENTITY ||
    errno === ERROR_ERRNO.NO_ENTITY_NEGATIVE
  );
}

function isResourceBusy(error: unknown): boolean {
  const { message, code, errno } = readErrorDetails(error);
  return (
    message.includes("Resource busy") ||
    code === ERROR_CODES.RESOURCE_BUSY ||
    errno === ERROR_ERRNO.RESOURCE_BUSY ||
    errno === ERROR_ERRNO.RESOURCE_BUSY_NEGATIVE
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const kuzuPaths = {
  dir: KUZU_DB_DIR,
  db: KUZU_DB_PATH,
};
