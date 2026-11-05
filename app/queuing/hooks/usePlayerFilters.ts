import { useState, useMemo, useDeferredValue } from "react";
import { getTotalIdleTime } from "../utils";
import { Player, PlayerLevel, LEVEL_VALUE, isCheckedIn } from "../types";

import { useVisibleTime } from "./useCurrentTime";
export const usePlayerFilters = (
  players: Player[],
  sessionStartTime: number | null,
  frozenTime: number | null,
) => {
  const [playerTab, setPlayerTab] = useState<
    "all" | "active" | "inactive" | "queue"
  >("all");
  const [levelFilter, setLevelFilter] = useState<PlayerLevel[]>([]);
  const [genderFilter, setGenderFilter] = useState<"All" | "Male" | "Female">(
    "All",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    field: string;
    direction: "asc" | "desc";
  }>({ field: "idle_time", direction: "desc" });
  const [playerViewMode, setPlayerViewMode] = useState<"list" | "grid">("list");

  const search = useDeferredValue(searchQuery).toLowerCase();
  const { ref: clockRef, currentTime } = useVisibleTime<HTMLDivElement>(frozenTime, sessionStartTime !== null && sortConfig.field === "total_idle");
  // Current-idle ordering depends on wait start times, not the ticking clock.
  const sortTime = currentTime;
  const baseFilteredPlayers = useMemo(() => {
    return players.filter((p) => {
      if (levelFilter.length > 0 && !levelFilter.includes(p.level))
        return false;
      if (genderFilter !== "All" && p.gender !== genderFilter) return false;
      if (
        search &&
        !p.name.toLowerCase().includes(search)
      )
        return false;
      return true;
    });
  }, [players, levelFilter, genderFilter, search]);

  const sortedPlayers = useMemo(() => {
    return [...baseFilteredPlayers].sort((a, b) => {
      // Availability stays first even when the selected sort is reversed.
      const availabilityRank = (player: Player) =>
        !isCheckedIn(player) || !player.isActive ? 2 : player.isPlaying ? 1 : 0;
      const availability = availabilityRank(a) - availabilityRank(b);
      if (availability !== 0) return availability;

      let valA: number | string = 0;
      let valB: number | string = 0;

      switch (sortConfig.field) {
        case "level":
          valA = LEVEL_VALUE[a.level] || 0;
          valB = LEVEL_VALUE[b.level] || 0;
          break;
        case "idle_time":
          if (sessionStartTime === null) {
            valA = 0;
            valB = 0;
          } else {
            valA = !isCheckedIn(a)
              ? -2
              : a.isPlaying
                ? -1
                : sortTime -
                  Math.max(
                    a.lastMatchEndTime,
                    a.checkedInAt ?? a.joinedAt,
                    sessionStartTime,
                  );
            valB = !isCheckedIn(b)
              ? -2
              : b.isPlaying
                ? -1
                : sortTime -
                  Math.max(
                    b.lastMatchEndTime,
                    b.checkedInAt ?? b.joinedAt,
                    sessionStartTime,
                  );
          }
          break;
        case "total_idle":
          valA = getTotalIdleTime(a, sessionStartTime, sortTime);
          valB = getTotalIdleTime(b, sessionStartTime, sortTime);
          break;
        case "games":
          valA = a.gamesPlayed;
          valB = b.gamesPlayed;
          break;
        case "gender":
          valA = a.gender;
          valB = b.gender;
          break;
        case "wins":
          valA = a.wins;
          valB = b.wins;
          break;
        case "losses":
          valA = a.losses;
          valB = b.losses;
          break;
        default:
          return 0;
      }

      if (valA === valB) {
        return a.lastMatchEndTime - b.lastMatchEndTime;
      }

      const compare = valA > valB ? 1 : -1;
      return sortConfig.direction === "asc" ? compare : -compare;
    });
  }, [baseFilteredPlayers, sortConfig, sessionStartTime, sortTime]);

  const activePlayers = useMemo(
    () => sortedPlayers.filter((p) => p.isPlaying),
    [sortedPlayers],
  );
  const inactivePlayers = useMemo(
    () => sortedPlayers.filter((p) => !p.isPlaying),
    [sortedPlayers],
  );

  return {
    clockRef,
    playerTab,
    setPlayerTab,
    levelFilter,
    setLevelFilter,
    genderFilter,
    setGenderFilter,
    searchQuery,
    setSearchQuery,
    sortConfig,
    setSortConfig,
    playerViewMode,
    setPlayerViewMode,
    allPlayers: sortedPlayers,
    activePlayers,
    inactivePlayers,
    // Raw counts for badges (unfiltered)
    activeCount: players.filter((p) => p.isPlaying).length,
    inactiveCount: players.filter((p) => !p.isPlaying).length,
    totalCount: players.length,
  };
};
