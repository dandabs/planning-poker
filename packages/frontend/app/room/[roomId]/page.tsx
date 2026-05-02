'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRoom } from '@/hooks/useRoom';
import { ParticipantsList } from '@/components/ParticipantsList';
import { VotingButtons } from '@/components/VotingButtons';
import { RevealButton } from '@/components/RevealButton';

interface PageProps {
  params: Promise<{ roomId: string }>;
}

export default function RoomPage({ params }: PageProps) {
  const searchParams = useSearchParams();
  const username = searchParams.get('username') || '';
  const [roomId, setRoomId] = useState<string | null>(null);

  // Unwrap the params promise
  useEffect(() => {
    params.then((p) => {
      setRoomId(decodeURIComponent(p.roomId));
    });
  }, [params]);

  const { room, participants, currentUserId, loading, error, joinRoom, submitVote, revealVotes, hideVotes } =
    useRoom(roomId || '');

  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);

  // Auto-join when component mounts and we have username
  useEffect(() => {
    if (username && roomId && !joined && !currentUserId && !joining) {
      setJoining(true);
      joinRoom(username).finally(() => {
        setJoined(true);
        setJoining(false);
      });
    }
  }, [username, roomId, joined, currentUserId, joining, joinRoom]);

  const currentParticipant = participants.find((p) => p.id === currentUserId);

  if (!roomId) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!joined && !joining) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="p-8 bg-white rounded-lg shadow-lg">
          <p className="text-gray-600">Joining room...</p>
        </div>
      </div>
    );
  }

  if (error && !joined) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-50">
        <div className="p-8 bg-white rounded-lg shadow-lg max-w-md">
          <h2 className="text-lg font-semibold text-red-900">Error</h2>
          <p className="mt-2 text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6 pb-40">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Planning Poker</h1>
          <div className="mt-4 space-y-2">
            <p className="text-lg text-gray-700">
              <strong>Room:</strong> {roomId}
            </p>
            {currentParticipant && (
              <p className="text-lg text-gray-700">
                <strong>You:</strong> {currentParticipant.username}
              </p>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-8">
          {/* Participants */}
          <div className="p-6 bg-white rounded-lg shadow-md">
            {loading ? (
              <p className="text-gray-600">Loading participants...</p>
            ) : (
              <ParticipantsList
                participants={participants}
                revealed={room?.revealed || false}
                onReveal={() => (room?.revealed ? hideVotes() : revealVotes())}
                revealDisabled={loading || participants.length === 0}
              />
            )}
          </div>

          {/* Voting Section */}
          <div className="">
            <VotingButtons
              onVote={submitVote}
              currentVote={currentParticipant?.vote}
              disabled={loading || room?.revealed}
            />
          </div>

          {/* Reveal button moved into table */}

          {/* Error Display */}
          {error && (
            <div className="p-4 text-sm text-red-700 bg-red-100 rounded-lg">
              <strong>Error:</strong> {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
