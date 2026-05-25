import { useState } from 'react'
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'
import { extractApiMessage, extractFieldErrors } from '@/lib/api-error'
import { inputClass } from '@/features/auth/pages/auth-field'

const initialForm = {
  fname: '',
  lname: '',
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
}

export function SignupPage() {
  const navigate = useNavigate()
  const { signUp } = useAuth()
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [bannerError, setBannerError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)

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

    if (form.password !== form.confirmPassword) {
      setBannerError('Passwords do not match.')
      setFieldErrors({ confirmPassword: 'Passwords do not match.' })
      setSubmitting(false)
      return
    }

    try {
      await signUp({
        fname: form.fname.trim(),
        lname: form.lname.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      })
      navigate('/', { replace: true })
    } catch (error) {
      setBannerError(extractApiMessage(error, 'Unable to create your account.'))
      setFieldErrors(extractFieldErrors(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-[30px] font-semibold tracking-[-0.02em] text-ink">
          Create your account
        </h1>
        <p className="mt-1 text-[13.5px] text-fg-muted">
          Two minutes — then you’re in.
        </p>
      </header>

      {bannerError ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2.5 text-[13px] text-destructive">
          <AlertCircle className="mt-px size-4 shrink-0" strokeWidth={2} />
          <span>{bannerError}</span>
        </div>
      ) : null}

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" htmlFor="fname" error={fieldErrors.fname}>
            <input
              id="fname"
              name="fname"
              autoComplete="given-name"
              value={form.fname}
              onChange={handleChange}
              className={inputClass(fieldErrors.fname)}
            />
          </Field>
          <Field label="Last name" htmlFor="lname" error={fieldErrors.lname}>
            <input
              id="lname"
              name="lname"
              autoComplete="family-name"
              value={form.lname}
              onChange={handleChange}
              className={inputClass(fieldErrors.lname)}
            />
          </Field>
        </div>

        <Field label="Username" htmlFor="username" error={fieldErrors.username}>
          <input
            id="username"
            name="username"
            autoComplete="username"
            value={form.username}
            onChange={handleChange}
            placeholder="choose a handle"
            className={inputClass(fieldErrors.username)}
          />
        </Field>

        <Field label="Email" htmlFor="email" error={fieldErrors.email}>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            placeholder="you@university.edu"
            className={inputClass(fieldErrors.email)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Password" htmlFor="password" error={fieldErrors.password}>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={form.password}
                onChange={handleChange}
                className={cn(inputClass(fieldErrors.password), 'pr-11')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-fg-muted transition-colors hover:bg-bg-soft hover:text-ink"
              >
                {showPassword ? (
                  <EyeOff className="size-[15px]" strokeWidth={1.7} />
                ) : (
                  <Eye className="size-[15px]" strokeWidth={1.7} />
                )}
              </button>
            </div>
          </Field>
          <Field
            label="Confirm"
            htmlFor="confirmPassword"
            error={fieldErrors.confirmPassword}
          >
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={handleChange}
              className={inputClass(fieldErrors.confirmPassword)}
            />
          </Field>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="group mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,var(--accent-indigo),var(--primary))] text-[14.5px] font-bold text-primary-foreground shadow-[0_12px_26px_-10px_rgba(14,107,84,0.7)] transition-all hover:-translate-y-px hover:shadow-[0_16px_32px_-12px_rgba(14,107,84,0.8)] disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Creating account…
            </>
          ) : (
            <>
              Create account
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-[13px] text-fg-muted">
        Already have an account?{' '}
        <Link
          to="/login"
          className="font-bold text-brand underline-offset-2 hover:underline"
        >
          Sign in
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
        className="block text-[12.5px] font-medium text-fg-soft"
      >
        {label}
      </label>
      {children}
      {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
    </div>
  )
}
