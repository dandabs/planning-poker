'use client';

interface VotingButtonsProps {
  onVote: (vote: string) => void;
  currentVote?: string | null;
  disabled?: boolean;
}

const VOTE_OPTIONS = ['1', '2', '3', '5', '8', '13'];

export function VotingButtons({ onVote, currentVote, disabled = false }: VotingButtonsProps) {
  return (
    <div>
      <div className="sr-only">Your Vote</div>
      <div className="fixed bottom-4 left-0 w-full flex items-center justify-center px-4 z-50">
        <div className="w-full max-w-3xl bg-white/60 backdrop-blur-sm p-3 rounded-2xl shadow-lg flex items-center justify-between gap-3 z-50">
          {VOTE_OPTIONS.map((vote) => (
            <button
              key={vote}
              onClick={() => onVote(vote)}
              disabled={disabled}
              className={`w-16 h-24 flex items-center justify-center text-lg font-semibold rounded-xl shadow-md transition-transform transform ${
                currentVote === vote
                  ? 'bg-blue-600 text-white scale-105'
                  : 'bg-white text-gray-900 hover:shadow-lg'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {vote}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
