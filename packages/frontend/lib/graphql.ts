import { GraphQLClient, gql } from 'graphql-request';
import type { Participant, Room } from './types';

// Get the API endpoint and API key from environment variables
export const API_ENDPOINT = process.env.NEXT_PUBLIC_APPSYNC_API_URL || 'http://localhost:3000/graphql';
export const API_KEY = process.env.NEXT_PUBLIC_APPSYNC_API_KEY || '';

// Initialize GraphQL client for HTTP operations (queries and mutations)
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  'x-api-key': API_KEY,
};

export const graphqlClient = new GraphQLClient(API_ENDPOINT, {
  headers,
});

// GraphQL Operations
export const GET_ROOM = gql`
  query GetRoom($roomId: ID!) {
    getRoom(roomId: $roomId) {
      id
      roomId
      revealed
    }
  }
`;

export const LIST_PARTICIPANTS = gql`
  query ListParticipants($roomId: ID!) {
    listParticipants(roomId: $roomId) {
      id
      roomId
      username
      vote
    }
  }
`;

export const JOIN_ROOM = gql`
  mutation JoinRoom($roomId: ID!, $username: String!) {
    joinRoom(roomId: $roomId, username: $username) {
      id
      roomId
      username
      vote
    }
  }
`;

export const ENSURE_ROOM = gql`
  mutation EnsureRoom($roomId: ID!) {
    ensureRoom(roomId: $roomId) {
      id
      roomId
      revealed
    }
  }
`;

export const VOTE = gql`
  mutation Vote($roomId: ID!, $userId: ID!, $vote: String!) {
    vote(roomId: $roomId, userId: $userId, vote: $vote) {
      id
      roomId
      username
      vote
    }
  }
`;

export const REVEAL = gql`
  mutation Reveal($roomId: ID!) {
    reveal(roomId: $roomId) {
      id
      roomId
      revealed
    }
  }
`;

export const HIDE = gql`
  mutation Hide($roomId: ID!) {
    hide(roomId: $roomId) {
      id
      roomId
      revealed
    }
  }
`;

export const CLEAR_VOTE = gql`
  mutation ClearVote($roomId: ID!, $userId: ID!) {
    clearVote(roomId: $roomId, userId: $userId) {
      id
      roomId
      username
      vote
    }
  }
`;

export const KICK = gql`
  mutation Kick($roomId: ID!, $userId: ID!) {
    kick(roomId: $roomId, userId: $userId) {
      id
      roomId
      username
    }
  }
`;

export const PUBLISH_PARTICIPANT_CHANGE = gql`
  mutation PublishParticipantChange($roomId: ID!, $userId: ID!, $username: String, $vote: String) {
    publishParticipantChange(roomId: $roomId, userId: $userId, username: $username, vote: $vote) {
      id
      roomId
      username
      vote
    }
  }
`;

export const HEARTBEAT = gql`
  mutation Heartbeat($roomId: ID!, $userId: ID!) {
    heartbeat(roomId: $roomId, userId: $userId) {
      id
      roomId
    }
  }
`;

export const PARTICIPANT_LEFT = gql`
  mutation ParticipantLeft($roomId: ID!, $userId: ID!, $username: String) {
    participantLeft(roomId: $roomId, userId: $userId, username: $username) {
      id
      roomId
      username
    }
  }
`;

// Subscription documents (for WebSocket handling)
export const ON_VOTE = gql`
  subscription OnVote($roomId: ID!) {
    onVote(roomId: $roomId) {
      id
      roomId
      username
      vote
    }
  }
`;

export const ON_ROOM_UPDATE = gql`
  subscription OnRoomUpdate($roomId: ID!) {
    onRoomUpdate(roomId: $roomId) {
      id
      roomId
      revealed
    }
  }
`;

export const ON_PARTICIPANT_LEFT = gql`
  subscription OnParticipantLeft($roomId: ID!) {
    onParticipantLeft(roomId: $roomId) {
      id
      roomId
      username
    }
  }
`;

export type VoteSubscriptionPayload = {
  onVote: Participant;
};

export type RoomUpdateSubscriptionPayload = {
  onRoomUpdate: Room;
};

// WebSocket Subscription Manager for AppSync
interface WebSocketMessage {
  type: string;
  id?: string;
  payload?: unknown;
  message?: string;
}

class AppSyncSubscriptionManager {
  private subscriptions: Map<string, { ws: WebSocket; unsubscribe: () => void }> = new Map();
  private connectionPromises: Map<string, Promise<void>> = new Map();

  private getWebSocketUrl(endpoint: string): string {
    const url = new URL(endpoint);
    const apiHost = url.hostname;
    const realtimeHost = apiHost.includes('appsync-api')
      ? apiHost.replace('appsync-api', 'appsync-realtime-api')
      : apiHost;
    const headersForAuth = {
      host: apiHost,
      ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
    };

    const encodedHeader = typeof btoa === 'function'
      ? btoa(JSON.stringify(headersForAuth))
      : Buffer.from(JSON.stringify(headersForAuth)).toString('base64');
    const encodedPayload = typeof btoa === 'function'
      ? btoa(JSON.stringify({}))
      : Buffer.from(JSON.stringify({})).toString('base64');

    return `wss://${realtimeHost}/graphql?header=${encodedHeader}&payload=${encodedPayload}`;
  }

  private createConnection(wsUrl: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(wsUrl, 'graphql-ws');

        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('WebSocket connection timeout'));
        }, 5000);

        ws.onopen = () => {
          clearTimeout(timeout);
          resolve(ws);
        };

        ws.onerror = (error) => {
          clearTimeout(timeout);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  subscribe<TData = unknown>(
    subscriptionId: string,
    subscription: string,
    variables: Record<string, unknown>,
    onData: (data: TData) => void,
    onError?: (error: unknown) => void
  ): void {
    if (this.subscriptions.has(subscriptionId)) {
      onError?.(new Error(`Subscription ${subscriptionId} already exists`));
      return;
    }

    const execute = async () => {
      try {
        const wsUrl = this.getWebSocketUrl(API_ENDPOINT);
        const ws = await this.createConnection(wsUrl);

        let subscriptionActive = true;

        ws.onmessage = (event) => {
          if (!subscriptionActive) return;

          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            console.log('WS message:', message.type);

            if (message.type === 'connection_ack') {
              const subscriptionMessage = {
                id: subscriptionId,
                type: 'start',
                payload: {
                  data: JSON.stringify({
                    query: subscription,
                    variables,
                  }),
                  extensions: {
                    authorization: {
                        host: new URL(API_ENDPOINT).hostname,
                        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
                    }
                  }
                },
              };

              ws.send(JSON.stringify(subscriptionMessage));
              return;
            }

            if (message.type === 'data' && message.id === subscriptionId) {
              const data = typeof message.payload === 'string'
                ? JSON.parse(message.payload)
                : message.payload;
              onData(((data as { data?: TData })?.data ?? data) as TData);
            } else if (message.type === 'error' && message.id === subscriptionId) {
              onError?.(message.payload || message.message);
              subscriptionActive = false;
              ws.close();
            } else if (message.type === 'complete' && message.id === subscriptionId) {
              subscriptionActive = false;
            }
          } catch (parseError) {
            console.error('Failed to parse WebSocket message:', parseError);
            onError?.(parseError);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          onError?.(error);
          subscriptionActive = false;
        };

        ws.onclose = () => {
          subscriptionActive = false;
          this.subscriptions.delete(subscriptionId);
        };

        this.subscriptions.set(subscriptionId, {
          ws,
          unsubscribe: () => {
            subscriptionActive = false;
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ id: subscriptionId, type: 'stop' }));
            }
            ws.close();
          },
        });

        // Send connection_init immediately after connection is ready
        ws.send(JSON.stringify({ type: 'connection_init', payload: {} }));
      } catch (error) {
        console.error('Failed to create subscription:', error);
        onError?.(error);
      }
    };

    execute();
  }

  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(subscriptionId);
    }
  }

  unsubscribeAll(): void {
    this.subscriptions.forEach((subscription) => {
      subscription.unsubscribe();
    });
    this.subscriptions.clear();
    this.connectionPromises.clear();
  }
}

export const subscriptionManager = new AppSyncSubscriptionManager();

// Helper to execute queries and mutations
export async function executeQuery<T>(
  document: string,
  variables?: Record<string, unknown>
): Promise<T> {
  try {
    return await graphqlClient.request<T>(document, variables);
  } catch (error) {
    console.error('GraphQL error:', error);
    throw error;
  }
}
