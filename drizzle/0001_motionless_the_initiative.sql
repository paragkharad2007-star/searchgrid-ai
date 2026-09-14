CREATE TABLE `incidents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`title` varchar(160) NOT NULL,
	`venue` varchar(160) NOT NULL,
	`status` enum('active','resolved') NOT NULL DEFAULT 'active',
	`lastSeenZone` varchar(80) NOT NULL,
	`lastSeenAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `incidents_id` PRIMARY KEY(`id`),
	CONSTRAINT `incidents_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `sightings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`incidentId` int NOT NULL,
	`zone` varchar(80) NOT NULL,
	`label` varchar(160) NOT NULL,
	`source` varchar(120) NOT NULL,
	`confidence` int NOT NULL,
	`reportedBy` varchar(80),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sightings_id` PRIMARY KEY(`id`)
);
