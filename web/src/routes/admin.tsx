import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { type FormEvent, useEffect, useState } from 'react'
import type { AdminCompetition, LeagueSearchResult } from '@/lib/admin'
import {
  AdminAuthError,
  adminCompetitionsQuery,
  getAdminToken,
  leagueSearchQuery,
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
  const [searchText, setSearchText] = useState('')
  const [debounced, setDebounced] = useState('')
  const [selected, setSelected] = useState<LeagueSearchResult | null>(null)
  const [name, setName] = useState('')
  const [kind, setKind] = useState('league')

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(searchText), 300)
    return () => clearTimeout(timer)
  }, [searchText])

  const search = useQuery(leagueSearchQuery(debounced))
  const results = search.data ?? []

  const add = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Pick a league from the search results.')
      return upsertCompetition({
        api_football_league_id: selected.league_id,
        name: name.trim(),
        kind,
      })
    },
    onSuccess: () => {
      setSearchText('')
      setSelected(null)
      setName('')
      setKind('league')
      queryClient.invalidateQueries({ queryKey: ['admin', 'competitions'] })
    },
  })

  function onSearchChange(value: string) {
    setSearchText(value)
    // mica's combobox commits a selection by dispatching a real change
    // event with the option's value; match it back to the result.
    const picked = results.find(result => optionLabel(result) === value)
    if (picked) {
      setSelected(picked)
      setName(picked.name)
      setKind(picked.type === 'Cup' ? 'cup' : 'league')
    } else if (selected) {
      setSelected(null)
    }
  }

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
          <m-vstack gap='xs' style={{ inlineSize: '100%' }}>
            <label htmlFor='league-search'>Find a league</label>
            <m-combobox>
              <input
                autoComplete='off'
                id='league-search'
                list='league-search-options'
                onChange={event => onSearchChange(event.target.value)}
                placeholder='Search API-Football (e.g. championship)…'
                type='text'
                value={searchText}
              />
              <datalist id='league-search-options'>
                {results.map(result => (
                  <option
                    key={`${result.league_id}-${result.country}`}
                    value={optionLabel(result)}
                  />
                ))}
              </datalist>
            </m-combobox>
            {search.isFetching ? (
              <p className='hint'>Searching…</p>
            ) : selected ? (
              <p className='hint'>
                League ID {selected.league_id} · {selected.country} ·{' '}
                {selected.type}
              </p>
            ) : (
              <p className='hint'>
                Type at least three characters, then pick a result.
              </p>
            )}
            {search.isError ? (
              <p className='form-error' role='alert'>
                {search.error.message}
              </p>
            ) : null}
          </m-vstack>

          {selected ? (
            <div className='admin-form-grid'>
              <m-vstack gap='xs'>
                <label htmlFor='add-name'>Display name</label>
                <input
                  id='add-name'
                  onChange={event => setName(event.target.value)}
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
          ) : null}

          {add.isError ? (
            <p className='form-error' role='alert'>
              {add.error.message}
            </p>
          ) : null}
          <button
            data-variant='primary'
            disabled={!selected || add.isPending}
            type='submit'
          >
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

function optionLabel(result: LeagueSearchResult) {
  return `${result.name} — ${result.country}`
}
