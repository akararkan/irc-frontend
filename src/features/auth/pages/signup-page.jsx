import { useState } from 'react'
import { AlertCircle, ArrowRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'
import { extractApiMessage, extractFieldErrors } from '@/lib/api-error'

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

  function errorClass(field) {
    return fieldErrors[field] ? 'border-destructive focus-visible:ring-destructive/40' : ''
  }

  return (
    <Card className="border shadow-sm">
      <CardContent className="space-y-6 p-6">
        <div className="space-y-1.5 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
          <p className="text-sm text-muted-foreground">Join the community.</p>
        </div>

        {bannerError ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{bannerError}</span>
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fname">First name</Label>
              <Input
                id="fname"
                name="fname"
                autoComplete="given-name"
                value={form.fname}
                onChange={handleChange}
                className={cn(errorClass('fname'))}
              />
              {fieldErrors.fname ? <p className="text-xs text-destructive">{fieldErrors.fname}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lname">Last name</Label>
              <Input
                id="lname"
                name="lname"
                autoComplete="family-name"
                value={form.lname}
                onChange={handleChange}
                className={cn(errorClass('lname'))}
              />
              {fieldErrors.lname ? <p className="text-xs text-destructive">{fieldErrors.lname}</p> : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              value={form.username}
              onChange={handleChange}
              className={cn(errorClass('username'))}
            />
            {fieldErrors.username ? <p className="text-xs text-destructive">{fieldErrors.username}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              className={cn(errorClass('email'))}
            />
            {fieldErrors.email ? <p className="text-xs text-destructive">{fieldErrors.email}</p> : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={handleChange}
                className={cn(errorClass('password'))}
              />
              {fieldErrors.password ? <p className="text-xs text-destructive">{fieldErrors.password}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={handleChange}
                className={cn(errorClass('confirmPassword'))}
              />
              {fieldErrors.confirmPassword ? (
                <p className="text-xs text-destructive">{fieldErrors.confirmPassword}</p>
              ) : null}
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
            <ArrowRight className="size-4" />
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Button asChild variant="link" className="h-auto p-0 text-sm">
            <Link to="/login">Sign in</Link>
          </Button>
        </p>
      </CardContent>
    </Card>
  )
}
