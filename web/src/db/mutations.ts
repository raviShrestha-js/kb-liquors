import { db } from './db'
import { newId } from '../lib/id'
import {
  serializeCategory,
  serializeStockItem,
  serializeCashSession,
  serializeSale,
  serializeSaleItem,
  serializeBankTransaction,
  serializeCashExpense,
} from './serialize'
import type {
  Category,
  StockItem,
  CashSession,
  Sale,
  SaleItem,
  PaymentMethod,
  BankTransaction,
  CashExpense,
} from './types'
import type { SyncEntity } from './types'

async function enqueue(
  entity: SyncEntity,
  entityId: string,
  operation: 'insert' | 'update' | 'delete',
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

export async function updateCategory(id: string, name: string): Promise<Category> {
  return db.transaction('rw', db.categories, db.syncOutbox, async () => {
    const existing = await db.categories.get(id)
    if (!existing) throw new Error(`Category ${id} not found locally`)
    const updated: Category = { ...existing, name }
    await db.categories.put(updated)
    await enqueue('categories', id, 'update', serializeCategory(updated))
    return updated
  })
}

export async function deleteCategory(id: string): Promise<void> {
  await db.transaction('rw', db.categories, db.stockItems, db.syncOutbox, async () => {
    // Clear the category off any stock items first — via updateStockItem's
    // normal path so each gets a fresh updated_at/version and syncs properly,
    // rather than leaving them pointing at a category that no longer exists.
    const affected = await db.stockItems.where({ categoryId: id }).toArray()
    for (const item of affected) {
      const updated: StockItem = { ...item, categoryId: null, updatedAt: new Date().toISOString(), version: item.version + 1 }
      await db.stockItems.put(updated)
      await enqueue('stock_items', updated.id, 'update', serializeStockItem(updated))
    }

    await db.categories.delete(id)
    await enqueue('categories', id, 'delete', { id })
  })
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

// Sales history references stock_items, so this is a soft delete (isActive:
// false) rather than a row delete — it disappears from Stock/POS immediately,
// but past sales keep their item reference. The photo, if any, is genuinely
// deleted from storage via a queued deletion (works even while offline).
export async function deleteStockItem(id: string): Promise<void> {
  await db.transaction('rw', db.stockItems, db.photoDeletions, db.syncOutbox, async () => {
    const existing = await db.stockItems.get(id)
    if (!existing) throw new Error(`Stock item ${id} not found locally`)

    const updated: StockItem = {
      ...existing,
      isActive: false,
      photoPath: null,
      updatedAt: new Date().toISOString(),
      version: existing.version + 1,
    }
    await db.stockItems.put(updated)
    await enqueue('stock_items', updated.id, 'update', serializeStockItem(updated))

    if (existing.photoPath) {
      await db.photoDeletions.add({
        id: newId(),
        photoPath: existing.photoPath,
        createdAt: new Date().toISOString(),
        attempts: 0,
        lastError: null,
        status: 'pending',
      })
    }
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

async function cashSalesTotalFor(sessionId: string): Promise<number> {
  // Bank-paid sales never touch the physical cash drawer, so only cash
  // sales count toward the expected cash-in-hand total.
  const sales = await db.sales.where({ cashSessionId: sessionId, status: 'completed' }).toArray()
  return sales.filter((s) => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.total, 0)
}

async function cashExpensesTotalFor(sessionId: string): Promise<number> {
  const expenses = await db.cashExpenses.where({ cashSessionId: sessionId }).toArray()
  return expenses.reduce((sum, e) => sum + e.amount, 0)
}

async function expectedCashFor(sessionId: string, openingAmount: number): Promise<number> {
  const [sales, expenses] = await Promise.all([cashSalesTotalFor(sessionId), cashExpensesTotalFor(sessionId)])
  return openingAmount + sales - expenses
}

export async function closeCashSession(
  sessionId: string,
  closingCountedAmount: number,
  notes: string | null,
): Promise<CashSession> {
  return db.transaction('rw', db.cashSessions, db.sales, db.cashExpenses, db.syncOutbox, async () => {
    const session = await db.cashSessions.get(sessionId)
    if (!session) throw new Error(`Cash session ${sessionId} not found locally`)

    const expectedAmount = await expectedCashFor(sessionId, session.openingAmount)

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

export interface CashSessionEditInput {
  openingAmount?: number
  closingCountedAmount?: number
  notes?: string | null
}

// Fixes a mistake on an existing session (wrong opening float, mis-counted
// close) — recomputes expected/discrepancy from the current figures so they
// never drift out of sync with what's displayed.
export async function updateCashSessionDetails(
  sessionId: string,
  edit: CashSessionEditInput,
): Promise<CashSession> {
  return db.transaction('rw', db.cashSessions, db.sales, db.cashExpenses, db.syncOutbox, async () => {
    const session = await db.cashSessions.get(sessionId)
    if (!session) throw new Error(`Cash session ${sessionId} not found locally`)

    const openingAmount = edit.openingAmount ?? session.openingAmount
    const closingCountedAmount = edit.closingCountedAmount ?? session.closingCountedAmount
    const notes = edit.notes !== undefined ? edit.notes : session.notes

    const isClosed = session.status === 'closed'
    const expectedAmount = isClosed ? await expectedCashFor(sessionId, openingAmount) : session.expectedAmount
    const discrepancy =
      isClosed && closingCountedAmount !== null ? closingCountedAmount - (expectedAmount ?? 0) : session.discrepancy

    const updated: CashSession = {
      ...session,
      openingAmount,
      closingCountedAmount,
      notes,
      expectedAmount,
      discrepancy,
      updatedAt: new Date().toISOString(),
    }
    await db.cashSessions.put(updated)
    await enqueue('cash_sessions', updated.id, 'update', serializeCashSession(updated))
    return updated
  })
}

// Only safe when nothing references this session — sales/cash_expenses both
// require a cash_session_id, so deleting one that's in use would fail server-side.
export async function deleteCashSession(sessionId: string): Promise<void> {
  await db.transaction('rw', db.cashSessions, db.sales, db.cashExpenses, db.syncOutbox, async () => {
    const [salesCount, expensesCount] = await Promise.all([
      db.sales.where({ cashSessionId: sessionId }).count(),
      db.cashExpenses.where({ cashSessionId: sessionId }).count(),
    ])
    if (salesCount > 0 || expensesCount > 0) {
      const parts = []
      if (salesCount > 0) parts.push(`${salesCount} sale(s)`)
      if (expensesCount > 0) parts.push(`${expensesCount} expense(s)`)
      throw new Error(`Can't delete — ${parts.join(' and ')} are linked to this session.`)
    }
    await db.cashSessions.delete(sessionId)
    await enqueue('cash_sessions', sessionId, 'delete', { id: sessionId })
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
  paymentMethod?: PaymentMethod
}

export async function checkout(input: CheckoutInput): Promise<Sale> {
  const { storeId, cashSessionId, createdBy, lines, discount = 0, paymentMethod = 'cash' } = input
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
    paymentMethod,
    status: 'completed',
    createdBy,
    updatedAt: new Date().toISOString(),
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

  // A bank-paid sale is also a bank ledger entry — recorded automatically so
  // the owner never has to double-enter the same sale in two places.
  const bankTransaction: BankTransaction | null =
    paymentMethod === 'bank'
      ? {
          id: newId(),
          storeId,
          occurredAt: sale.soldAt,
          direction: 'in',
          amount: total,
          category: 'Sale',
          notes: null,
          relatedSaleId: sale.id,
          createdBy,
          updatedAt: sale.soldAt,
        }
      : null

  await db.transaction(
    'rw',
    db.sales,
    db.saleItems,
    db.stockItems,
    db.bankTransactions,
    db.syncOutbox,
    async () => {
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

      if (bankTransaction) {
        await db.bankTransactions.add(bankTransaction)
        await enqueue('bank_transactions', bankTransaction.id, 'insert', serializeBankTransaction(bankTransaction))
      }
    },
  )

  return sale
}

export interface NewBankTransactionInput {
  storeId: string
  occurredAt: string
  direction: 'in' | 'out'
  amount: number
  category: string
  notes: string | null
  createdBy: string | null
}

export async function createBankTransaction(input: NewBankTransactionInput): Promise<BankTransaction> {
  const row: BankTransaction = { id: newId(), relatedSaleId: null, updatedAt: new Date().toISOString(), ...input }
  await db.transaction('rw', db.bankTransactions, db.syncOutbox, async () => {
    await db.bankTransactions.add(row)
    await enqueue('bank_transactions', row.id, 'insert', serializeBankTransaction(row))
  })
  return row
}

export interface BankTransactionEditInput {
  occurredAt?: string
  direction?: 'in' | 'out'
  amount?: number
  category?: string
  notes?: string | null
}

// POS-generated entries (relatedSaleId set) stay read-only here — they mirror
// an actual sale, so fixing one means editing/voiding the sale, not the ledger row.
export async function updateBankTransaction(
  id: string,
  patch: BankTransactionEditInput,
): Promise<BankTransaction> {
  return db.transaction('rw', db.bankTransactions, db.syncOutbox, async () => {
    const existing = await db.bankTransactions.get(id)
    if (!existing) throw new Error(`Bank transaction ${id} not found locally`)
    if (existing.relatedSaleId) throw new Error("Can't edit — this entry came from a POS sale.")

    const updated: BankTransaction = { ...existing, ...patch, updatedAt: new Date().toISOString() }
    await db.bankTransactions.put(updated)
    await enqueue('bank_transactions', id, 'update', serializeBankTransaction(updated))
    return updated
  })
}

export async function deleteBankTransaction(id: string): Promise<void> {
  await db.transaction('rw', db.bankTransactions, db.syncOutbox, async () => {
    const existing = await db.bankTransactions.get(id)
    if (!existing) throw new Error(`Bank transaction ${id} not found locally`)
    if (existing.relatedSaleId) throw new Error("Can't delete — this entry came from a POS sale.")

    await db.bankTransactions.delete(id)
    await enqueue('bank_transactions', id, 'delete', { id })
  })
}

export interface NewCashExpenseInput {
  storeId: string
  cashSessionId: string
  occurredAt: string
  amount: number
  category: string
  notes: string | null
  createdBy: string | null
}

export async function createCashExpense(input: NewCashExpenseInput): Promise<CashExpense> {
  const row: CashExpense = { id: newId(), updatedAt: new Date().toISOString(), ...input }
  await db.transaction('rw', db.cashExpenses, db.syncOutbox, async () => {
    await db.cashExpenses.add(row)
    await enqueue('cash_expenses', row.id, 'insert', serializeCashExpense(row))
  })
  return row
}

export interface CashExpenseEditInput {
  occurredAt?: string
  amount?: number
  category?: string
  notes?: string | null
}

export async function updateCashExpense(id: string, patch: CashExpenseEditInput): Promise<CashExpense> {
  return db.transaction('rw', db.cashExpenses, db.syncOutbox, async () => {
    const existing = await db.cashExpenses.get(id)
    if (!existing) throw new Error(`Cash expense ${id} not found locally`)

    const updated: CashExpense = { ...existing, ...patch, updatedAt: new Date().toISOString() }
    await db.cashExpenses.put(updated)
    await enqueue('cash_expenses', id, 'update', serializeCashExpense(updated))
    return updated
  })
}

export async function deleteCashExpense(id: string): Promise<void> {
  await db.transaction('rw', db.cashExpenses, db.syncOutbox, async () => {
    const existing = await db.cashExpenses.get(id)
    if (!existing) throw new Error(`Cash expense ${id} not found locally`)

    await db.cashExpenses.delete(id)
    await enqueue('cash_expenses', id, 'delete', { id })
  })
}

// Undoes a completed sale: restores the stock it decremented, marks it
// voided (kept for history rather than deleted), and removes the automatic
// bank-ledger entry a bank-paid sale would have created.
export async function voidSale(saleId: string): Promise<void> {
  await db.transaction(
    'rw',
    db.sales,
    db.saleItems,
    db.stockItems,
    db.bankTransactions,
    db.syncOutbox,
    async () => {
      const sale = await db.sales.get(saleId)
      if (!sale) throw new Error(`Sale ${saleId} not found locally`)
      if (sale.status === 'voided') return

      const items = await db.saleItems.where({ saleId }).toArray()
      for (const item of items) {
        if (!item.stockItemId) continue
        const stockItem = await db.stockItems.get(item.stockItemId)
        if (stockItem) {
          await db.stockItems.put({ ...stockItem, quantityOnHand: stockItem.quantityOnHand + item.quantity })
        }
      }

      const updated: Sale = { ...sale, status: 'voided', updatedAt: new Date().toISOString() }
      await db.sales.put(updated)
      await enqueue('sales', saleId, 'update', serializeSale(updated))

      if (sale.paymentMethod === 'bank') {
        const linked = await db.bankTransactions.where({ relatedSaleId: saleId }).first()
        if (linked) {
          await db.bankTransactions.delete(linked.id)
          await enqueue('bank_transactions', linked.id, 'delete', { id: linked.id })
        }
      }
    },
  )
}
