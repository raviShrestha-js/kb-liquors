import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'

export function LoginPage() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [storeName, setStoreName] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'signUp') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { store_name: storeName, full_name: fullName } },
        })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>KB Liquors</h1>
        <p className="auth-subtitle">Stock &amp; POS management</p>

        <div className="auth-tabs">
          <button type="button" className={mode === 'signIn' ? 'active' : ''} onClick={() => setMode('signIn')}>
            Sign in
          </button>
          <button type="button" className={mode === 'signUp' ? 'active' : ''} onClick={() => setMode('signUp')}>
            Create shop account
          </button>
        </div>

        {mode === 'signUp' && (
          <>
            <label>
              Shop name
              <input value={storeName} onChange={(e) => setStoreName(e.target.value)} required />
            </label>
            <label>
              Your name
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </label>
          </>
        )}

        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </label>

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'Please wait…' : mode === 'signUp' ? 'Create account' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
