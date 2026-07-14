import { queryOptions } from '@tanstack/react-query'

export type User = {
  id: number
  email: string
  display_name: string | null
}

type VerifyResponse = {
  session_token: string
  user: User
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
    throw new Error(
      body?.error ?? `Request failed with status ${response.status}`,
    )
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function requestMagicLink(email: string) {
  return authRequest<void>('/auth/request', { body: { email } })
}

export function verifyMagicLink(token: string) {
  return authRequest<VerifyResponse>('/auth/verify', { body: { token } })
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
