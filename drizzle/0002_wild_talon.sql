CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`incidentCode` varchar(32) NOT NULL,
	`actor` varchar(120) NOT NULL,
	`action` varchar(80) NOT NULL,
	`detail` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
