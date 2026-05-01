import { pgTable, uuid, text, timestamp, numeric, integer, index } from 'drizzle-orm/pg-core'
import { companies } from './companies'

export const stockCategories = pgTable('stock_categories', {
  id:        uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('idx_stock_cat_company').on(t.companyId),
])

export const stockProducts = pgTable('stock_products', {
  id:            uuid('id').primaryKey().defaultRandom(),
  companyId:     uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  categoryId:    uuid('category_id').references(() => stockCategories.id, { onDelete: 'set null' }),
  name:          text('name').notNull(),
  purchasePrice: numeric('purchase_price', { precision: 12, scale: 2 }).notNull().default('0'),
  salePrice:     numeric('sale_price',     { precision: 12, scale: 2 }).notNull().default('0'),
  quantity:      integer('quantity').notNull().default(0),
  deletedAt:     timestamp('deleted_at'),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
  updatedAt:     timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('idx_stock_prod_company').on(t.companyId),
  index('idx_stock_prod_category').on(t.categoryId),
])
