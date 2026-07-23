import { db } from '../db/db'
import { supabase } from '../lib/supabase'
import { ENTITY_TABLE } from './tables'
import { serializeCategory } from '../db/serialize'
import type { SyncEntity } from '../db/types'

const MAX_ATTEMPTS = 8

// Parents must reach the server before the rows that reference them. Sorting
// each flush by this priority (then by insertion id) guarantees, e.g., a
// category is pushed before the stock item that points at it.
const PRIORITY: Record<SyncEntity, number> = {
  categories: 1,
  stock_items: 2,
  cash_sessions: 3,
  sales: 4,
  sale_items: 5,
  bank_transactions: 6,
  cash_expenses: 7,
}

export interface PushResult {
  pushed: number
  failed: number
}

// If a stock item references a category the server doesn't have yet (a foreign
// key error), re-queue that category from local data so the next flush pushes it
// first. This self-heals orphaned references left over from earlier failed syncs.
async function healOrphanedCategory(categoryId: string) {
  const alreadyQueued = await db.syncOutbox
    .where('entity')
    .equals('categories')
    .filter((e) => e.entityId === categoryId && e.status !== 'done')
    .count()
  if (alreadyQueued > 0) return

  const category = await db.categories.get(categoryId)
  if (!category) return

  await db.syncOutbox.add({
    entity: 'categories',
    entityId: category.id,
    operation: 'insert',
    payload: serializeCategory(category),
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
    status: 'pending',
  })
}

export async function pushOutbox(): Promise<PushResult> {
  let pushed = 0
  let failed = 0

  const entries = await db.syncOutbox.orderBy('id').filter((e) => e.status === 'pending').toArray()
  entries.sort((a, b) => PRIORITY[a.entity] - PRIORITY[b.entity] || (a.id ?? 0) - (b.id ?? 0))

  for (const entry of entries) {
    await db.syncOutbox.update(entry.id!, { status: 'inflight' })

    const table = ENTITY_TABLE[entry.entity]
    const { error } =
      entry.operation === 'delete'
        ? await supabase.from(table).delete().eq('id', entry.entityId)
        : await supabase.from(table).upsert(entry.payload, { onConflict: 'client_generated_id' })

    if (!error) {
      await db.syncOutbox.delete(entry.id!)
      pushed++
      continue
    }

    const attempts = entry.attempts + 1
    const status = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending'
    await db.syncOutbox.update(entry.id!, { status, attempts, lastError: error.message })
    failed++

    // Self-heal a missing parent category so this stock item can sync next pass.
    const categoryId = entry.entity === 'stock_items' ? (entry.payload.category_id as string | null) : null
    if (categoryId) await healOrphanedCategory(categoryId)
  }

  return { pushed, failed }
}

export async function pendingOutboxCount(): Promise<number> {
  return db.syncOutbox.where('status').anyOf('pending', 'inflight', 'failed').count()
}
