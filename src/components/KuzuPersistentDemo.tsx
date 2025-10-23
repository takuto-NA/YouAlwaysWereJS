/**
 * Demonstrates Kuzu persistence inside the developer UI.
 * Why it matters: this flow seeds or reuses the on-disk database so engineers can
 * verify long-running graph state while the app handles resets and aborts safely.
 */
import { useEffect, useRef, useState } from "react";
import { KUZU_DEMO_FLAG, seedDemoData, loadKuzuModule } from "../services/kuzuClient";
import { logDebug, logError, logWarning } from "../utils/errorHandler";

const DEMO_LOG_CONTEXT = "KuzuPersistentDemo";
const KUZU_DB_DIR = "/database";
const KUZU_DB_PATH = `${KUZU_DB_DIR}/persistent.db`;
const RUN_ABORTED_ERROR_MESSAGE = "RUN_ABORTED";
const RUN_MODE_FIRST: RunMode = "first-run";
const RUN_MODE_SUBSEQUENT: RunMode = "subsequent";
const RESOURCE_BUSY_CODE = "EBUSY";
const INVALID_ARGUMENT_CODE = "EINVAL";
const NO_ENTITY_CODE = "ENOENT";
const RESOURCE_BUSY_ERRNOS = new Set([16, -16]);
const NO_SPACE_ERRNOS = new Set([28, -28]);
const NO_ENTITY_ERRNOS = new Set([2, -2]);
const FALLBACK_IDB_DATABASE_NAMES = ["EM_FS_IDBFS", "kuzu", "kuzu-wasm"];
const FILE_EXISTS_CODE = "EEXIST";
const FILE_EXISTS_ERRNOS = new Set([17, -17, 20]);
const NOT_FOUND_ERROR_NAME = "NotFoundError";
const RESOURCE_RETRY_DELAY_MS = 50;

type RunMode = "first-run" | "subsequent";
type KuzuModuleInstance = Awaited<ReturnType<typeof loadKuzuModule>>;
type KuzuDatabaseInstance = InstanceType<KuzuModuleInstance["Database"]>;
type KuzuConnectionInstance = InstanceType<KuzuModuleInstance["Connection"]>;
type KuzuQueryHandle = Awaited<ReturnType<KuzuConnectionInstance["query"]>>;

class RunAbortedError extends Error {
  constructor() {
    super(RUN_ABORTED_ERROR_MESSAGE);
    this.name = "RunAbortedError";
  }
}

export default function KuzuPersistentDemo() {
  const [logLines, setLogLines] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [lastRunMode, setLastRunMode] = useState<RunMode | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [runToken, setRunToken] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;

    const appendLog = (line: string) => {
      if (cancelled || abortControllerRef.current?.signal.aborted) {
        return;
      }
      setLogLines((prev) => [...prev, line]);
    };

    const controller = new AbortController();
    abortControllerRef.current?.abort();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    const runDemo = async (abortSignal: AbortSignal) => {
      setIsRunning(true);
      setErrorMessage(null);
      setLogLines([]);
      setLastRunMode(null);

      try {
        checkAbort(abortSignal);
        const kuzu = await loadKuzuModule();

        checkAbort(abortSignal);
        const isFirstRun = window.localStorage.getItem(KUZU_DEMO_FLAG) !== "true";
        appendLog(
          isFirstRun
            ? "First run detected. Creating and seeding the database..."
            : "Existing database detected. Loading from persistent storage..."
        );

        const runMode = isFirstRun
          ? await performFirstRun(kuzu, appendLog, abortSignal)
          : await performSubsequentRun(kuzu, appendLog, abortSignal);

        if (!cancelled) {
          setLastRunMode(runMode);
        }

        checkAbort(abortSignal);
        appendLog("Done. You can refresh the page to observe persistence.");
      } catch (error) {
        if (isRunAbortedError(error)) {
          return;
        }
        const message = extractErrorMessage(error);
        if (!cancelled) {
          setErrorMessage(message);
          appendLog(`Error: ${message}`);
        }
        logError(DEMO_LOG_CONTEXT, error, { phase: "runDemo" });
      } finally {
        if (!cancelled) {
          setIsRunning(false);
        }
      }
    };

    runDemo(signal).catch((error) => {
      if (isRunAbortedError(error)) {
        return;
      }
      logError(DEMO_LOG_CONTEXT, error, { phase: "runDemo:unhandled" });
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [runToken]);

  const handleRerun = () => {
    if (isRunning || isResetting) return;
    setRunToken((prev) => prev + 1);
  };

  const handleReset = async () => {
    if (isRunning || isResetting) return;

    setIsResetting(true);
    setErrorMessage(null);
    setLogLines([]);
    setLastRunMode(null);

    try {
      await clearPersistentStorage();
      window.localStorage.removeItem(KUZU_DEMO_FLAG);
      setLogLines([
        "Cleared IndexedDB and localStorage markers.",
        "Reload the demo to trigger the first-run setup again.",
      ]);
    } catch (error) {
      const message = extractErrorMessage(error);
      setErrorMessage(message);
      setLogLines((prev) => [...prev, `Reset error: ${message}`]);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-10 text-neutral-100">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-white">Kuzu WASM Persistent Demo</h1>
        <p className="text-sm text-neutral-300">
          ブラウザだけでKuzu Graph DBを初期化し、IndexedDB（IDBFS）に永続化して再読み込みできるかを検証する簡易PoCです。
          URLのハッシュに<code className="ml-1 rounded bg-neutral-800 px-1 py-0.5 text-xs">#kuzu-demo</code>
          を付けてアクセスすると、この画面が表示されます。
        </p>
      </header>

      <section className="space-y-3 rounded-lg border border-neutral-700 bg-neutral-900 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-neutral-300">
            <div>
              現在の状態:{" "}
              <span className="font-medium text-white">
                {isRunning ? "実行中..." : isResetting ? "リセット中..." : "待機中"}
              </span>
            </div>
            {lastRunMode && (
              <div>
                直近のモード:{" "}
                <span className="font-medium text-white">
                  {lastRunMode === "first-run" ? "初回セットアップ" : "永続化データの読み込み"}
                </span>
              </div>
            )}
            {errorMessage && <div className="text-red-400">エラー: {errorMessage}</div>}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRerun}
              disabled={isRunning || isResetting}
              className="rounded bg-emerald-500 px-4 py-2 text-sm font-medium text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
            >
              デモ再実行
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={isRunning || isResetting}
              className="rounded bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-100 transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
            >
              永続データを削除
            </button>
          </div>
        </div>

        <div className="space-y-2 text-xs text-neutral-400">
          <p>検証手順:</p>
          <ol className="space-y-1 list-decimal pl-5">
            <li>初回アクセスでテーブル作成とCSVロードが行われます。</li>
            <li>ページをリロードすると2回目以降のモードになり、永続化されたデータをクエリして結果を表示します。</li>
            <li>「永続データを削除」を押すとIndexedDBとlocalStorageが初期化され、再度初回セットアップを試せます。</li>
          </ol>
        </div>
      </section>

      <section className="flex-1 space-y-2">
        <h2 className="text-sm font-semibold text-neutral-200">ログ出力</h2>
        <pre className="scrollbar-thin h-96 overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-950 p-4 text-xs leading-relaxed text-neutral-100">
          {logLines.length > 0 ? logLines.join("\n") : "初期化中..."}
        </pre>
      </section>

      <footer className="space-y-1 border-t border-neutral-800 pt-4 text-xs text-neutral-400">
        <p>
          このデモは<code className="mx-1 rounded bg-neutral-800 px-1 py-0.5 text-xs">public/kuzu-wasm</code>
          配下に配置したWASMバンドルを<code className="mx-1 rounded bg-neutral-800 px-1 py-0.5 text-xs">setWorkerPath</code>
          で読み込み、IDBFSを通じてIndexedDBへ同期しています。
        </p>
        <p>実運用ではこのラッパーをLangGraphのツールやUIコンポーネントから呼び出すことで記憶マネージャ機能に接続できます。</p>
      </footer>
    </div>
  );
}

async function queryDatabase(
  kuzu: KuzuModuleInstance,
  appendLog: (line: string) => void,
  signal?: AbortSignal
) {
  checkAbort(signal);
  await ensureDirectory(kuzu, KUZU_DB_DIR);
  await remountIdbfs(kuzu, KUZU_DB_DIR, appendLog, signal);
  appendLog(`Mounted ${KUZU_DB_DIR}. Syncing from IndexedDB...`);
  await kuzu.FS.syncfs(true);
  appendLog("Sync complete. Opening database for read queries...");

  const database: KuzuDatabaseInstance = new kuzu.Database(KUZU_DB_PATH);
  const connection: KuzuConnectionInstance = new kuzu.Connection(database);

  try {
    const queries = [
      {
        sql: "MATCH (u:User) -[f:Follows]-> (v:User) RETURN u.name, f.since, v.name",
        formatter: (row: Record<string, unknown>) =>
          `User ${String(row["u.name"])} follows ${String(row["v.name"])} since ${String(
            row["f.since"]
          )}`,
      },
      {
        sql: "MATCH (u:User) -[l:LivesIn]-> (c:City) RETURN u.name, c.name",
        formatter: (row: Record<string, unknown>) =>
          `User ${String(row["u.name"])} lives in ${String(row["c.name"])}`,
      },
    ];

    for (const { sql, formatter } of queries) {
      checkAbort(signal);
      appendLog(`Executing: ${sql}`);
      const queryResult: KuzuQueryHandle = await connection.query(sql);
      checkAbort(signal);
      const rows = await queryResult.getAllObjects();
      appendLog("Query result:");
      for (const row of rows) {
        appendLog(`- ${formatter(row)}`);
      }
      if (rows.length === 0) {
        appendLog("- (no rows)");
      }
      await queryResult.close();
      appendLog("");
    }
  } finally {
    try {
      await connection.close();
    } catch (error) {
      logWarning(DEMO_LOG_CONTEXT, "Failed to close connection during query", {
        phase: "queryDatabase",
        error: extractErrorMessage(error),
      });
    }
    try {
      await database.close();
    } catch (error) {
      logWarning(DEMO_LOG_CONTEXT, "Failed to close database during query", {
        phase: "queryDatabase",
        error: extractErrorMessage(error),
      });
    }
  }

  await safeUnmount(kuzu, KUZU_DB_DIR, appendLog, false, "Unmounted persistent mount", signal);
  if (!signal?.aborted) {
    appendLog(`Unmounted ${KUZU_DB_DIR}. Persistence remains in IndexedDB.`);
  }
}

async function ensureDirectory(kuzu: KuzuModuleInstance, path: string) {
  try {
    await kuzu.FS.mkdir(path);
  } catch (error) {
    const { message, code, errno } = readSystemError(error);
    const alreadyExists =
      message.includes("File exists") ||
      code === FILE_EXISTS_CODE ||
      (typeof errno === "number" && FILE_EXISTS_ERRNOS.has(errno));

    if (!alreadyExists) {
      throw error;
    }
  }
}

// Seeds the persistent database once so developers always start from known graph state.
async function performFirstRun(
  kuzu: KuzuModuleInstance,
  appendLog: (line: string) => void,
  abortSignal: AbortSignal
): Promise<RunMode> {
  checkAbort(abortSignal);
  await seedDemoData({ kuzuInstance: kuzu, signal: abortSignal, onLog: appendLog });
  window.localStorage.setItem(KUZU_DEMO_FLAG, "true");
  checkAbort(abortSignal);
  return RUN_MODE_FIRST;
}

// Handles the common case of reusing persistent data while repairing corrupt schemas if needed.
async function performSubsequentRun(
  kuzu: KuzuModuleInstance,
  appendLog: (line: string) => void,
  abortSignal: AbortSignal
): Promise<RunMode> {
  try {
    await queryDatabase(kuzu, appendLog, abortSignal);
    return RUN_MODE_SUBSEQUENT;
  } catch (error) {
    if (isRunAbortedError(error)) {
      throw error;
    }

    if (!isMissingSchemaError(error)) {
      throw error;
    }

    appendLog(
      "Existing database is missing expected tables. Recreating schema and re-running queries..."
    );
    await seedDemoData({ kuzuInstance: kuzu, signal: abortSignal, onLog: appendLog });
    window.localStorage.setItem(KUZU_DEMO_FLAG, "true");
    appendLog("Schema recreated. Running read queries again...");
    await queryDatabase(kuzu, appendLog, abortSignal);
    return RUN_MODE_SUBSEQUENT;
  }
}

// Guarantees IndexedDB-backed storage is mounted fresh before reads or writes.
async function remountIdbfs(
  kuzu: KuzuModuleInstance,
  path: string,
  appendLog?: (line: string) => void,
  signal?: AbortSignal
) {
  checkAbort(signal);
  await safeUnmount(kuzu, path, appendLog, false, "Unmounted stale mount (pre-mount)", signal);
  checkAbort(signal);
  try {
    checkAbort(signal);
    await kuzu.FS.mountIdbfs(path);
  } catch (error) {
    if (isResourceBusy(error)) {
      appendLog?.("Mount point busy. Attempting to unmount again...");
      await safeUnmount(kuzu, path, appendLog, true, "Unmounted stale mount (retry)", signal);
      checkAbort(signal);
      await kuzu.FS.mountIdbfs(path);
    } else {
      throw error;
    }
  }
}

// Keeps the virtual filesystem clean so subsequent mounts do not inherit stale state.
async function safeUnmount(
  kuzu: KuzuModuleInstance,
  path: string,
  appendLog?: (line: string) => void,
  force = false,
  logMessage = "Unmounted stale mount",
  signal?: AbortSignal
) {
  try {
    checkAbort(signal);
    await kuzu.FS.unmount(path);
    appendLog?.(`${logMessage} at ${path}.`);
  } catch (error) {
    if (isNotMountedError(error)) {
      return;
    }

    if (force && isResourceBusy(error)) {
      appendLog?.("Resource still busy; retrying unmount after small delay...");
      await new Promise((resolve) => setTimeout(resolve, RESOURCE_RETRY_DELAY_MS));
      return safeUnmount(kuzu, path, appendLog, false, logMessage, signal);
    }

    throw error;
  }
}

function isResourceBusy(error: unknown) {
  const { message, code, errno } = readSystemError(error);
  return (
    message.includes("Resource busy") ||
    code === RESOURCE_BUSY_CODE ||
    (typeof errno === "number" && RESOURCE_BUSY_ERRNOS.has(errno))
  );
}

function isNotMountedError(error: unknown) {
  const { message, code, errno } = readSystemError(error);
  return (
    message.includes("not mounted") ||
    message.includes("No such device") ||
    message.includes("No mount point") ||
    message.includes("Invalid argument") ||
    code === INVALID_ARGUMENT_CODE ||
    code === NO_ENTITY_CODE ||
    (typeof errno === "number" && (NO_SPACE_ERRNOS.has(errno) || NO_ENTITY_ERRNOS.has(errno)))
  );
}

function isRunAbortedError(error: unknown) {
  return (
    error instanceof RunAbortedError ||
    (error instanceof Error && error.message === RUN_ABORTED_ERROR_MESSAGE)
  );
}

function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new RunAbortedError();
  }
}

function isMissingSchemaError(error: unknown) {
  const message = extractErrorMessage(error).toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("binder exception") ||
    message.includes("no such table") ||
    message.includes("missing table") ||
    message.includes("invalid schema")
  );
}

// Wipes IndexedDB copies so the demo can simulate a fresh install on demand.
async function clearPersistentStorage() {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this environment.");
  }

  const candidateNames = await discoverIdbfsDatabases();
  const uniqueNames = Array.from(new Set(candidateNames));

  for (const name of uniqueNames) {
    await deleteDatabase(name);
  }
}

// Enumerates possible persistence stores so cleanup can target every browser implementation.
async function discoverIdbfsDatabases(): Promise<string[]> {
  const indexedDbWithEnumeration = indexedDB as typeof indexedDB & {
    databases?: () => Promise<Array<{ name?: string | null }>>;
  };

  const hasEnumeration = typeof indexedDbWithEnumeration.databases === "function";
  if (!hasEnumeration) {
    return FALLBACK_IDB_DATABASE_NAMES;
  }

  try {
    const databases = await indexedDbWithEnumeration.databases();
    const names = databases
      .map((db) => db.name)
      .filter((name): name is string => Boolean(name));

    if (names.length === 0) {
      return FALLBACK_IDB_DATABASE_NAMES;
    }

    return names;
  } catch (error) {
    logDebug(DEMO_LOG_CONTEXT, "Falling back to default IndexedDB names", {
      reason: extractErrorMessage(error),
    });
    return FALLBACK_IDB_DATABASE_NAMES;
  }
}

// Removes a single IndexedDB database, tolerating races where the store already vanished.
function deleteDatabase(name: string) {
  return new Promise<void>((resolve, reject) => {
    try {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onblocked = () => resolve();
      request.onerror = () => {
        const error = request.error;
        if (error && error.name === NOT_FOUND_ERROR_NAME) {
          resolve();
        } else {
          reject(error ?? new Error(`Failed to delete IndexedDB database: ${name}`));
        }
      };
    } catch (error) {
      const message = extractErrorMessage(error);
      if (message.includes("not found") || message.includes(NOT_FOUND_ERROR_NAME)) {
        resolve();
      } else {
        reject(error as Error);
      }
    }
  });
}

// Normalises filesystem-related errors so retry logic can stay declarative.
function readSystemError(error: unknown): { message: string; code?: string; errno?: number } {
  if (typeof error === "object" && error !== null) {
    const candidate = error as { message?: unknown; code?: unknown; errno?: unknown };
    const message =
      typeof candidate.message === "string" ? candidate.message : extractErrorMessage(error);
    const code = typeof candidate.code === "string" ? candidate.code : undefined;
    const errno = typeof candidate.errno === "number" ? candidate.errno : undefined;
    return { message, code, errno };
  }

  return { message: extractErrorMessage(error) };
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}
