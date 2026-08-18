import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect } from 'react'
import { verifyMagicLink } from '@/lib/auth'
import { setSessionToken } from '@/lib/session'

const verificationRequests = new Map<
  string,
  ReturnType<typeof verifyMagicLink>
>()

function verifyMagicLinkOnce(token: string) {
  const existing = verificationRequests.get(token)
  if (existing) return existing

  const request = verifyMagicLink(token)
  verificationRequests.set(token, request)
  return request
}

export const Route = createFileRoute('/auth/verify')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : '',
  }),
  component: VerifyPage,
})

function VerifyPage() {
  const { token } = Route.useSearch()
  const queryClient = useQueryClient()
  const verify = useMutation({
    mutationFn: verifyMagicLinkOnce,
    onSuccess: result => {
      setSessionToken(result.session_token)
      queryClient.removeQueries({ queryKey: ['groups'] })
      queryClient.setQueryData(['auth', 'me'], result.user)
    },
  })

  useEffect(() => {
    if (token) verify.mutate(token)
  }, [token, verify.mutate])

  if (!token) return <InvalidLink />
  if (verify.isSuccess) return <Verified />

  return (
    <main className='auth-page' id='main-content'>
      <div
        aria-live='polite'
        className='notice-card centered-card'
        role='status'
      >
        {verify.isError ? (
          <m-vstack align='center' gap='sm'>
            <h1>Sign-in link unavailable</h1>
            <p className='page-subtitle'>
              The link may be expired or already used. Request a new one to
              continue.
            </p>
            <Link className='btn' data-variant='primary' to='/login'>
              Request another link
            </Link>
          </m-vstack>
        ) : (
          <m-vstack align='center' gap='sm'>
            <div aria-hidden className='pulse-square' />
            <h1>Signing you in…</h1>
            <p className='page-subtitle'>Verifying your one-time link.</p>
          </m-vstack>
        )}
      </div>
    </main>
  )
}

function Verified() {
  return (
    <main className='auth-page' id='main-content'>
      <div
        aria-live='polite'
        className='notice-card success centered-card'
        role='status'
      >
        <h1>Email verified</h1>
        <p className='body'>
          Return to Maestro to finish signing in, or continue in this browser.
        </p>
        <Link className='btn' data-variant='primary' to='/'>
          Continue in this browser
        </Link>
      </div>
    </main>
  )
}

function InvalidLink() {
  return (
    <main className='auth-page' id='main-content'>
      <div className='error-card' role='alert'>
        <m-vstack align='start' gap='sm'>
          <h1>Invalid sign-in link</h1>
          <p>Request a new link to sign in.</p>
          <Link className='btn' to='/login'>
            Go to sign in
          </Link>
        </m-vstack>
      </div>
    </main>
  )
}
