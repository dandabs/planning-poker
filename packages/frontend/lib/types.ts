// GraphQL Types
export interface Room {
  id: string;
  roomId: string;
  revealed: boolean;
}

export interface Participant {
  id: string;
  roomId: string;
  username: string;
  vote?: string | null;
}

// App State
export interface RoomState {
  room: Room | null;
  participants: Participant[];
  currentUserId: string | null;
  loading: boolean;
  error: string | null;
  kicked?: boolean;
}
