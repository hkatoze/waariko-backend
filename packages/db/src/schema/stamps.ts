import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core'
import { companies } from './companies'
import { projects } from './projects'

export const companyStamps = pgTable('company_stamps', {
  id:        uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  label:     text('label').notNull().default(''),
  url:       text('url').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_stamps_company').on(t.companyId),
  index('idx_stamps_project').on(t.projectId),
])

// Sessions éphémères pour le bridge QR (mobile → desktop)
// Stockées en DB pour survivre aux redémarrages Render free tier
export const stampSessions = pgTable('stamp_sessions', {
  id:         uuid('id').primaryKey().defaultRandom(),
  companyId:  uuid('company_id').notNull(),
  invoiceId:  uuid('invoice_id').notNull(),
  status:     text('status').notNull().default('waiting'),  // 'waiting' | 'received'
  stampUrl:   text('stamp_url'),
  expiresAt:  timestamp('expires_at').notNull(),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_stamp_sessions_expires').on(t.expiresAt),
])
