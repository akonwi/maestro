import { ArrowLeft } from '@phosphor-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { groupQuery, inviteGroupMember } from '@/lib/groups'
import { useSessionToken } from '@/lib/session'

export const Route = createFileRoute('/groups/$groupId')({
  component: GroupPage,
})

const joinedFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

function GroupPage() {
  const token = useSessionToken()
  const { groupId } = Route.useParams()
  const id = Number(groupId)
  const detail = useQuery({
    ...groupQuery(id),
    enabled: Boolean(token) && Number.isInteger(id),
  })
  if (!token) return <SignInRequired />
  if (!Number.isInteger(id) || id <= 0) return <InvalidGroup />

  return (
    <main
      className='mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14'
      id='main-content'
    >
      <Link
        className='mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground'
        search={{ mode: 'season', week: undefined }}
        to='/groups'
      >
        <ArrowLeft aria-hidden size={16} /> Your Groups
      </Link>

      {detail.isPending ? <GroupSkeleton /> : null}
      {detail.isError ? (
        <div
          className='border border-danger bg-danger-muted p-5 text-danger'
          role='alert'
        >
          <h1 className='font-semibold'>Group unavailable</h1>
          <p className='mt-2 text-sm'>
            It may not exist, or you may not be a member.
          </p>
          <button
            className='ui-button mt-4'
            onClick={() => detail.refetch()}
            type='button'
          >
            Retry Group
          </button>
        </div>
      ) : null}
      {detail.data ? (
        <>
          <div className='section-kicker'>Group members</div>
          <h1 className='mt-3 text-balance text-3xl font-semibold tracking-tight'>
            {detail.data.group.name}
          </h1>
          <p className='mt-2 text-sm text-muted-foreground'>
            {detail.data.group.member_count}{' '}
            {detail.data.group.member_count === 1 ? 'member' : 'members'}
          </p>

          <InviteForm groupId={id} />

          <section className='mt-10' aria-labelledby='members-heading'>
            <h2
              className='font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground'
              id='members-heading'
            >
              Members
            </h2>
            <div className='mt-3 border border-border bg-surface'>
              {detail.data.members.map(member => (
                <div
                  className='grid gap-2 border-b border-border p-4 last:border-b-0 sm:grid-cols-[1fr_auto] sm:gap-4'
                  key={member.id}
                >
                  <div className='min-w-0'>
                    <div className='truncate font-semibold'>
                      {member.display_name ?? member.email}
                    </div>
                    <div className='truncate text-sm text-muted-foreground'>
                      {member.email}
                    </div>
                  </div>
                  <div className='self-center font-mono text-[.6875rem] text-muted-foreground sm:text-right'>
                    Joined {joinedFormatter.format(member.joined_at)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </main>
  )
}

function InviteForm({ groupId }: { groupId: number }) {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const invite = useMutation({
    mutationFn: (address: string) => inviteGroupMember(groupId, address),
    onSuccess: () => {
      setEmail('')
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] })
      queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    invite.mutate(email.trim())
  }

  return (
    <form
      className='mt-8 grid gap-3 border border-border bg-muted p-4 sm:grid-cols-[1fr_auto] sm:items-end'
      onSubmit={submit}
    >
      <div className='grid gap-2'>
        <label className='text-sm font-semibold' htmlFor='invite-email'>
          Invite by email
        </label>
        <input
          autoComplete='email'
          className='h-11 border border-border bg-surface px-3 text-base'
          id='invite-email'
          inputMode='email'
          name='invite-email'
          onChange={event => setEmail(event.target.value)}
          required
          spellCheck={false}
          type='email'
          value={email}
        />
      </div>
      <button
        className='ui-button ui-button-primary'
        disabled={invite.isPending}
        type='submit'
      >
        {invite.isPending ? 'Sending invite…' : 'Invite Member'}
      </button>
      {invite.isSuccess ? (
        <p
          aria-live='polite'
          className='text-sm text-success sm:col-span-2'
          role='status'
        >
          {invite.data.invitation_sent
            ? 'Member added and invitation sent.'
            : invite.data.member_added
              ? 'Member added. Email delivery is disabled.'
              : 'This person is already a member.'}
        </p>
      ) : null}
      {invite.isError ? (
        <p className='text-sm text-danger sm:col-span-2' role='alert'>
          {invite.error.message}
        </p>
      ) : null}
    </form>
  )
}

function GroupSkeleton() {
  return (
    <div aria-live='polite' role='status'>
      <span className='sr-only'>Loading group…</span>
      <div
        aria-hidden
        className='h-72 animate-pulse border border-border bg-muted motion-reduce:animate-none'
      />
    </div>
  )
}

function SignInRequired() {
  return (
    <main className='mx-auto w-full max-w-md px-4 py-16' id='main-content'>
      <h1 className='text-xl font-semibold'>Sign In to View This Group</h1>
      <Link
        className='ui-button ui-button-primary mt-5 inline-flex items-center'
        to='/login'
      >
        Sign In
      </Link>
    </main>
  )
}

function InvalidGroup() {
  return (
    <main className='mx-auto w-full max-w-md px-4 py-16' id='main-content'>
      <h1 className='text-xl font-semibold'>Invalid Group</h1>
      <Link
        className='ui-button mt-5 inline-flex items-center'
        search={{ mode: 'season', week: undefined }}
        to='/groups'
      >
        View Your Groups
      </Link>
    </main>
  )
}
