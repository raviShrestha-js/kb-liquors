import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { useAppStore } from '../../state/appStore'
import { createStockItem, updateStockItem, createCategory } from '../../db/mutations'
import { CameraCapture } from '../../components/CameraCapture'
import { StockPhoto } from '../../components/StockPhoto'

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
      navigate('/stock')
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
  }

  const photoTargetId = id ?? savedId

  return (
    <div className="page">
      <h1>{isEdit ? 'Edit stock item' : 'Add stock item'}</h1>

      <form className="stock-form" onSubmit={handleSubmit}>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Brand
          <input value={brand} onChange={(e) => setBrand(e.target.value)} />
        </label>
        <label>
          Size (ml)
          <input type="number" value={sizeMl} onChange={(e) => setSizeMl(e.target.value)} />
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
          <button type="button" onClick={handleAddCategory}>
            Add category
          </button>
        </div>

        <label>
          Cost price (NPR)
          <input type="number" step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} required />
        </label>
        <label>
          Sale price (NPR)
          <input type="number" step="0.01" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} required />
        </label>
        <label>
          Quantity on hand
          <input type="number" value={quantityOnHand} onChange={(e) => setQuantityOnHand(e.target.value)} required />
        </label>
        <label>
          Reorder level
          <input type="number" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} required />
        </label>

        <button type="submit">{isEdit ? 'Save changes' : 'Create item'}</button>
      </form>

      {photoTargetId && auth.storeId && (
        <div className="photo-section">
          <h2>Photo</h2>
          <StockPhoto
            stockItemId={photoTargetId}
            photoPath={existing?.photoPath ?? null}
            alt={name}
          />
          <CameraCapture stockItemId={photoTargetId} storeId={auth.storeId} />
        </div>
      )}

      {savedId && (
        <button type="button" onClick={() => navigate('/stock')}>
          Done
        </button>
      )}
    </div>
  )
}
