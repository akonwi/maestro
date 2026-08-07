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
    <main className='page' id='main-content'>
      <m-vstack align='stretch' gap='lg'>
        <Link
          className='back-link'
          search={{ mode: 'season', week: undefined }}
          style={{ alignSelf: 'start' }}
          to='/groups'
        >
          <ArrowLeft aria-hidden size={16} /> Your Groups
        </Link>

        {detail.isPending ? <GroupSkeleton /> : null}
        {detail.isError ? (
          <div className='error-card' role='alert'>
            <m-vstack align='start' gap='sm'>
              <h1>Group unavailable</h1>
              <p>It may not exist, or you may not be a member.</p>
              <button onClick={() => detail.refetch()} type='button'>
                Retry Group
              </button>
            </m-vstack>
          </div>
        ) : null}
        {detail.data ? (
          <m-vstack align='stretch' gap='lg'>
            <div>
              <div className='section-kicker'>Group members</div>
              <h1 className='page-title'>{detail.data.group.name}</h1>
              <p className='page-subtitle'>
                {detail.data.group.member_count}{' '}
                {detail.data.group.member_count === 1 ? 'member' : 'members'}
              </p>
            </div>

            <InviteForm groupId={id} />

            <section aria-labelledby='members-heading'>
              <h2 className='day-heading' id='members-heading'>
                Members
              </h2>
              <div className='card'>
                {detail.data.members.map(member => (
                  <div className='member-row' key={member.id}>
                    <div className='who-block'>
                      <div className='who'>
                        {member.display_name ?? member.email}
                      </div>
                      <div className='sub'>{member.email}</div>
                    </div>
                    <div className='joined'>
                      Joined {joinedFormatter.format(member.joined_at)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </m-vstack>
        ) : null}
      </m-vstack>
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
    <form className='form-card' onSubmit={submit}>
      <m-vstack gap='xs'>
        <label htmlFor='invite-email'>Invite by email</label>
        <input
          autoComplete='email'
          id='invite-email'
          inputMode='email'
          name='invite-email'
          onChange={event => setEmail(event.target.value)}
          required
          spellCheck={false}
          type='email'
          value={email}
        />
      </m-vstack>
      <button data-variant='primary' disabled={invite.isPending} type='submit'>
        {invite.isPending ? 'Sending invite…' : 'Invite Member'}
      </button>
      {invite.isSuccess ? (
        <p aria-live='polite' className='form-success span-all' role='status'>
          {invite.data.invitation_sent
            ? 'Member added and invitation sent.'
            : invite.data.member_added
              ? 'Member added. Email delivery is disabled.'
              : 'This person is already a member.'}
        </p>
      ) : null}
      {invite.isError ? (
        <p className='form-error span-all' role='alert'>
          {invite.error.message}
        </p>
      ) : null}
    </form>
  )
}

function GroupSkeleton() {
  return (
    <div aria-live='polite' role='status'>
      <span data-visually-hidden>Loading group…</span>
      <div aria-hidden className='skeleton tall' />
    </div>
  )
}

function SignInRequired() {
  return (
    <main className='page slim' id='main-content'>
      <m-vstack align='start' gap='sm'>
        <h1 className='panel-title'>Sign In to View This Group</h1>
        <Link className='btn' data-variant='primary' to='/login'>
          Sign In
        </Link>
      </m-vstack>
    </main>
  )
}

function InvalidGroup() {
  return (
    <main className='page slim' id='main-content'>
      <m-vstack align='start' gap='sm'>
        <h1 className='panel-title'>Invalid Group</h1>
        <Link
          className='btn'
          search={{ mode: 'season', week: undefined }}
          to='/groups'
        >
          View Your Groups
        </Link>
      </m-vstack>
    </main>
  )
}
