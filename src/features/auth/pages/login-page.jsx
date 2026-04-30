import { useState } from 'react'
import { AlertCircle, ArrowRight } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'
import { extractApiMessage, extractFieldErrors } from '@/lib/api-error'

const initialForm = { username: '', password: '' }

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn } = useAuth()
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [bannerError, setBannerError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

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
    <Card className="border shadow-sm">
      <CardContent className="space-y-6 p-6">
        <div className="space-y-1.5 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground">Sign in to continue.</p>
        </div>

        {bannerError ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{bannerError}</span>
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="username">Username or email</Label>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              value={form.username}
              onChange={handleChange}
              placeholder="your username"
              aria-invalid={Boolean(fieldErrors.username)}
              className={cn(fieldErrors.username && 'border-destructive focus-visible:ring-destructive/40')}
            />
            {fieldErrors.username ? (
              <p className="text-xs text-destructive">{fieldErrors.username}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              aria-invalid={Boolean(fieldErrors.password)}
              className={cn(fieldErrors.password && 'border-destructive focus-visible:ring-destructive/40')}
            />
            {fieldErrors.password ? (
              <p className="text-xs text-destructive">{fieldErrors.password}</p>
            ) : null}
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
            <ArrowRight className="size-4" />
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          New here?{' '}
          <Button asChild variant="link" className="h-auto p-0 text-sm">
            <Link to="/signup">Create an account</Link>
          </Button>
        </p>
      </CardContent>
    </Card>
  )
}
