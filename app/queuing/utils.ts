import { Player, LEVEL_VALUE } from './types';

export const formatDuration = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
};

export const formatSessionDuration = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const formatMatchTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const getMatchOdds = (courtPlayers: (string | null)[], players: Player[]) => {
  const team1Ids = [courtPlayers[0], courtPlayers[1]].filter(Boolean) as string[];
  const team2Ids = [courtPlayers[2], courtPlayers[3]].filter(Boolean) as string[];
  
  if (team1Ids.length === 0 || team2Ids.length === 0) return null;
  
  const getTeamScore = (ids: string[]) => {
    return ids.reduce((sum, id) => {
      const p = players.find(x => x.id === id);
      return sum + (p ? LEVEL_VALUE[p.level] : 0);
    }, 0);
  };

  const score1 = getTeamScore(team1Ids);
  const score2 = getTeamScore(team2Ids);
  
  if (score1 === score2) return { text: 'Even', color: 'success' };
  
  const diff = Math.abs(score1 - score2);
  const favoredTeam = score1 > score2 ? 'Team 1' : 'Team 2';
  // Calculate simple odds percentage roughly based on level difference
  // Max difference approx 18 (2 advanced+ vs 2 beginner-)
  // Let's cap at 90%
  const winProb = Math.min(50 + (diff * 2.5), 90); 
  
  return { 
    text: `${favoredTeam} (${winProb.toFixed(0)}%)`, 
    color: diff > 4 ? 'error' : 'warning' 
  };
};

export const getWaitTime = (player: Player, sessionStartTime: number | null, currentTime: number) => {
  if (sessionStartTime === null) return '0m 0s';
  if (player.isPlaying) return 'Playing';
  if (player.gamesPlayed === 0) return 'Waiting';
  // If last match ended before session started (shouldn't happen in new session but possible in reloads), clamp to session start
  const effectiveTime = Math.max(player.lastMatchEndTime, sessionStartTime);
  const diff = Math.floor((currentTime - effectiveTime) / 1000);
  const mins = Math.floor(diff / 60);
  const secs = diff % 60;
  return `${mins}m ${secs}s`;
};
