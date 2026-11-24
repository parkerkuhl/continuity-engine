ALTER TABLE `entities` ADD `status` text DEFAULT 'confirmed' NOT NULL;--> statement-breakpoint
ALTER TABLE `worlds` ADD `as_of_story_time` text;