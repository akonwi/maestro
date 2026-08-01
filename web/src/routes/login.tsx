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
    <main
      className='mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md items-start px-4 py-16 sm:items-center sm:py-10'
      id='main-content'
    >
      <div className='w-full'>
        <div className='section-kicker'>Private groups / score predictions</div>
        <h1 className='mt-3 text-balance text-3xl font-semibold tracking-tight'>
          Sign in to Maestro
        </h1>
        <p className='mt-2 text-pretty text-sm text-muted-foreground'>
          Enter your email and we’ll send you a one-time sign-in link.
        </p>

        {requestLink.isSuccess ? (
          <div
            aria-live='polite'
            className='mt-8 border border-success bg-surface p-5 text-sm'
            role='status'
          >
            <h2 className='font-semibold text-success'>Check your inbox</h2>
            <p className='mt-2 break-words text-muted-foreground'>
              Open the link sent to {email}. Keep this tab open — it signs you
              in automatically once you do.
            </p>
          </div>
        ) : (
          <form className='mt-8' onSubmit={submit}>
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
                <p
                  aria-live='polite'
                  className='text-sm text-danger'
                  role='alert'
                >
                  We couldn’t send the link. Check the address and try again.
                </p>
              ) : null}
              <button
                className='primary'
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

        <Link
          className='mt-6 inline-block text-sm text-muted-foreground hover:text-foreground'
          to='/'
        >
          Continue without signing in
        </Link>
      </div>
    </main>
  )
}
