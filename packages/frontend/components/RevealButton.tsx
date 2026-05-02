'use client';

interface RevealButtonProps {
  onReveal: () => void;
  disabled?: boolean;
  revealed?: boolean;
}

export function RevealButton({ onReveal, disabled = false, revealed = false }: RevealButtonProps) {
  return (
    <button
      onClick={onReveal}
      disabled={disabled}
      className={`w-full px-4 py-3 font-semibold text-white rounded-lg transition-colors ${
        disabled
          ? 'bg-gray-400 cursor-not-allowed'
          : revealed
            ? 'bg-red-600 hover:bg-red-700'
            : 'bg-blue-600 hover:bg-blue-700'
      }`}
    >
      {revealed ? 'Hide Votes' : 'Reveal Votes'}
    </button>
  );
}
