import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { useAppStore } from '../../state/appStore'
import { createCategory, updateCategory, deleteCategory } from '../../db/mutations'
import { toast } from '../../state/toastStore'

export function CategoriesPage() {
  const storeId = useAppStore((s) => s.auth.storeId)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const categories = useLiveQuery(async () => {
    if (!storeId) return []
    const all = await db.categories.where({ storeId }).toArray()
    return all.sort((a, b) => a.name.localeCompare(b.name))
  }, [storeId])

  const itemCounts = useLiveQuery(async () => {
    if (!storeId) return new Map<string, number>()
    const items = await db.stockItems.where({ storeId }).filter((i) => i.isActive).toArray()
    const counts = new Map<string, number>()
    for (const item of items) {
      if (!item.categoryId) continue
      counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + 1)
    }
    return counts
  }, [storeId])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !storeId) return
    setError(null)
    try {
      await createCategory(storeId, newName.trim())
      setNewName('')
      toast.success('Category added')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create category.')
    }
  }

  function startEdit(id: string, currentName: string) {
    setEditingId(id)
    setEditingName(currentName)
  }

  async function handleRename(e: FormEvent) {
    e.preventDefault()
    if (!editingId || !editingName.trim()) return
    setBusy(true)
    setError(null)
    try {
      await updateCategory(editingId, editingName.trim())
      setEditingId(null)
      toast.success('Category renamed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rename category.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id: string) {
    setBusy(true)
    setError(null)
    try {
      await deleteCategory(id)
      setConfirmingDeleteId(null)
      toast.success('Category deleted')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete category.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <Link to="/stock" className="back-link">
          ‹ Stock
        </Link>
      </div>
      <h1>Categories</h1>

      {error && <p className="form-error">{error}</p>}

      <form className="inline-add" onSubmit={handleCreate}>
        <input placeholder="New category name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button type="submit" className="button-primary">
          Add
        </button>
      </form>

      <ul className="category-list">
        {(categories ?? []).map((cat) => (
          <li key={cat.id} className="category-row">
            {editingId === cat.id ? (
              <form className="category-row__edit" onSubmit={handleRename}>
                <input value={editingName} onChange={(e) => setEditingName(e.target.value)} autoFocus />
                <button type="submit" className="button-primary" disabled={busy}>
                  Save
                </button>
                <button type="button" className="button-secondary" onClick={() => setEditingId(null)}>
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <span className="category-row__name">
                  {cat.name} <span className="section-count">({itemCounts?.get(cat.id) ?? 0} items)</span>
                </span>
                {confirmingDeleteId === cat.id ? (
                  <span className="category-row__confirm">
                    Delete?
                    <button type="button" className="button-danger" onClick={() => handleDelete(cat.id)} disabled={busy}>
                      Yes
                    </button>
                    <button type="button" className="button-secondary" onClick={() => setConfirmingDeleteId(null)}>
                      No
                    </button>
                  </span>
                ) : (
                  <span className="category-row__actions">
                    <button type="button" className="button-secondary" onClick={() => startEdit(cat.id, cat.name)}>
                      Rename
                    </button>
                    <button type="button" className="button-danger-ghost" onClick={() => setConfirmingDeleteId(cat.id)}>
                      Delete
                    </button>
                  </span>
                )}
              </>
            )}
          </li>
        ))}
        {categories && categories.length === 0 && <p className="empty-hint">No categories yet.</p>}
      </ul>
    </div>
  )
}
