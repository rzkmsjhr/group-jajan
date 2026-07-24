CREATE TABLE `menu_items` (
	`id` text PRIMARY KEY NOT NULL,
	`menu_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price_cents` integer NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`menu_id`) REFERENCES `menus`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `menus` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`note` text,
	`payment_instructions` text,
	`admin_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`item_name` text NOT NULL,
	`quantity` integer NOT NULL,
	`price_cents` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`menu_id` text NOT NULL,
	`customer_name` text NOT NULL,
	`total_cents` integer NOT NULL,
	`status` text DEFAULT 'unpaid' NOT NULL,
	`proof_key` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`menu_id`) REFERENCES `menus`(`id`) ON UPDATE no action ON DELETE cascade
);
