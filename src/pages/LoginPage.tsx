import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import { api, useLogin } from '../api/client'

const schema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
})
type LoginForm = z.infer<typeof schema>

const inputCls = 'min-h-12 w-full rounded-lg border border-line bg-card px-3 py-2'

function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 21 21" className="h-5 w-5" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  )
}

export function LoginPage() {
  const login = useLogin()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const ssoError = params.get('error')
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const { data: providers } = useQuery({
    queryKey: ['auth-providers'],
    queryFn: () => api<{ local: boolean; sso: boolean }>('/auth/providers'),
    staleTime: Infinity,
  })

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(schema),
  })

  const submit = handleSubmit((data) =>
    login.mutate(data, { onSuccess: () => navigate(from, { replace: true }) }),
  )

  const showLocal = providers?.local ?? true
  const showSso = providers?.sso ?? false

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <img src="/osiLogo.jpg" alt="OSI Group" className="h-12 w-auto" />
          <h1 className="text-xl font-extrabold tracking-tight">CIMT</h1>
          <p className="text-sm text-steel">Critical Incident Management Team</p>
        </div>

        <div className="overflow-hidden rounded-2xl bg-card shadow-card">
          <div className="hazard-stripe" />
          <div className="space-y-4 p-6">
            {ssoError ? (
              <p className="rounded-lg bg-emergency-soft p-3 text-sm font-semibold text-emergency-deep">
                {ssoError}
              </p>
            ) : null}

            {showSso ? (
              <a
                href="/api/auth/sso/login"
                className="flex min-h-12 w-full items-center justify-center gap-3 rounded-full border border-line bg-card font-bold hover:border-ink"
              >
                <MicrosoftLogo />
                Sign in with Microsoft
              </a>
            ) : null}

            {showSso && showLocal ? (
              <div className="flex items-center gap-3 text-xs font-bold text-steel uppercase">
                <span className="h-px flex-1 bg-line" aria-hidden /> or <span className="h-px flex-1 bg-line" aria-hidden />
              </div>
            ) : null}

            {showLocal ? (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold" htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    className={inputCls}
                    {...register('email')}
                  />
                  {errors.email ? <p className="mt-1 text-sm text-emergency-deep">{errors.email.message}</p> : null}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold" htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    className={inputCls}
                    {...register('password')}
                  />
                  {errors.password ? <p className="mt-1 text-sm text-emergency-deep">{errors.password.message}</p> : null}
                </div>

                {login.isError ? (
                  <p className="rounded-lg bg-emergency-soft p-3 text-sm font-semibold text-emergency-deep">
                    {login.error instanceof Error ? login.error.message : 'Sign-in failed'}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={login.isPending}
                  className="min-h-12 w-full rounded-full bg-accent font-bold text-white hover:bg-accent-deep disabled:opacity-60"
                >
                  {login.isPending ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            ) : null}
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-steel">
          Access is restricted to authorized CIMT members.
        </p>
      </div>
    </div>
  )
}
