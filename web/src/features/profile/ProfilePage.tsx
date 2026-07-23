import { useEffect, useState, type FormEvent } from 'react'
import { UserCog, KeyRound, LogOut } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAppStore } from '../../state/appStore'
import { toast } from '../../state/toastStore'

export function ProfilePage() {
  const auth = useAppStore((s) => s.auth)
  const setAuth = useAppStore((s) => s.setAuth)

  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState(auth.fullName ?? '')
  const [shopName, setShopName] = useState('')
  const [savingDetails, setSavingDetails] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''))
    if (auth.storeId) {
      supabase
        .from('stores')
        .select('name')
        .eq('id', auth.storeId)
        .single()
        .then(({ data }) => {
          if (data) setShopName(data.name)
        })
    }
  }, [auth.storeId])

  async function handleSaveDetails(e: FormEvent) {
    e.preventDefault()
    if (!auth.userId || !auth.storeId) return
    setDetailsError(null)
    setSavingDetails(true)
    try {
      const [{ error: pErr }, { error: sErr }] = await Promise.all([
        supabase.from('profiles').update({ full_name: fullName }).eq('id', auth.userId),
        supabase.from('stores').update({ name: shopName }).eq('id', auth.storeId),
      ])
      if (pErr) throw pErr
      if (sErr) throw sErr
      setAuth({ ...auth, fullName })
      toast.success('Details updated')
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : 'Could not save your details.')
    } finally {
      setSavingDetails(false)
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault()
    setPasswordError(null)
    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setPasswordError('Passwords do not match.')
      return
    }
    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setPassword('')
      setConfirm('')
      toast.success('Password changed')
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Could not change password.')
    } finally {
      setSavingPassword(false)
    }
  }

  const initials = (auth.fullName ?? 'K B')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="page">
      <h1>Profile</h1>

      <div className="profile-hero">
        <div className="profile-hero__avatar">{initials || 'KB'}</div>
        <div>
          <div className="profile-hero__name">{auth.fullName || 'Shop owner'}</div>
          <div className="profile-hero__email">{email}</div>
        </div>
      </div>

      <form className="profile-card" onSubmit={handleSaveDetails}>
        <h2 className="btn-icon" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <UserCog size={19} /> Your details
        </h2>
        <label>
          Your name
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </label>
        <label>
          Shop name
          <input value={shopName} onChange={(e) => setShopName(e.target.value)} required />
        </label>
        <label>
          Email
          <input value={email} disabled />
        </label>
        {detailsError && <p className="form-error">{detailsError}</p>}
        <button type="submit" className="button-primary button-large" disabled={savingDetails}>
          {savingDetails ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      <form className="profile-card" onSubmit={handleChangePassword}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <KeyRound size={19} /> Change password
        </h2>
        <label>
          New password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            placeholder="At least 6 characters"
          />
        </label>
        <label>
          Confirm new password
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={6} />
        </label>
        {passwordError && <p className="form-error">{passwordError}</p>}
        <button type="submit" className="button-primary button-large" disabled={savingPassword}>
          {savingPassword ? 'Updating…' : 'Update password'}
        </button>
      </form>

      <button className="button-danger-ghost btn-icon" onClick={() => supabase.auth.signOut()}>
        <LogOut size={16} /> Sign out
      </button>
    </div>
  )
}
