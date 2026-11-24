-- Full-text search over entities (Postgres counterpart of the SQLite FTS5 table in drizzle/0001_fts.sql).
-- One row per entity, maintained by the storage layer inside each entity or section write.
-- Weights: name A, aliases B, summary C, section headings and bodies D (FTS5 ranks them the same way).
CREATE TABLE "entities_search" (
	"entity_id" text PRIMARY KEY NOT NULL,
	"world_id" text NOT NULL,
	"doc" tsvector NOT NULL
);
--> statement-breakpoint
CREATE INDEX "entities_search_doc" ON "entities_search" USING gin ("doc");
--> statement-breakpoint
CREATE INDEX "entities_search_world" ON "entities_search" ("world_id");
