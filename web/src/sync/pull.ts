import type { EntityTable } from 'dexie'
import { db } from '../db/db'
import { supabase } from '../lib/supabase'
import {
  deserializeCategory,
  deserializeStockItem,
  deserializeCashSession,
  deserializeSale,
  deserializeSaleItem,
} from '../db/serialize'

const EPOCH = new Date(0).toISOString()

async function getWatermark(key: string): Promise<string> {
  const row = await db.meta.get(key)
  return row?.lastPulledAt ?? EPOCH
}

async function setWatermark(key: string, value: string) {
  await db.meta.put({ key, lastPulledAt: value })
}

function latestTimestamp(rows: Array<Record<string, any>>, field: string, fallback: string): string {
  return rows.reduce((max, r) => (r[field] > max ? r[field] : max), fallback)
}

/** Mutable rows only overwrite the local copy if the remote copy is newer or equal by version. */
async function mergeMutable<T extends { id: string }>(
  table: EntityTable<T, 'id'>,
  rows: T[],
  version: (row: T) => number,
) {
  for (const row of rows) {
    const existing = await table.get(row.id as never)
    if (!existing || version(row) >= version(existing)) {
      await table.put(row)
    }
  }
}

export async function pullAll(storeId: string): Promise<void> {
  await pullCategories(storeId)
  await pullStockItems(storeId)
  await pullCashSessions(storeId)
  await pullSales(storeId)
  await pullSaleItems(storeId)
}

async function pullCategories(storeId: string) {
  const watermark = await getWatermark('categories')
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('store_id', storeId)
    .gt('created_at', watermark)
  if (error || !data) return

  const rows = data.map(deserializeCategory)
  await db.categories.bulkPut(rows)
  if (rows.length) await setWatermark('categories', latestTimestamp(data, 'created_at', watermark))
}

async function pullStockItems(storeId: string) {
  const watermark = await getWatermark('stock_items')
  const { data, error } = await supabase
    .from('stock_items')
    .select('*')
    .eq('store_id', storeId)
    .gt('updated_at', watermark)
  if (error || !data) return

  const rows = data.map(deserializeStockItem)
  await mergeMutable(db.stockItems, rows, (r) => r.version)
  if (rows.length) await setWatermark('stock_items', latestTimestamp(data, 'updated_at', watermark))
}

async function pullCashSessions(storeId: string) {
  const watermark = await getWatermark('cash_sessions')
  const { data, error } = await supabase
    .from('cash_sessions')
    .select('*')
    .eq('store_id', storeId)
    .gt('updated_at', watermark)
  if (error || !data) return

  const rows = data.map(deserializeCashSession)
  await mergeMutable(db.cashSessions, rows, (r) => new Date(r.updatedAt).getTime())
  if (rows.length) await setWatermark('cash_sessions', latestTimestamp(data, 'updated_at', watermark))
}

async function pullSales(storeId: string) {
  const watermark = await getWatermark('sales')
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .eq('store_id', storeId)
    .gt('created_at', watermark)
  if (error || !data) return

  const rows = data.map(deserializeSale)
  await db.sales.bulkPut(rows)
  if (rows.length) await setWatermark('sales', latestTimestamp(data, 'created_at', watermark))
}

async function pullSaleItems(storeId: string) {
  const watermark = await getWatermark('sale_items')
  // sale_items has no store_id column — scope through its parent sale via an
  // embedded-resource filter (RLS enforces the same boundary server-side regardless).
  const { data, error } = await supabase
    .from('sale_items')
    .select('*, sales!inner(store_id)')
    .eq('sales.store_id', storeId)
    .gt('created_at', watermark)
  if (error || !data) return

  const rows = data.map(deserializeSaleItem)
  await db.saleItems.bulkPut(rows)
  if (rows.length) await setWatermark('sale_items', latestTimestamp(data, 'created_at', watermark))
}
