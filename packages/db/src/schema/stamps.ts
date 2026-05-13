import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core'
import { companies } from './companies'

export const companyStamps = pgTable('company_stamps', {
  id:        uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  label:     text('label').notNull().default(''),
  url:       text('url').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_stamps_company').on(t.companyId),
])
