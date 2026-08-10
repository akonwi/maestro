import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { GroupLeaderboardCard } from '@/components/group-leaderboard-card'
import { currentUserQuery } from '@/lib/auth'
import { competitionCode, feedQuery } from '@/lib/fixtures'
import { createGroup, groupsQuery } from '@/lib/groups'
import {
  currentWeekKey,
  isWeekKey,
  shiftWeek,
  weekLabel,
} from '@/lib/leaderboard-period'
import { useSessionToken } from '@/lib/session'

export const Route = createFileRoute('/groups/')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { mode: 'week' | 'season'; week?: string; comp?: number } => {
    const comp = Number(search.comp)
    const out: { mode: 'week' | 'season'; week?: string; comp?: number } = {
      mode: search.mode === 'week' ? 'week' : 'season',
    }
    if (typeof search.week === 'string' && isWeekKey(search.week))
      out.week = search.week
    if (Number.isInteger(comp) && comp > 0) out.comp = comp
    return out
  },
  component: GroupsPage,
})

function GroupsPage() {
  const token = useSessionToken()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const groups = useQuery({ ...groupsQuery, enabled: Boolean(token) })
  const currentUser = useQuery(currentUserQuery(token))
  const feed = useQuery({ ...feedQuery, enabled: Boolean(token) })
  const competitions = feed.data?.map(entry => entry.competition) ?? []
  const currentWeek = currentWeekKey()
  const selectedWeek = search.week ?? currentWeek

  if (!token) return <SignInRequired />

  return (
    <main className='page' id='main-content'>
      <m-vstack align='stretch' gap='lg'>
        <div>
          <div className='section-kicker'>Private competitions</div>
          <h1 className='page-title'>Your Groups</h1>
          <p className='page-subtitle'>
            Predict scores with friends and compare results after each matchday.
          </p>
        </div>

        {groups.data?.length && !currentUser.isPending ? (
          <m-vstack align='stretch' gap='md'>
            <PeriodControls
              mode={search.mode}
              onModeChange={mode =>
                navigate({
                  search: previous => ({
                    ...previous,
                    mode,
                    week: mode === 'week' ? selectedWeek : undefined,
                  }),
                })
              }
              onWeekChange={week =>
                navigate({
                  search: previous => ({ ...previous, mode: 'week', week }),
                })
              }
              week={selectedWeek}
            />
            {competitions.length > 1 ? (
              <nav aria-label='Competition filter' className='scope-rail small'>
                <button
                  aria-pressed={search.comp === undefined}
                  className='scope-tab'
                  onClick={() =>
                    navigate({
                      search: previous => ({ ...previous, comp: undefined }),
                    })
                  }
                  type='button'
                >
                  All
                </button>
                {competitions.map(competition => (
                  <button
                    aria-pressed={search.comp === competition.id}
                    className='scope-tab'
                    key={competition.id}
                    onClick={() =>
                      navigate({
                        search: previous => ({
                          ...previous,
                          comp: competition.id,
                        }),
                      })
                    }
                    type='button'
                  >
                    {competitionCode(competition.name)}
                    <span data-visually-hidden>{competition.name}</span>
                  </button>
                ))}
              </nav>
            ) : null}
            <section aria-label='Group standings' className='two-col'>
              {groups.data.map(group => (
                <GroupLeaderboardCard
                  competitionId={search.comp}
                  group={group}
                  key={group.id}
                  mode={search.mode}
                  userId={currentUser.data?.id}
                  week={selectedWeek}
                />
              ))}
            </section>
          </m-vstack>
        ) : null}

        {groups.isPending || (groups.data?.length && currentUser.isPending) ? (
          <GroupsSkeleton />
        ) : null}
        {currentUser.isError ? (
          <p className='error-card' role='alert'>
            Your account could not be loaded, so personal standings are
            unavailable.
          </p>
        ) : null}
        {groups.isError ? (
          <div className='error-card' role='alert'>
            <m-vstack align='start' gap='sm'>
              <p>
                Groups are unavailable. Check your connection and try again.
              </p>
              <button onClick={() => groups.refetch()} type='button'>
                Retry Groups
              </button>
            </m-vstack>
          </div>
        ) : null}
        {groups.data?.length === 0 ? <EmptyGroups /> : null}

        <section aria-labelledby='create-group-heading' className='divider-top'>
          <h2 className='panel-title' id='create-group-heading'>
            Create a Group
          </h2>
          <p className='hint'>Invite friends and start a private table.</p>
          <CreateGroupForm />
        </section>
      </m-vstack>
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
    <div className='period-bar'>
      <fieldset>
        <legend data-visually-hidden>Leaderboard period</legend>
        <m-segmented>
          <label>
            <input
              checked={mode === 'season'}
              name='leaderboard-period'
              onChange={() => onModeChange('season')}
              type='radio'
              value='season'
            />{' '}
            Season
          </label>
          <label>
            <input
              checked={mode === 'week'}
              name='leaderboard-period'
              onChange={() => onModeChange('week')}
              type='radio'
              value='week'
            />{' '}
            Week
          </label>
        </m-segmented>
      </fieldset>
      {mode === 'week' ? (
        <div className='week-pager'>
          <button
            aria-label='Previous week'
            className='pager-arrow'
            onClick={() => onWeekChange(shiftWeek(week, -7))}
            type='button'
          >
            <CaretLeft aria-hidden />
          </button>
          <span className='week-label'>{weekLabel(week)}</span>
          <button
            aria-label='Next week'
            className='pager-arrow'
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
    <form className='form-card' onSubmit={submit}>
      <m-vstack gap='xs'>
        <label htmlFor='group-name'>Group name</label>
        <input
          autoComplete='off'
          id='group-name'
          maxLength={80}
          name='group-name'
          onChange={event => setName(event.target.value)}
          required
          value={name}
        />
      </m-vstack>
      <button data-variant='primary' disabled={create.isPending} type='submit'>
        {create.isPending ? 'Creating group…' : 'Create Group'}
      </button>
      {create.isError ? (
        <p className='form-error span-all' role='alert'>
          We couldn’t create the group. Check the name and try again.
        </p>
      ) : null}
    </form>
  )
}

function GroupsSkeleton() {
  return (
    <div aria-live='polite' className='two-col' role='status'>
      <span data-visually-hidden>Loading groups…</span>
      {[0, 1].map(card => (
        <div aria-hidden className='skeleton tall' key={card} />
      ))}
    </div>
  )
}

function EmptyGroups() {
  return (
    <div className='empty-state'>
      <h2>No Groups Yet</h2>
      <p className='page-subtitle'>
        Create the first group below and invite people by email.
      </p>
    </div>
  )
}

function SignInRequired() {
  return (
    <main className='page slim' id='main-content'>
      <div className='empty-state'>
        <m-vstack align='center' gap='sm'>
          <h1>Sign In to View Groups</h1>
          <p className='page-subtitle'>
            Groups and predictions are tied to your Maestro account.
          </p>
          <Link className='btn' data-variant='primary' to='/login'>
            Sign In
          </Link>
        </m-vstack>
      </div>
    </main>
  )
}
