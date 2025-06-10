import { useState } from 'preact/hooks';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../utils/database';
import { Bet, deleteBet, updateBet, calculatePayout, calculateProfit } from '../../services/betService';

interface BetListProps {
  matchId: string;
  onEditBet?: (bet: Bet) => void;
}

export default function BetList({ matchId, onEditBet }: BetListProps) {
  const bets = useLiveQuery(
    () => db.bets.where('matchId').equals(matchId).toArray(),
    [matchId]
  );

  const handleDelete = async (betId: string) => {
    if (confirm('Are you sure you want to delete this bet?')) {
      try {
        await deleteBet(betId);
      } catch (error) {
        console.error('Failed to delete bet:', error);
      }
    }
  };

  const handleResultUpdate = async (betId: string, result: 'win' | 'loss' | 'push') => {
    try {
      await updateBet(betId, { result });
    } catch (error) {
      console.error('Failed to update bet result:', error);
    }
  };

  const getResultBadge = (result?: 'win' | 'loss' | 'push') => {
    if (!result) return <span className="badge badge-ghost">Pending</span>;
    
    switch (result) {
      case 'win':
        return <span className="badge badge-success">Win</span>;
      case 'loss':
        return <span className="badge badge-error">Loss</span>;
      case 'push':
        return <span className="badge badge-warning">Push</span>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (!bets) {
    return <div className="loading loading-spinner loading-sm"></div>;
  }

  if (bets.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No bets recorded for this match yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-lg">Bets ({bets.length})</h4>
      
      {bets.map((bet) => (
        <div key={bet.id} className="card bg-base-100 border border-base-300">
          <div className="card-body p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="font-medium">{bet.description}</p>
                <div className="text-sm text-gray-600 mt-1 space-x-4">
                  <span>Line: {bet.line}</span>
                  <span>Odds: {bet.odds > 0 ? `+${bet.odds}` : bet.odds}</span>
                  <span>Wager: {formatCurrency(bet.amount)}</span>
                </div>
                {bet.result && (
                  <div className="text-sm mt-2">
                    {bet.result === 'win' && (
                      <span className="text-success">
                        Payout: {formatCurrency(calculatePayout(bet.amount, bet.odds))} 
                        (+{formatCurrency(calculateProfit(bet.amount, bet.odds))})
                      </span>
                    )}
                    {bet.result === 'loss' && (
                      <span className="text-error">
                        Loss: -{formatCurrency(bet.amount)}
                      </span>
                    )}
                    {bet.result === 'push' && (
                      <span className="text-warning">
                        Push: {formatCurrency(bet.amount)} returned
                      </span>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {getResultBadge(bet.result)}
                
                {!bet.result && (
                  <div className="dropdown dropdown-end">
                    <label tabIndex={0} className="btn btn-sm btn-ghost">
                      Set Result
                    </label>
                    <ul tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-32">
                      <li><a onClick={() => handleResultUpdate(bet.id, 'win')}>Win</a></li>
                      <li><a onClick={() => handleResultUpdate(bet.id, 'loss')}>Loss</a></li>
                      <li><a onClick={() => handleResultUpdate(bet.id, 'push')}>Push</a></li>
                    </ul>
                  </div>
                )}
                
                <div className="dropdown dropdown-end">
                  <label tabIndex={0} className="btn btn-sm btn-ghost">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zM12 13a1 1 0 110-2 1 1 0 010 2zM12 20a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </label>
                  <ul tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-32">
                    {onEditBet && <li><a onClick={() => onEditBet(bet)}>Edit</a></li>}
                    <li><a onClick={() => handleDelete(bet.id)} className="text-error">Delete</a></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
