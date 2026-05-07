import { pgTable, uuid, text, timestamp, pgEnum, index } from 'drizzle-orm/pg-core'
import { companies } from './companies'

export const clientTypeEnum = pgEnum('client_type', ['COMPANY', 'INDIVIDUAL'])

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  type: clientTypeEnum('type').notNull(),
  name: text('name').notNull(),
  countryCode: text('country_code').notNull(),
  sector: text('sector'),
  email: text('email'),
  address: text('address'),
  legalInfo:        text('legal_info'),
  rccm:             text('rccm'),
  ifu:              text('ifu'),
  divisionFiscale:  text('division_fiscale'),
  regimeImposition: text('regime_imposition'),
  internalContactName: text('internal_contact_name'),
  internalContactEmail: text('internal_contact_email'),
  internalContactPhone: text('internal_contact_phone'),
  internalContactJobTitle: text('internal_contact_job_title'),
  deletedAt: timestamp('deleted_at'),
  deletedBy: uuid('deleted_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('idx_clients_company').on(t.companyId),
  index('idx_clients_company_name').on(t.companyId, t.name),
  index('idx_clients_deleted_at').on(t.deletedAt),
])
