import { useState, useEffect } from 'react';
import { Player, Court, MatchHistory, PlayerLevel, LEVEL_VALUE } from '../types';

export const useQueuingState = () => {
  // -- State --
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(() => Date.now());
  
  const [courts, setCourts] = useState<Court[]>([
    { id: 'c1', name: 'Court 1', status: 'idle', players: [null, null, null, null], startTime: null },
    { id: 'c2', name: 'Court 2', status: 'idle', players: [null, null, null, null], startTime: null },
  ]);
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [history, setHistory] = useState<MatchHistory[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // -- Persistence --
  useEffect(() => {
    // Load data from localStorage on mount
    const savedData = localStorage.getItem('badminton_queue_data');
    if (savedData) {
      try {
        const { sessionStartTime, courts, players, history } = JSON.parse(savedData);
        setSessionStartTime(sessionStartTime);
        setCourts(courts);
        // Patch legacy players
        const patchedPlayers = players.map((p: Player & { isActive?: boolean }) => ({
          ...p,
          gender: p.gender || 'Male',
          isActive: p.isActive !== undefined ? p.isActive : true
        }));
        setPlayers(patchedPlayers);
        setHistory(history);
      } catch (e) {
        console.error('Failed to parse saved queue data', e);
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    // Save data to localStorage whenever it changes
    if (isLoaded) {
      const dataToSave = {
        sessionStartTime,
        courts,
        players,
        history
      };
      localStorage.setItem('badminton_queue_data', JSON.stringify(dataToSave));
    }
  }, [sessionStartTime, courts, players, history, isLoaded]);

  // -- Timers --
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // -- Actions --

  const addCourt = (name: string) => {
    const newId = `c-${Date.now()}`; 
    setCourts([...courts, { 
      id: newId, 
      name, 
      status: 'idle', 
      players: [null, null, null, null], 
      startTime: null  
    }]);
  };

  const removeCourt = (id: string) => {
    const court = courts.find(c => c.id === id);
    if (court && court.status === 'active') {
      alert('Cannot remove an active court. Finish the match first.');
      return;
    }
    setCourts(courts.filter(c => c.id !== id));
  };

  const updateCourtName = (id: string, newName: string) => {
    setCourts(courts.map(c => c.id === id ? { ...c, name: newName } : c));
  };

  const addPlayer = (values: { name: string; level: PlayerLevel; gender: 'Male' | 'Female' }) => {
    const newPlayer: Player = {
      id: Date.now().toString(),
      name: values.name,
      level: values.level,
      gender: values.gender,
      isActive: true,
      joinedAt: Date.now(),
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      totalIdleTime: 0,
      lastMatchEndTime: Date.now(),
      firstMatchTime: null,
      partners: {},
      isPlaying: false,
    };
    setPlayers([...players, newPlayer]);
  };

  const updatePlayerLevel = (id: string, newLevel: PlayerLevel) => {
    setPlayers(players.map(p => p.id === id ? { ...p, level: newLevel } : p));
  };

  const updatePlayerGender = (id: string, newGender: 'Male' | 'Female') => {
    setPlayers(players.map(p => p.id === id ? { ...p, gender: newGender } : p));
  };

  const populateDummyPlayers = (levels: PlayerLevel[]) => {
    const newPlayers: Player[] = [];
    
    for (let i = 1; i <= 40; i++) {
      const level = levels[Math.floor(Math.random() * levels.length)];
      const gender = Math.random() > 0.5 ? 'Male' : 'Female';
      newPlayers.push({
        id: `dummy-${Date.now()}-${i}`,
        name: `Player ${i}`,
        level,
        gender,
        isActive: true,
        joinedAt: Date.now(),
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        totalIdleTime: 0,
        lastMatchEndTime: Date.now(),
        firstMatchTime: null,
        partners: {},
        isPlaying: false,
      });
    }
    setPlayers(prev => [...prev, ...newPlayers]);
  };

  const togglePlayerSelection = (courtId: string, playerId: string) => {
    const court = courts.find(c => c.id === courtId);
    if (!court) return;

    if (court.players.includes(playerId)) {
      // Remove from court
      const newPlayers = court.players.map(p => p === playerId ? null : p);
      setCourts(courts.map(c => c.id === courtId ? { ...c, players: newPlayers } : c));
    } else {
      // Add to court
      const emptyIndex = court.players.indexOf(null);
      if (emptyIndex === -1) return; // Full
      
      // Check if player is already on another court
      const otherCourt = courts.find(c => c.id !== courtId && c.players.includes(playerId));
      
      let updatedCourts = [...courts];
      
      if (otherCourt) {
        // Remove from other court
        const updatedOtherCourtPlayers = otherCourt.players.map(p => p === playerId ? null : p);
        updatedCourts = updatedCourts.map(c => c.id === otherCourt.id ? { ...c, players: updatedOtherCourtPlayers } : c);
      }
      
      updatedCourts = updatedCourts.map(c => {
        if (c.id === courtId) {
           const newPlayers = [...c.players];
           const idx = newPlayers.indexOf(null);
           if (idx !== -1) newPlayers[idx] = playerId;
           return { ...c, players: newPlayers };
        }
        return c;
      });

      setCourts(updatedCourts);
    }
  };

  const startMatch = (courtId: string) => {
    const court = courts.find(c => c.id === courtId);
    if (!court) return;
    
    const team1Count = [court.players[0], court.players[1]].filter(Boolean).length;
    const team2Count = [court.players[2], court.players[3]].filter(Boolean).length;

    if (team1Count === 0 || team2Count === 0) {
      alert("Need at least 1 player per team");
      return;
    }

    const activePlayerIds = court.players.filter(Boolean) as string[];
    setPlayers(players.map(p => {
      if (activePlayerIds.includes(p.id)) {
        return { 
          ...p, 
          isPlaying: true, 
          firstMatchTime: p.firstMatchTime || Date.now(),
          totalIdleTime: p.gamesPlayed === 0 
            ? p.totalIdleTime 
            : p.totalIdleTime + Math.floor((Date.now() - p.lastMatchEndTime) / 1000)
        };
      }
      return p;
    }));

    setCourts(courts.map(c => c.id === courtId ? { ...c, status: 'active', startTime: Date.now() } : c));
  };

  const finishMatch = (courtId: string, values: { team1Score?: number; team2Score?: number; winningTeam?: number }) => {
    const court = courts.find(c => c.id === courtId);
    if (!court) return;

    const endTime = Date.now();
    const duration = court.startTime ? Math.floor((endTime - court.startTime) / 1000) : 0;
    
    const team1Ids = [court.players[0], court.players[1]].filter(Boolean) as string[];
    const team2Ids = [court.players[2], court.players[3]].filter(Boolean) as string[];
    const allPlayerIds = [...team1Ids, ...team2Ids];

    const winningTeam = values.winningTeam; 

    setPlayers(players.map(p => {
      if (allPlayerIds.includes(p.id)) {
        const isTeam1 = team1Ids.includes(p.id);
        const isWinner = (winningTeam === 1 && isTeam1) || (winningTeam === 2 && !isTeam1);
        
        const newPartners = { ...p.partners };
        const teammates = isTeam1 ? team1Ids : team2Ids;
        teammates.forEach(tmId => {
          if (tmId !== p.id) {
            newPartners[tmId] = (newPartners[tmId] || 0) + 1;
          }
        });

        return {
          ...p,
          isPlaying: false,
          lastMatchEndTime: endTime,
          gamesPlayed: p.gamesPlayed + 1,
          wins: isWinner ? p.wins + 1 : p.wins,
          losses: !isWinner && winningTeam ? p.losses + 1 : p.losses,
          partners: newPartners
        };
      }
      return p;
    }));

    const matchRecord: MatchHistory = {
      id: Date.now().toString(),
      courtName: court.name,
      startTime: court.startTime || 0,
      endTime,
      duration,
      players: [
        ...team1Ids.map(id => ({ id, name: players.find(p => p.id === id)?.name || '', team: 1 as const })),
        ...team2Ids.map(id => ({ id, name: players.find(p => p.id === id)?.name || '', team: 2 as const })),
      ],
      winners: winningTeam as 1 | 2 | undefined,
      score: values.team1Score && values.team2Score ? `${values.team1Score} - ${values.team2Score}` : undefined
    };
    
    setHistory([matchRecord, ...history]);
    setCourts(courts.map(c => c.id === courtId ? { ...c, status: 'idle', players: [null, null, null, null], startTime: null } : c));
  };

  const stopMatch = (courtId: string, reason: string) => {
    const court = courts.find(c => c.id === courtId);
    if (!court) return;

    const endTime = Date.now();
    const duration = court.startTime ? Math.floor((endTime - court.startTime) / 1000) : 0;
    const activePlayerIds = court.players.filter(Boolean) as string[];

    setPlayers(players.map(p => {
      if (activePlayerIds.includes(p.id)) {
        return {
          ...p,
          isPlaying: false,
          lastMatchEndTime: endTime,
          gamesPlayed: p.gamesPlayed + 1,
        };
      }
      return p;
    }));

    const team1Ids = [court.players[0], court.players[1]].filter(Boolean) as string[];
    const team2Ids = [court.players[2], court.players[3]].filter(Boolean) as string[];

    const matchRecord: MatchHistory = {
      id: Date.now().toString(),
      courtName: court.name,
      startTime: court.startTime || 0,
      endTime,
      duration,
      players: [
        ...team1Ids.map(id => ({ id, name: players.find(p => p.id === id)?.name || '', team: 1 as const })),
        ...team2Ids.map(id => ({ id, name: players.find(p => p.id === id)?.name || '', team: 2 as const })),
      ],
      isStopped: true,
      reason
    };

    setHistory([matchRecord, ...history]);
    setCourts(courts.map(c => c.id === courtId ? { ...c, status: 'idle', players: [null, null, null, null], startTime: null } : c));
  };

  const removePlayer = (id: string) => {
    setPlayers(players.filter(p => p.id !== id));
    // Also remove from any courts
    setCourts(courts.map(c => ({
      ...c,
      players: c.players.map(pid => pid === id ? null : pid)
    })));
  };
  
  const togglePlayerActive = (id: string) => {
    setPlayers(players.map(p => p.id === id ? { ...p, isActive: !p.isActive } : p));
  };

  const startSession = () => {
    setSessionStartTime(Date.now());
  };

  const resetState = () => {
    localStorage.removeItem('badminton_queue_data');
    setSessionStartTime(null);
    setCourts([]);
    setPlayers([]);
    setHistory([]);
  };

  return {
    state: {
      sessionStartTime,
      currentTime,
      courts,
      players,
      history,
      isLoaded
    },
    actions: {
      setSessionStartTime,
      addCourt,
      removeCourt,
      updateCourtName,
      addPlayer,
      updatePlayerLevel,
      updatePlayerGender,
      populateDummyPlayers,
      togglePlayerSelection,
      startMatch,
      finishMatch,
      stopMatch,
      removePlayer,
      togglePlayerActive,
      startSession,
      resetState
    }
  };
};
