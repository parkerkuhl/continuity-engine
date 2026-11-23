CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`settings` text NOT NULL,
	`approval_mode` text NOT NULL,
	`severity_policy` text NOT NULL,
	`as_of_story_time` text,
	`current_chapter` integer DEFAULT 1 NOT NULL,
	`spoilers_on` integer DEFAULT false NOT NULL,
	`last_session_at` text,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `chapters` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`number` integer NOT NULL,
	`title` text NOT NULL,
	`summary_md` text DEFAULT '' NOT NULL,
	`closed_at` text,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `entities` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`campaign_id` text,
	`type` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`aliases` text NOT NULL,
	`source` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entities_world_slug` ON `entities` (`world_id`,`slug`);--> statement-breakpoint
CREATE INDEX `entities_campaign` ON `entities` (`campaign_id`);--> statement-breakpoint
CREATE TABLE `gm_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`kind` text NOT NULL,
	`key` text NOT NULL,
	`body_md` text DEFAULT '' NOT NULL,
	`data` text,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `knowledge` (
	`holder_entity_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	PRIMARY KEY(`holder_entity_id`, `target_type`, `target_id`),
	FOREIGN KEY (`holder_entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pc_sheets` (
	`campaign_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `permissions` (
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	PRIMARY KEY(`subject_type`, `subject_id`, `user_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reads` (
	`session_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`read_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reads_session_entity` ON `reads` (`session_id`,`entity_id`);--> statement-breakpoint
CREATE TABLE `rulings` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`campaign_id` text,
	`text` text NOT NULL,
	`origin` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `scenes` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`chapter` integer NOT NULL,
	`number` integer NOT NULL,
	`place_entity_id` text,
	`present_entity_ids` text NOT NULL,
	`summary_md` text DEFAULT '' NOT NULL,
	`started_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`logged_at` text,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`place_entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sections` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_id` text NOT NULL,
	`campaign_id` text,
	`key` text NOT NULL,
	`heading` text NOT NULL,
	`body_md` text NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`order` integer NOT NULL,
	`locked_by_user` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sections_entity` ON `sections` (`entity_id`,`campaign_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`opened_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`closed_at` text,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `threads` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`title` text NOT NULL,
	`body_md` text DEFAULT '' NOT NULL,
	`state` text DEFAULT 'open' NOT NULL,
	`tags` text NOT NULL,
	`opened_chapter` integer,
	`resolved_chapter` integer,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `updates` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`seq` integer NOT NULL,
	`entity_ids` text NOT NULL,
	`tags` text NOT NULL,
	`type` text NOT NULL,
	`severity` text NOT NULL,
	`status` text NOT NULL,
	`story_time` text,
	`chapter` integer,
	`scene_id` text,
	`body_md` text NOT NULL,
	`supersedes_id` text,
	`author` text NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `updates_campaign_seq` ON `updates` (`campaign_id`,`seq`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `versions` (
	`id` text PRIMARY KEY NOT NULL,
	`object_type` text NOT NULL,
	`object_id` text NOT NULL,
	`before` text,
	`after` text,
	`author` text NOT NULL,
	`edit_kind` text,
	`reason` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `versions_object` ON `versions` (`object_type`,`object_id`);--> statement-breakpoint
CREATE TABLE `voice_anchors` (
	`campaign_id` text PRIMARY KEY NOT NULL,
	`sample_verbatim` text NOT NULL,
	`profile_md` text NOT NULL,
	`interior_level` text NOT NULL,
	`avoid_list` text NOT NULL,
	`voice_rulings` text NOT NULL,
	`scenes_since_audit` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `worlds` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`pitch` text DEFAULT '' NOT NULL,
	`depth` text NOT NULL,
	`default_approval_mode` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
