-- Full-text search over entities (SPEC "Data model": FTS5 over name, aliases, summary and section bodies).
-- One row per entity, maintained by the storage layer inside each entity or section write.
-- SQLite-only; the Postgres backend (Milestone 8) replaces this with a tsvector index.
CREATE VIRTUAL TABLE `entities_fts` USING fts5(
  `entity_id` UNINDEXED,
  `world_id` UNINDEXED,
  `name`,
  `aliases`,
  `summary`,
  `body`,
  tokenize = 'unicode61 remove_diacritics 2'
);
