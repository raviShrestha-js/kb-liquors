import { useState, type FormEvent } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { useAppStore } from '../../state/appStore'
import { createStockItem, updateStockItem, deleteStockItem, createCategory } from '../../db/mutations'
import { CameraCapture } from '../../components/CameraCapture'
import { StockPhoto } from '../../components/StockPhoto'
import { toast } from '../../state/toastStore'

export function StockFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const auth = useAppStore((s) => s.auth)
  const isEdit = Boolean(id)

  const existing = useLiveQuery(() => (id ? db.stockItems.get(id) : undefined), [id])
  const categories = useLiveQuery(
    () => (auth.storeId ? db.categories.where({ storeId: auth.storeId }).toArray() : []),
    [auth.storeId],
  )

  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [sizeMl, setSizeMl] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [quantityOnHand, setQuantityOnHand] = useState('')
  const [reorderLevel, setReorderLevel] = useState('5')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedJustNow, setSavedJustNow] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  if (existing && !loaded) {
    setName(existing.name)
    setBrand(existing.brand ?? '')
    setSizeMl(existing.sizeMl?.toString() ?? '')
    setCategoryId(existing.categoryId ?? '')
    setCostPrice(existing.costPrice.toString())
    setSalePrice(existing.salePrice.toString())
    setQuantityOnHand(existing.quantityOnHand.toString())
    setReorderLevel(existing.reorderLevel.toString())
    setLoaded(true)
  }

  async function handleAddCategory() {
    if (!newCategoryName.trim() || !auth.storeId) return
    const category = await createCategory(auth.storeId, newCategoryName.trim())
    setCategoryId(category.id)
    setNewCategoryName('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!auth.storeId) return
    setError(null)
    setSaving(true)

    try {
      if (isEdit && id) {
        await updateStockItem(id, {
          name,
          brand: brand || null,
          sizeMl: sizeMl ? Number(sizeMl) : null,
          categoryId: categoryId || null,
          costPrice: Number(costPrice),
          salePrice: Number(salePrice),
          quantityOnHand: Number(quantityOnHand),
          reorderLevel: Number(reorderLevel),
          updatedBy: auth.userId,
        })
        setSavedJustNow(true)
        setTimeout(() => setSavedJustNow(false), 2000)
        toast.success('Changes saved')
      } else {
        const item = await createStockItem({
          storeId: auth.storeId,
          categoryId: categoryId || null,
          name,
          brand: brand || null,
          sizeMl: sizeMl ? Number(sizeMl) : null,
          sku: null,
          costPrice: Number(costPrice),
          salePrice: Number(salePrice),
          quantityOnHand: Number(quantityOnHand),
          reorderLevel: Number(reorderLevel),
          photoPath: null,
          updatedBy: auth.userId,
        })
        setSavedId(item.id)
      }
    } catch (err) {
      console.error('Save stock item failed:', err)
      setError(err instanceof Error ? err.message : 'Could not save this item. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!id) return
    setDeleting(true)
    setError(null)
    try {
      await deleteStockItem(id)
      toast.success('Item deleted')
      navigate('/stock')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this item.')
      setDeleting(false)
    }
  }

  const photoTargetId = id ?? savedId
  const showForm = !savedId // once a new item is created, replace the form with the photo/finish step

  return (
    <div className="page">
      <div className="page-header">
        <Link to="/stock" className="back-link">
          ‹ Stock
        </Link>
      </div>
      <h1>{isEdit ? 'Edit stock item' : savedId ? 'Item added' : 'Add stock item'}</h1>

      {error && <p className="form-error">{error}</p>}

      {showForm && (
        <form className="stock-form" onSubmit={handleSubmit}>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </label>
          <label>
            Brand
            <input value={brand} onChange={(e) => setBrand(e.target.value)} />
          </label>
          <label>
            Size (ml)
            <input type="number" inputMode="numeric" value={sizeMl} onChange={(e) => setSizeMl(e.target.value)} />
          </label>

          <label>
            Category
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">— None —</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="inline-add">
            <input
              placeholder="New category name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
            />
            <button type="button" className="button-secondary" onClick={handleAddCategory}>
              Add
            </button>
          </div>

          <div className="field-row">
            <label>
              Cost price (NPR)
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                required
              />
            </label>
            <label>
              Sale price (NPR)
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                required
              />
            </label>
          </div>

          <div className="field-row">
            <label>
              Quantity on hand
              <input
                type="number"
                inputMode="numeric"
                value={quantityOnHand}
                onChange={(e) => setQuantityOnHand(e.target.value)}
                required
              />
            </label>
            <label>
              Reorder level
              <input
                type="number"
                inputMode="numeric"
                value={reorderLevel}
                onChange={(e) => setReorderLevel(e.target.value)}
                required
              />
            </label>
          </div>

          {isEdit && photoTargetId && auth.storeId && (
            <div className="photo-section">
              <span className="field-label">Photo</span>
              <StockPhoto stockItemId={photoTargetId} photoPath={existing?.photoPath ?? null} alt={name} />
              <CameraCapture stockItemId={photoTargetId} storeId={auth.storeId} />
            </div>
          )}

          <div className="sticky-action-bar">
            {savedJustNow && <span className="saved-pill">Saved ✓</span>}
            <button type="submit" className="button-primary button-large" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save item'}
            </button>
          </div>
        </form>
      )}

      {isEdit && showForm && (
        <div className="danger-zone">
          {!confirmingDelete ? (
            <button type="button" className="button-danger-ghost" onClick={() => setConfirmingDelete(true)}>
              Delete item
            </button>
          ) : (
            <div className="danger-zone__confirm">
              <p>
                Delete "{name}"? It will disappear from Stock and POS, and its photo will be removed. Past
                sales that included it are kept.
              </p>
              <div className="danger-zone__actions">
                <button type="button" className="button-secondary" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                  Cancel
                </button>
                <button type="button" className="button-danger" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Deleting…' : 'Yes, delete it'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!showForm && photoTargetId && auth.storeId && (
        <div className="success-step">
          <p className="success-banner">✓ "{name}" was added to your stock.</p>

          <div className="photo-section">
            <span className="field-label">Add a photo (optional)</span>
            <StockPhoto stockItemId={photoTargetId} photoPath={null} alt={name} />
            <CameraCapture stockItemId={photoTargetId} storeId={auth.storeId} />
          </div>

          <div className="sticky-action-bar">
            <button
              type="button"
              className="button-primary button-large"
              onClick={() => navigate('/stock')}
            >
              Finish — back to stock list
            </button>
            <button
              type="button"
              className="button-secondary button-large"
              onClick={() => {
                setSavedId(null)
                setName('')
                setBrand('')
                setSizeMl('')
                setCostPrice('')
                setSalePrice('')
                setQuantityOnHand('')
              }}
            >
              Add another item
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
