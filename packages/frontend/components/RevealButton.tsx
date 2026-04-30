'use client';

interface RevealButtonProps {
  onReveal: () => void;
  disabled?: boolean;
  revealed?: boolean;
}

export function RevealButton({ onReveal, disabled = false, revealed = false }: RevealButtonProps) {
  if (revealed) {
    return (
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
        <p className="text-sm font-medium text-green-800">✓ Votes have been revealed</p>
      </div>
    );
  }

  return (
    <button
      onClick={onReveal}
      disabled={disabled}
      className={`w-full px-4 py-3 font-semibold text-white rounded-lg transition-colors ${
        disabled
          ? 'bg-gray-400 cursor-not-allowed'
          : 'bg-blue-600 hover:bg-blue-700'
      }`}
    >
      Reveal Votes
    </button>
  );
}
