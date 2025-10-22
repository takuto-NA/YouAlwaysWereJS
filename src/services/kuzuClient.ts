const KUZU_DB_DIR = "/database";
const KUZU_DB_PATH = `${KUZU_DB_DIR}/persistent.db`;
const KUZU_WORKER_PATH = "/kuzu-wasm/kuzu_wasm_worker.js";
const KUZU_MODULE_PATH = "/kuzu-wasm/index.js";

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
  kuzuInstance?: any;
}

let kuzuModulePromise: Promise<any> | null = null;
let catalogProceduresSupported: boolean | null = null;
let catalogWarningLogged = false;
let operationQueue: Promise<void> = Promise.resolve();

function ensureBrowserEnvironment() {
  if (typeof window === "undefined") {
    throw new Error("Kuzu WASM client requires a browser environment.");
  }
}

export async function loadKuzuModule(): Promise<any> {
  ensureBrowserEnvironment();
  if (!kuzuModulePromise) {
    kuzuModulePromise = (async () => {
      const moduleUrl = new URL(KUZU_MODULE_PATH, window.location.origin).href;
      const module: any = await import(/* @vite-ignore */ moduleUrl);
      const kuzu = module.default ?? module;
      if (typeof kuzu.setWorkerPath === "function") {
        kuzu.setWorkerPath(KUZU_WORKER_PATH);
      }
      return kuzu;
    })();
  }
  return kuzuModulePromise;
}

export async function runWithConnection<T>(task: (ctx: { kuzu: any; db: any; conn: any }) => Promise<T>): Promise<T> {
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
        console.warn("[kuzuClient] Failed to close connection", error);
      }
      try {
        await db.close();
      } catch (error) {
        console.warn("[kuzuClient] Failed to close database", error);
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

export async function executeQuery(sql: string): Promise<QueryResult> {
  return runWithConnection(async ({ conn }) => {
    return runQuery(conn, sql);
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
      console.log("[kuzuClient] seedDemoData counts", {
        nodes: extractCount(checkNodes.rows),
        rels: extractCount(checkRels.rows),
      });
    } finally {
      try {
        await conn.close();
      } catch (error) {
        console.warn("[kuzuClient] Failed to close connection during seeding", error);
      }
      try {
        await db.close();
      } catch (error) {
        console.warn("[kuzuClient] Failed to close database during seeding", error);
      }
    }

    log("Syncing filesystem to IndexedDB...");
    await syncFs(kuzu, false);
    await safeUnmount(kuzu, KUZU_DB_DIR);
    log("Database persisted to IndexedDB.");

    const fallbackTables = buildFallbackTables();
    storeFallbackTables(fallbackTables);
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
      storeFallbackTables(resultFromShow);
      return resultFromShow;
    }

    const resultFromNodeRel = await tryNodeRelTables(conn);
    if (resultFromNodeRel.length > 0) {
      storeFallbackTables(resultFromNodeRel);
      return resultFromNodeRel;
    }

    const fallback = loadFallbackTables();
    if (fallback.length > 0) {
      return fallback;
    }

    const labelTables = await listTablesViaLabelScan(conn);
    if (labelTables.length > 0) {
      storeFallbackTables(labelTables);
      return labelTables;
    }

    return labelTables;
  });
}

async function tryShowTables(conn: any): Promise<TableInfo[] | null> {
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
    } catch (error) {
      catalogProceduresSupported = false;
      catalogWarningLogged = true;
    }
  }
  return null;
}

async function tryNodeRelTables(conn: any): Promise<TableInfo[]> {
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
  } catch (error) {
    catalogProceduresSupported = false;
    catalogWarningLogged = true;
  }
  return [];
}

async function listTablesViaLabelScan(conn: any): Promise<TableInfo[]> {
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
      console.warn("[kuzuClient] Failed to list rel types, falling back to nodes only", error);
    }
  }

  const map = new Map<string, TableInfo>();

  for (const row of nodeResult.rows) {
    const raw = (row as Record<string, unknown>).tableName;
    const rawString =
      raw && typeof raw === "object" && "toString" in (raw as Record<string, unknown>)
        ? (raw as { toString(): string }).toString()
        : raw;
    console.log("[kuzuClient] node label row", { row, typeofRaw: typeof raw, rawValue: raw, rawString });
    const name = extractString(row.tableName ?? row["tableName"]);
    if (!name) {
      console.warn("[kuzuClient] Unable to resolve node table name", row);
      continue;
    }
    map.set(name, { name, type: "NODE", raw: row });
  }

  if (relResult) {
    for (const row of relResult.rows) {
      const name = extractString(row.tableName ?? row["tableName"]);
      if (!name) {
        console.warn("[kuzuClient] Unable to resolve rel table name", row);
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
    console.log("[kuzuClient] No node labels discovered", {
      columns: nodeResult.columns,
      rows: nodeResult.rows,
    });
    if (relResult) {
      console.log("[kuzuClient] No rel types discovered", {
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

export async function previewTable(table: TableInfo, limit = 25): Promise<TablePreview> {
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

async function runQuery(conn: any, sql: string): Promise<QueryResult> {
  const queryResult = await conn.query(sql);
  try {
    let columns: string[] = [];
    try {
      columns = await queryResult.getColumnNames();
    } catch (error) {
      console.warn("[kuzuClient] Failed to get column names", { error, sql });
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
      console.warn("[kuzuClient] Failed to close query result", { error, sql });
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
    if (tokens.length >= 2) {
      const [name, ...typeTokens] = tokens;
      columns.push({ name, type: typeTokens.join(" ") });
    }
  }
  return columns;
}

function storeFallbackTables(tables: TableInfo[]) {
  if (typeof window === "undefined") return;
  if (!Array.isArray(tables) || tables.length === 0) return;
  try {
    const data = tables.map((table) => ({
      name: table.name,
      type: table.type,
      columns: table.columns,
    }));
    window.localStorage.setItem(KUZU_FALLBACK_TABLES_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn("[kuzuClient] Failed to store fallback tables", error);
  }
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
                .map((column: any) => {
                  if (!column || !column.name) return null;
                  return {
                    name: String(column.name),
                    type: column.type ? String(column.type) : "",
                  };
                })
                .filter(Boolean)
            : undefined,
        } as TableInfo;
      })
      .filter((entry): entry is TableInfo => Boolean(entry));
  } catch (error) {
    console.warn("[kuzuClient] Failed to load fallback tables", error);
    return [];
  }
}

function findFallbackTable(name: string): TableInfo | undefined {
  return loadFallbackTables().find((table) => table.name === name);
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
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    return value.length > 0 ? value : null;
  }
  if (depth > 5) {
    return null;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const resolved = extractString(entry, depth + 1);
      if (resolved) return resolved;
    }
    return null;
  }
  if (typeof value === "object") {
    if ("value" in (value as Record<string, unknown>)) {
      const nested = extractString((value as Record<string, unknown>).value, depth + 1);
      if (nested) return nested;
    }
    if ("name" in (value as Record<string, unknown>)) {
      const nested = extractString((value as Record<string, unknown>).name, depth + 1);
      if (nested) return nested;
    }
    for (const entry of Object.values(value as Record<string, unknown>)) {
      const nested = extractString(entry, depth + 1);
      if (nested) return nested;
    }
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "object" && typeof (value as any).toString === "function") {
    const str = (value as any).toString();
    if (typeof str === "string" && str.length > 0 && str !== "[object Object]") {
      return str;
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

async function firstSuccessfulQuery(conn: any, queries: string[]): Promise<QueryResult> {
  let lastError: unknown = null;
  for (const sql of queries) {
    try {
      const result = await runQuery(conn, sql);
      return result;
    } catch (error) {
      lastError = error;
      continue;
    }
  }
  if (lastError) {
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
  return { columns: [], rows: [] };
}

async function runLabelQuery(conn: any): Promise<QueryResult> {
  const result = await runQuery(
    conn,
    `MATCH (n)
     WITH labels(n) AS labelsVec
     WHERE labelsVec IS NOT NULL AND labelsVec <> []
     RETURN DISTINCT labelsVec`
  );

  if (!result.rows || result.rows.length === 0) {
    return result;
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
}

async function removeStaleDatabaseFile(kuzu: any) {
  try {
    await kuzu.FS.unlink(KUZU_DB_PATH);
  } catch (error: any) {
    const message = typeof error?.message === "string" ? error.message : "";
    if (!message.includes("No such file") && error?.code !== "ENOENT") {
      throw error;
    }
  }
}

async function ensureDirectory(kuzu: any, path: string) {
  try {
    await kuzu.FS.mkdir(path);
  } catch (error: any) {
    if (!isExistsError(error)) {
      throw error;
    }
  }
}

async function remountIdbfs(kuzu: any, path: string) {
  await safeUnmount(kuzu, path);
  try {
    await kuzu.FS.mountIdbfs(path);
  } catch (error: any) {
    if (isResourceBusy(error)) {
      await delay(50);
      await safeUnmount(kuzu, path, false);
      await kuzu.FS.mountIdbfs(path);
    } else {
      throw error;
    }
  }
}

async function syncFs(kuzu: any, populate: boolean) {
  try {
    await kuzu.FS.syncfs(populate);
  } catch (error) {
    console.warn("[kuzuClient] FS.syncfs failed", { error, populate });
  }
}

async function safeUnmount(kuzu: any, path: string, warn = true) {
  try {
    await kuzu.FS.unmount(path);
  } catch (error: any) {
    if (isNotMountedError(error)) {
      return;
    }
    if (isResourceBusy(error)) {
      if (warn) {
        console.warn("[kuzuClient] Unmount busy, retrying", { path, error });
      }
      await delay(50);
      return safeUnmount(kuzu, path, false);
    }
    throw error;
  }
}

function isExistsError(error: any): boolean {
  const message = typeof error?.message === "string" ? error.message : "";
  const code = typeof error?.code === "string" ? error.code : "";
  const errno = typeof error?.errno === "number" ? error.errno : undefined;
  return (
    message.includes("File exists") ||
    code === "EEXIST" ||
    errno === 17 ||
    errno === -17 ||
    errno === 20
  );
}

function isNotMountedError(error: any): boolean {
  const message = typeof error?.message === "string" ? error.message : "";
  const code = typeof error?.code === "string" ? error.code : "";
  const errno = typeof error?.errno === "number" ? error.errno : undefined;
  return (
    message.includes("not mounted") ||
    message.includes("No such device") ||
    message.includes("No mount point") ||
    message.includes("Invalid argument") ||
    code === "EINVAL" ||
    code === "ENOENT" ||
    errno === 28 ||
    errno === -28 ||
    errno === 2 ||
    errno === -2
  );
}

function isResourceBusy(error: any): boolean {
  const message = typeof error?.message === "string" ? error.message : "";
  const code = typeof error?.code === "string" ? error.code : "";
  const errno = typeof error?.errno === "number" ? error.errno : undefined;
  return message.includes("Resource busy") || code === "EBUSY" || errno === 16 || errno === -16;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const kuzuPaths = {
  dir: KUZU_DB_DIR,
  db: KUZU_DB_PATH,
};
