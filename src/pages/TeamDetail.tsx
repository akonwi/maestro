import { useState, useEffect } from 'preact/hooks';
import { Team } from '../types';
import { getTeamById } from '../utils/database';

interface TeamDetailProps {
	teamId: string;
}

export function TeamDetail({ teamId }: TeamDetailProps) {
	const [team, setTeam] = useState<Team | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		loadTeam();
	}, [teamId]);

	const loadTeam = async () => {
		try {
			setLoading(true);
			const foundTeam = await getTeamById(teamId);
			if (foundTeam) {
				setTeam(foundTeam);
				setError(null);
			} else {
				setError('Team not found');
			}
		} catch (err) {
			setError('Failed to load team');
			console.error('Error loading team:', err);
		} finally {
			setLoading(false);
		}
	};

	if (loading) {
		return (
			<div className="text-center py-12">
				<span className="loading loading-spinner loading-lg"></span>
			</div>
		);
	}

	if (error) {
		return (
			<div className="space-y-6">
				<div className="alert alert-error">
					<span>{error}</span>
				</div>
				<a href="/" className="btn btn-outline">
					← Back to Teams
				</a>
			</div>
		);
	}

	if (!team) {
		return null;
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-4">
				<a href="/" className="btn btn-ghost btn-sm">
					← Back to Teams
				</a>
				<h1 className="text-3xl font-bold">{team.name}</h1>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<div className="lg:col-span-2">
					<div className="card bg-base-100 shadow-xl">
						<div className="card-body">
							<h2 className="card-title">Team Information</h2>
							<div className="space-y-2">
								<p><span className="font-semibold">Name:</span> {team.name}</p>
								<p><span className="font-semibold">Created:</span> {team.createdAt.toLocaleDateString()}</p>
							</div>
						</div>
					</div>
				</div>

				<div>
					<div className="card bg-base-100 shadow-xl">
						<div className="card-body">
							<h2 className="card-title">Quick Stats</h2>
							<div className="stats stats-vertical shadow">
								<div className="stat">
									<div className="stat-title">Games</div>
									<div className="stat-value">-</div>
								</div>
								<div className="stat">
									<div className="stat-title">W-L-D</div>
									<div className="stat-value text-sm">-</div>
								</div>
								<div className="stat">
									<div className="stat-title">Goals</div>
									<div className="stat-value text-sm">- : -</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div className="card bg-base-100 shadow-xl">
				<div className="card-body">
					<h2 className="card-title">Recent Matches</h2>
					<div className="text-center py-8 text-base-content/60">
						No matches recorded yet
					</div>
				</div>
			</div>
		</div>
	);
}
