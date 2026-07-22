import { db } from '../db/db'
import { supabase } from '../lib/supabase'
import { ENTITY_TABLE } from './tables'

const MAX_ATTEMPTS = 8

export interface PushResult {
  pushed: number
  failed: number
}

// Processes outbox entries in insertion order so FK dependencies (e.g. a sale's
// cash_session_id, a sale_item's sale_id) are always pushed before what references them.
export async function pushOutbox(): Promise<PushResult> {
  let pushed = 0
  let failed = 0

  const entries = await db.syncOutbox.orderBy('id').filter((e) => e.status === 'pending').toArray()

  for (const entry of entries) {
    await db.syncOutbox.update(entry.id!, { status: 'inflight' })

    const table = ENTITY_TABLE[entry.entity]
    const { error } = await supabase.from(table).upsert(entry.payload, { onConflict: 'client_generated_id' })

    if (!error) {
      await db.syncOutbox.delete(entry.id!)
      pushed++
      continue
    }

    const attempts = entry.attempts + 1
    const status = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending'
    await db.syncOutbox.update(entry.id!, {
      status,
      attempts,
      lastError: error.message,
    })
    failed++

    // Stop on the first failure in this batch — later entries may depend on
    // this one (e.g. a sale_item waiting on its sale), so pushing out of
    // order would just produce a confusing FK error on top of the real one.
    break
  }

  return { pushed, failed }
}

export async function pendingOutboxCount(): Promise<number> {
  return db.syncOutbox.where('status').anyOf('pending', 'inflight', 'failed').count()
}
