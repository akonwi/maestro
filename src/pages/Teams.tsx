import { useState } from 'preact/hooks';
import { Team } from '../types';

export function Teams() {
	const [teams, setTeams] = useState<Team[]>([]);
	const [showAddForm, setShowAddForm] = useState(false);
	const [newTeamName, setNewTeamName] = useState('');

	const handleAddTeam = (e: Event) => {
		e.preventDefault();
		if (newTeamName.trim()) {
			const newTeam: Team = {
				id: crypto.randomUUID(),
				name: newTeamName.trim(),
				createdAt: new Date()
			};
			setTeams(prev => [...prev, newTeam]);
			setNewTeamName('');
			setShowAddForm(false);
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<h1 className="text-3xl font-bold">Teams</h1>
				<button 
					className="btn btn-primary"
					onClick={() => setShowAddForm(true)}
				>
					Add Team
				</button>
			</div>

			{showAddForm && (
				<div className="card bg-base-100 shadow-xl">
					<div className="card-body">
						<h2 className="card-title">Add New Team</h2>
						<form onSubmit={handleAddTeam} className="space-y-4">
							<div className="form-control">
								<label className="label">
									<span className="label-text">Team Name</span>
								</label>
								<input 
									type="text"
									className="input input-bordered"
									value={newTeamName}
									onInput={(e) => setNewTeamName((e.target as HTMLInputElement).value)}
									placeholder="Enter team name"
									autoFocus
									required
								/>
							</div>
							<div className="card-actions justify-end">
								<button 
									type="button"
									className="btn btn-ghost"
									onClick={() => {
										setShowAddForm(false);
										setNewTeamName('');
									}}
								>
									Cancel
								</button>
								<button type="submit" className="btn btn-primary">
									Add Team
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{teams.length === 0 ? (
				<div className="text-center py-12">
					<div className="text-base-content/60 text-lg">No teams yet</div>
					<div className="text-base-content/40 text-sm mt-2">
						Add your first team to get started
					</div>
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{teams.map(team => (
						<div key={team.id} className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
							<div className="card-body">
								<h2 className="card-title">{team.name}</h2>
								<p className="text-base-content/60 text-sm">
									Added {team.createdAt.toLocaleDateString()}
								</p>
								<div className="card-actions justify-end">
									<button className="btn btn-sm btn-outline">View Details</button>
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
