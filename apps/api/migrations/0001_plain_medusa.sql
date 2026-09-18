CREATE TABLE `conversation` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `conversation_user_updated_idx` ON `conversation` (`user_id`,`updated_at`);--> statement-breakpoint
-- Preserve existing Flue instance identities; never copy or rewrite transcripts.
INSERT INTO conversation (id, user_id, title, created_at, updated_at)
SELECT id, id, '历史对话', created_at, updated_at FROM user;
