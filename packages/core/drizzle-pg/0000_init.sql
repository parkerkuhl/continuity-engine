CREATE TABLE "campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"world_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"settings" jsonb NOT NULL,
	"approval_mode" text NOT NULL,
	"severity_policy" jsonb NOT NULL,
	"as_of_story_time" text,
	"current_chapter" integer DEFAULT 1 NOT NULL,
	"spoilers_on" boolean DEFAULT false NOT NULL,
	"last_session_at" text
);
--> statement-breakpoint
CREATE TABLE "chapters" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"summary_md" text DEFAULT '' NOT NULL,
	"closed_at" text
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" text PRIMARY KEY NOT NULL,
	"world_id" text NOT NULL,
	"campaign_id" text,
	"type" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"aliases" jsonb NOT NULL,
	"source" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gm_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"body_md" text DEFAULT '' NOT NULL,
	"data" jsonb
);
--> statement-breakpoint
CREATE TABLE "knowledge" (
	"holder_entity_id" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	CONSTRAINT "knowledge_holder_entity_id_target_type_target_id_pk" PRIMARY KEY("holder_entity_id","target_type","target_id")
);
--> statement-breakpoint
CREATE TABLE "pc_sheets" (
	"campaign_id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	CONSTRAINT "permissions_subject_type_subject_id_user_id_pk" PRIMARY KEY("subject_type","subject_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "reads" (
	"session_id" text NOT NULL,
	"entity_id" text NOT NULL,
	"read_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rulings" (
	"id" text PRIMARY KEY NOT NULL,
	"world_id" text NOT NULL,
	"campaign_id" text,
	"text" text NOT NULL,
	"origin" text NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenes" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"chapter" integer NOT NULL,
	"number" integer NOT NULL,
	"place_entity_id" text,
	"present_entity_ids" jsonb NOT NULL,
	"summary_md" text DEFAULT '' NOT NULL,
	"started_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"logged_at" text
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"campaign_id" text,
	"key" text NOT NULL,
	"heading" text NOT NULL,
	"body_md" text NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"order" integer NOT NULL,
	"locked_by_user" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"opened_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"closed_at" text
);
--> statement-breakpoint
CREATE TABLE "threads" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"title" text NOT NULL,
	"body_md" text DEFAULT '' NOT NULL,
	"state" text DEFAULT 'open' NOT NULL,
	"tags" jsonb NOT NULL,
	"opened_chapter" integer,
	"resolved_chapter" integer
);
--> statement-breakpoint
CREATE TABLE "updates" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"seq" integer NOT NULL,
	"entity_ids" jsonb NOT NULL,
	"tags" jsonb NOT NULL,
	"type" text NOT NULL,
	"severity" text NOT NULL,
	"status" text NOT NULL,
	"story_time" text,
	"chapter" integer,
	"scene_id" text,
	"body_md" text NOT NULL,
	"supersedes_id" text,
	"conflicts_with" jsonb,
	"author" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "versions" (
	"id" text PRIMARY KEY NOT NULL,
	"object_type" text NOT NULL,
	"object_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"author" text NOT NULL,
	"edit_kind" text,
	"reason" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_anchors" (
	"campaign_id" text PRIMARY KEY NOT NULL,
	"sample_verbatim" text NOT NULL,
	"profile_md" text NOT NULL,
	"interior_level" text NOT NULL,
	"avoid_list" jsonb NOT NULL,
	"voice_rulings" jsonb NOT NULL,
	"scenes_since_audit" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worlds" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"pitch" text DEFAULT '' NOT NULL,
	"depth" text NOT NULL,
	"default_approval_mode" text NOT NULL,
	"as_of_story_time" text
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gm_notes" ADD CONSTRAINT "gm_notes_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge" ADD CONSTRAINT "knowledge_holder_entity_id_entities_id_fk" FOREIGN KEY ("holder_entity_id") REFERENCES "entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pc_sheets" ADD CONSTRAINT "pc_sheets_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reads" ADD CONSTRAINT "reads_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reads" ADD CONSTRAINT "reads_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rulings" ADD CONSTRAINT "rulings_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rulings" ADD CONSTRAINT "rulings_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_place_entity_id_entities_id_fk" FOREIGN KEY ("place_entity_id") REFERENCES "entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "updates" ADD CONSTRAINT "updates_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_anchors" ADD CONSTRAINT "voice_anchors_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worlds" ADD CONSTRAINT "worlds_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "entities_world_slug" ON "entities" USING btree ("world_id","slug");--> statement-breakpoint
CREATE INDEX "entities_campaign" ON "entities" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "reads_session_entity" ON "reads" USING btree ("session_id","entity_id");--> statement-breakpoint
CREATE INDEX "sections_entity" ON "sections" USING btree ("entity_id","campaign_id");--> statement-breakpoint
CREATE UNIQUE INDEX "updates_campaign_seq" ON "updates" USING btree ("campaign_id","seq");--> statement-breakpoint
CREATE INDEX "versions_object" ON "versions" USING btree ("object_type","object_id");