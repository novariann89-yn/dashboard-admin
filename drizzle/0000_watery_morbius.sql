CREATE TABLE `bonus_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` integer NOT NULL,
	`rule_id` integer,
	`purchase_id` integer,
	`reward_product_id` integer,
	`reward_product_name` text NOT NULL,
	`reward_qty` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'earned' NOT NULL,
	`earned_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`redeemed_at` integer,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rule_id`) REFERENCES `bonus_rules`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reward_product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `bonus_events_member_idx` ON `bonus_events` (`member_id`);--> statement-breakpoint
CREATE INDEX `bonus_events_status_idx` ON `bonus_events` (`status`);--> statement-breakpoint
CREATE TABLE `bonus_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`threshold` integer NOT NULL,
	`reward_product_id` integer NOT NULL,
	`reward_qty` integer DEFAULT 1 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`reward_product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`notes` text,
	`is_active` integer DEFAULT true NOT NULL,
	`bonus_progress` integer DEFAULT 0 NOT NULL,
	`total_purchases` integer DEFAULT 0 NOT NULL,
	`total_bonuses` integer DEFAULT 0 NOT NULL,
	`joined_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_phone_unique` ON `members` (`phone`);--> statement-breakpoint
CREATE INDEX `members_phone_idx` ON `members` (`phone`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`price` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `purchase_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`purchase_id` integer NOT NULL,
	`product_id` integer,
	`product_name` text NOT NULL,
	`unit_price` integer DEFAULT 0 NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`subtotal` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `purchase_items_purchase_idx` ON `purchase_items` (`purchase_id`);--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` integer NOT NULL,
	`total_amount` integer DEFAULT 0 NOT NULL,
	`note` text,
	`counts_toward_bonus` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`occurred_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `purchases_member_idx` ON `purchases` (`member_id`);--> statement-breakpoint
CREATE INDEX `purchases_occurred_idx` ON `purchases` (`occurred_at`);