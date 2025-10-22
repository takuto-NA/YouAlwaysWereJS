import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleStackIcon,
  XMarkIcon,
  ArrowPathIcon,
  PlayIcon,
  InboxStackIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import {
  describeTable,
  executeQuery,
  listTables,
  previewTable,
  quoteIdentifier,
  TableInfo,
  TablePreview,
  QueryResult,
  seedDemoData,
  KUZU_DEMO_FLAG,
} from "../services/kuzuClient";

interface MemoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LoadingState {
  loading: boolean;
  error: string | null;
}

const QUERY_PLACEHOLDER = `// ここにCypherクエリを入力（例）:
MATCH (u:User)-[f:Follows]->(v:User)
RETURN u, f, v
LIMIT 10`;

function MemoryManagerModal({ isOpen, onClose }: MemoryManagerModalProps) {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [tablesState, setTablesState] = useState<LoadingState>({ loading: false, error: null });
  const [schemaState, setSchemaState] = useState<LoadingState>({ loading: false, error: null });
  const [previewState, setPreviewState] = useState<LoadingState>({ loading: false, error: null });
  const [selectedTableName, setSelectedTableName] = useState<string | null>(null);
  const [currentPreview, setCurrentPreview] = useState<TablePreview | null>(null);
  const [currentSchema, setCurrentSchema] = useState<QueryResult | null>(null);
  const [queryText, setQueryText] = useState("");
  const [queryState, setQueryState] = useState<LoadingState>({ loading: false, error: null });
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [seedStatus, setSeedStatus] = useState<{ loading: boolean; message: string | null; error: string | null }>({
    loading: false,
    message: null,
    error: null,
  });

  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setSeedStatus({ loading: false, message: null, error: null });
      return;
    }

    let cancelled = false;
    setTablesState({ loading: true, error: null });

    (async () => {
      try {
        const fetchedTables = await listTables();
        if (cancelled) return;
        setTables(fetchedTables);
        if (fetchedTables.length > 0) {
          setSelectedTableName((prev) => {
            if (prev && fetchedTables.some((table) => table.name === prev)) {
              return prev;
            }
            return fetchedTables[0].name;
          });
        } else {
          setSelectedTableName(null);
        }
      } catch (error) {
        if (cancelled) return;
        setTablesState({
          loading: false,
          error: extractMessage(error),
        });
        return;
      }
      if (cancelled) return;
      setTablesState({ loading: false, error: null });
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, refreshToken]);

  const selectedTable = useMemo(() => {
    if (!selectedTableName) {
      return tables[0] ?? null;
    }
    return tables.find((table) => table.name === selectedTableName) ?? tables[0] ?? null;
  }, [tables, selectedTableName]);

  useEffect(() => {
    if (!isOpen || !selectedTable) {
      setCurrentSchema(null);
      setCurrentPreview(null);
      setSchemaState({ loading: false, error: null });
      setPreviewState({ loading: false, error: null });
      return;
    }

    let cancelled = false;
    setSchemaState({ loading: true, error: null });
    setPreviewState({ loading: true, error: null });

    (async () => {
      try {
        const schema = await describeTable(selectedTable);
        if (cancelled) return;
        setCurrentSchema(schema.columns);
        setSchemaState({ loading: false, error: null });
      } catch (error) {
        if (cancelled) return;
        setCurrentSchema(null);
        setSchemaState({ loading: false, error: extractMessage(error) });
      }
    })();

    (async () => {
      try {
        const preview = await previewTable(selectedTable, 25);
        if (cancelled) return;
        setCurrentPreview(preview);
        setPreviewState({
          loading: false,
          error: preview.error ?? null,
        });
      } catch (error) {
        if (cancelled) return;
        setCurrentPreview(null);
        setPreviewState({ loading: false, error: extractMessage(error) });
      }
    })();

    const defaultQuery = buildDefaultQuery(selectedTable);
    setQueryText(defaultQuery);
    setQueryResult(null);
    setQueryState({ loading: false, error: null });

    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedTable]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    setTimeout(() => closeButtonRef.current?.focus(), 100);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, [isOpen, onClose]);

  const handleRunQuery = async () => {
    const trimmed = queryText.trim();
    if (!trimmed) {
      setQueryState({ loading: false, error: "クエリを入力してください。" });
      return;
    }

    setQueryState({ loading: true, error: null });
    setQueryResult(null);

    try {
      const result = await executeQuery(trimmed);
      setQueryResult({
        columns: result.columns,
        rows: result.rows.map((row) => normalizeResultRow(row)),
      });
      setQueryState({ loading: false, error: null });
    } catch (error) {
      setQueryResult(null);
      setQueryState({ loading: false, error: extractMessage(error) });
    }
  };

  const handleSeedDemo = async () => {
    if (seedStatus.loading) return;
    setSeedStatus({ loading: true, message: null, error: null });
    try {
      await seedDemoData({
        onLog: () => undefined,
      });
      window.localStorage.setItem(KUZU_DEMO_FLAG, "true");
      setSeedStatus({
        loading: false,
        message: "Demo data initialized.",
        error: null,
      });
      setRefreshToken((value) => value + 1);
    } catch (error) {
      const message = extractMessage(error);
      if (message === "RUN_ABORTED") {
        setSeedStatus({ loading: false, message: null, error: null });
        return;
      }
      setSeedStatus({
        loading: false,
        message: null,
        error: message,
      });
    }
  };

  const handleRefresh = async () => {
    if (tablesState.loading) return;
    setTablesState({ loading: true, error: null });
    try {
      const fetchedTables = await listTables();
      setTables(fetchedTables);
      if (fetchedTables.length > 0) {
        setSelectedTableName((prev) => {
          if (prev && fetchedTables.some((table) => table.name === prev)) {
            return prev;
          }
          return fetchedTables[0].name;
        });
      } else {
        setSelectedTableName(null);
      }
      setTablesState({ loading: false, error: null });
    } catch (error) {
      setTablesState({ loading: false, error: extractMessage(error) });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative flex h-full w-full max-w-6xl flex-col overflow-hidden border border-gray-800 bg-black text-white shadow-2xl">
        <header className="flex flex-shrink-0 items-center justify-between border-b border-gray-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <CircleStackIcon className="h-6 w-6 text-gray-400" />
            <div>
              <h2 className="text-lg font-semibold tracking-wide">Memory Manager</h2>
              <p className="text-xs text-gray-500">
                IndexedDB に保存された Kuzu グラフデータを確認・管理します
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSeedDemo}
              disabled={seedStatus.loading}
              className="flex items-center gap-2 rounded border border-indigo-500 px-3 py-2 text-xs uppercase tracking-wider text-indigo-200 transition hover:border-indigo-400 hover:text-white disabled:cursor-not-allowed disabled:border-gray-700 disabled:text-gray-600"
            >
              <SparklesIcon className="h-4 w-4" />
              Initialize Demo
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={tablesState.loading || seedStatus.loading}
              className="flex items-center gap-2 rounded border border-gray-700 px-3 py-2 text-xs uppercase tracking-wider text-gray-400 transition hover:border-gray-500 hover:text-white disabled:cursor-not-allowed disabled:border-gray-700 disabled:text-gray-600"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Refresh
            </button>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="rounded border border-gray-700 p-2 text-gray-400 transition hover:border-gray-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Close memory manager"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </header>

        {(seedStatus.loading || seedStatus.message || seedStatus.error) && (
          <div className="border-b border-gray-900 bg-black/80 px-6 py-2 text-xs">
            {seedStatus.loading && <span className="text-gray-400">Initializing demo data...</span>}
            {!seedStatus.loading && seedStatus.message && (
              <span className="text-emerald-400">{seedStatus.message}</span>
            )}
            {!seedStatus.loading && seedStatus.error && (
              <span className="text-red-400">{seedStatus.error}</span>
            )}
          </div>
        )}

        <div className="flex min-h-0 flex-1 divide-x divide-gray-900">
          <aside className="w-64 flex-shrink-0 overflow-y-auto bg-black/60">
            <div className="border-b border-gray-900 px-6 py-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Tables
              </h3>
            </div>

            <div className="flex flex-col gap-1 px-3 py-4">
              {tablesState.loading && (
                <p className="px-3 py-2 text-xs text-gray-500">Loading tables...</p>
              )}
              {tablesState.error && (
                <p className="px-3 py-2 text-xs text-red-400">{tablesState.error}</p>
              )}
              {!tablesState.loading && !tablesState.error && tables.length === 0 && (
                <div className="px-3 py-2 text-xs text-gray-500">
                  テーブルが見つかりません。
                  <br />
                  サンプルデータを読み込むには `#kuzu-demo` 画面で初期化してください。
                </div>
              )}
              {tables.map((table) => {
                const isSelected = table.name === selectedTableName;
                return (
                  <button
                    key={table.name}
                    type="button"
                    onClick={() => setSelectedTableName(table.name)}
                    className={`flex flex-col gap-0.5 rounded px-3 py-2 text-left text-sm transition ${
                      isSelected ? "bg-white/10 text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span className="font-medium">{table.name}</span>
                    {table.type && (
                      <span className="text-[11px] uppercase tracking-wider text-gray-500">
                        {table.type}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-col gap-6 overflow-y-auto px-6 py-6">
              <section>
                <header className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-200">
                      Schema
                    </h3>
                    {selectedTable && (
                      <p className="text-xs text-gray-500">
                        {selectedTable.name} {selectedTable.type ? `(${selectedTable.type})` : ""}
                      </p>
                    )}
                  </div>
                </header>
                {schemaState.loading && (
                  <StateMessage icon="loading" message="Loading schema..." />
                )}
                {schemaState.error && <StateMessage icon="error" message={schemaState.error} />}
                {!schemaState.loading && !schemaState.error && currentSchema && (
                  <DataTable result={currentSchema} emptyMessage="Columns not available." />
                )}
              </section>

              <section>
                <header className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <InboxStackIcon className="h-5 w-5 text-gray-500" />
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-200">
                        Preview
                      </h3>
                      <p className="text-xs text-gray-500">最初の数件をプレビュー表示します</p>
                    </div>
                  </div>
                </header>
                {previewState.loading && <StateMessage icon="loading" message="Loading preview..." />}
                {previewState.error && <StateMessage icon="error" message={previewState.error} />}
                {!previewState.loading &&
                  !previewState.error &&
                  currentPreview &&
                  currentPreview.result && (
                    <DataTable
                      result={currentPreview.result}
                      emptyMessage="No rows found for the selected table."
                    />
                  )}
                {!previewState.loading &&
                  !previewState.error &&
                  currentPreview &&
                  !currentPreview.result && (
                    <StateMessage icon="info" message="プレビューを取得できませんでした。" />
                  )}
              </section>

              <section className="border-t border-gray-900 pt-6">
                <header className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-200">
                    Run Custom Query
                  </h3>
                  <span className="text-[11px] uppercase tracking-wider text-gray-500">
                    Limit 25 rows recommended
                  </span>
                </header>
                <div className="flex flex-col gap-3">
                  <textarea
                    value={queryText}
                    onChange={(event) => setQueryText(event.target.value)}
                    placeholder={QUERY_PLACEHOLDER}
                    className="h-32 w-full rounded border border-gray-800 bg-black/40 px-3 py-2 font-mono text-sm text-gray-200 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleRunQuery}
                      disabled={queryState.loading}
                      className="flex items-center gap-2 rounded border border-indigo-500 px-4 py-2 text-xs uppercase tracking-wider text-indigo-200 transition hover:border-indigo-400 hover:text-white disabled:cursor-not-allowed disabled:border-gray-700 disabled:text-gray-600"
                    >
                      <PlayIcon className="h-4 w-4" />
                      Run Query
                    </button>
                    {queryState.loading && (
                      <span className="text-xs text-gray-500">Running query...</span>
                    )}
                    {queryState.error && (
                      <span className="text-xs text-red-400">{queryState.error}</span>
                    )}
                  </div>
                  {queryResult && (
                    <div className="rounded border border-gray-900 bg-black/60 p-4">
                      <DataTable result={queryResult} emptyMessage="Query returned no rows." />
                    </div>
                  )}
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

interface StateMessageProps {
  icon: "loading" | "error" | "info";
  message: string;
}

function StateMessage({ icon, message }: StateMessageProps) {
  const iconElement = useMemo(() => {
    switch (icon) {
      case "loading":
        return <ArrowPathIcon className="h-4 w-4 animate-spin text-gray-500" />;
      case "error":
        return <XMarkIcon className="h-4 w-4 text-red-500" />;
      default:
        return <CircleStackIcon className="h-4 w-4 text-gray-500" />;
    }
  }, [icon]);

  return (
    <div className="flex items-center gap-2 rounded border border-gray-900 bg-black/40 px-3 py-2 text-xs text-gray-400">
      {iconElement}
      <span>{message}</span>
    </div>
  );
}

interface DataTableProps {
  result: QueryResult;
  emptyMessage?: string;
}

function DataTable({ result, emptyMessage = "No data." }: DataTableProps) {
  const { columns, rows } = result;

  if (rows.length === 0) {
    return (
      <div className="rounded border border-gray-900 bg-black/40 px-3 py-2 text-xs text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  const normalizedColumns =
    columns.length > 0 ? columns : Array.from(new Set(rows.flatMap((row) => Object.keys(row))));

  return (
    <div className="overflow-hidden rounded border border-gray-900">
      <div className="max-h-80 overflow-auto">
        <table className="min-w-full divide-y divide-gray-900">
          <thead className="bg-white/5 text-xs uppercase tracking-wider text-gray-400">
            <tr>
              {normalizedColumns.map((column) => (
                <th key={column} className="px-3 py-2 text-left font-semibold">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-900 text-sm text-gray-100">
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-white/5">
                {normalizedColumns.map((column) => (
                  <td
                    key={column}
                    className="whitespace-pre-wrap px-3 py-2 align-top font-mono text-xs text-gray-300"
                  >
                    {formatValue(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function buildDefaultQuery(table: TableInfo | null): string {
  if (!table) {
    return "";
  }
  const quoted = quoteIdentifier(table.name);
  if (table.type?.toUpperCase() === "REL") {
    return `MATCH (source)-[rel:${quoted}]->(target)\nRETURN source, rel, target\nLIMIT 25`;
  }
  return `MATCH (n:${quoted})\nRETURN n\nLIMIT 25`;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function normalizeResultRow(row: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[key] = normalizeResultValue(value);
  }
  return normalized;
}

function normalizeResultValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeResultValue(item));
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;

    if ("value" in obj && Object.keys(obj).length === 1) {
      return normalizeResultValue(obj.value);
    }

    if ("_properties" in obj) {
      const result: Record<string, unknown> = {};
      result.properties = normalizeResultValue(obj._properties);
      if ("_src" in obj) {
        result.source = normalizeResultValue(obj._src);
      }
      if ("_dst" in obj) {
        result.target = normalizeResultValue(obj._dst);
      }
      if ("_id" in obj) {
        result.id = normalizeResultValue(obj._id);
      }
      if (Object.keys(result).length === 1 && "properties" in result) {
        return result.properties;
      }
      return result;
    }

    const plain: Record<string, unknown> = {};
    for (const [nestedKey, nestedValue] of Object.entries(obj)) {
      plain[nestedKey.replace(/^_/, "")] = normalizeResultValue(nestedValue);
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

function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

export default MemoryManagerModal;
