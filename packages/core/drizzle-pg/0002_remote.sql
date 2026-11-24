CREATE TABLE "oauth_clients" (
	"client_id" text PRIMARY KEY NOT NULL,
	"secret_hash" text,
	"name" text DEFAULT '' NOT NULL,
	"redirect_uris" jsonb NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_codes" (
	"code_hash" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"user_id" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"code_challenge" text NOT NULL,
	"scope" text DEFAULT '' NOT NULL,
	"resource" text,
	"expires_at" text NOT NULL,
	"used_at" text
);
--> statement-breakpoint
CREATE TABLE "oauth_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"client_id" text NOT NULL,
	"user_id" text NOT NULL,
	"scope" text DEFAULT '' NOT NULL,
	"expires_at" text NOT NULL,
	"revoked_at" text
);
--> statement-breakpoint
CREATE TABLE "pending_imports" (
	"id" text PRIMARY KEY NOT NULL,
	"world_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "oauth_tokens_user" ON "oauth_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pending_imports_world" ON "pending_imports" USING btree ("world_id");