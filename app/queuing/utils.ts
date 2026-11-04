import { Player, LEVEL_VALUE, isCheckedIn } from "./types";

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
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

export const formatMatchTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

export const getMatchOdds = (
  courtPlayers: (string | null)[],
  players: Player[],
) => {
  const team1Ids = [courtPlayers[0], courtPlayers[1]].filter(
    Boolean,
  ) as string[];
  const team2Ids = [courtPlayers[2], courtPlayers[3]].filter(
    Boolean,
  ) as string[];

  if (team1Ids.length === 0 || team2Ids.length === 0) return null;

  const getTeamScore = (ids: string[]) => {
    return ids.reduce((sum, id) => {
      const p = players.find((x) => x.id === id);
      return sum + (p ? LEVEL_VALUE[p.level] : 0);
    }, 0);
  };

  const score1 = getTeamScore(team1Ids);
  const score2 = getTeamScore(team2Ids);

  if (score1 === score2) return { text: "Even", color: "success" };

  const diff = Math.abs(score1 - score2);
  const favoredTeam = score1 > score2 ? "Team 1" : "Team 2";
  // Calculate simple odds percentage roughly based on level difference
  // Max difference approx 18 (2 advanced+ vs 2 beginner-)
  // Let's cap at 90%
  const winProb = Math.min(50 + diff * 2.5, 90);

  return {
    text: `${favoredTeam} (${winProb.toFixed(0)}%)`,
    color: diff > 4 ? "error" : "warning",
  };
};

// First-game waits are visible without changing accumulated idle statistics.
export const getCurrentWaitDuration = (
  player: Player,
  sessionStartTime: number | null,
  currentTime: number,
) => {
  if (
    sessionStartTime === null ||
    player.isPlaying ||
    !player.isActive ||
    !isCheckedIn(player)
  )
    return 0;
  return Math.max(
    0,
    Math.floor(
      (currentTime -
        Math.max(
          player.lastMatchEndTime,
          player.checkedInAt ?? player.joinedAt,
          sessionStartTime,
        )) /
        1000,
    ),
  );
};
export const getWaitPriority = (
  seconds: number,
): "normal" | "warning" | "urgent" =>
  seconds >= 20 * 60 ? "urgent" : seconds >= 15 * 60 ? "warning" : "normal";
export const getWaitTime = (
  player: Player,
  sessionStartTime: number | null,
  currentTime: number,
) => {
  if (!isCheckedIn(player)) return "—";
  if (player.isPlaying) return "Playing";
  if (!player.isActive) return "Away";
  const seconds = getCurrentWaitDuration(player, sessionStartTime, currentTime);
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

export const getWaitDuration = (
  player: Player,
  sessionStartTime: number | null,
  currentTime: number,
) => {
  if (
    sessionStartTime === null ||
    player.isPlaying ||
    !isCheckedIn(player) ||
    player.gamesPlayed === 0
  )
    return 0;
  const effectiveTime = Math.max(
    player.lastMatchEndTime,
    player.checkedInAt ?? player.joinedAt,
    sessionStartTime,
  );
  const diff = Math.floor((currentTime - effectiveTime) / 1000);
  return diff; // in seconds
};
