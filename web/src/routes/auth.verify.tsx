import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { verifyMagicLink } from '@/lib/auth'
import { setSessionToken } from '@/lib/session'

export const Route = createFileRoute('/auth/verify')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : '',
  }),
  component: VerifyPage,
})

function VerifyPage() {
  const { token } = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const started = useRef(false)
  const verify = useMutation({
    mutationFn: verifyMagicLink,
    onSuccess: result => {
      setSessionToken(result.session_token)
      queryClient.setQueryData(['auth', 'me'], result.user)
      navigate({ to: '/', replace: true })
    },
  })

  useEffect(() => {
    if (!token || started.current) return
    started.current = true
    verify.mutate(token)
  }, [token, verify.mutate])

  if (!token) return <InvalidLink />

  return (
    <main
      className='mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md items-center px-4 py-10'
      id='main-content'
    >
      <div
        aria-live='polite'
        className='w-full border border-border bg-surface p-6 text-center'
        role='status'
      >
        {verify.isError ? (
          <>
            <h1 className='text-xl font-semibold'>Sign-in link unavailable</h1>
            <p className='mt-2 text-sm text-muted-foreground'>
              The link may be expired or already used. Request a new one to
              continue.
            </p>
            <Link
              className='ui-button ui-button-primary mt-5 inline-flex items-center'
              to='/login'
            >
              Request another link
            </Link>
          </>
        ) : (
          <>
            <div
              aria-hidden
              className='mx-auto size-8 animate-pulse border border-accent bg-accent-muted motion-reduce:animate-none'
            />
            <h1 className='mt-5 text-xl font-semibold'>Signing you in…</h1>
            <p className='mt-2 text-sm text-muted-foreground'>
              Verifying your one-time link.
            </p>
          </>
        )}
      </div>
    </main>
  )
}

function InvalidLink() {
  return (
    <main className='mx-auto w-full max-w-md px-4 py-16' id='main-content'>
      <div
        className='border border-danger bg-danger-muted p-5 text-danger'
        role='alert'
      >
        <h1 className='font-semibold'>Invalid sign-in link</h1>
        <p className='mt-2 text-sm'>Request a new link to sign in.</p>
        <Link className='ui-button mt-5 inline-flex items-center' to='/login'>
          Go to sign in
        </Link>
      </div>
    </main>
  )
}
