'use client';

import { useEffect, useReducer, useCallback, useRef } from 'react';
import {
  executeQuery,
  subscriptionManager,
  GET_ROOM,
  LIST_PARTICIPANTS,
  JOIN_ROOM,
  ENSURE_ROOM,
  VOTE,
  REVEAL,
  HIDE,
  CLEAR_VOTE,
  KICK,
  ON_VOTE,
  ON_ROOM_UPDATE,
  HEARTBEAT,
  PARTICIPANT_LEFT,
  ON_PARTICIPANT_LEFT,
  type RoomUpdateSubscriptionPayload,
  type VoteSubscriptionPayload,
} from '@/lib/graphql';
import { API_ENDPOINT, API_KEY } from '@/lib/graphql';
import { RoomState, Room, Participant } from '@/lib/types';

type Action =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ROOM'; payload: Room }
  | { type: 'UPDATE_ROOM'; payload: Partial<Room> }
  | { type: 'SET_PARTICIPANTS'; payload: Participant[] }
  | { type: 'UPDATE_PARTICIPANT'; payload: Participant }
  | { type: 'SET_CURRENT_USER'; payload: string }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'REMOVE_PARTICIPANT'; payload: string }
  | { type: 'SET_KICKED'; payload: boolean }
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
    case 'REMOVE_PARTICIPANT':
      return { ...state, participants: state.participants.filter(p => p.id !== action.payload) };
    case 'SET_KICKED':
      return { ...state, kicked: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

export function useRoom(roomId: string) {
  const [state, dispatch] = useReducer(roomReducer, initialState);
  const heartbeatRef = useRef<number | null>(null);
  const usernameRef = useRef<string | null>(null);

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
        usernameRef.current = username;

        // Ensure room metadata exists
        await executeQuery(ENSURE_ROOM, { roomId });

        // start heartbeat to keep TTL updated
        if (participant.id) {
          // clear existing
          if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current);
          }

          // send initial heartbeat immediately
          executeQuery(HEARTBEAT, { roomId, userId: participant.id }).catch((err) =>
            console.error('Heartbeat failed', err)
          );

          // start an interval that updates TTL every 30 seconds
          const id = window.setInterval(() => {
            executeQuery(HEARTBEAT, { roomId, userId: participant.id }).catch((err) =>
              console.error('Heartbeat failed', err)
            );
          }, 30_000);
          heartbeatRef.current = id;
        }

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

  const hideVotes = useCallback(async () => {
    try {
      await executeQuery(HIDE, { roomId });
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to hide votes',
      });
    }
  }, [roomId]);

  const clearParticipantVote = useCallback(async (userId: string) => {
    try {
      const res = await executeQuery<{ clearVote: Participant }>(CLEAR_VOTE, { roomId, userId });
      if (res?.clearVote) {
        dispatch({ type: 'UPDATE_PARTICIPANT', payload: res.clearVote });
        // also publish the change so other clients receive the update
        try {
          await executeQuery(PUBLISH_PARTICIPANT_CHANGE, {
            roomId,
            userId: res.clearVote.id,
            username: res.clearVote.username,
            vote: res.clearVote.vote,
          });
        } catch (e) {
          console.warn('Publish participant change failed', e);
        }
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to clear vote' });
    }
  }, [roomId]);

  const kickParticipant = useCallback(async (userId: string) => {
    try {
      await executeQuery(KICK, { roomId, userId });
      // remove locally
      dispatch({ type: 'REMOVE_PARTICIPANT', payload: userId });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to kick participant' });
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

  // Subscribe to participant-left events
  useEffect(() => {
    const subscriptionId = `onParticipantLeft_${roomId}`;

    if (state.currentUserId) {
      subscriptionManager.subscribe(
        subscriptionId,
        ON_PARTICIPANT_LEFT,
        { roomId },
        (data: { onParticipantLeft?: Participant }) => {
          if (data?.onParticipantLeft) {
            const id = data.onParticipantLeft.id;
            // remove participant from list
            dispatch({ type: 'REMOVE_PARTICIPANT', payload: id });
            // if the event is for this client, mark as kicked
            if (id === state.currentUserId) {
              dispatch({ type: 'SET_KICKED', payload: true });
            }
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

  // Send participantLeft when the user closes the tab/window
  useEffect(() => {
    if (!state.currentUserId) return;

    const sendLeft = () => {
      const userId = state.currentUserId;
      const username = usernameRef.current ?? null;
      const payload = { roomId, userId, username };

      try {
        // Prefer sendBeacon to survive unload; send to local API route that forwards to AppSync
        const url = '/api/leave';
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        const beaconSent = typeof navigator !== 'undefined' && navigator.sendBeacon && navigator.sendBeacon(url, blob);
        if (beaconSent) {
          console.debug('leave: beacon sent', payload);
          return;
        }

        // Fallback to fetch with keepalive
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        })
          .then((res) => console.debug('leave response', res.status, res.statusText))
          .catch((e) => console.warn('leave fetch failed', e));
      } catch (e) {
        console.warn('leave send failed', e);
      }
    };

    const onPageHide = () => sendLeft();

    // Only send leave on pagehide / unload — don't send on visibilitychange
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', sendLeft);

    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', sendLeft);
    };
  }, [state.currentUserId, roomId]);

  // Clear heartbeat interval on unmount
  useEffect(() => {
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, []);

  return {
    ...state,
    loadRoomData,
    joinRoom,
    submitVote,
    revealVotes,
    hideVotes,
    clearParticipantVote,
    kickParticipant,
    kicked: state.kicked || false,
  };
}
