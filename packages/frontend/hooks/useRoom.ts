'use client';

import { useEffect, useReducer, useCallback } from 'react';
import {
  executeQuery,
  subscriptionManager,
  GET_ROOM,
  LIST_PARTICIPANTS,
  JOIN_ROOM,
  ENSURE_ROOM,
  VOTE,
  REVEAL,
  ON_VOTE,
  ON_ROOM_UPDATE,
  type RoomUpdateSubscriptionPayload,
  type VoteSubscriptionPayload,
} from '@/lib/graphql';
import { RoomState, Room, Participant } from '@/lib/types';

type Action =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ROOM'; payload: Room }
  | { type: 'UPDATE_ROOM'; payload: Partial<Room> }
  | { type: 'SET_PARTICIPANTS'; payload: Participant[] }
  | { type: 'UPDATE_PARTICIPANT'; payload: Participant }
  | { type: 'SET_CURRENT_USER'; payload: string }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET' };

const initialState: RoomState = {
  room: null,
  participants: [],
  currentUserId: null,
  loading: false,
  error: null,
};

function roomReducer(state: RoomState, action: Action): RoomState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ROOM':
      return { ...state, room: action.payload };
    case 'UPDATE_ROOM':
      return {
        ...state,
        room: state.room ? { ...state.room, ...action.payload } : null,
      };
    case 'SET_PARTICIPANTS':
      return { ...state, participants: action.payload };
    case 'UPDATE_PARTICIPANT': {
      const updated = state.participants.map((p) =>
        p.id === action.payload.id ? action.payload : p
      );
      // If participant not found, add them
      if (!state.participants.find((p) => p.id === action.payload.id)) {
        updated.push(action.payload);
      }
      return { ...state, participants: updated };
    }
    case 'SET_CURRENT_USER':
      return { ...state, currentUserId: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

export function useRoom(roomId: string) {
  const [state, dispatch] = useReducer(roomReducer, initialState);

  const syncRoomData = useCallback(async () => {
    try {
      const [roomResponse, participantsResponse] = await Promise.all([
        executeQuery<{ getRoom: Room }>(GET_ROOM, { roomId }),
        executeQuery<{ listParticipants: Participant[] }>(LIST_PARTICIPANTS, {
          roomId,
        }),
      ]);

      dispatch({ type: 'SET_ROOM', payload: roomResponse.getRoom });
      dispatch({ type: 'SET_PARTICIPANTS', payload: participantsResponse.listParticipants });
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to load room',
      });
    }
  }, [roomId]);

  // Fetch room and participants
  const loadRoomData = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      await syncRoomData();
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to load room',
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [syncRoomData]);

  // Join room
  const joinRoom = useCallback(
    async (username: string) => {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      try {
        const response = await executeQuery<{ joinRoom: Participant }>(
          JOIN_ROOM,
          { roomId, username }
        );
        const participant = response.joinRoom;
        dispatch({ type: 'SET_CURRENT_USER', payload: participant.id });
        
        // Ensure room metadata exists
        await executeQuery(ENSURE_ROOM, { roomId });
        
        await syncRoomData();
      } catch (error) {
        dispatch({
          type: 'SET_ERROR',
          payload: error instanceof Error ? error.message : 'Failed to join room',
        });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [roomId, syncRoomData]
  );

  // Submit vote
  const submitVote = useCallback(
    async (vote: string) => {
      if (!state.currentUserId) {
        dispatch({
          type: 'SET_ERROR',
          payload: 'User not logged in',
        });
        return;
      }

      try {
        await executeQuery(VOTE, {
          roomId,
          userId: state.currentUserId,
          vote,
        });
      } catch (error) {
        dispatch({
          type: 'SET_ERROR',
          payload: error instanceof Error ? error.message : 'Failed to submit vote',
        });
      }
    },
    [roomId, state.currentUserId]
  );

  // Reveal votes
  const revealVotes = useCallback(async () => {
    try {
      await executeQuery(REVEAL, { roomId });
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to reveal votes',
      });
    }
  }, [roomId]);

  // Subscribe to vote updates
  useEffect(() => {
    const subscriptionId = `onVote_${roomId}`;

    if (state.currentUserId) {
      subscriptionManager.subscribe(
        subscriptionId,
        ON_VOTE,
        { roomId },
        (data: VoteSubscriptionPayload) => {
          if (data?.onVote) {
            dispatch({
              type: 'UPDATE_PARTICIPANT',
              payload: data.onVote,
            });
          }
        },
        (error) => {
          console.error('Subscription error:', JSON.stringify(error));
        }
      );
    }

    return () => {
      subscriptionManager.unsubscribe(subscriptionId);
    };
  }, [roomId, state.currentUserId]);

  // Subscribe to room updates (reveal)
  useEffect(() => {
    const subscriptionId = `onRoomUpdate_${roomId}`;

    if (state.currentUserId) {
      subscriptionManager.subscribe(
        subscriptionId,
        ON_ROOM_UPDATE,
        { roomId },
        (data: RoomUpdateSubscriptionPayload) => {
          if (data?.onRoomUpdate) {
            dispatch({
              type: 'UPDATE_ROOM',
              payload: data.onRoomUpdate,
            });
          }
        },
        (error) => {
          console.error('Subscription error:', JSON.stringify(error));
        }
      );
    }

    return () => {
      subscriptionManager.unsubscribe(subscriptionId);
    };
  }, [roomId, state.currentUserId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      subscriptionManager.unsubscribeAll();
    };
  }, []);

  return {
    ...state,
    loadRoomData,
    joinRoom,
    submitVote,
    revealVotes,
  };
}
