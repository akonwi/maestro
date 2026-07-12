import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { createGroup, groupsQuery } from '@/lib/groups'
import { useSessionToken } from '@/lib/session'

export const Route = createFileRoute('/groups/')({ component: GroupsPage })

const countFormatter = new Intl.NumberFormat()

function GroupsPage() {
  const token = useSessionToken()
  const groups = useQuery({ ...groupsQuery, enabled: Boolean(token) })

  if (!token) return <SignInRequired />

  return (
    <main
      className='mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14'
      id='main-content'
    >
      <div className='section-kicker'>Private competitions</div>
      <h1 className='mt-3 text-balance text-3xl font-semibold tracking-tight'>
        Your Groups
      </h1>
      <p className='mt-2 text-pretty text-sm text-muted-foreground'>
        Predict scores with friends and compare results after each matchday.
      </p>

      <CreateGroupForm />

      {groups.isPending ? <GroupsSkeleton /> : null}
      {groups.isError ? (
        <div
          className='mt-8 border border-danger bg-danger-muted p-4 text-sm text-danger'
          role='alert'
        >
          Groups are unavailable. Check your connection and try again.
        </div>
      ) : null}
      {groups.data?.length === 0 ? <EmptyGroups /> : null}
      {groups.data?.length ? (
        <div className='mt-10 grid gap-2'>
          {groups.data.map(group => (
            <Link
              className='grid grid-cols-[1fr_auto] items-center border border-border bg-surface p-5 hover:border-foreground'
              key={group.id}
              params={{ groupId: String(group.id) }}
              to='/groups/$groupId'
            >
              <div className='min-w-0'>
                <h2 className='truncate font-semibold'>{group.name}</h2>
                <p className='mt-1 text-sm text-muted-foreground'>
                  {countFormatter.format(group.member_count)}{' '}
                  {group.member_count === 1 ? 'member' : 'members'}
                </p>
              </div>
              <span aria-hidden className='font-mono text-muted-foreground'>
                →
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </main>
  )
}

function CreateGroupForm() {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const create = useMutation({
    mutationFn: createGroup,
    onSuccess: () => {
      setName('')
      queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    create.mutate(name.trim())
  }

  return (
    <form
      className='mt-8 grid gap-3 border border-border bg-muted p-4 sm:grid-cols-[1fr_auto] sm:items-end'
      onSubmit={submit}
    >
      <div className='grid gap-2'>
        <label className='text-sm font-semibold' htmlFor='group-name'>
          Group name
        </label>
        <input
          autoComplete='off'
          className='h-11 border border-border bg-surface px-3 text-base'
          id='group-name'
          maxLength={80}
          name='group-name'
          onChange={event => setName(event.target.value)}
          required
          value={name}
        />
      </div>
      <button
        className='ui-button ui-button-primary'
        disabled={create.isPending}
        type='submit'
      >
        {create.isPending ? 'Creating group…' : 'Create Group'}
      </button>
      {create.isError ? (
        <p className='text-sm text-danger sm:col-span-2' role='alert'>
          We couldn’t create the group. Check the name and try again.
        </p>
      ) : null}
    </form>
  )
}

function GroupsSkeleton() {
  return (
    <div aria-live='polite' className='mt-10' role='status'>
      <span className='sr-only'>Loading groups…</span>
      <div
        aria-hidden
        className='h-32 animate-pulse border border-border bg-muted motion-reduce:animate-none'
      />
    </div>
  )
}

function EmptyGroups() {
  return (
    <div className='mt-10 border border-border bg-surface p-8 text-center'>
      <h2 className='font-semibold'>No Groups Yet</h2>
      <p className='mt-2 text-sm text-muted-foreground'>
        Create the first group and invite people by email.
      </p>
    </div>
  )
}

function SignInRequired() {
  return (
    <main className='mx-auto w-full max-w-md px-4 py-16' id='main-content'>
      <div className='border border-border bg-surface p-6 text-center'>
        <h1 className='text-xl font-semibold'>Sign In to View Groups</h1>
        <p className='mt-2 text-sm text-muted-foreground'>
          Groups and predictions are tied to your Maestro account.
        </p>
        <Link
          className='ui-button ui-button-primary mt-5 inline-flex items-center'
          to='/login'
        >
          Sign In
        </Link>
      </div>
    </main>
  )
}
