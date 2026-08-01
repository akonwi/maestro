import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { verifyMagicLink } from '@/lib/auth'
import { createAuthChannel, isAuthMessage } from '@/lib/auth-channel'
import { setSessionToken } from '@/lib/session'

// How long to wait for another tab to take over before this tab enters the
// app itself (i.e. the link was opened on a device with no waiting tab).
const HANDOFF_TIMEOUT_MS = 1500

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
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [handedOff, setHandedOff] = useState(false)
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

  // After verifying, offer the sign-in to the original tab. If it acks,
  // show a "close this tab" screen; otherwise enter the app here.
  useEffect(() => {
    if (!verify.isSuccess) return
    const channel = createAuthChannel()
    if (!channel) {
      navigate({ to: '/', replace: true })
      return
    }
    let done = false
    channel.onmessage = event => {
      if (isAuthMessage(event.data) && event.data.type === 'ack') {
        done = true
        setHandedOff(true)
        // Try to close this tab. Browsers only allow closing script-opened
        // windows, so this often no-ops (e.g. a Gmail-opened tab) — the
        // "you can close this tab" screen is the fallback.
        window.close()
      }
    }
    channel.postMessage({ type: 'signed-in' })
    const timer = setTimeout(() => {
      if (!done) navigate({ to: '/', replace: true })
    }, HANDOFF_TIMEOUT_MS)
    return () => {
      clearTimeout(timer)
      channel.close()
    }
  }, [verify.isSuccess, navigate])

  if (!token) return <InvalidLink />
  if (handedOff) return <HandedOff />

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

function HandedOff() {
  return (
    <main
      className='mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md items-center px-4 py-10'
      id='main-content'
    >
      <div
        aria-live='polite'
        className='w-full border border-success bg-surface p-6 text-center'
        role='status'
      >
        <h1 className='text-xl font-semibold text-success'>You’re signed in</h1>
        <p className='mt-2 text-sm text-muted-foreground'>
          You can close this tab and return to Maestro in your other tab.
        </p>
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
