import { useMutation } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { requestMagicLink } from '@/lib/auth'

export const Route = createFileRoute('/login')({ component: LoginPage })

function LoginPage() {
  const [email, setEmail] = useState('')
  const requestLink = useMutation({ mutationFn: requestMagicLink })

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
              Open the link sent to {email}. You can close this page.
            </p>
          </div>
        ) : (
          <form className='mt-8 grid gap-4' onSubmit={submit}>
            <div className='grid gap-2'>
              <label className='text-sm font-semibold' htmlFor='email'>
                Email address
              </label>
              <input
                autoComplete='email'
                className='h-11 border border-border bg-surface px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
                id='email'
                inputMode='email'
                name='email'
                onChange={event => setEmail(event.target.value)}
                required
                spellCheck={false}
                type='email'
                value={email}
              />
            </div>
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
              className='ui-button ui-button-primary'
              disabled={requestLink.isPending}
              type='submit'
            >
              {requestLink.isPending
                ? 'Sending link…'
                : 'Email me a sign-in link'}
            </button>
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
