import { useEffect, useRef, useState } from "react";
import { KUZU_DEMO_FLAG, seedDemoData, loadKuzuModule } from "../services/kuzuClient";

const KUZU_DB_DIR = "/database";
const KUZU_DB_PATH = `${KUZU_DB_DIR}/persistent.db`;

type RunMode = "first-run" | "subsequent";

class RunAbortedError extends Error {
  constructor() {
    super("RUN_ABORTED");
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

        if (isFirstRun) {
          await seedDemoData({ kuzuInstance: kuzu, signal: abortSignal, onLog: appendLog });
          if (!cancelled) {
            window.localStorage.setItem(KUZU_DEMO_FLAG, "true");
            setLastRunMode("first-run");
          }
        } else {
          let succeeded = false;
          try {
            await queryDatabase(kuzu, appendLog, abortSignal);
            succeeded = true;
            if (!cancelled) {
              setLastRunMode("subsequent");
            }
          } catch (error) {
            if (isRunAbortedError(error)) {
              return;
            }
            if (isMissingSchemaError(error)) {
              appendLog(
                "Existing database is missing expected tables. Recreating schema and re-running queries..."
              );
              await seedDemoData({ kuzuInstance: kuzu, signal: abortSignal, onLog: appendLog });
              if (!cancelled) {
                window.localStorage.setItem(KUZU_DEMO_FLAG, "true");
                setLastRunMode("first-run");
              }
              appendLog("Schema recreated. Running read queries again...");
              await queryDatabase(kuzu, appendLog, abortSignal);
              succeeded = true;
              if (!cancelled) {
                setLastRunMode("subsequent");
              }
            } else {
              throw error;
            }
          }

          if (!succeeded) {
            throw new Error("Unable to query the database.");
          }
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
        console.error("[KuzuPersistentDemo]", error);
      } finally {
        if (!cancelled) {
          setIsRunning(false);
        }
      }
    };

    runDemo(signal).catch((error) => {
      if (!isRunAbortedError(error)) {
        console.error("[KuzuPersistentDemo] runDemo failed", error);
      }
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
  kuzu: any,
  appendLog: (line: string) => void,
  signal?: AbortSignal
) {
  checkAbort(signal);
  await ensureDirectory(kuzu, KUZU_DB_DIR);
  await remountIdbfs(kuzu, KUZU_DB_DIR, appendLog, signal);
  appendLog(`Mounted ${KUZU_DB_DIR}. Syncing from IndexedDB...`);
  await kuzu.FS.syncfs(true);
  appendLog("Sync complete. Opening database for read queries...");

  const db = new kuzu.Database(KUZU_DB_PATH);
  const conn = new kuzu.Connection(db);

  try {
    const queries = [
      {
        sql: "MATCH (u:User) -[f:Follows]-> (v:User) RETURN u.name, f.since, v.name",
        formatter: (row: Record<string, string | number>) =>
          `User ${row["u.name"]} follows ${row["v.name"]} since ${row["f.since"]}`,
      },
      {
        sql: "MATCH (u:User) -[l:LivesIn]-> (c:City) RETURN u.name, c.name",
        formatter: (row: Record<string, string | number>) =>
          `User ${row["u.name"]} lives in ${row["c.name"]}`,
      },
    ];

    for (const { sql, formatter } of queries) {
      checkAbort(signal);
      appendLog(`Executing: ${sql}`);
      const queryResult = await conn.query(sql);
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
      await conn.close();
    } catch (error) {
      console.warn("[KuzuPersistentDemo] Failed to close connection during query", error);
    }
    try {
      await db.close();
    } catch (error) {
      console.warn("[KuzuPersistentDemo] Failed to close database during query", error);
    }
  }

  await safeUnmount(kuzu, KUZU_DB_DIR, appendLog, false, "Unmounted persistent mount", signal);
  if (!signal?.aborted) {
    appendLog(`Unmounted ${KUZU_DB_DIR}. Persistence remains in IndexedDB.`);
  }
}

async function ensureDirectory(kuzu: any, path: string) {
  try {
    await kuzu.FS.mkdir(path);
  } catch (error: any) {
    const message = typeof error?.message === "string" ? error.message : "";
    const errno = typeof error?.errno === "number" ? error.errno : undefined;
    const code = typeof error?.code === "string" ? error.code : undefined;
    const knownExists =
      message.includes("File exists") || code === "EEXIST" || errno === 17 || errno === -17 || errno === 20;

    if (!knownExists) {
      throw error;
    }
  }
}

async function remountIdbfs(
  kuzu: any,
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
  } catch (error: any) {
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

async function safeUnmount(
  kuzu: any,
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
  } catch (error: any) {
    const errMessage = typeof error?.message === "string" ? error.message : "";
    const code = typeof error?.code === "string" ? error.code : undefined;
    if (isNotMountedError(error)) {
      return;
    }

    if (force && isResourceBusy(error)) {
      appendLog?.("Resource still busy; retrying unmount after small delay...");
      await new Promise((resolve) => setTimeout(resolve, 50));
      return safeUnmount(kuzu, path, appendLog, false, logMessage, signal);
    }

    throw error;
  }
}

function isResourceBusy(error: any) {
  const message = typeof error?.message === "string" ? error.message : "";
  const code = typeof error?.code === "string" ? error.code : undefined;
  const errno = typeof error?.errno === "number" ? error.errno : undefined;
  return (
    message.includes("Resource busy") ||
    code === "EBUSY" ||
    errno === 16 ||
    errno === -16
  );
}

function isNotMountedError(error: any) {
  const message = typeof error?.message === "string" ? error.message : "";
  const code = typeof error?.code === "string" ? error.code : undefined;
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

function isRunAbortedError(error: unknown) {
  return error instanceof RunAbortedError || (error instanceof Error && error.message === "RUN_ABORTED");
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

async function discoverIdbfsDatabases(): Promise<string[]> {
  const fallbackNames = ["EM_FS_IDBFS", "kuzu", "kuzu-wasm"];

  const hasEnumeration = typeof (indexedDB as any).databases === "function";
  if (!hasEnumeration) {
    return fallbackNames;
  }

  try {
    const databases: Array<{ name?: string | null }> = await (indexedDB as any).databases();
    const names = databases
      .map((db) => db.name)
      .filter((name): name is string => Boolean(name));

    if (names.length === 0) {
      return fallbackNames;
    }

    return names;
  } catch {
    return fallbackNames;
  }
}

function deleteDatabase(name: string) {
  return new Promise<void>((resolve, reject) => {
    try {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onblocked = () => resolve();
      request.onerror = () => {
        const err = request.error;
        if (err && err.name === "NotFoundError") {
          resolve();
        } else {
          reject(err ?? new Error(`Failed to delete IndexedDB database: ${name}`));
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("not found") || message.includes("NotFoundError")) {
        resolve();
      } else {
        reject(error as Error);
      }
    }
  });
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
