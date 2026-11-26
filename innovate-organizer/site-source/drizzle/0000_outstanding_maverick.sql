CREATE TABLE `event_leads` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`name_company` text NOT NULL,
	`whatsapp` text NOT NULL,
	`event_type` text NOT NULL,
	`event_date` text NOT NULL,
	`participants` integer,
	`requirements` text NOT NULL,
	`attribution` text NOT NULL,
	`status` text NOT NULL,
	`consent_version` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `event_leads_created_at_idx` ON `event_leads` (`created_at`);