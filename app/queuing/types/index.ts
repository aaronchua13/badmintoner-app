export type PlayerLevel = 
  | 'Beginner -' | 'Beginner' | 'Beginner +' 
  | 'Intermediate -' | 'Intermediate' | 'Intermediate +' 
  | 'Advanced -' | 'Advanced' | 'Advanced +';

export const LEVEL_COLORS: Record<PlayerLevel, string> = {
  'Beginner -': '#d9f7be', // Green-2
  'Beginner': '#389e0d',   // Green-7
  'Beginner +': '#135200', // Green-10
  'Intermediate -': '#bae7ff', // Blue-2
  'Intermediate': '#096dd9',   // Blue-7
  'Intermediate +': '#002766', // Blue-10
  'Advanced -': '#ffccc7', // Red-2
  'Advanced': '#cf1322',   // Red-7
  'Advanced +': '#5c0011', // Red-10
};

export const LEVEL_TEXT_COLORS: Record<PlayerLevel, string> = {
  'Beginner -': '#135200',
  'Beginner': '#fff',
  'Beginner +': '#fff',
  'Intermediate -': '#002766',
  'Intermediate': '#fff',
  'Intermediate +': '#fff',
  'Advanced -': '#5c0011',
  'Advanced': '#fff',
  'Advanced +': '#fff',
};

export const LEVEL_VALUE: Record<PlayerLevel, number> = {
  'Beginner -': 1, 'Beginner': 2, 'Beginner +': 3,
  'Intermediate -': 4, 'Intermediate': 5, 'Intermediate +': 6,
  'Advanced -': 7, 'Advanced': 8, 'Advanced +': 9,
};

export const LEVEL_SHORT_TEXT: Record<PlayerLevel, string> = {
  'Beginner -': 'Beg-', 'Beginner': 'Beg', 'Beginner +': 'Beg+',
  'Intermediate -': 'Int-', 'Intermediate': 'Int', 'Intermediate +': 'Int+',
  'Advanced -': 'Adv-', 'Advanced': 'Adv', 'Advanced +': 'Adv+',
};

export type Gender = 'Male' | 'Female';

export interface Player {
  id: string;
  name: string;
  level: PlayerLevel;
  joinedAt: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  totalIdleTime: number; // in seconds
  lastMatchEndTime: number; // Timestamp
  firstMatchTime: number | null;
  partners: Record<string, number>; // partnerId -> count
  isPlaying: boolean;
  gender: Gender;
  isActive: boolean;
}

export interface Court {
  id: string;
  name: string;
  status: 'idle' | 'active';
  players: (string | null)[]; // Player IDs or null for empty slots
  startTime: number | null;
}

export interface MatchHistory {
  id: string;
  courtName: string;
  startTime: number;
  endTime: number;
  duration: number; // seconds
  players: { id: string; name: string; team: 1 | 2 }[];
  winners?: 1 | 2;
  score?: string;
  reason?: string;
  isStopped?: boolean;
}

export interface QueueItem {
  id: string;
  team1: string[];
  team2: string[];
  createdAt: number;
}

export interface CourtHistoryItem {
  id: string;
  name: string;
  addedAt: number;
  removedAt: number | null;
  gamesPlayed: number;
}
