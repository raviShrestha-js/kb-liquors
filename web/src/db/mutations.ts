import { db } from './db'
import { newId } from '../lib/id'
import {
  serializeCategory,
  serializeStockItem,
  serializeCashSession,
  serializeSale,
  serializeSaleItem,
} from './serialize'
import type { Category, StockItem, CashSession, Sale, SaleItem } from './types'

async function enqueue(
  entity: 'categories' | 'stock_items' | 'cash_sessions' | 'sales' | 'sale_items',
  entityId: string,
  operation: 'insert' | 'update',
  payload: Record<string, unknown>,
) {
  await db.syncOutbox.add({
    entity,
    entityId,
    operation,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
    status: 'pending',
  })
}

export async function createCategory(storeId: string, name: string): Promise<Category> {
  const row: Category = { id: newId(), storeId, name, createdAt: new Date().toISOString() }
  await db.transaction('rw', db.categories, db.syncOutbox, async () => {
    await db.categories.add(row)
    await enqueue('categories', row.id, 'insert', serializeCategory(row))
  })
  return row
}

export interface NewStockItemInput {
  storeId: string
  categoryId: string | null
  name: string
  brand: string | null
  sizeMl: number | null
  sku: string | null
  costPrice: number
  salePrice: number
  quantityOnHand: number
  reorderLevel: number
  photoPath: string | null
  updatedBy: string | null
}

export async function createStockItem(input: NewStockItemInput): Promise<StockItem> {
  const row: StockItem = {
    id: newId(),
    ...input,
    isActive: true,
    updatedAt: new Date().toISOString(),
    version: 1,
  }
  await db.transaction('rw', db.stockItems, db.syncOutbox, async () => {
    await db.stockItems.add(row)
    await enqueue('stock_items', row.id, 'insert', serializeStockItem(row))
  })
  return row
}

export async function updateStockItem(
  id: string,
  patch: Partial<Omit<StockItem, 'id' | 'storeId'>>,
): Promise<StockItem> {
  return db.transaction('rw', db.stockItems, db.syncOutbox, async () => {
    const existing = await db.stockItems.get(id)
    if (!existing) throw new Error(`Stock item ${id} not found locally`)
    const updated: StockItem = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
      version: existing.version + 1,
    }
    await db.stockItems.put(updated)
    await enqueue('stock_items', updated.id, 'update', serializeStockItem(updated))
    return updated
  })
}

export async function openCashSession(
  storeId: string,
  openedBy: string | null,
  openingAmount: number,
): Promise<CashSession> {
  const existingOpen = await db.cashSessions.where({ storeId, status: 'open' }).first()
  if (existingOpen) throw new Error('A cash session is already open for this store.')

  const row: CashSession = {
    id: newId(),
    storeId,
    openedAt: new Date().toISOString(),
    openedBy,
    openingAmount,
    closedAt: null,
    closingCountedAmount: null,
    expectedAmount: null,
    discrepancy: null,
    status: 'open',
    notes: null,
    updatedAt: new Date().toISOString(),
  }
  await db.transaction('rw', db.cashSessions, db.syncOutbox, async () => {
    await db.cashSessions.add(row)
    await enqueue('cash_sessions', row.id, 'insert', serializeCashSession(row))
  })
  return row
}

export async function closeCashSession(
  sessionId: string,
  closingCountedAmount: number,
  notes: string | null,
): Promise<CashSession> {
  return db.transaction('rw', db.cashSessions, db.sales, db.syncOutbox, async () => {
    const session = await db.cashSessions.get(sessionId)
    if (!session) throw new Error(`Cash session ${sessionId} not found locally`)

    const sales = await db.sales.where({ cashSessionId: sessionId, status: 'completed' }).toArray()
    const cashSalesTotal = sales.reduce((sum, s) => sum + s.total, 0)
    const expectedAmount = session.openingAmount + cashSalesTotal

    const updated: CashSession = {
      ...session,
      closedAt: new Date().toISOString(),
      closingCountedAmount,
      expectedAmount,
      discrepancy: closingCountedAmount - expectedAmount,
      status: 'closed',
      notes,
      updatedAt: new Date().toISOString(),
    }
    await db.cashSessions.put(updated)
    await enqueue('cash_sessions', updated.id, 'update', serializeCashSession(updated))
    return updated
  })
}

export interface CartLine {
  stockItemId: string
  name: string
  quantity: number
  unitPrice: number
  unitCost: number
}

export interface CheckoutInput {
  storeId: string
  cashSessionId: string
  createdBy: string | null
  lines: CartLine[]
  discount?: number
}

export async function checkout(input: CheckoutInput): Promise<Sale> {
  const { storeId, cashSessionId, createdBy, lines, discount = 0 } = input
  if (lines.length === 0) throw new Error('Cannot check out an empty cart.')

  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)
  const costTotal = lines.reduce((sum, l) => sum + l.unitCost * l.quantity, 0)
  const total = subtotal - discount

  const sale: Sale = {
    id: newId(),
    storeId,
    cashSessionId,
    soldAt: new Date().toISOString(),
    subtotal,
    discount,
    total,
    costTotal,
    paymentMethod: 'cash',
    status: 'completed',
    createdBy,
  }

  const saleItems: SaleItem[] = lines.map((line) => ({
    id: newId(),
    saleId: sale.id,
    stockItemId: line.stockItemId,
    itemNameSnapshot: line.name,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    unitCost: line.unitCost,
    lineTotal: line.unitPrice * line.quantity,
  }))

  await db.transaction('rw', db.sales, db.saleItems, db.stockItems, db.syncOutbox, async () => {
    await db.sales.add(sale)
    await enqueue('sales', sale.id, 'insert', serializeSale(sale))

    for (const item of saleItems) {
      await db.saleItems.add(item)
      await enqueue('sale_items', item.id, 'insert', serializeSaleItem(item))

      // Mirror the server trigger locally so the UI reflects the new stock
      // level immediately, offline included. The server is still the only
      // place that decrements on the authoritative record (via its own
      // trigger on sale_items insert), so this local write never round-trips.
      const stockItem = await db.stockItems.get(item.stockItemId!)
      if (stockItem) {
        await db.stockItems.put({
          ...stockItem,
          quantityOnHand: stockItem.quantityOnHand - item.quantity,
        })
      }
    }
  })

  return sale
}
