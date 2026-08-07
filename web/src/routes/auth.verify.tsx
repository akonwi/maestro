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

function HandedOff() {
  return (
    <main className='auth-page' id='main-content'>
      <div
        aria-live='polite'
        className='notice-card success centered-card'
        role='status'
      >
        <h1>You’re signed in</h1>
        <p className='body'>
          You can close this tab and return to Maestro in your other tab.
        </p>
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
