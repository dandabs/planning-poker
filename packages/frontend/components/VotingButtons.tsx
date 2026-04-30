'use client';

interface VotingButtonsProps {
  onVote: (vote: string) => void;
  currentVote?: string | null;
  disabled?: boolean;
}

const VOTE_OPTIONS = ['1', '2', '3', '5', '8', '13'];

export function VotingButtons({ onVote, currentVote, disabled = false }: VotingButtonsProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900">Your Vote</h2>
      <div className="grid gap-2 grid-cols-3 sm:grid-cols-6">
        {VOTE_OPTIONS.map((vote) => (
          <button
            key={vote}
            onClick={() => onVote(vote)}
            disabled={disabled}
            className={`px-3 py-2 font-semibold rounded-lg transition-colors ${
              currentVote === vote
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {vote}
          </button>
        ))}
      </div>
    </div>
  );
}
