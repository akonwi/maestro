import { useMutation } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { type FormEvent, useEffect, useState } from 'react'
import { requestMagicLink } from '@/lib/auth'
import { createAuthChannel, isAuthMessage } from '@/lib/auth-channel'

export const Route = createFileRoute('/login')({ component: LoginPage })

function LoginPage() {
  const [email, setEmail] = useState('')
  const requestLink = useMutation({ mutationFn: requestMagicLink })
  const navigate = useNavigate()

  // If the magic link is verified in another tab, that tab writes the
  // session (localStorage) and broadcasts. Ack it and take over here so
  // this tab — the one the user was already looking at — becomes the app.
  useEffect(() => {
    const channel = createAuthChannel()
    if (!channel) return
    channel.onmessage = event => {
      if (isAuthMessage(event.data) && event.data.type === 'signed-in') {
        channel.postMessage({ type: 'ack' })
        navigate({ to: '/', replace: true })
      }
    }
    return () => channel.close()
  }, [navigate])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    requestLink.mutate(email.trim())
  }

  return (
    <main className='auth-page' id='main-content'>
      <m-vstack align='stretch' gap='lg'>
        <div>
          <div className='section-kicker'>
            Private groups / score predictions
          </div>
          <h1 className='page-title'>Sign in to Maestro</h1>
          <p className='page-subtitle'>
            Enter your email and we’ll send you a one-time sign-in link.
          </p>
        </div>

        {requestLink.isSuccess ? (
          <div aria-live='polite' className='notice-card success' role='status'>
            <h2>Check your inbox</h2>
            <p className='body'>
              Open the link sent to {email}. Keep this tab open — it signs you
              in automatically once you do.
            </p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <m-vstack gap='md'>
              <m-vstack gap='xs'>
                <label htmlFor='email'>Email address</label>
                <input
                  autoComplete='email'
                  id='email'
                  inputMode='email'
                  name='email'
                  onChange={event => setEmail(event.target.value)}
                  required
                  spellCheck={false}
                  type='email'
                  value={email}
                />
              </m-vstack>
              {requestLink.isError ? (
                <p aria-live='polite' className='form-error' role='alert'>
                  We couldn’t send the link. Check the address and try again.
                </p>
              ) : null}
              <button
                data-variant='primary'
                disabled={requestLink.isPending}
                type='submit'
              >
                {requestLink.isPending
                  ? 'Sending link…'
                  : 'Email me a sign-in link'}
              </button>
            </m-vstack>
          </form>
        )}

        <Link className='subtle-link' style={{ alignSelf: 'start' }} to='/'>
          Continue without signing in
        </Link>
      </m-vstack>
    </main>
  )
}
