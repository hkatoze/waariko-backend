import { pgTable, uuid, text, timestamp, numeric, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { companies } from './companies'
import { clients } from './clients'
import { projects, settlementTypeEnum } from './projects'

export const invoiceTypeEnum     = pgEnum('invoice_type',     ['PROFORMA', 'FINAL', 'DELIVERY_NOTE'])
export const invoiceCategoryEnum = pgEnum('invoice_category', ['STANDARD', 'DEPOSIT', 'BALANCE'])
export { settlementTypeEnum }

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  type: invoiceTypeEnum('type').notNull().default('PROFORMA'),
  category: invoiceCategoryEnum('category').notNull().default('STANDARD'),
  number: text('number'),
  reference: text('reference'),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).default('0'),
  discountAmount: numeric('discount_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  discountRate: numeric('discount_rate', { precision: 5, scale: 2 }),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }),
  taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 12, scale: 2 }).default('0'),
  paymentModality: numeric('payment_modality', { precision: 12, scale: 2 }).default('0'),
  issuedAt: timestamp('issued_at').defaultNow().notNull(),
  dueDate: timestamp('due_date'),
  settlementType: settlementTypeEnum('settlement_type'),
  notes: text('notes'),
  internalNote: text('internal_note'),
  deletedAt: timestamp('deleted_at'),
  deletedBy: uuid('deleted_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('uq_invoices_company_number').on(t.companyId, t.number),
  uniqueIndex('uq_invoices_company_reference').on(t.companyId, t.reference),
  index('idx_invoices_company').on(t.companyId),
  index('idx_invoices_project').on(t.projectId),
])

export const invoiceItems = pgTable('invoice_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  quantity: numeric('quantity', { precision: 10, scale: 2 }).notNull(),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
  total: numeric('total', { precision: 12, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('idx_invoice_items_invoice').on(t.invoiceId),
])
