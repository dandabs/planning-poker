'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!roomId.trim()) {
      setError('Please enter a room ID');
      return;
    }

    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    setLoading(true);

    try {
      // Navigate to room page - the room page will handle joining
      router.push(`/room/${encodeURIComponent(roomId)}?username=${encodeURIComponent(username)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room');
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">Planning Poker</h1>
        <p className="mb-8 text-gray-600">Join a room to start voting</p>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label htmlFor="roomId" className="block mb-2 text-sm font-medium text-gray-700">
              Room ID
            </label>
            <input
              id="roomId"
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Enter room ID"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="username" className="block mb-2 text-sm font-medium text-gray-700">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              disabled={loading}
            />
          </div>

          {error && <div className="p-3 text-sm text-red-700 bg-red-100 rounded-lg">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Joining...' : 'Join Room'}
          </button>
        </form>

        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-gray-600">
            <strong>Demo tip:</strong> Use any room ID (e.g., "room-123") and any username to get started.
          </p>
        </div>
      </div>
    </div>
  );
}
