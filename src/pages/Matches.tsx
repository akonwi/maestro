import { useState, useEffect } from 'preact/hooks';
import { Team, Match } from '../types';
import { getAllTeams, addMatch, getAllMatches } from '../utils/database';

export function Matches() {
	const [teams, setTeams] = useState<Team[]>([]);
	const [matches, setMatches] = useState<Match[]>([]);
	const [showAddForm, setShowAddForm] = useState(false);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	
	// Form state
	const [matchDate, setMatchDate] = useState('');
	const [homeTeamId, setHomeTeamId] = useState('');
	const [awayTeamId, setAwayTeamId] = useState('');
	const [homeScore, setHomeScore] = useState('');
	const [awayScore, setAwayScore] = useState('');

	useEffect(() => {
		loadData();
	}, []);

	const loadData = async () => {
		try {
			setLoading(true);
			const [allTeams, allMatches] = await Promise.all([
				getAllTeams(),
				getAllMatches()
			]);
			setTeams(allTeams);
			setMatches(allMatches);
			setError(null);
		} catch (err) {
			setError('Failed to load data');
			console.error('Error loading data:', err);
		} finally {
			setLoading(false);
		}
	};

	const handleAddMatch = async (e: Event) => {
		e.preventDefault();
		
		if (!matchDate || !homeTeamId || !awayTeamId || homeScore === '' || awayScore === '') {
			setError('Please fill in all fields');
			return;
		}

		if (homeTeamId === awayTeamId) {
			setError('Home and away teams must be different');
			return;
		}

		const homeScoreNum = parseInt(homeScore);
		const awayScoreNum = parseInt(awayScore);
		
		if (isNaN(homeScoreNum) || isNaN(awayScoreNum) || homeScoreNum < 0 || awayScoreNum < 0) {
			setError('Scores must be valid numbers (0 or greater)');
			return;
		}

		try {
			const newMatch: Match = {
				id: crypto.randomUUID(),
				date: matchDate,
				homeId: homeTeamId,
				awayId: awayTeamId,
				homeScore: homeScoreNum,
				awayScore: awayScoreNum,
				createdAt: new Date()
			};

			await addMatch(newMatch);
			setMatches(prev => [newMatch, ...prev]);
			
			// Reset form
			setMatchDate('');
			setHomeTeamId('');
			setAwayTeamId('');
			setHomeScore('');
			setAwayScore('');
			setShowAddForm(false);
			setError(null);
		} catch (err) {
			setError('Failed to add match');
			console.error('Error adding match:', err);
		}
	};

	const getTeamName = (teamId: string) => {
		const team = teams.find(t => t.id === teamId);
		return team ? team.name : 'Unknown Team';
	};

	const formatMatchResult = (match: Match) => {
		const homeTeam = getTeamName(match.homeId);
		const awayTeam = getTeamName(match.awayId);
		return `${homeTeam} ${match.homeScore} - ${match.awayScore} ${awayTeam}`;
	};

	if (loading) {
		return (
			<div className="text-center py-12">
				<span className="loading loading-spinner loading-lg"></span>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<h1 className="text-3xl font-bold">Matches</h1>
				<button 
					className="btn btn-primary"
					onClick={() => setShowAddForm(true)}
					disabled={teams.length < 2}
				>
					Add Match
				</button>
			</div>

			{teams.length < 2 && (
				<div className="alert alert-warning">
					<span>You need at least 2 teams to record matches. <a href="/" className="link">Add teams first</a>.</span>
				</div>
			)}

			{error && (
				<div className="alert alert-error">
					<span>{error}</span>
				</div>
			)}

			{showAddForm && (
				<div className="card bg-base-100 shadow-xl">
					<div className="card-body">
						<h2 className="card-title">Add New Match</h2>
						<form onSubmit={handleAddMatch} className="space-y-4">
							<div className="form-control">
								<label className="label">
									<span className="label-text">Match Date</span>
								</label>
								<input 
									type="date"
									className="input input-bordered"
									value={matchDate}
									onInput={(e) => setMatchDate((e.target as HTMLInputElement).value)}
									required
								/>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div className="form-control">
									<label className="label">
										<span className="label-text">Home Team</span>
									</label>
									<select 
										className="select select-bordered"
										value={homeTeamId}
										onChange={(e) => setHomeTeamId((e.target as HTMLSelectElement).value)}
										required
									>
										<option value="">Select home team</option>
										{teams.map(team => (
											<option key={team.id} value={team.id}>{team.name}</option>
										))}
									</select>
								</div>

								<div className="form-control">
									<label className="label">
										<span className="label-text">Away Team</span>
									</label>
									<select 
										className="select select-bordered"
										value={awayTeamId}
										onChange={(e) => setAwayTeamId((e.target as HTMLSelectElement).value)}
										required
									>
										<option value="">Select away team</option>
										{teams.map(team => (
											<option key={team.id} value={team.id} disabled={team.id === homeTeamId}>
												{team.name}
											</option>
										))}
									</select>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="form-control">
									<label className="label">
										<span className="label-text">Home Score</span>
									</label>
									<input 
										type="number"
										min="0"
										className="input input-bordered"
										value={homeScore}
										onInput={(e) => setHomeScore((e.target as HTMLInputElement).value)}
										placeholder="0"
										required
									/>
								</div>

								<div className="form-control">
									<label className="label">
										<span className="label-text">Away Score</span>
									</label>
									<input 
										type="number"
										min="0"
										className="input input-bordered"
										value={awayScore}
										onInput={(e) => setAwayScore((e.target as HTMLInputElement).value)}
										placeholder="0"
										required
									/>
								</div>
							</div>

							<div className="card-actions justify-end">
								<button 
									type="button"
									className="btn btn-ghost"
									onClick={() => {
										setShowAddForm(false);
										setMatchDate('');
										setHomeTeamId('');
										setAwayTeamId('');
										setHomeScore('');
										setAwayScore('');
										setError(null);
									}}
								>
									Cancel
								</button>
								<button type="submit" className="btn btn-primary">
									Add Match
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{matches.length === 0 ? (
				<div className="text-center py-12">
					<div className="text-base-content/60 text-lg">No matches recorded yet</div>
					<div className="text-base-content/40 text-sm mt-2">
						Add your first match to get started
					</div>
				</div>
			) : (
				<div className="space-y-4">
					{matches.map(match => (
						<div key={match.id} className="card bg-base-100 shadow-xl">
							<div className="card-body">
								<div className="flex justify-between items-center">
									<div>
										<h3 className="text-lg font-semibold">{formatMatchResult(match)}</h3>
										<p className="text-base-content/60 text-sm">
											{new Date(match.date).toLocaleDateString()}
										</p>
									</div>
									<div className="text-right">
										<div className="text-2xl font-bold">
											{match.homeScore} - {match.awayScore}
										</div>
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
