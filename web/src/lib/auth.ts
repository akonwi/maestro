import { queryOptions } from '@tanstack/react-query'

export type User = {
  id: number
  email: string
  display_name: string | null
}

export type AuthenticatedSession = {
  session_token: string
  user: User
}

export type LoginAttempt = {
  attempt_id: string
  claim_token: string
  expires_in: number
}

export type CompletedLogin = AuthenticatedSession & { status: 'complete' }

export type LoginClaim = { status: 'pending' } | CompletedLogin

/** API error carrying the HTTP status so callers can tell a definitive
 * auth rejection (401/403) apart from a transient failure. */
export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export function isAuthRejection(error: unknown) {
  return (
    error instanceof ApiError && (error.status === 401 || error.status === 403)
  )
}

async function authRequest<T>(
  path: string,
  options: { body?: unknown; token?: string } = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: options.body === undefined ? 'GET' : 'POST',
    headers: {
      ...(options.body === undefined
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string
    } | null
    throw new ApiError(
      body?.error ?? `Request failed with status ${response.status}`,
      response.status,
    )
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function requestMagicLink(email: string) {
  return authRequest<LoginAttempt>('/auth/request', { body: { email } })
}

export function claimLoginAttempt(attempt: LoginAttempt) {
  return authRequest<LoginClaim>('/auth/attempt/claim', {
    body: {
      attempt_id: attempt.attempt_id,
      claim_token: attempt.claim_token,
    },
  })
}

export function redeemLoginCode(attempt: LoginAttempt, code: string) {
  return authRequest<CompletedLogin>('/auth/attempt/code', {
    body: {
      attempt_id: attempt.attempt_id,
      claim_token: attempt.claim_token,
      code,
    },
  })
}

export function verifyMagicLink(token: string) {
  return authRequest<AuthenticatedSession>('/auth/verify', { body: { token } })
}

export function currentUserQuery(token: string | null) {
  return queryOptions({
    queryKey: ['auth', 'me'],
    queryFn: () => authRequest<User>('/auth/me', { token: token ?? undefined }),
    enabled: Boolean(token),
    staleTime: 0,
    retry: false,
  })
}

export function logout(token: string) {
  return authRequest<void>('/auth/logout', { body: {}, token })
}
