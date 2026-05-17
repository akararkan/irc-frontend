import { useState } from 'react'
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'
import { extractApiMessage, extractFieldErrors } from '@/lib/api-error'
import { inputClass } from '@/features/auth/pages/auth-field'

const initialForm = { username: '', password: '' }

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn } = useAuth()
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [bannerError, setBannerError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)

  const nextPath = location.state?.from?.pathname ?? '/'

  function handleChange(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setBannerError('')
    setFieldErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setBannerError('')
    setFieldErrors({})
    try {
      await signIn({ username: form.username.trim(), password: form.password })
      navigate(nextPath, { replace: true })
    } catch (error) {
      setBannerError(extractApiMessage(error, 'Unable to sign in.'))
      setFieldErrors(extractFieldErrors(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.018em] text-ink">
          Welcome back
        </h1>
        <p className="mt-1 text-[13.5px] text-ink-3">
          Sign in to continue your research journey.
        </p>
      </header>

      {bannerError ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2.5 text-[13px] text-destructive">
          <AlertCircle className="mt-px size-4 shrink-0" strokeWidth={2} />
          <span>{bannerError}</span>
        </div>
      ) : null}

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <Field
          label="Username or email"
          htmlFor="username"
          error={fieldErrors.username}
        >
          <input
            id="username"
            name="username"
            autoComplete="username"
            value={form.username}
            onChange={handleChange}
            placeholder="your username"
            aria-invalid={Boolean(fieldErrors.username)}
            className={inputClass(fieldErrors.username)}
          />
        </Field>

        <Field label="Password" htmlFor="password" error={fieldErrors.password}>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              aria-invalid={Boolean(fieldErrors.password)}
              className={cn(inputClass(fieldErrors.password), 'pr-11')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-ink-3 transition-colors hover:bg-secondary hover:text-ink"
            >
              {showPassword ? (
                <EyeOff className="size-[15px]" strokeWidth={1.7} />
              ) : (
                <Eye className="size-[15px]" strokeWidth={1.7} />
              )}
            </button>
          </div>
        </Field>

        <button
          type="submit"
          disabled={submitting}
          className="group flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand text-[14px] font-medium text-brand-foreground transition-colors hover:bg-brand/90 disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Signing in…
            </>
          ) : (
            <>
              Sign in
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-[13px] text-ink-3">
        New here?{' '}
        <Link
          to="/signup"
          className="font-medium text-brand underline-offset-2 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  )
}

function Field({ label, htmlFor, error, children }) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-[12.5px] font-medium text-ink-2"
      >
        {label}
      </label>
      {children}
      {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
    </div>
  )
}
