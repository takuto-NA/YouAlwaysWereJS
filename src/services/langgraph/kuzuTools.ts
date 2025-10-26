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
  normalizeCypherStatement,
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

      const normalization = normalizeCypherStatement(trimmed);
      if (normalization.didRewrite) {
        logDebug("KuzuTools", "Rewrote unsupported syntax before execution", {
          original: trimmed,
          normalized: normalization.statement,
        });
      }

      try {
        const result = await executeQuery(normalization.statement, {
          skipNormalization: true,
          autoMemoryIdPlaceholders: normalization.autoMemoryIdPlaceholders,
        });
        const columnSummary = result.columns;
        const rowCount = result.rows.length;
        applyDdlStatementToCache(normalization.statement);
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
        logError("KuzuTools", error, {
          statement: trimmed,
          normalizedStatement: normalization.statement,
        });
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
        "Execute Cypher queries against the persistent Kuzu graph. Use for reads, writes, updates, or deletes. " +
        "CRITICAL: BEFORE querying ANY table:\n" +
        "1) Use kuzu_list_tables to check if the table exists\n" +
        "2) If it doesn't exist, CREATE it first with CREATE NODE TABLE\n" +
        "3) Then use kuzu_describe_table to see the actual schema and available properties\n" +
        "NEVER assume a table exists - the database starts empty!\n" +
        "KuzuDB is NOT Neo4j - some Cypher features differ: " +
        "1) Use DROP TABLE (not DROP REL/RELATION) " +
        "2) No id() function - use explicit properties " +
        "3) Limited MERGE support " +
        "4) Use CURRENT_TIMESTAMP (not DATETIME()) " +
        "Always include a LIMIT for large reads to avoid performance issues.",
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
        "Inspect a table's schema and preview sample rows to understand stored memory structure. " +
        "CRITICAL: Always call this BEFORE writing kuzu_query statements for a table to see exact property names and types. " +
        "This prevents 'Cannot find property' errors.",
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

function interpretKuzuError(error: unknown, _statement: string): { message: string; hint?: string } {
  const baseMessage = error instanceof Error ? error.message : String(error);
  let hint: string | undefined;

  if (baseMessage.includes("Table") && baseMessage.includes("does not exist")) {
    hint =
      "CRITICAL: The table does not exist in the database. You MUST:\n" +
      "1. Use kuzu_list_tables to see all existing tables\n" +
      "2. If the table is missing, CREATE it first with CREATE NODE TABLE\n" +
      "3. Example: CREATE NODE TABLE User(userId STRING, name STRING, memoryInfo STRING, lastUpdated TIMESTAMP, PRIMARY KEY (userId))\n" +
      "DO NOT retry the query without creating the table first!";
  } else if (baseMessage.includes("mismatched input 'REL'") || baseMessage.includes("mismatched input 'RELATION'")) {
    hint =
      "Kuzu expects `DROP TABLE <name>` for both node and relationship tables. Try rerunning with `DROP TABLE Follows;` etc.";
  } else if (baseMessage.includes("function DATETIME does not exist")) {
    hint =
      "KuzuDB does not support a `DATETIME()` function. Use `CURRENT_TIMESTAMP` or `CAST(<value> AS TIMESTAMP)` and declare columns as `TIMESTAMP`.";
  } else if (baseMessage.toLowerCase().includes("expects primary key")) {
    hint =
      "Provide a unique `id` value when creating Memory nodes (e.g. `CREATE (m:Memory {id: <nextId>, ...})`). Use `MATCH (m:Memory) RETURN MAX(m.id)` to choose the next identifier.";
  } else if (baseMessage.toLowerCase().includes("duplicated primary key value")) {
    hint =
      "The chosen `id` already exists. Query the current max id (e.g. `MATCH (m:Memory) RETURN MAX(m.id)`), then retry with a higher value.";
  } else if (baseMessage.includes("Cannot delete node table") && baseMessage.includes("referenced by relationship table")) {
    hint =
      "Delete or drop relationship tables (e.g. `DROP TABLE Follows;`) before removing the referenced node table.";
  } else if (baseMessage.includes("Cast failed")) {
    hint =
      "The graph may already be empty. Try refreshing with `kuzu_list_tables` or reseeding data if needed.";
  } else if (baseMessage.includes("Cannot find property") || baseMessage.includes("property") && baseMessage.includes("does not exist")) {
    hint =
      "The property does not exist in this table. ALWAYS use kuzu_describe_table first to see the actual schema and available properties, then construct your query with the correct property names.";
  } else if (baseMessage.includes("label") && baseMessage.includes("does not exist")) {
    hint =
      "The node or relationship label does not exist. Use kuzu_list_tables to see available tables (labels).";
  } else if (baseMessage.includes("id() function")) {
    hint =
      "KuzuDB may not support Neo4j's id() function. Use explicit primary key properties instead (e.g. node.id).";
  } else if (baseMessage.includes("MERGE") || baseMessage.includes("merge")) {
    hint =
      "KuzuDB has limited MERGE support. Consider using MATCH + CREATE or separate MATCH and CREATE statements.";
  } else if (baseMessage.includes("CURRENT_TIMESTAMP") && baseMessage.includes("not in scope")) {
    hint =
      "In KuzuDB, CURRENT_TIMESTAMP cannot be used directly in CREATE/SET statements. Use a literal timestamp string instead (e.g. '2025-10-26T12:00:00') or use current_timestamp() function if available.";
  }

  return {
    message: baseMessage || "Unknown Kuzu error",
    hint,
  };
}
