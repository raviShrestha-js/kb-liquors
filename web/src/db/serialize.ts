import type { Category, StockItem, CashSession, Sale, SaleItem, BankTransaction, CashExpense } from './types'

// The client generates `id` up front, and every payload sends it as both
// `id` and `client_generated_id` — so a retried push is a no-op upsert
// keyed on the same value, never a duplicate row.

export function serializeCategory(row: Category) {
  return {
    id: row.id,
    client_generated_id: row.id,
    store_id: row.storeId,
    name: row.name,
    created_at: row.createdAt,
  }
}

export function serializeStockItem(row: StockItem) {
  return {
    id: row.id,
    client_generated_id: row.id,
    store_id: row.storeId,
    category_id: row.categoryId,
    name: row.name,
    brand: row.brand,
    size_ml: row.sizeMl,
    sku: row.sku,
    cost_price: row.costPrice,
    sale_price: row.salePrice,
    quantity_on_hand: row.quantityOnHand,
    reorder_level: row.reorderLevel,
    photo_path: row.photoPath,
    is_active: row.isActive,
    updated_at: row.updatedAt,
    updated_by: row.updatedBy,
    version: row.version,
  }
}

export function serializeCashSession(row: CashSession) {
  return {
    id: row.id,
    client_generated_id: row.id,
    store_id: row.storeId,
    opened_at: row.openedAt,
    opened_by: row.openedBy,
    opening_amount: row.openingAmount,
    closed_at: row.closedAt,
    closing_counted_amount: row.closingCountedAmount,
    expected_amount: row.expectedAmount,
    discrepancy: row.discrepancy,
    status: row.status,
    notes: row.notes,
    updated_at: row.updatedAt,
  }
}

export function serializeSale(row: Sale) {
  return {
    id: row.id,
    client_generated_id: row.id,
    store_id: row.storeId,
    cash_session_id: row.cashSessionId,
    sold_at: row.soldAt,
    subtotal: row.subtotal,
    discount: row.discount,
    total: row.total,
    cost_total: row.costTotal,
    payment_method: row.paymentMethod,
    status: row.status,
    created_by: row.createdBy,
    updated_at: row.updatedAt,
  }
}

export function serializeSaleItem(row: SaleItem) {
  return {
    id: row.id,
    client_generated_id: row.id,
    sale_id: row.saleId,
    stock_item_id: row.stockItemId,
    item_name_snapshot: row.itemNameSnapshot,
    quantity: row.quantity,
    unit_price: row.unitPrice,
    unit_cost: row.unitCost,
    line_total: row.lineTotal,
  }
}

export function serializeBankTransaction(row: BankTransaction) {
  return {
    id: row.id,
    client_generated_id: row.id,
    store_id: row.storeId,
    occurred_at: row.occurredAt,
    direction: row.direction,
    amount: row.amount,
    category: row.category,
    notes: row.notes,
    related_sale_id: row.relatedSaleId,
    created_by: row.createdBy,
    updated_at: row.updatedAt,
  }
}

export function deserializeBankTransaction(row: Record<string, any>): BankTransaction {
  return {
    id: row.id,
    storeId: row.store_id,
    occurredAt: row.occurred_at,
    direction: row.direction,
    amount: Number(row.amount),
    category: row.category,
    notes: row.notes,
    relatedSaleId: row.related_sale_id,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
  }
}

export function serializeCashExpense(row: CashExpense) {
  return {
    id: row.id,
    client_generated_id: row.id,
    store_id: row.storeId,
    cash_session_id: row.cashSessionId,
    occurred_at: row.occurredAt,
    amount: row.amount,
    category: row.category,
    notes: row.notes,
    created_by: row.createdBy,
    updated_at: row.updatedAt,
  }
}

export function deserializeCashExpense(row: Record<string, any>): CashExpense {
  return {
    id: row.id,
    storeId: row.store_id,
    cashSessionId: row.cash_session_id,
    occurredAt: row.occurred_at,
    amount: Number(row.amount),
    category: row.category,
    notes: row.notes,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
  }
}

export function deserializeStockItem(row: Record<string, any>): StockItem {
  return {
    id: row.id,
    storeId: row.store_id,
    categoryId: row.category_id,
    name: row.name,
    brand: row.brand,
    sizeMl: row.size_ml,
    sku: row.sku,
    costPrice: Number(row.cost_price),
    salePrice: Number(row.sale_price),
    quantityOnHand: row.quantity_on_hand,
    reorderLevel: row.reorder_level,
    photoPath: row.photo_path,
    isActive: row.is_active,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    version: row.version,
  }
}

export function deserializeCategory(row: Record<string, any>): Category {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    createdAt: row.created_at,
  }
}

export function deserializeCashSession(row: Record<string, any>): CashSession {
  return {
    id: row.id,
    storeId: row.store_id,
    openedAt: row.opened_at,
    openedBy: row.opened_by,
    openingAmount: Number(row.opening_amount),
    closedAt: row.closed_at,
    closingCountedAmount: row.closing_counted_amount === null ? null : Number(row.closing_counted_amount),
    expectedAmount: row.expected_amount === null ? null : Number(row.expected_amount),
    discrepancy: row.discrepancy === null ? null : Number(row.discrepancy),
    status: row.status,
    notes: row.notes,
    updatedAt: row.updated_at,
  }
}

export function deserializeSale(row: Record<string, any>): Sale {
  return {
    id: row.id,
    storeId: row.store_id,
    cashSessionId: row.cash_session_id,
    soldAt: row.sold_at,
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    total: Number(row.total),
    costTotal: Number(row.cost_total),
    paymentMethod: row.payment_method,
    status: row.status,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
  }
}

export function deserializeSaleItem(row: Record<string, any>): SaleItem {
  return {
    id: row.id,
    saleId: row.sale_id,
    stockItemId: row.stock_item_id,
    itemNameSnapshot: row.item_name_snapshot,
    quantity: row.quantity,
    unitPrice: Number(row.unit_price),
    unitCost: Number(row.unit_cost),
    lineTotal: Number(row.line_total),
  }
}
