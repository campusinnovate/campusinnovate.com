import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const eventLeads = sqliteTable("event_leads", {
 id: text("id").primaryKey(), createdAt: text("created_at").notNull(), nameCompany: text("name_company").notNull(),
 whatsapp: text("whatsapp").notNull(), eventType: text("event_type").notNull(), eventDate: text("event_date").notNull(),
 participants: integer("participants"), requirements: text("requirements").notNull(), attribution: text("attribution").notNull(),
 status: text("status").notNull(), consentVersion: text("consent_version").notNull()
}, table => [index("event_leads_created_at_idx").on(table.createdAt)]);
