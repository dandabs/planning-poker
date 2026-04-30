'use client';

import { Participant } from '@/lib/types';

interface ParticipantsListProps {
  participants: Participant[];
  revealed: boolean;
}

export function ParticipantsList({ participants, revealed }: ParticipantsListProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900">Participants</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {participants.map((participant) => (
          <div
            key={participant.id}
            className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
          >
            <p className="font-medium text-gray-900">{participant.username}</p>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-gray-500">Vote:</span>
              <div
                className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  revealed && participant.vote
                    ? 'bg-green-100 text-green-800'
                    : participant.vote
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-gray-100 text-gray-500'
                }`}
              >
                {revealed || !participant.vote ? participant.vote || '?' : '?'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
