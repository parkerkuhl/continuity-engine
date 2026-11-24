// Milestone 8: "the schema ports to Postgres unchanged". schema-pg.ts must have the same tables,
// columns, nullability, primary keys and indexes as schema.ts.
import { getTableConfig as pgConfig, PgTable } from "drizzle-orm/pg-core";
import { getTableConfig as liteConfig, SQLiteTable } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import * as lite from "../src/schema";
import * as pg from "../src/schema-pg";

type Shape = Record<string, { columns: Record<string, { notNull: boolean; primary: boolean }>; pk: string[][]; indexes: string[] }>;

function shape(tables: unknown[], config: (t: never) => ReturnType<typeof pgConfig> | ReturnType<typeof liteConfig>): Shape {
  const out: Shape = {};
  for (const t of tables) {
    const c = config(t as never);
    out[c.name] = {
      columns: Object.fromEntries(c.columns.map((col) => [col.name, { notNull: col.notNull, primary: col.primary }])),
      pk: c.primaryKeys.map((k) => k.columns.map((col) => col.name)),
      indexes: c.indexes.map((i) => i.config.name).sort(),
    };
  }
  return out;
}

describe("M8: the Postgres schema mirrors the SQLite schema", () => {
  it("has the same tables, columns, keys and indexes", () => {
    const a = shape(Object.values(lite).filter((t) => t instanceof SQLiteTable), liteConfig as never);
    const b = shape(Object.values(pg).filter((t) => t instanceof PgTable), pgConfig as never);
    expect(Object.keys(b).sort()).toEqual(Object.keys(a).sort());
    expect(b).toEqual(a);
  });
});
