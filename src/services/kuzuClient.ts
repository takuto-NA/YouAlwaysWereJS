/**
 * KuzuDB WebAssembly クライアント
 *
 * @description
 * KuzuグラフデータベースのWASM版をブラウザ内で実行し、
 * AIエージェントの長期記憶として機能させる。
 * IndexedDB経由でデータを永続化し、ファイルシステム操作を直列化することで
 * 並行アクセスによる競合状態を防ぐ。
 *
 * @why
 * - KuzuDB WASMの複雑な初期化/クリーンアップをカプセル化し、安定したAPIを提供
 * - 複数のAI Tool呼び出しが並行実行されてもファイルシステム競合を防ぐため直列化
 * - メモリID自動採番により、AIエージェントが簡単に記憶を追加できるようにする
 * - IndexedDBによるブラウザ永続化で、リロード後もデータを保持
 *
 * @see https://kuzudb.com/ - KuzuDB公式ドキュメント
 */
import { logDebug, logWarning, getErrorMessage } from "../utils/errorHandler";

/**
 * KuzuDB関連のパス定数
 * WASMファイルとデータベースディレクトリの配置を一箇所で管理
 */
const KUZU_DB_DIR = "/database";
const KUZU_DB_PATH = `${KUZU_DB_DIR}/persistent.db`;
const KUZU_WORKER_PATH = "/kuzu-wasm/kuzu_wasm_worker.js";
const KUZU_MODULE_PATH = "/kuzu-wasm/index.js";
const BASE_PATH = import.meta.env?.BASE_URL ?? "/";

/**
 * 動作設定定数
 */
const KUZU_LOG_CONTEXT = "KuzuClient";
/** ファイルシステム操作リトライ時の待機時間（ミリ秒） */
const FILESYSTEM_RETRY_DELAY_MS = 50;
/** クエリ結果から文字列を抽出する際の最大再帰深度 */
const MAX_STRING_EXTRACTION_DEPTH = 5;
/** テーブルプレビュー時のデフォルト行数制限 */
const DEFAULT_PREVIEW_LIMIT = 25;
/** カラム名分割時の最小トークン数 */
const MIN_COLUMN_TOKENS = 2;
/** Memoryノードの最大ID取得クエリ */
const MEMORY_MAX_ID_QUERY = "MATCH (m:Memory) RETURN COALESCE(MAX(m.id), 0) AS maxId";
/** AIエージェントが自動ID採番を要求する際のプレースホルダー */
const AUTO_MEMORY_ID_PLACEHOLDER = "__AUTO_MEMORY_ID__";
/** Memory ID増分値 */
const MEMORY_ID_INCREMENT = 1;

/**
 * KuzuDB WASMファイルシステムインターフェース
 * Emscripten FSを通じてIndexedDBに永続化
 */
interface KuzuFileSystem {
  mkdir(path: string): Promise<void>;
  unlink(path: string): Promise<void>;
  mountIdbfs(path: string): Promise<void>;
  syncfs(populate: boolean): Promise<void>;
  unmount(path: string): Promise<void>;
  writeFile?(path: string, content: string): Promise<void>;
}

/**
 * KuzuDBデータベースインスタンス
 */
interface KuzuDatabase {
  close(): Promise<void>;
}

/**
 * Kuzuクエリ結果ハンドル
 */
interface KuzuQueryResultHandle {
  getColumnNames(): Promise<string[]>;
  getAllObjects(): Promise<QueryRow[]>;
  close(): Promise<void>;
}

/**
 * Kuzuデータベース接続
 */
interface KuzuConnection {
  query(sql: string): Promise<KuzuQueryResultHandle>;
  close(): Promise<void>;
}

/**
 * KuzuDB WASMモジュール
 */
interface KuzuModule {
  Database: new (path: string) => KuzuDatabase;
  Connection: new (db: KuzuDatabase) => KuzuConnection;
  FS: KuzuFileSystem;
  setWorkerPath?(path: string): void;
}

/**
 * Kuzu実行コンテキスト
 * モジュール、DB、接続の3点セットを保持
 */
interface KuzuExecutionContext {
  kuzu: KuzuModule;
  db: KuzuDatabase;
  conn: KuzuConnection;
}

/**
 * ファイルシステムエラーコード（文字列形式）
 * EmscriptenのErrnoに対応
 */
const ERROR_CODES = {
  FILE_EXISTS: "EEXIST",
  INVALID_ARGUMENT: "EINVAL",
  NO_ENTITY: "ENOENT",
  RESOURCE_BUSY: "EBUSY",
} as const;

/**
 * ファイルシステムエラー番号（数値形式）
 * ブラウザ環境でのエラー判定に使用
 */
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

/** localStorageでデモデータ初期化済みフラグを保存するキー */
export const KUZU_DEMO_FLAG = "kuzuDemoInitialized";
/** テーブル一覧のフォールバックデータを保存するキー */
const KUZU_FALLBACK_TABLES_KEY = "kuzuFallbackTables";

/**
 * デモ用CSVシードデータ
 * 初回起動時にグラフDBの動作を確認するためのサンプルデータ
 */
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

/**
 * デモデータベース初期化クエリ
 * User/Cityノードテーブル、Follows/LivesIn関係テーブルを作成し、CSVからデータをロード
 */
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

/** クエリ結果の1行を表す型 */
export type QueryRow = Record<string, unknown>;

/**
 * クエリ実行結果
 */
export interface QueryResult {
  /** カラム名配列 */
  columns: string[];
  /** 結果行配列 */
  rows: QueryRow[];
}

/**
 * テーブル情報
 */
export interface TableInfo {
  /** テーブル名 */
  name: string;
  /** テーブルタイプ（NODE/REL等） */
  type?: string;
  /** 生のクエリ結果行 */
  raw: QueryRow;
  /** カラム情報配列 */
  columns?: Array<{ name: string; type: string }>;
}

/**
 * テーブルスキーマ情報
 */
export interface TableSchema {
  /** テーブル基本情報 */
  table: TableInfo;
  /** カラム定義結果 */
  columns: QueryResult;
}

/**
 * テーブルプレビュー結果
 */
export interface TablePreview {
  /** テーブル基本情報 */
  table: TableInfo;
  /** プレビューデータ */
  result: QueryResult | null;
  /** エラーメッセージ（エラー時のみ） */
  error?: string;
}

/**
 * デモデータシード時のオプション
 */
export interface SeedDemoOptions {
  /** キャンセル用AbortSignal */
  signal?: AbortSignal;
  /** ログ出力コールバック */
  onLog?: (message: string) => void;
  /** 既存のKuzuインスタンス（省略時は自動ロード） */
  kuzuInstance?: KuzuModule;
}

/**
 * グローバル状態管理
 * WASMモジュールのシングルトン化と操作の直列化を実現
 */
let kuzuModulePromise: Promise<KuzuModule> | null = null;
/** カタログプロシージャのサポート状況キャッシュ */
let catalogProceduresSupported: boolean | null = null;
/** ファイルシステム操作の直列化キュー（並行アクセス防止） */
let operationQueue: Promise<void> = Promise.resolve();

/**
 * ブラウザ環境であることを確認
 *
 * @throws {Error} Node.js等のサーバー環境で実行された場合
 * @why WASM + IndexedDBはブラウザ専用のため、早期にエラーを出して誤用を防ぐ
 */
function ensureBrowserEnvironment() {
  if (typeof window === "undefined") {
    throw new Error("Kuzu WASM client requires a browser environment.");
  }
}

/**
 * 相対パスから絶対URLを解決
 *
 * @param relativePath - 相対パス
 * @returns 完全修飾URL
 * @why Viteのベースパスやデプロイ先URLに応じて、正しいアセットURLを構築するため
 */
function resolveAssetUrl(relativePath: string): string {
  const normalized = relativePath.startsWith("/") ? relativePath.slice(1) : relativePath;
  const base = BASE_PATH.endsWith("/") ? BASE_PATH : `${BASE_PATH}/`;
  if (typeof window === "undefined") {
    return `${base}${normalized}`;
  }
  return new URL(`${base}${normalized}`, window.location.origin).href;
}

/**
 * KuzuDB WASMモジュールをロード
 *
 * @returns KuzuModuleインスタンス
 * @throws {Error} ブラウザ環境でない場合
 *
 * @why シングルトンパターンで複数回のロードを防ぎ、メモリとロード時間を節約
 */
export async function loadKuzuModule(): Promise<KuzuModule> {
  ensureBrowserEnvironment();
  // 既にロード済みの場合は同じPromiseを返してシングルトン化
  if (!kuzuModulePromise) {
    kuzuModulePromise = (async () => {
      const moduleUrl = resolveAssetUrl(KUZU_MODULE_PATH);
      const importedModule: unknown = await import(/* @vite-ignore */ moduleUrl);
      const kuzuCandidate =
        (importedModule as { default?: KuzuModule }).default ?? (importedModule as KuzuModule);
      const kuzu = kuzuCandidate as KuzuModule;
      // Workerパスを設定してマルチスレッド処理を有効化
      if (typeof kuzu.setWorkerPath === "function") {
        kuzu.setWorkerPath(resolveAssetUrl(KUZU_WORKER_PATH));
      }
      return kuzu;
    })();
  }
  return kuzuModulePromise;
}

/**
 * KuzuDB接続を確立してタスクを実行
 *
 * @template T タスクの戻り値の型
 * @param task 実行するタスク関数
 * @returns タスクの実行結果
 *
 * @why
 * - ファイルシステム操作を直列化し、並行アクセスによる競合状態を防ぐ
 * - IndexedDBの同期（syncfs）を自動化し、確実にデータを永続化
 * - 接続/DBのクリーンアップをfinallyで保証し、リソースリークを防ぐ
 */
export async function runWithConnection<T>(task: (ctx: KuzuExecutionContext) => Promise<T>): Promise<T> {
  // 前の操作が完了するまで待機することで直列化を実現
  const resultPromise = operationQueue.catch(() => undefined).then(async () => {
    const kuzu = await loadKuzuModule();
    await ensureDirectory(kuzu, KUZU_DB_DIR);
    await remountIdbfs(kuzu, KUZU_DB_DIR);
    // IndexedDBからWASMファイルシステムにデータを読み込む
    await syncFs(kuzu, true);

    const db = new kuzu.Database(KUZU_DB_PATH);
    const conn = new kuzu.Connection(db);

    try {
      return await task({ kuzu, db, conn });
    } finally {
      // エラーが発生してもリソースを確実に解放
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

      // WASMファイルシステムからIndexedDBに変更を書き戻す
      await syncFs(kuzu, false);
      await safeUnmount(kuzu, KUZU_DB_DIR);
    }
  });

  // 次の操作のために、このPromiseをキューに追加
  operationQueue = resultPromise
    .then(() => undefined)
    .catch(() => undefined);

  return resultPromise;
}

/**
 * 正規化されたCypherステートメント
 */
export interface NormalizedCypherStatement {
  /** 正規化後のステートメント */
  statement: string;
  /** 書き換えが行われたかどうか */
  didRewrite: boolean;
  /** 自動メモリID採番のプレースホルダー数 */
  autoMemoryIdPlaceholders?: number;
}

/**
 * クエリ実行オプション
 */
interface ExecuteQueryOptions {
  /** Cypher正規化をスキップするか */
  skipNormalization?: boolean;
  /** 自動メモリID採番のプレースホルダー数 */
  autoMemoryIdPlaceholders?: number;
}

/**
 * Cypherクエリを実行
 *
 * @param sql Cypherクエリ文字列
 * @param options 実行オプション
 * @returns クエリ実行結果
 *
 * @why
 * - Cypher構文をKuzu互換形式に自動変換し、AIエージェントが標準Cypherで記述できるようにする
 * - `__AUTO_MEMORY_ID__`プレースホルダーを自動採番に置換し、AIが簡単に記憶を追加できるようにする
 */
export async function executeQuery(
  sql: string,
  options: ExecuteQueryOptions = {}
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

    const placeholderCount =
      options.autoMemoryIdPlaceholders ?? normalization.autoMemoryIdPlaceholders ?? 0;

    let statementToRun = normalization.statement;
    if (placeholderCount > 0) {
      statementToRun = await injectAutoMemoryIds(
        conn,
        normalization.statement,
        placeholderCount
      );
    }

    return runQuery(conn, statementToRun);
  });
}

// Ensures Memory nodes receive primary keys even when callers forget to supply them.
async function injectAutoMemoryIds(
  conn: KuzuConnection,
  statement: string,
  placeholderCount: number
): Promise<string> {
  if (placeholderCount <= 0) {
    return statement;
  }

  const result = await runQuery(
    conn,
    MEMORY_MAX_ID_QUERY
  );

  const firstRow = result.rows[0] ?? {};
  const rawValue =
    typeof firstRow.maxId === "number"
      ? firstRow.maxId
      : typeof firstRow.maxId === "string"
      ? Number(firstRow.maxId)
      : Number(firstRow[Object.keys(firstRow)[0] ?? ""] ?? 0);

  const baseMax = Number.isFinite(rawValue) ? Number(rawValue) : 0;
  let nextId = baseMax + 1;
  let replacements = 0;

  const rewritten = statement.replace(new RegExp(AUTO_MEMORY_ID_PLACEHOLDER, "g"), () => {
    replacements += 1;
    const value = nextId;
    nextId += MEMORY_ID_INCREMENT;
    return String(value);
  });

  if (replacements !== placeholderCount) {
    logDebug(KUZU_LOG_CONTEXT, "Auto memory id placeholder mismatch", {
      expected: placeholderCount,
      actual: replacements,
    });
  }

  return rewritten;
}

export function normalizeCypherStatement(statement: string): NormalizedCypherStatement {
  const { masked, literals } = maskStringLiterals(statement);
  let didRewrite = false;
  let autoMemoryIdPlaceholders = 0;

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

  const MEMORY_CREATE_REGEX =
    /CREATE\s*\(\s*(?<alias>[A-Za-z_][\w]*)?\s*(?::\s*(?<labels>[A-Za-z_][\w]*(?:\s*:\s*[A-Za-z_][\w]*)*))\s*\{(?<props>[\s\S]*?)\}\s*\)/gi;

  transformed = transformed.replace(
    MEMORY_CREATE_REGEX,
    (fullMatch, _alias, labels: string | undefined, props: string | undefined) => {
      const labelList =
        labels
          ?.split(":")
          .map((label) => label.trim().toLowerCase())
          .filter((label) => label.length > 0) ?? [];

      if (!labelList.includes("memory")) {
        return fullMatch;
      }

      const propertyBlock = props ?? "";
      if (/\bid\s*:/.test(propertyBlock)) {
        return fullMatch;
      }

      didRewrite = true;
      autoMemoryIdPlaceholders += 1;

      const beforeProps = fullMatch.slice(0, fullMatch.indexOf("{") + 1);
      const afterProps = fullMatch.slice(fullMatch.lastIndexOf("}"));
      const trimmedProps = propertyBlock.trim();
      const idProperty = `id: ${AUTO_MEMORY_ID_PLACEHOLDER}`;
      const newProps = trimmedProps.length > 0 ? `${idProperty}, ${trimmedProps}` : idProperty;

      return `${beforeProps}${newProps}${afterProps}`;
    }
  );

  const restored = restoreStringLiterals(transformed, literals);
  if (restored === statement) {
    return {
      statement,
      didRewrite: false,
      autoMemoryIdPlaceholders,
    };
  }
  return {
    statement: restored,
    didRewrite,
    autoMemoryIdPlaceholders,
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

/**
 * データベース内の全テーブルを一覧取得
 *
 * @returns テーブル情報配列
 *
 * @why
 * - 複数の取得方法を試行し、Kuzuバージョン互換性を確保
 * - localStorageにフォールバックキャッシュを保存し、一時的なエラーでもテーブル一覧を表示
 * - AIエージェントがデータベーススキーマを理解し、適切なクエリを生成できるようにする
 */
export async function listTables(): Promise<TableInfo[]> {
  return runWithConnection(async ({ conn }) => {
    // 最新のKuzuバージョン: SHOW_TABLES()プロシージャを使用
    const resultFromShow = await tryShowTables(conn);
    if (resultFromShow) {
      replaceFallbackTables(resultFromShow);
      return resultFromShow;
    }

    // 古いバージョン: NODE/REL別のプロシージャを使用
    const resultFromNodeRel = await tryNodeRelTables(conn);
    if (resultFromNodeRel.length > 0) {
      replaceFallbackTables(resultFromNodeRel);
      return resultFromNodeRel;
    }

    // プロシージャが使えない場合: localStorageキャッシュから復元
    const fallback = loadFallbackTables();
    if (fallback.length > 0) {
      return fallback;
    }

    // 最終手段: ラベルスキャンで取得
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
    // リレーションシップタイプを取得（複数の構文を試す）
    const relQueries = [
      // 戦略1: label()関数を使う（ノードと同じ）
      `MATCH ()-[r]->()
       RETURN DISTINCT label(r) AS tableName
       ORDER BY tableName`,
      // 戦略2: type()関数を使う（古い構文）
      `MATCH ()-[r]->()
       WITH DISTINCT type(r) AS relType
       WHERE relType IS NOT NULL AND relType <> ''
       RETURN relType AS tableName
       ORDER BY tableName`,
    ];

    for (const query of relQueries) {
      try {
        relResult = await runQuery(conn, query);
        if (relResult.rows && relResult.rows.length > 0) {
          logDebug(KUZU_LOG_CONTEXT, "Retrieved relationship types", {
            count: relResult.rows.length,
          });
          break;
        }
      } catch (error) {
        logDebug(KUZU_LOG_CONTEXT, "Failed to list rel types with query", { query, error });
        continue;
      }
    }

    if (!relResult || relResult.rows.length === 0) {
      logWarning(KUZU_LOG_CONTEXT, "Failed to list rel types, falling back to nodes only");
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

/**
 * テーブルのスキーマ（カラム定義）を取得
 *
 * @param table テーブル情報
 * @returns テーブルスキーマ（カラム名と型）
 *
 * @why
 * - AIエージェントが各テーブルの構造を理解し、正しいクエリを生成できるようにする
 * - エラー時はlocalStorageキャッシュから復元し、可用性を向上
 */
export async function describeTable(table: TableInfo): Promise<TableSchema> {
  return runWithConnection(async ({ conn }) => {
    // 複数の構文を試す（Kuzuのバージョンによって異なる）
    const queries = [
      // 最新のKuzu: CALL構文
      `CALL TABLE_INFO('${table.name}')`,
      // 代替構文
      `CALL SHOW_COLUMNS('${table.name}')`,
      // 古いバージョン: DESCRIBE構文（サポートされていない可能性あり）
      `DESCRIBE TABLE ${quoteIdentifier(table.name)}`,
    ];

    for (const sql of queries) {
      try {
        const columns = await runQuery(conn, sql);
        if (columns.rows && columns.rows.length > 0) {
          return { table, columns };
        }
      } catch (error) {
        // 次の構文を試す
        logDebug(KUZU_LOG_CONTEXT, `Failed to describe table with: ${sql}`, { error });
        continue;
      }
    }

    // すべての構文が失敗した場合、フォールバックキャッシュから復元
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

    // フォールバックも失敗した場合、エラーをスロー
    throw new Error(`Failed to describe table: ${table.name}. No supported syntax found.`);
  });
}

/**
 * テーブルの内容をプレビュー取得
 *
 * @param table テーブル情報
 * @param limit 取得する最大行数
 * @returns テーブルプレビュー結果
 *
 * @why AIエージェントがデータの実例を確認し、適切なクエリを組み立てられるようにする
 */
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
  // 複数の戦略を試す: labels()関数は一部のDBで型変換エラーを起こすため、
  // より単純なクエリから試す

  // 戦略1: label()関数で個別にラベルを取得（配列ではなく単一の文字列）
  try {
    const result = await runQuery(
      conn,
      `MATCH (n)
       RETURN DISTINCT label(n) AS tableName
       ORDER BY tableName`
    );

    if (result.rows && result.rows.length > 0) {
      logDebug(KUZU_LOG_CONTEXT, "Retrieved node labels using label() function", {
        count: result.rows.length,
      });
      return { columns: ["tableName"], rows: result.rows };
    }
  } catch (error) {
    // label()が使えない場合は次の戦略へ
    logDebug(KUZU_LOG_CONTEXT, "label() function not available", { error });
  }

  // 戦略2: labels()関数を使った従来の方法（配列処理）
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

/**
 * データベースを完全にクリアする
 *
 * @description
 * IndexedDBからKuzuデータベースファイルを削除し、
 * データを完全に初期化する。この操作は復元できない。
 *
 * @why
 * - ユーザーが全てのデータを削除したい場合に使用
 * - デモデータ初期化前にクリーンな状態にするため
 */
export async function clearDatabase(): Promise<void> {
  await queueOperation(async () => {
    const kuzu = await loadKuzuModule();

    // ディレクトリを確保
    await ensureDirectory(kuzu, KUZU_DB_DIR);
    await remountIdbfs(kuzu, KUZU_DB_DIR);

    // データベースファイルを削除
    await removeStaleDatabaseFile(kuzu);

    // IndexedDBに変更を同期
    await syncFs(kuzu, false);
    await safeUnmount(kuzu, KUZU_DB_DIR);

    // キャッシュもクリア
    window.localStorage.removeItem(KUZU_DEMO_FLAG);
    writeFallbackTables([]);
  });
}

/**
 * データベースをエクスポート
 *
 * @description
 * IndexedDBに保存されているKuzuデータベースディレクトリを
 * 圧縮してBlobとして取得し、ダウンロード可能にする。
 *
 * @returns データベースファイルのBlob
 *
 * @why
 * - ユーザーがデータをバックアップできるようにする
 * - 他のデバイスやブラウザにデータを移行できるようにする
 */
export async function exportDatabase(): Promise<Blob> {
  return queueOperation(async () => {
    const kuzu = await loadKuzuModule();

    // ディレクトリを確保してIndexedDBからデータを読み込む
    await ensureDirectory(kuzu, KUZU_DB_DIR);
    await remountIdbfs(kuzu, KUZU_DB_DIR);
    await syncFs(kuzu, true);

    // データベースディレクトリ全体を読み取る
    const dbFiles = await readDatabaseDirectory(kuzu);

    await safeUnmount(kuzu, KUZU_DB_DIR);

    logDebug(KUZU_LOG_CONTEXT, "Database exported", {
      fileCount: dbFiles.length,
      totalSize: dbFiles.reduce((sum: number, f: DatabaseFileEntry) => sum + f.data.length, 0),
    });

    // バイナリデータを直接Blobとして保存
    // SQLiteフォーマットなので、バイナリで保存する必要がある
    if (dbFiles.length !== 1) {
      throw new Error("Expected exactly one database file");
    }

    const dbFile = dbFiles[0];

    // バイナリデータのチェックサムを計算
    let dataChecksum = 0;
    for (let i = 0; i < dbFile.data.length; i++) {
      dataChecksum = (dataChecksum + dbFile.data[i]) % 0x100000000;
    }
    console.log("Export data checksum (original):", dataChecksum);

    // メタデータとバイナリデータを分離
    const metadata = {
      version: 1,
      exportDate: new Date().toISOString(),
      fileName: dbFile.path,
      fileSize: dbFile.data.length,
      checksum: dataChecksum, // チェックサムを追加
    };

    // メタデータをJSON文字列に変換
    const metadataJson = JSON.stringify(metadata);
    const metadataBytes = new TextEncoder().encode(metadataJson);

    // メタデータサイズ（4バイト）+ メタデータ + バイナリデータ
    const headerSize = new Uint32Array([metadataBytes.length]);
    const headerBytes = new Uint8Array(headerSize.buffer);

    // 結合: [4バイトのヘッダーサイズ] + [メタデータJSON] + [バイナリデータ]
    const combined = new Uint8Array(4 + metadataBytes.length + dbFile.data.length);
    combined.set(headerBytes, 0);
    combined.set(metadataBytes, 4);
    combined.set(dbFile.data, 4 + metadataBytes.length);

    // 結合後のバイナリ部分のチェックサムを確認
    let combinedChecksum = 0;
    const dataOffset = 4 + metadataBytes.length;
    for (let i = 0; i < dbFile.data.length; i++) {
      combinedChecksum = (combinedChecksum + combined[dataOffset + i]) % 0x100000000;
    }
    console.log("Export data checksum (in combined):", combinedChecksum);
    console.log("Checksums match after combining:", dataChecksum === combinedChecksum);

    return new Blob([combined], { type: "application/octet-stream" });
  });
}

/**
 * データベースをインポート
 *
 * @description
 * BlobからKuzuデータベースディレクトリを復元し、
 * IndexedDBに保存する。既存のデータは上書きされる。
 *
 * @param file インポートするデータベースファイル
 *
 * @why
 * - ユーザーがバックアップからデータを復元できるようにする
 * - 他のデバイスやブラウザからデータを移行できるようにする
 */
export async function importDatabase(file: Blob): Promise<void> {
  // Note: キャッシュクリアはインポート処理の最後に行う
  // インポート処理中は既存のkuzuインスタンスを使ってファイル操作を行い、
  // 完了後にキャッシュをクリアして次回アクセス時に新DBを読み込む

  await queueOperation(async () => {
    const kuzu = await loadKuzuModule();

    // バイナリデータを読み取る
    const arrayBuffer = await file.arrayBuffer();
    const dataView = new DataView(arrayBuffer);

    // ヘッダーサイズを読み取る（最初の4バイト）
    const metadataSize = dataView.getUint32(0, true); // little-endian

    // メタデータを読み取る
    const metadataBytes = new Uint8Array(arrayBuffer, 4, metadataSize);
    const metadataJson = new TextDecoder().decode(metadataBytes);
    const metadata = JSON.parse(metadataJson) as {
      version: number;
      exportDate: string;
      fileName: string;
      fileSize: number;
      checksum?: number;
    };

    logDebug(KUZU_LOG_CONTEXT, "Importing database", {
      version: metadata.version,
      exportDate: metadata.exportDate,
      fileName: metadata.fileName,
      fileSize: metadata.fileSize,
    });

    // バイナリデータを読み取る
    const dbData = new Uint8Array(arrayBuffer, 4 + metadataSize);

    if (dbData.length !== metadata.fileSize) {
      throw new Error(`File size mismatch: expected ${metadata.fileSize}, got ${dbData.length}`);
    }

    // Blob読み込み後のチェックサムを計算
    let blobChecksum = 0;
    for (let i = 0; i < dbData.length; i++) {
      blobChecksum = (blobChecksum + dbData[i]) % 0x100000000;
    }
    console.log("Import checksum (from blob):", blobChecksum);

    if (metadata.checksum !== undefined) {
      console.log("Expected checksum (from metadata):", metadata.checksum);
      console.log("Checksum match (blob vs metadata):", blobChecksum === metadata.checksum);

      if (blobChecksum !== metadata.checksum) {
        console.error("CRITICAL: Checksum mismatch detected!");
        console.error("This indicates data corruption during export or file read.");
      }
    }

    // ディレクトリを確保
    await ensureDirectory(kuzu, KUZU_DB_DIR);
    await remountIdbfs(kuzu, KUZU_DB_DIR);

    // 既存のデータベースを削除
    console.log("🗑️ Clearing existing database...");
    await clearDatabaseDirectory(kuzu);
    console.log("✅ Database cleared");

    // データの最初の16バイトをチェック（マジックナンバー）
    const header = Array.from(dbData.slice(0, 16));
    console.log("Imported database header (first 16 bytes):", header);
    console.log("Imported database header as string:", String.fromCharCode(...header.slice(0, 4)));

    // 新しいデータベースファイルを直接書き込む
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fs = kuzu.FS as any;
    const fullPath = `${KUZU_DB_DIR}/${metadata.fileName}`;

    console.log("📝 Writing new database file...");
    await fs.writeFile(fullPath, dbData);
    console.log("✅ File written");

    // 書き込んだデータのチェックサム
    let checksumBefore = 0;
    for (let i = 0; i < dbData.length; i++) {
      checksumBefore = (checksumBefore + dbData[i]) % 0x100000000;
    }
    console.log("Import checksum (before sync):", checksumBefore);

    logDebug(KUZU_LOG_CONTEXT, "Database file written directly", {
      path: metadata.fileName,
      size: dbData.length,
      header: header.slice(0, 4),
    });

    // IndexedDBに変更を同期
    await syncFs(kuzu, false);

    // 同期後、ファイルを読み戻してチェックサムを検証
    try {
      const readBackBuffer = await fs.readFile(fullPath);
      const readBackData = new Uint8Array(readBackBuffer);

      let checksumAfter = 0;
      for (let i = 0; i < readBackData.length; i++) {
        checksumAfter = (checksumAfter + readBackData[i]) % 0x100000000;
      }

      console.log("Import checksum (after sync, read back):", checksumAfter);
      console.log("Checksum match:", checksumBefore === checksumAfter);
      console.log("Size match:", dbData.length === readBackData.length);

      // 先頭100バイトを比較
      const first100Match = dbData.slice(0, 100).every((byte, i) => byte === readBackData[i]);
      console.log("First 100 bytes match:", first100Match);

      // 末尾100バイトを比較
      const last100Match = dbData.slice(-100).every((byte, i) => {
        const offset = readBackData.length - 100;
        return byte === readBackData[offset + i];
      });
      console.log("Last 100 bytes match:", last100Match);
    } catch (e) {
      console.error("Failed to read back imported file:", e);
    }

    await safeUnmount(kuzu, KUZU_DB_DIR);

    // フラグをクリア（インポートされたデータは不明なため）
    window.localStorage.removeItem(KUZU_DEMO_FLAG);

    logDebug(KUZU_LOG_CONTEXT, "Database imported successfully", {
      fileSize: dbData.length,
    });
  });

  // CRITICAL: インポート完了後にKuzuDBインスタンスキャッシュをクリア
  // ファイルは正しく書き込まれたが、メモリ内のDatabaseインスタンスは
  // まだ古いファイルを参照している。次回アクセス時に新しいDBを読み込むため、
  // ここでキャッシュをクリアする
  kuzuModulePromise = null;
  catalogProceduresSupported = null;
}

/**
 * データベースディレクトリ内のファイル情報
 */
interface DatabaseFileEntry {
  path: string;
  data: Uint8Array;
}

/**
 * データベースディレクトリ全体を読み取る（内部ヘルパー）
 *
 * 注: Emscripten FSにはreaddirがないため、IndexedDBから直接読み取る
 */
async function readDatabaseDirectory(kuzu: KuzuModule): Promise<DatabaseFileEntry[]> {
  // IndexedDBから直接データベースファイルを読み取る
  // Kuzuはpersistent.dbという単一ファイルを使用

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fs = kuzu.FS as any;

  const files: DatabaseFileEntry[] = [];

  try {
    // メインデータベースファイルを読み取る
    const dbFilePath = KUZU_DB_PATH;

    try {
      // fs.readFileは非同期でArrayBufferを返す
      const arrayBuffer = await fs.readFile(dbFilePath);
      const uint8Array = new Uint8Array(arrayBuffer);

      // データの最初の16バイトをチェック（マジックナンバー）
      const header = Array.from(uint8Array.slice(0, 16));
      console.log("Database header (first 16 bytes):", header);
      console.log("Database header as string:", String.fromCharCode(...header.slice(0, 4)));

      // チェックサムを計算（デバッグ用）
      let checksum = 0;
      for (let i = 0; i < uint8Array.length; i++) {
        checksum = (checksum + uint8Array[i]) % 0x100000000;
      }
      console.log("Export checksum:", checksum);

      logDebug(KUZU_LOG_CONTEXT, "Database file read successfully", {
        path: "persistent.db",
        size: uint8Array.length,
        header: header.slice(0, 4),
      });

      if (uint8Array.length > 0) {
        files.push({
          path: "persistent.db",
          data: uint8Array,
        });
      } else {
        throw new Error(`Database file is empty. Length: ${uint8Array.length}`);
      }
    } catch (error) {
      logWarning(KUZU_LOG_CONTEXT, "Failed to read database file", { error, path: dbFilePath });
      throw error;
    }

  } catch (error) {
    logWarning(KUZU_LOG_CONTEXT, "Failed to read database", { error });
    throw new Error(`Failed to export database: ${getErrorMessage(error)}`);
  }

  if (files.length === 0) {
    throw new Error("No database files found. Please ensure data has been saved to the database.");
  }

  logDebug(KUZU_LOG_CONTEXT, "Database files read successfully", {
    fileCount: files.length,
    totalSize: files.reduce((sum: number, f: DatabaseFileEntry) => sum + f.data.length, 0),
  });

  return files;
}

/**
 * データベースディレクトリをクリアする（内部ヘルパー）
 */
async function clearDatabaseDirectory(kuzu: KuzuModule): Promise<void> {
  // メインデータベースファイルを削除
  await removeStaleDatabaseFile(kuzu);
}


export const kuzuPaths = {
  dir: KUZU_DB_DIR,
  db: KUZU_DB_PATH,
};
