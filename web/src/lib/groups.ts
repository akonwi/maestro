import { queryOptions } from '@tanstack/react-query'
import { getSessionToken } from '@/lib/session'

export type Group = {
  id: number
  name: string
  owner_id: number
  created_at: number
  member_count: number
}

export type GroupMember = {
  id: number
  email: string
  display_name: string | null
  joined_at: number
}

export type GroupDetail = {
  group: Group
  members: GroupMember[]
}

export type InviteResult = {
  member: GroupMember
  member_added: boolean
  invitation_sent: boolean
}

async function groupRequest<T>(path: string, body?: unknown): Promise<T> {
  const token = getSessionToken()
  if (!token) throw new Error('Sign in to view your groups.')

  const response = await fetch(`/api${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string
    } | null
    throw new Error(
      payload?.error ?? `Request failed with status ${response.status}`,
    )
  }
  return response.json() as Promise<T>
}

export const groupsQuery = queryOptions({
  queryKey: ['groups'],
  queryFn: () => groupRequest<Group[]>('/groups'),
})

export function groupQuery(id: number) {
  return queryOptions({
    queryKey: ['groups', id],
    queryFn: () => groupRequest<GroupDetail>(`/groups/${id}`),
  })
}

export function createGroup(name: string) {
  return groupRequest<Group>('/groups', { name })
}

export function inviteGroupMember(groupId: number, email: string) {
  return groupRequest<InviteResult>(`/groups/${groupId}/invites`, { email })
}
