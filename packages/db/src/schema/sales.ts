import { pgTable, uuid, text, timestamp, numeric, integer, pgEnum, index } from 'drizzle-orm/pg-core'
import { companies } from './companies'
import { stockProducts } from './stock'

export const saleTypeEnum   = pgEnum('sale_type',   ['NORMAL', 'CREDIT'])
export const saleStatusEnum = pgEnum('sale_status', ['PENDING', 'SETTLED'])

export const sales = pgTable('sales', {
  id:             uuid('id').primaryKey().defaultRandom(),
  companyId:      uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  clientName:     text('client_name').notNull(),
  reference:      text('reference'),
  saleDate:       timestamp('sale_date').defaultNow().notNull(),
  discountAmount: numeric('discount_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  taxRate:        numeric('tax_rate',        { precision: 5,  scale: 2  }).notNull().default('0'),
  taxAmount:      numeric('tax_amount',      { precision: 12, scale: 2 }).notNull().default('0'),
  subtotal:       numeric('subtotal',        { precision: 12, scale: 2 }).notNull().default('0'),
  total:          numeric('total',           { precision: 12, scale: 2 }).notNull().default('0'),
  saleType:       saleTypeEnum('sale_type').notNull().default('NORMAL'),
  depositAmount:  numeric('deposit_amount',  { precision: 12, scale: 2 }).notNull().default('0'),
  status:         saleStatusEnum('status').notNull().default('PENDING'),
  notes:          text('notes'),
  deletedAt:      timestamp('deleted_at'),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
  updatedAt:      timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('idx_sales_company').on(t.companyId),
  index('idx_sales_status').on(t.status),
])

export const saleItems = pgTable('sale_items', {
  id:          uuid('id').primaryKey().defaultRandom(),
  saleId:      uuid('sale_id').notNull().references(() => sales.id, { onDelete: 'cascade' }),
  productId:   uuid('product_id').references(() => stockProducts.id, { onDelete: 'set null' }),
  designation: text('designation').notNull(),
  quantity:    integer('quantity').notNull().default(1),
  unitPrice:   numeric('unit_price', { precision: 12, scale: 2 }).notNull().default('0'),
  total:       numeric('total',      { precision: 12, scale: 2 }).notNull().default('0'),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('idx_sale_items_sale').on(t.saleId),
])
