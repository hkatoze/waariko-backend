import { db, stockCategories, stockProducts, eq, and, isNull, desc, asc } from '@waariko/db'

// ── Catégories ────────────────────────────────────────────────────────────────

export async function getCategories(companyId: string) {
  return db
    .select()
    .from(stockCategories)
    .where(eq(stockCategories.companyId, companyId))
    .orderBy(asc(stockCategories.name))
}

export async function createCategory(companyId: string, name: string) {
  const [row] = await db
    .insert(stockCategories)
    .values({ companyId, name })
    .returning()
  return row
}

export async function updateCategory(companyId: string, categoryId: string, name: string) {
  const [row] = await db
    .update(stockCategories)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(stockCategories.companyId, companyId), eq(stockCategories.id, categoryId)))
    .returning()
  return row
}

export async function deleteCategory(companyId: string, categoryId: string) {
  await db
    .delete(stockCategories)
    .where(and(eq(stockCategories.companyId, companyId), eq(stockCategories.id, categoryId)))
}

// ── Produits ──────────────────────────────────────────────────────────────────

export async function getProducts(companyId: string, categoryId?: string) {
  const conditions = [
    eq(stockProducts.companyId, companyId),
    isNull(stockProducts.deletedAt),
  ]
  if (categoryId) conditions.push(eq(stockProducts.categoryId, categoryId))

  return db
    .select({
      id:            stockProducts.id,
      companyId:     stockProducts.companyId,
      categoryId:    stockProducts.categoryId,
      name:          stockProducts.name,
      purchasePrice: stockProducts.purchasePrice,
      salePrice:     stockProducts.salePrice,
      quantity:      stockProducts.quantity,
      createdAt:     stockProducts.createdAt,
      category: { id: stockCategories.id, name: stockCategories.name },
    })
    .from(stockProducts)
    .leftJoin(stockCategories, eq(stockProducts.categoryId, stockCategories.id))
    .where(and(...conditions))
    .orderBy(desc(stockProducts.createdAt))
}

export async function createProducts(
  companyId: string,
  categoryId: string | null,
  items: { name: string; purchasePrice: string; salePrice: string; quantity: number }[],
) {
  const rows = await db
    .insert(stockProducts)
    .values(items.map(item => ({ ...item, companyId, categoryId })))
    .returning()
  return rows
}

export async function updateProduct(
  companyId: string,
  productId: string,
  data: Partial<{
    name: string; purchasePrice: string; salePrice: string
    quantity: number; categoryId: string | null
  }>,
) {
  const [row] = await db
    .update(stockProducts)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(stockProducts.companyId, companyId), eq(stockProducts.id, productId)))
    .returning()
  return row
}

export async function deleteProduct(companyId: string, productId: string) {
  const [row] = await db
    .update(stockProducts)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(stockProducts.companyId, companyId), eq(stockProducts.id, productId)))
    .returning()
  return row
}
