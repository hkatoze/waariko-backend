import { pgTable, uuid, integer, uniqueIndex } from 'drizzle-orm/pg-core'
import { companies } from './companies'

/**
 * Compteur de séquence par entreprise × année.
 * Incrémenté atomiquement via INSERT … ON CONFLICT DO UPDATE.
 * Remis à 0 chaque nouvel exercice.
 */
export const invoiceSequences = pgTable('invoice_sequences', {
  id:        uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  year:      integer('year').notNull(),
  lastSeq:   integer('last_seq').notNull().default(0),
}, (t) => [
  uniqueIndex('uq_invoice_seq_company_year').on(t.companyId, t.year),
])
