import { tool } from "@langchain/core/tools";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { z } from "zod";
import {
  executeQuery,
  listTables,
  describeTable,
  previewTable,
  TableInfo,
  QueryResult,
  quoteIdentifier,
  applyDdlStatementToCache,
  getCachedTables,
} from "../kuzuClient";
import { logDebug, logError } from "../../utils/errorHandler";

function serializeResult<T>(label: string, payload: T): string {
  try {
    return JSON.stringify(
      {
        label,
        payload,
      },
      null,
      2
    );
  } catch (error) {
    return `${label}: ${String(error)}`;
  }
}

async function resolveTable(tableName: string): Promise<TableInfo | null> {
  const tables = await listTables();
  return tables.find((table) => table.name.toLowerCase() === tableName.toLowerCase()) ?? null;
}

export function createKuzuMemoryTools(): StructuredToolInterface[] {
  const queryTool = tool(
    async ({ statement, summarizeOnly }: { statement: string; summarizeOnly?: boolean }) => {
      const trimmed = statement.trim();
      if (!trimmed) {
        return "ERROR: Query statement is empty.";
      }

      logDebug("KuzuTools", "Executing kuzu_query", { statement: trimmed });

      try {
        const result = await executeQuery(trimmed);
        const columnSummary = result.columns;
        const rowCount = result.rows.length;
        applyDdlStatementToCache(trimmed);
        const payload = summarizeOnly
          ? {
              rowCount,
              columns: columnSummary,
            }
          : {
              columns: columnSummary,
              rows: result.rows,
              rowCount,
            };
        return serializeResult("kuzu_query_result", payload);
      } catch (error) {
        logError("KuzuTools", error, { statement: trimmed });
        const interpreted = interpretKuzuError(error, trimmed);
        return serializeResult("kuzu_query_error", {
          message: interpreted.message,
          hint: interpreted.hint,
        });
      }
    },
    {
      name: "kuzu_query",
      description:
        "Execute Cypher queries against the persistent Kuzu graph. Use for reads, writes, updates, or deletes. Always include a LIMIT for large reads.",
      schema: z.object({
        statement: z
          .string()
          .min(1, "Provide a Cypher statement.")
          .describe("Cypher query to execute. Include LIMIT for reads."),
        summarizeOnly: z
          .boolean()
          .optional()
          .describe("Set true to return only row count and columns for large updates."),
      }),
    }
  );

  const listTablesTool = tool(
    async () => {
      logDebug("KuzuTools", "Executing kuzu_list_tables");
      try {
        const tables = await listTables();
        const payload = tables.map((table) => ({
          name: table.name,
          type: table.type ?? "UNKNOWN",
        }));
        return serializeResult("kuzu_tables", payload);
      } catch (error) {
        logError("KuzuTools", error, { operation: "listTables" });
        const fallback = getCachedTables();
        if (fallback.length > 0) {
          return serializeResult("kuzu_tables", fallback.map((table) => ({
            name: table.name,
            type: table.type ?? "UNKNOWN",
          })));
        }
        return serializeResult("kuzu_tables_error", {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    {
      name: "kuzu_list_tables",
      description: "List available Kuzu graph tables with their types.",
      schema: z.object({}).passthrough(),
    }
  );

  const describeTableTool = tool(
    async ({ tableName, previewLimit }: { tableName: string; previewLimit?: number }) => {
      const effectiveLimit = previewLimit ?? 10;
      logDebug("KuzuTools", "Executing kuzu_describe_table", {
        tableName,
        previewLimit: effectiveLimit,
      });

      try {
        const table = await resolveTable(tableName);
        if (!table) {
          return serializeResult("kuzu_describe_error", {
            message: `Table ${quoteIdentifier(tableName)} not found.`,
          });
        }

        const schema = await describeTable(table);
        const preview = await previewTable(table, effectiveLimit);

        const payload = {
          table: {
            name: table.name,
            type: table.type ?? "UNKNOWN",
          },
          columns:
            schema.columns.rows.map((row: QueryResult["rows"][number]) => ({
              name: row.columnName ?? row.name ?? row.COLUMN_NAME ?? row.COLUMN ?? row[0],
              type: row.columnType ?? row.type ?? row.COLUMN_TYPE ?? row[1],
              raw: row,
            })) ?? [],
          preview: preview.result
            ? {
                columns: preview.result.columns,
                rows: preview.result.rows,
              }
            : null,
          notes: preview.error ?? null,
        };

        return serializeResult("kuzu_table_details", payload);
      } catch (error) {
        logError("KuzuTools", error, { tableName, previewLimit: effectiveLimit });
        return serializeResult("kuzu_describe_error", {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    {
      name: "kuzu_describe_table",
      description:
        "Inspect a table's schema and preview sample rows to understand stored memory structure.",
      schema: z.object({
        tableName: z
          .string()
          .min(1, "Provide the table name as returned by kuzu_list_tables.")
          .describe("Name of the table to inspect."),
        previewLimit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Optional row limit for the sample preview (default 10)."),
      }),
    }
  );

  return [queryTool, listTablesTool, describeTableTool];
}

function interpretKuzuError(error: unknown, statement: string): { message: string; hint?: string } {
  const baseMessage = error instanceof Error ? error.message : String(error);
  let hint: string | undefined;

  if (baseMessage.includes("mismatched input 'REL'") || baseMessage.includes("mismatched input 'RELATION'")) {
    hint =
      "Kuzu expects `DROP TABLE <name>` for both node and relationship tables. Try rerunning with `DROP TABLE Follows;` etc.";
  } else if (baseMessage.includes("Cannot delete node table") && baseMessage.includes("referenced by relationship table")) {
    hint =
      "Delete or drop relationship tables (e.g. `DROP TABLE Follows;`) before removing the referenced node table.";
  } else if (baseMessage.includes("Cast failed")) {
    hint =
      "The graph may already be empty. Try refreshing with `kuzu_list_tables` or reseeding data if needed.";
  }

  return {
    message: baseMessage || "Unknown Kuzu error",
    hint,
  };
}
