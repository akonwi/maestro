import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { GroupLeaderboardCard } from '@/components/group-leaderboard-card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { currentUserQuery } from '@/lib/auth'
import { createGroup, groupsQuery } from '@/lib/groups'
import {
  currentWeekKey,
  isWeekKey,
  shiftWeek,
  weekLabel,
} from '@/lib/leaderboard-period'
import { useSessionToken } from '@/lib/session'

export const Route = createFileRoute('/groups/')({
  validateSearch: (search: Record<string, unknown>) => ({
    mode: search.mode === 'week' ? ('week' as const) : ('season' as const),
    week:
      typeof search.week === 'string' && isWeekKey(search.week)
        ? search.week
        : undefined,
  }),
  component: GroupsPage,
})

function GroupsPage() {
  const token = useSessionToken()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const groups = useQuery({ ...groupsQuery, enabled: Boolean(token) })
  const currentUser = useQuery(currentUserQuery(token))
  const currentWeek = currentWeekKey()
  const selectedWeek = search.week ?? currentWeek

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

      {groups.data?.length && !currentUser.isPending ? (
        <>
          <PeriodControls
            mode={search.mode}
            onModeChange={mode =>
              navigate({
                search: {
                  mode,
                  week: mode === 'week' ? selectedWeek : undefined,
                },
              })
            }
            onWeekChange={week => navigate({ search: { mode: 'week', week } })}
            week={selectedWeek}
          />
          <section
            aria-label='Group standings'
            className='mt-5 grid gap-4 lg:grid-cols-2'
          >
            {groups.data.map(group => (
              <GroupLeaderboardCard
                group={group}
                key={group.id}
                mode={search.mode}
                userId={currentUser.data?.id}
                week={selectedWeek}
              />
            ))}
          </section>
        </>
      ) : null}

      {groups.isPending || (groups.data?.length && currentUser.isPending) ? (
        <GroupsSkeleton />
      ) : null}
      {currentUser.isError ? (
        <p
          className='mt-5 border border-danger bg-danger-muted p-4 text-sm text-danger'
          role='alert'
        >
          Your account could not be loaded, so personal standings are
          unavailable.
        </p>
      ) : null}
      {groups.isError ? (
        <div
          className='mt-8 border border-danger bg-danger-muted p-4 text-sm text-danger'
          role='alert'
        >
          <p>Groups are unavailable. Check your connection and try again.</p>
          <button
            className='ui-button mt-3'
            onClick={() => groups.refetch()}
            type='button'
          >
            Retry Groups
          </button>
        </div>
      ) : null}
      {groups.data?.length === 0 ? <EmptyGroups /> : null}

      <section
        className='mt-12 border-t border-border pt-8'
        aria-labelledby='create-group-heading'
      >
        <h2 className='text-lg font-semibold' id='create-group-heading'>
          Create a Group
        </h2>
        <p className='mt-1 text-sm text-muted-foreground'>
          Invite friends and start a private table.
        </p>
        <CreateGroupForm />
      </section>
    </main>
  )
}

function PeriodControls({
  mode,
  onModeChange,
  onWeekChange,
  week,
}: {
  mode: 'season' | 'week'
  onModeChange: (mode: 'season' | 'week') => void
  onWeekChange: (week: string) => void
  week: string
}) {
  return (
    <div className='mt-8 flex flex-wrap items-center gap-2 border-b border-border pb-4'>
      <ToggleGroup
        aria-label='Leaderboard period'
        onValueChange={values => {
          const value = values[0]
          if (value === 'season' || value === 'week') onModeChange(value)
        }}
        spacing={0}
        value={[mode]}
        variant='outline'
      >
        <ToggleGroupItem value='season'>Season</ToggleGroupItem>
        <ToggleGroupItem value='week'>Week</ToggleGroupItem>
      </ToggleGroup>
      {mode === 'week' ? (
        <div className='flex items-center border border-border bg-surface'>
          <button
            aria-label='Previous week'
            className='grid size-11 place-items-center border-r border-border'
            onClick={() => onWeekChange(shiftWeek(week, -7))}
            type='button'
          >
            <CaretLeft aria-hidden />
          </button>
          <span className='min-w-28 px-3 text-center font-mono text-xs font-semibold'>
            {weekLabel(week)}
          </span>
          <button
            aria-label='Next week'
            className='grid size-11 place-items-center border-l border-border disabled:opacity-40'
            disabled={week >= currentWeekKey()}
            onClick={() => onWeekChange(shiftWeek(week, 7))}
            type='button'
          >
            <CaretRight aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
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
      className='mt-4 grid gap-3 border border-border bg-muted p-4 sm:grid-cols-[1fr_auto] sm:items-end'
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
    <div
      aria-live='polite'
      className='mt-10 grid gap-4 lg:grid-cols-2'
      role='status'
    >
      <span className='sr-only'>Loading groups…</span>
      {[0, 1].map(card => (
        <div
          aria-hidden
          className='h-64 animate-pulse border border-border bg-muted motion-reduce:animate-none'
          key={card}
        />
      ))}
    </div>
  )
}

function EmptyGroups() {
  return (
    <div className='mt-10 border border-border bg-surface p-8 text-center'>
      <h2 className='font-semibold'>No Groups Yet</h2>
      <p className='mt-2 text-sm text-muted-foreground'>
        Create the first group below and invite people by email.
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
