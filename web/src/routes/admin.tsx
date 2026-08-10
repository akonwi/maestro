import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import type { AdminCompetition } from '@/lib/admin'
import {
  AdminAuthError,
  adminCompetitionsQuery,
  getAdminToken,
  setAdminToken,
  upsertCompetition,
} from '@/lib/admin'

export const Route = createFileRoute('/admin')({
  component: AdminPage,
})

function AdminPage() {
  const [hasToken, setHasToken] = useState(() => Boolean(getAdminToken()))

  return (
    <main className='page' id='main-content'>
      <m-vstack align='stretch' gap='lg'>
        <div>
          <h1 className='page-title'>Administration</h1>
          <p className='page-subtitle'>
            Competitions drive everything the app shows. Seasons roll over
            automatically — a league is configured once.
          </p>
        </div>

        {hasToken ? (
          <CompetitionsPanel onAuthError={() => setHasToken(false)} />
        ) : (
          <TokenGate onSubmit={() => setHasToken(true)} />
        )}
      </m-vstack>
    </main>
  )
}

function TokenGate({ onSubmit }: { onSubmit: () => void }) {
  const [token, setToken] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token.trim()) return
    setAdminToken(token.trim())
    onSubmit()
  }

  return (
    <section className='card' style={{ padding: 'var(--space-lg)' }}>
      <form onSubmit={submit}>
        <m-vstack align='start' gap='md'>
          <m-vstack gap='xs'>
            <label htmlFor='admin-token'>Admin token</label>
            <input
              autoComplete='off'
              id='admin-token'
              name='admin-token'
              onChange={event => setToken(event.target.value)}
              required
              type='password'
              value={token}
            />
            <p className='hint'>
              Held for this browser session only. Unrelated to your user
              account.
            </p>
          </m-vstack>
          <button data-variant='primary' type='submit'>
            Unlock
          </button>
        </m-vstack>
      </form>
    </section>
  )
}

function CompetitionsPanel({ onAuthError }: { onAuthError: () => void }) {
  const competitions = useQuery(adminCompetitionsQuery(true))

  if (competitions.isError && competitions.error instanceof AdminAuthError) {
    onAuthError()
    return null
  }

  return (
    <>
      <section aria-labelledby='admin-competitions-heading' className='card'>
        <header className='panel-head'>
          <h2 className='panel-title' id='admin-competitions-heading'>
            Competitions
          </h2>
        </header>
        {competitions.isPending ? (
          <div aria-live='polite' role='status'>
            <span data-visually-hidden>Loading competitions…</span>
            <div aria-hidden className='skeleton' />
          </div>
        ) : null}
        {competitions.isError ? (
          <p className='form-error' role='alert'>
            {competitions.error.message}
          </p>
        ) : null}
        {competitions.data ? (
          <CompetitionsTable competitions={competitions.data} />
        ) : null}
      </section>

      <AddCompetitionForm />
    </>
  )
}

function CompetitionsTable({
  competitions,
}: {
  competitions: AdminCompetition[]
}) {
  if (competitions.length === 0)
    return <p className='panel-body meta'>No competitions yet.</p>
  return (
    <table className='admin-table'>
      <caption data-visually-hidden>Configured competitions</caption>
      <thead>
        <tr>
          <th scope='col'>Competition</th>
          <th abbr='API-Football league id' scope='col'>
            League ID
          </th>
          <th scope='col'>Status</th>
          <th scope='col'>
            <span data-visually-hidden>Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {competitions.map(competition => (
          <CompetitionRow competition={competition} key={competition.id} />
        ))}
      </tbody>
    </table>
  )
}

function CompetitionRow({ competition }: { competition: AdminCompetition }) {
  const queryClient = useQueryClient()
  const toggle = useMutation({
    mutationFn: () =>
      upsertCompetition({
        api_football_league_id: competition.api_football_league_id,
        name: competition.name,
        kind: competition.kind,
        is_active: !competition.is_active,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'competitions'] }),
  })

  return (
    <tr className={competition.is_active ? undefined : 'inactive'}>
      <th scope='row'>{competition.name}</th>
      <td className='num'>{competition.api_football_league_id}</td>
      <td>
        <span className={competition.is_active ? 'chip on' : 'chip'}>
          {competition.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className='action'>
        <button
          disabled={toggle.isPending}
          onClick={() => toggle.mutate()}
          type='button'
        >
          {toggle.isPending
            ? 'Saving…'
            : competition.is_active
              ? 'Deactivate'
              : 'Activate'}
        </button>
        {toggle.isError ? (
          <p className='form-error' role='alert'>
            {toggle.error.message}
          </p>
        ) : null}
      </td>
    </tr>
  )
}

function AddCompetitionForm() {
  const queryClient = useQueryClient()
  const [leagueId, setLeagueId] = useState('')
  const [name, setName] = useState('')
  const [kind, setKind] = useState('league')

  const add = useMutation({
    mutationFn: () =>
      upsertCompetition({
        api_football_league_id: Number(leagueId),
        name: name.trim(),
        kind,
      }),
    onSuccess: () => {
      setLeagueId('')
      setName('')
      queryClient.invalidateQueries({ queryKey: ['admin', 'competitions'] })
    },
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    add.mutate()
  }

  return (
    <section aria-labelledby='admin-add-heading' className='card'>
      <header className='panel-head'>
        <h2 className='panel-title' id='admin-add-heading'>
          Add competition
        </h2>
      </header>
      <form className='admin-form' onSubmit={submit}>
        <m-vstack align='start' gap='md'>
          <div className='admin-form-grid'>
            <m-vstack gap='xs'>
              <label htmlFor='add-league-id'>API-Football league ID</label>
              <input
                id='add-league-id'
                inputMode='numeric'
                min='1'
                onChange={event => setLeagueId(event.target.value)}
                required
                type='number'
                value={leagueId}
              />
            </m-vstack>
            <m-vstack gap='xs'>
              <label htmlFor='add-name'>Name</label>
              <input
                id='add-name'
                onChange={event => setName(event.target.value)}
                placeholder='Premier League'
                required
                type='text'
                value={name}
              />
            </m-vstack>
            <m-vstack gap='xs'>
              <label htmlFor='add-kind'>Kind</label>
              <select
                id='add-kind'
                onChange={event => setKind(event.target.value)}
                value={kind}
              >
                <option value='league'>League</option>
                <option value='cup'>Cup</option>
                <option value='playoff'>Playoff</option>
              </select>
            </m-vstack>
          </div>
          {add.isError ? (
            <p className='form-error' role='alert'>
              {add.error.message}
            </p>
          ) : null}
          <button data-variant='primary' disabled={add.isPending} type='submit'>
            {add.isPending ? 'Adding…' : 'Add competition'}
          </button>
          <p className='hint'>
            Upserts by league ID — re-adding an existing league updates it. The
            current season is resolved automatically from API-Football.
          </p>
        </m-vstack>
      </form>
    </section>
  )
}
