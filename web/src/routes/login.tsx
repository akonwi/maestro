import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { type FormEvent, useCallback, useEffect, useState } from 'react'
import {
  ApiError,
  type CompletedLogin,
  claimLoginAttempt,
  type LoginAttempt,
  redeemLoginCode,
  requestMagicLink,
} from '@/lib/auth'
import { setSessionToken } from '@/lib/session'

const CLAIM_INTERVAL_MS = 1500

export const Route = createFileRoute('/login')({ component: LoginPage })

function LoginPage() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const requestLink = useMutation({ mutationFn: requestMagicLink })
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const attempt = requestLink.data

  const finishLogin = useCallback(
    (result: CompletedLogin) => {
      setSessionToken(result.session_token)
      queryClient.removeQueries({ queryKey: ['groups'] })
      queryClient.setQueryData(['auth', 'me'], result.user)
      navigate({ to: '/', replace: true })
    },
    [navigate, queryClient],
  )

  const claim = useQuery({
    queryKey: ['auth', 'attempt', attempt?.attempt_id],
    queryFn: attempt ? () => claimLoginAttempt(attempt) : skipToken,
    enabled: Boolean(attempt),
    refetchInterval: query => {
      if (
        query.state.data?.status === 'complete' ||
        (query.state.error instanceof ApiError &&
          query.state.error.status === 400)
      ) {
        return false
      }
      return CLAIM_INTERVAL_MS
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
    retry: false,
  })

  const verifyCode = useMutation({
    mutationFn: ({
      attempt,
      value,
    }: {
      attempt: LoginAttempt
      value: string
    }) => redeemLoginCode(attempt, value),
    onSuccess: finishLogin,
  })

  useEffect(() => {
    if (claim.data?.status === 'complete') finishLogin(claim.data)
  }, [claim.data, finishLogin])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCode('')
    requestLink.mutate(email.trim())
  }

  function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (attempt) verifyCode.mutate({ attempt, value: code })
  }

  function startOver() {
    setCode('')
    verifyCode.reset()
    requestLink.reset()
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
          <m-vstack align='stretch' gap='md'>
            <div
              aria-live='polite'
              className='notice-card success'
              role='status'
            >
              <h2>Check your inbox</h2>
              <p className='body'>
                Open the link sent to {email}, then return to Maestro. This
                screen will finish signing you in automatically.
              </p>
            </div>

            <form onSubmit={submitCode}>
              <m-vstack gap='md'>
                <m-vstack gap='xs'>
                  <label htmlFor='login-code'>Or enter the 6-digit code</label>
                  <input
                    autoComplete='one-time-code'
                    id='login-code'
                    inputMode='numeric'
                    maxLength={6}
                    name='code'
                    onChange={event =>
                      setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    pattern='[0-9]{6}'
                    required
                    type='text'
                    value={code}
                  />
                </m-vstack>
                {verifyCode.isError ? (
                  <p aria-live='polite' className='form-error' role='alert'>
                    {verifyCode.error instanceof ApiError &&
                    verifyCode.error.status === 400
                      ? 'That code is invalid or expired. Check the email and try again.'
                      : 'We couldn’t verify the code right now. Try again.'}
                  </p>
                ) : null}
                {claim.isError ? (
                  <p aria-live='polite' className='form-error' role='alert'>
                    {claim.error instanceof ApiError &&
                    claim.error.status === 400
                      ? 'This sign-in request expired. Request a new email to continue.'
                      : 'We’re having trouble checking the sign-in link. We’ll keep trying.'}
                  </p>
                ) : null}
                <button
                  data-variant='primary'
                  disabled={code.length !== 6 || verifyCode.isPending}
                  type='submit'
                >
                  {verifyCode.isPending ? 'Verifying…' : 'Verify code'}
                </button>
              </m-vstack>
            </form>

            <button
              className='plain subtle-link'
              onClick={startOver}
              style={{ alignSelf: 'start', padding: 0 }}
              type='button'
            >
              Use a different email
            </button>
          </m-vstack>
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
