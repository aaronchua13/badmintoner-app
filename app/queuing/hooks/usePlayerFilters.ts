import { useState, useMemo } from 'react';
import { Player, PlayerLevel, LEVEL_VALUE } from '../types';

export const usePlayerFilters = (players: Player[], sessionStartTime: number | null, currentTime: number) => {
  const [playerTab, setPlayerTab] = useState<'all' | 'active' | 'inactive' | 'queue'>('all');
  const [levelFilter, setLevelFilter] = useState<PlayerLevel[]>([]);
  const [genderFilter, setGenderFilter] = useState<'All' | 'Male' | 'Female'>('All');
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: 'asc' | 'desc' }>({ field: 'idle_time', direction: 'desc' });
  const [playerViewMode, setPlayerViewMode] = useState<'list' | 'grid'>('list');

  const baseFilteredPlayers = useMemo(() => {
    return players.filter(p => {
      if (levelFilter.length > 0 && !levelFilter.includes(p.level)) return false;
      if (genderFilter !== 'All' && p.gender !== genderFilter) return false;
      return true;
    });
  }, [players, levelFilter, genderFilter]);

  const sortedPlayers = useMemo(() => {
    return [...baseFilteredPlayers].sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;

      switch (sortConfig.field) {
        case 'level':
          valA = LEVEL_VALUE[a.level] || 0;
          valB = LEVEL_VALUE[b.level] || 0;
          break;
        case 'idle_time':
          if (sessionStartTime === null) {
             valA = 0;
             valB = 0;
          } else {
             valA = a.isPlaying ? -1 : (currentTime - Math.max(a.lastMatchEndTime, sessionStartTime));
             valB = b.isPlaying ? -1 : (currentTime - Math.max(b.lastMatchEndTime, sessionStartTime));
          }
          break;
        case 'total_idle':
           const getCurrentIdle = (p: Player) => {
              if (sessionStartTime === null) return 0;
              return (p.isPlaying || p.gamesPlayed === 0) ? 0 : Math.floor((currentTime - Math.max(p.lastMatchEndTime, sessionStartTime))/1000);
           }
           valA = a.totalIdleTime + getCurrentIdle(a);
           valB = b.totalIdleTime + getCurrentIdle(b);
           break;
        case 'games':
          valA = a.gamesPlayed;
          valB = b.gamesPlayed;
          break;
        case 'gender':
          valA = a.gender;
          valB = b.gender;
          break;
        case 'wins':
          valA = a.wins;
          valB = b.wins;
          break;
        case 'losses':
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
      return sortConfig.direction === 'asc' ? compare : -compare;
    });
  }, [baseFilteredPlayers, sortConfig, sessionStartTime, currentTime]);

  const activePlayers = useMemo(() => sortedPlayers.filter(p => p.isPlaying), [sortedPlayers]);
  const inactivePlayers = useMemo(() => sortedPlayers.filter(p => !p.isPlaying), [sortedPlayers]);

  return {
    playerTab, setPlayerTab,
    levelFilter, setLevelFilter,
    genderFilter, setGenderFilter,
    sortConfig, setSortConfig,
    playerViewMode, setPlayerViewMode,
    allPlayers: sortedPlayers,
    activePlayers,
    inactivePlayers,
    // Raw counts for badges (unfiltered)
    activeCount: players.filter(p => p.isPlaying).length,
    inactiveCount: players.filter(p => !p.isPlaying).length,
    totalCount: players.length
  };
};
