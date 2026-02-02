'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Layout, Card, Button, Typography, Row, Col, Modal, Form, Input, 
  Select, Tag, Space, Avatar, Badge, List, Statistic, InputNumber, Divider,
  Tabs, Radio, Tooltip, Dropdown, MenuProps, Table, Descriptions
} from 'antd';
import { 
  PlusOutlined, DeleteOutlined, 
  ClockCircleOutlined, TeamOutlined,
  PlayCircleOutlined, ManOutlined, WomanOutlined,
  PauseCircleOutlined, CheckCircleOutlined, MoreOutlined,
  InfoCircleOutlined, StopOutlined, HistoryOutlined,
  SortAscendingOutlined, SortDescendingOutlined,
  AppstoreOutlined, BarsOutlined, CloseOutlined,
  HomeOutlined, EditOutlined, DownOutlined
} from '@ant-design/icons';
import Link from 'next/link';

const { Title, Text, Paragraph } = Typography;
const { Header, Content } = Layout;

// --- Types ---

type PlayerLevel = 
  | 'Beginner -' | 'Beginner' | 'Beginner +' 
  | 'Intermediate -' | 'Intermediate' | 'Intermediate +' 
  | 'Advanced -' | 'Advanced' | 'Advanced +';

const LEVEL_COLORS: Record<PlayerLevel, string> = {
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

const LEVEL_TEXT_COLORS: Record<PlayerLevel, string> = {
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

const LEVEL_VALUE: Record<PlayerLevel, number> = {
  'Beginner -': 1, 'Beginner': 2, 'Beginner +': 3,
  'Intermediate -': 4, 'Intermediate': 5, 'Intermediate +': 6,
  'Advanced -': 7, 'Advanced': 8, 'Advanced +': 9,
};

const LEVEL_SHORT_TEXT: Record<PlayerLevel, string> = {
  'Beginner -': 'Beg-', 'Beginner': 'Beg', 'Beginner +': 'Beg+',
  'Intermediate -': 'Int-', 'Intermediate': 'Int', 'Intermediate +': 'Int+',
  'Advanced -': 'Adv-', 'Advanced': 'Adv', 'Advanced +': 'Adv+',
};

const LevelTag = ({ level, style }: { level: PlayerLevel, style?: React.CSSProperties }) => (
  <Tag 
    style={{ 
      backgroundColor: LEVEL_COLORS[level],
      color: LEVEL_TEXT_COLORS[level],
      margin: 0, 
      fontSize: '10px', 
      lineHeight: '16px', 
      padding: '0 4px',
      border: 'none',
      fontWeight: 600,
      ...style
    }}
  >
    {LEVEL_SHORT_TEXT[level]}
  </Tag>
);

interface Player {
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
  gender: 'Male' | 'Female';
  isActive: boolean;
}

interface Court {
  id: string;
  name: string;
  status: 'idle' | 'active';
  players: (string | null)[]; // Player IDs or null for empty slots
  startTime: number | null;
}

interface MatchHistory {
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

// --- Component ---

export default function QueuingClient() {
  // -- State --
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  
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
        const patchedPlayers = players.map((p: any) => ({
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

  // Modals
  const [isAddPlayerOpen, setIsAddPlayerOpen] = useState(false);
  const [isAddCourtOpen, setIsAddCourtOpen] = useState(false);
  const [isFinishMatchOpen, setIsFinishMatchOpen] = useState(false);
  const [isStopMatchOpen, setIsStopMatchOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);
  
  const [form] = Form.useForm();
  const [addCourtForm] = Form.useForm();
  const [finishForm] = Form.useForm();
  const [stopForm] = Form.useForm();
  const [addPlayerMode, setAddPlayerMode] = useState<'close' | 'keep'>('close');
  const [playerTab, setPlayerTab] = useState<'active' | 'inactive'>('active');
  const [levelFilter, setLevelFilter] = useState<PlayerLevel[]>([]);
  const [genderFilter, setGenderFilter] = useState<'All' | 'Male' | 'Female'>('All');
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: 'asc' | 'desc' }>({ field: 'idle_time', direction: 'desc' });
  const [playerViewMode, setPlayerViewMode] = useState<'list' | 'grid'>('list');
  const [viewPlayerId, setViewPlayerId] = useState<string | null>(null);
  const viewPlayer = players.find(p => p.id === viewPlayerId);

  // -- Timers --
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // -- Helpers --
  const getSessionDuration = () => {
    if (sessionStartTime === null) return 'Not Started';
    const diff = Math.floor((currentTime - sessionStartTime) / 1000);
    const hrs = Math.floor(diff / 3600);
    const mins = Math.floor((diff % 3600) / 60);
    const secs = diff % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getWaitTime = (player: Player) => {
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

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const formatMatchTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getMatchOdds = (courtPlayers: (string | null)[]) => {
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

  // -- Actions --

  const openAddCourtModal = () => {
    addCourtForm.setFieldsValue({ name: `Court ${courts.length + 1}` });
    setIsAddCourtOpen(true);
  };

  const handleCreateCourt = (values: { name: string }) => {
    // Generate a unique ID. Using Date.now() + random to be safe.
    const newId = `c-${Date.now()}`; 
    setCourts([...courts, { 
      id: newId, 
      name: values.name, 
      status: 'idle', 
      players: [null, null, null, null], 
      startTime: null  
    }]);
    setIsAddCourtOpen(false);
    addCourtForm.resetFields();
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

  const updatePlayerLevel = (id: string, newLevel: PlayerLevel) => {
    setPlayers(players.map(p => p.id === id ? { ...p, level: newLevel } : p));
  };

  const updatePlayerGender = (id: string, newGender: 'Male' | 'Female') => {
    setPlayers(players.map(p => p.id === id ? { ...p, gender: newGender } : p));
  };

  const populateDummyPlayers = () => {
    const newPlayers: Player[] = [];
    const levels: PlayerLevel[] = Object.keys(LEVEL_COLORS) as PlayerLevel[];
    
    // Optional: Clear existing players if desired, but here we'll just append 'fresh' ones.
    // To strictly follow "fresh data", we'll create them with 0 stats.
    
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

  const handleAddPlayer = (values: { name: string; level: PlayerLevel; gender: 'Male' | 'Female' }) => {
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
    
    form.resetFields();
    if (addPlayerMode === 'close') {
      setIsAddPlayerOpen(false);
    }
  };

  const togglePlayerSelection = (courtId: string, playerId: string) => {
    const court = courts.find(c => c.id === courtId);
    if (!court) return;

    if (court.players.includes(playerId)) {
      // Remove from court (set to null)
      const newPlayers = court.players.map(p => p === playerId ? null : p);
      setCourts(courts.map(c => c.id === courtId ? { ...c, players: newPlayers } : c));
    } else {
      // Add to court (find first empty slot)
      const emptyIndex = court.players.indexOf(null);
      if (emptyIndex === -1) return; // Full
      
      const newPlayers = [...court.players];
      newPlayers[emptyIndex] = playerId;
      setCourts(courts.map(c => c.id === courtId ? { ...c, players: newPlayers } : c));
    }
  };

  const startMatch = (courtId: string) => {
    const court = courts.find(c => c.id === courtId);
    if (!court) return;
    
    // Check if we have at least one player per team
    const team1Count = [court.players[0], court.players[1]].filter(Boolean).length;
    const team2Count = [court.players[2], court.players[3]].filter(Boolean).length;

    if (team1Count === 0 || team2Count === 0) {
      alert("Need at least 1 player per team");
      return;
    }

    // Update players status
    const activePlayerIds = court.players.filter(Boolean) as string[];
    setPlayers(players.map(p => {
      if (activePlayerIds.includes(p.id)) {
        return { 
          ...p, 
          isPlaying: true, 
          firstMatchTime: p.firstMatchTime || Date.now(),
          // Add idle time accumulated so far (only if played before)
          totalIdleTime: p.gamesPlayed === 0 
            ? p.totalIdleTime 
            : p.totalIdleTime + Math.floor((Date.now() - p.lastMatchEndTime) / 1000)
        };
      }
      return p;
    }));

    // Update court
    setCourts(courts.map(c => c.id === courtId ? { ...c, status: 'active', startTime: Date.now() } : c));
  };

  const openFinishMatchModal = (courtId: string) => {
    setSelectedCourtId(courtId);
    // const court = courts.find(c => c.id === courtId); // Unused
    setIsFinishMatchOpen(true);
  };

  const handleFinishMatch = (values: { team1Score?: number; team2Score?: number; winningTeam?: number }) => {
    if (!selectedCourtId) return;
    const court = courts.find(c => c.id === selectedCourtId);
    if (!court) return;

    const endTime = Date.now();
    const duration = court.startTime ? Math.floor((endTime - court.startTime) / 1000) : 0;
    
    // Split by fixed slots: 0,1 vs 2,3
    const team1Ids = [court.players[0], court.players[1]].filter(Boolean) as string[];
    const team2Ids = [court.players[2], court.players[3]].filter(Boolean) as string[];
    const allPlayerIds = [...team1Ids, ...team2Ids];

    const winningTeam = values.winningTeam; // 1 or 2

    // Update Players
    setPlayers(players.map(p => {
      if (allPlayerIds.includes(p.id)) {
        const isTeam1 = team1Ids.includes(p.id);
        const isWinner = (winningTeam === 1 && isTeam1) || (winningTeam === 2 && !isTeam1);
        
        // Update partners
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

    // Record History
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

    // Reset Court
    setCourts(courts.map(c => c.id === selectedCourtId ? { ...c, status: 'idle', players: [null, null, null, null], startTime: null } : c));
    setIsFinishMatchOpen(false);
    finishForm.resetFields();
    setSelectedCourtId(null);
  };

  const openStopMatchModal = (courtId: string) => {
    setSelectedCourtId(courtId);
    setIsStopMatchOpen(true);
  };

  const handleStopMatch = (values: { reason: string }) => {
    if (!selectedCourtId) return;
    const court = courts.find(c => c.id === selectedCourtId);
    if (!court) return;

    const endTime = Date.now();
    const duration = court.startTime ? Math.floor((endTime - court.startTime) / 1000) : 0;
    const activePlayerIds = court.players.filter(Boolean) as string[];

    // Update Players (mark as not playing, increment gamesPlayed but no win/loss)
    setPlayers(players.map(p => {
      if (activePlayerIds.includes(p.id)) {
        return {
          ...p,
          isPlaying: false,
          lastMatchEndTime: endTime,
          gamesPlayed: p.gamesPlayed + 1,
          // No win/loss update for stopped matches
        };
      }
      return p;
    }));

    // Record History
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
      reason: values.reason
    };

    setHistory([matchRecord, ...history]);

    // Reset Court
    setCourts(courts.map(c => c.id === selectedCourtId ? { ...c, status: 'idle', players: [null, null, null, null], startTime: null } : c));
    setIsStopMatchOpen(false);
    stopForm.resetFields();
    setSelectedCourtId(null);
  };

  // -- Render Helpers --
  // Sort logic applied in render based on active/inactive
  const applyFilters = (list: Player[]) => {
    return list.filter(p => {
      if (levelFilter.length > 0 && !levelFilter.includes(p.level)) return false;
      if (genderFilter !== 'All' && p.gender !== genderFilter) return false;
      return true;
    });
  };

  const activePlayers = applyFilters(players.filter(p => p.isPlaying));
  const inactivePlayers = applyFilters(players.filter(p => !p.isPlaying));

  const getSortedPlayers = (list: Player[]) => {
    return [...list].sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

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
  };

  const getBestPartner = (player: Player) => {
    let bestId = '';
    let maxCount = -1;
    Object.entries(player.partners).forEach(([id, count]) => {
      if (count > maxCount) {
        maxCount = count;
        bestId = id;
      }
    });
    if (!bestId) return '-';
    return players.find(p => p.id === bestId)?.name || 'Unknown';
  };

  const renderPlayerList = (list: Player[]) => (
    <List
      rowKey="id"
      grid={playerViewMode === 'grid' ? { gutter: 12, xs: 1, sm: 2, md: 2, lg: 2, xl: 3, xxl: 4 } : undefined}
      dataSource={getSortedPlayers(list)}
      renderItem={(player) => {
        const idleCourts = courts.filter(c => c.status === 'idle');
        const showCourtButtons = !player.isPlaying && idleCourts.length > 0;
        
        if (playerViewMode === 'grid') {
          return (
            <List.Item style={{ padding: 0 }}>
              <div style={{ 
                background: player.isPlaying ? '#f6ffed' : '#fff', 
                border: '1px solid #f0f0f0', 
                borderRadius: '6px',
                padding: '8px',
                position: 'relative',
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text strong style={{ fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '65%', cursor: 'pointer' }} onClick={() => setViewPlayerId(player.id)}>
                    {player.name}
                  </Text>
                  <Tag color={player.isPlaying ? 'green' : 'default'} style={{ margin: 0, fontSize: '10px', lineHeight: '16px', padding: '0 4px' }}>
                    {getWaitTime(player)}
                  </Tag>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flex: 1 }}>
                  <Badge dot={player.isPlaying} color="green" offset={[-2, 2]}>
                    <Avatar size={32} style={{ backgroundColor: LEVEL_COLORS[player.level] || '#ccc', fontSize: '14px' }}>
                      {player.name[0]?.toUpperCase()}
                    </Avatar>
                  </Badge>
                  <div style={{ flex: 1, fontSize: '11px', lineHeight: '1.3' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>G: {player.gamesPlayed}</span>
                      <span>
                        <span style={{ color: '#389e0d' }}>W{player.wins}</span>-<span style={{ color: '#cf1322' }}>L{player.losses}</span>
                      </span>
                    </div>
                    <div style={{ color: '#888', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{LEVEL_SHORT_TEXT[player.level]}</span>
                      {player.gender === 'Female' ? 
                        <WomanOutlined style={{ color: '#eb2f96' }} /> : 
                        <ManOutlined style={{ color: '#1890ff' }} />
                      }
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 6, borderTop: '1px solid #f5f5f5' }}>
                  <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', maxWidth: '70%' }}>
                    {showCourtButtons ? idleCourts.map(court => {
                      const isSelected = court.players.includes(player.id);
                      return (
                        <Button 
                          key={court.id} 
                          size="small" 
                          type={isSelected ? 'primary' : 'default'}
                          onClick={() => togglePlayerSelection(court.id, player.id)}
                          style={{ fontSize: '10px', height: '20px', padding: '0 6px', minWidth: '20px' }}
                        >
                          {court.name.replace('Court ', 'C')}
                        </Button>
                      );
                    }) : (
                      <span style={{ fontSize: '10px', color: '#ccc' }}>
                        {player.isPlaying ? 'Playing' : 'No Courts'}
                      </span>
                    )}
                  </div>
                  
                  <Space size={0}>
                    <Button 
                      type="text" size="small" icon={<InfoCircleOutlined />} 
                      onClick={() => setViewPlayerId(player.id)}
                      style={{ width: 22, height: 22, minWidth: 22, fontSize: '11px', color: '#1890ff' }}
                    />
                    <Dropdown 
                      menu={{ items: [{ 
                        key: 'remove', 
                        label: 'Remove', 
                        danger: true, 
                        onClick: () => {
                          Modal.confirm({
                            title: 'Remove Player',
                            content: `Are you sure you want to remove ${player.name}?`,
                            onOk: () => setPlayers(players.filter(p => p.id !== player.id))
                          });
                        }
                      }] }} 
                      trigger={['click']} placement="bottomRight"
                    >
                      <Button type="text" size="small" icon={<MoreOutlined />} style={{ width: 22, height: 22, minWidth: 22, fontSize: '11px' }} />
                    </Dropdown>
                  </Space>
                </div>
              </div>
            </List.Item>
          );
        }

        return (
          <List.Item 
            style={{ 
              background: player.isPlaying ? '#f6ffed' : '#fff', 
              marginBottom: 4, 
              padding: '8px 10px', 
              borderRadius: '6px',
              border: '1px solid #f0f0f0',
              display: 'block' // Custom block layout instead of flex to handle wrapping better
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              {/* Left Side: Avatar & Info */}
              <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 0 }}>
                <Badge dot={player.isPlaying} color="green" offset={[-2, 2]}>
                  <Avatar 
                    size={36}
                    style={{ backgroundColor: LEVEL_COLORS[player.level] || '#ccc', fontSize: '16px' }}
                  >
                    {player.name[0]?.toUpperCase()}
                  </Avatar>
                </Badge>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <Space size={4} style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                      <Text strong style={{ fontSize: '14px', cursor: 'pointer' }} ellipsis onClick={() => setViewPlayerId(player.id)}>
                        {player.name}
                      </Text>
                      <InfoCircleOutlined 
                        onClick={() => setViewPlayerId(player.id)}
                        style={{ color: '#1890ff', fontSize: '12px', cursor: 'pointer' }}
                      />
                      {player.gender === 'Female' ? 
                        <WomanOutlined style={{ color: '#eb2f96', fontSize: '12px' }} /> : 
                        <ManOutlined style={{ color: '#1890ff', fontSize: '12px' }} />
                      }
                    </Space>
                    
                    <Tag color={player.isPlaying ? 'green' : 'default'} style={{ margin: 0, fontSize: '10px', lineHeight: '18px', padding: '0 6px' }}>
                      {getWaitTime(player)}
                    </Tag>
                  </div>
                  
                  <div style={{ fontSize: '11px', color: '#666', lineHeight: '1.4', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                     <span>G: {player.gamesPlayed}</span>
                     <span>
                        <span style={{ color: '#389e0d', fontWeight: 600 }}>W{player.wins}</span>
                        <span style={{ margin: '0 2px' }}>-</span>
                        <span style={{ color: '#cf1322', fontWeight: 600 }}>L{player.losses}</span>
                     </span>
                     <LevelTag level={player.level} />
                     <span>Idle: {formatDuration(player.totalIdleTime + ((player.isPlaying || player.gamesPlayed === 0 || sessionStartTime === null) ? 0 : Math.floor((currentTime - Math.max(player.lastMatchEndTime, sessionStartTime))/1000)))}</span>
                  </div>
                </div>
              </div>

              {/* Right Side: Actions (Dropdown) */}
               <Dropdown 
                  menu={{ 
                    items: [
                      { 
                        key: 'remove', 
                        label: 'Remove Player', 
                        danger: true,
                        onClick: () => {
                          Modal.confirm({
                            title: 'Remove Player',
                            content: `Are you sure you want to remove ${player.name}?`,
                            onOk: () => {
                              setPlayers(players.filter(p => p.id !== player.id));
                            }
                          });
                        }
                      }
                    ] 
                  }} 
                  trigger={['click']}
                  placement="bottomRight"
                >
                  <Button type="text" size="small" icon={<MoreOutlined />} style={{ minWidth: '24px' }} />
                </Dropdown>
            </div>

            {/* Court Buttons Row (if applicable) */}
            {showCourtButtons && (
              <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid #f9f9f9', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text type="secondary" style={{ fontSize: '11px' }}>Assign to:</Text>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {idleCourts.map(court => {
                    const isSelected = court.players.includes(player.id);
                    return (
                      <Button 
                        key={court.id} 
                        size="small" 
                        type={isSelected ? 'primary' : 'default'}
                        onClick={() => togglePlayerSelection(court.id, player.id)}
                        style={{ fontSize: '11px', height: '24px', padding: '0 8px' }}
                      >
                        {court.name.replace('Court ', 'C')}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
          </List.Item>
        );
      }}
    />
  );

  const startSession = () => {
    const now = Date.now();
    setSessionStartTime(now);
    // Reset all players' timers relative to session start if needed
    // Actually, idle time logic handles this with Math.max(lastMatchEndTime, sessionStartTime)
    // But we might want to update lastMatchEndTime for fresh players to 'now' so the logic is cleaner
    // However, existing logic works: if lastMatchEndTime < sessionStartTime, it uses sessionStartTime.
    // So idle time starts counting from 0 at session start.
  };

  const resetSession = () => {
    Modal.confirm({
      title: 'Reset Session?',
      content: 'This will clear all players, courts, and history. This action cannot be undone.',
      okText: 'Yes, Reset',
      okType: 'danger',
      onOk: () => {
        localStorage.removeItem('badminton_queue_data');
        window.location.reload();
      }
    });
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/">
            <Button icon={<HomeOutlined />} type="text" />
          </Link>
          <Title level={4} style={{ margin: 0 }}>🏸 Badminton Queue</Title>
          <Tag color={sessionStartTime ? "blue" : "default"} style={{ fontSize: '14px', padding: '4px 8px' }}>
             Session: {getSessionDuration()}
          </Tag>
          {!sessionStartTime && (
            <Button type="primary" onClick={startSession} icon={<PlayCircleOutlined />}>
              Start Session
            </Button>
          )}
          <Button icon={<HistoryOutlined />} onClick={() => setIsHistoryOpen(true)}>History</Button>
          <Button size="small" danger onClick={resetSession} type="text">Reset</Button>
        </div>
        <Space>
          <Button onClick={populateDummyPlayers} size="small">Populate 40</Button>
          <Button icon={<TeamOutlined />} onClick={() => setIsAddPlayerOpen(true)}>Add Player</Button>
          <Button icon={<PlusOutlined />} type="primary" onClick={openAddCourtModal}>Add Court</Button>
        </Space>
      </Header>

      <Content style={{ padding: '24px', maxWidth: 1600, margin: '0 auto', width: '100%' }}>
        <Row gutter={[24, 24]}>
          {/* Left Column: Courts */}
          <Col xs={24} xl={10}>
            <Title level={5} style={{ marginBottom: 16 }}>Courts ({courts.length})</Title>
            <Row gutter={[16, 16]}>
              {courts.map(court => (
                <Col xs={24} md={24} lg={12} xl={24} xxl={12} key={court.id}>
                  <Card 
                    size="small"
                    title={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 600 }}>
                            <Typography.Text 
                              editable={{ 
                                onChange: (val) => updateCourtName(court.id, val),
                                icon: <EditOutlined style={{ color: '#8c8c8c' }} />,
                                triggerType: ['icon', 'text']
                              }}
                              style={{ fontWeight: 600, fontSize: '14px', margin: 0 }}
                            >
                              {court.name}
                            </Typography.Text>
                          </span>
                          {court.players.length >= 2 && (() => {
                            const odds = getMatchOdds(court.players);
                            return odds && (
                              <Tag color={odds.color === 'success' ? 'green' : odds.color === 'error' ? 'red' : 'orange'} bordered={false} style={{ margin: 0, fontSize: '10px', lineHeight: '16px', padding: '0 6px' }}>
                                {odds.text}
                              </Tag>
                            );
                          })()}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {court.status === 'active' && (
                            <Tag color="processing" icon={<ClockCircleOutlined />} style={{ margin: 0 }}>
                              {court.startTime ? formatMatchTime(Math.floor((currentTime - court.startTime)/1000)) : '00:00'}
                            </Tag>
                          )}
                          <Button 
                            type="text" 
                            danger 
                            size="small"
                            icon={<DeleteOutlined />} 
                            onClick={() => removeCourt(court.id)}
                            disabled={court.status === 'active'}
                          />
                        </div>
                      </div>
                    }
                    style={{ 
                      borderTop: `4px solid ${court.status === 'active' ? '#52c41a' : '#d9d9d9'}`,
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                    styles={{ 
                      body: { 
                        flex: 1, 
                        display: 'flex', 
                        flexDirection: 'column', 
                        padding: '10px' 
                      } 
                    }}
                  >
                    {court.status === 'active' ? (
                      // Active Match View
                      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                            {/* Team 1 */}
                            <div style={{ textAlign: 'right', flex: 1 }}>
                              {court.players.slice(0, Math.ceil(court.players.length/2)).map(pid => {
                                const p = players.find(x => x.id === pid);
                                return (
                                  <div key={pid} style={{ fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                                    <span style={{ fontSize: '12px' }}>{p?.name}</span>
                                    {p && <LevelTag level={p.level} style={{ transform: 'scale(0.9)' }} />}
                                  </div>
                                );
                              })}
                            </div>
                            
                            <div style={{ fontSize: '10px', color: '#999', fontWeight: 'bold', padding: '0 2px' }}>VS</div>
                            
                            {/* Team 2 */}
                            <div style={{ textAlign: 'left', flex: 1 }}>
                              {court.players.slice(Math.ceil(court.players.length/2)).map(pid => {
                                const p = players.find(x => x.id === pid);
                                return (
                                  <div key={pid} style={{ fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 4 }}>
                                    {p && <LevelTag level={p.level} style={{ transform: 'scale(0.9)' }} />}
                                    <span style={{ fontSize: '12px' }}>{p?.name}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Button type="primary" size="small" block onClick={() => openFinishMatchModal(court.id)}>
                            Finish
                          </Button>
                          <Button danger size="small" block icon={<StopOutlined />} onClick={() => openStopMatchModal(court.id)}>
                            Stop
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // Idle / Setup View
                      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div style={{ flex: 1, marginBottom: 8 }}>
                          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                             {/* Team 1 */}
                             <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                               <Text type="secondary" style={{ fontSize: '9px', textAlign: 'center', marginBottom: -2 }}>Team 1</Text>
                               {[0, 1].map(i => {
                                  const pid = court.players[i];
                                  const p = pid ? players.find(x => x.id === pid) : null;

                                  return (
                                     <div key={i} 
                                        style={{ 
                                           height: 32,
                                           background: p ? '#fff' : '#fafafa',
                                           border: p ? '1px solid #d9d9d9' : '1px dashed #d9d9d9',
                                           borderRadius: 4,
                                           display: 'flex',
                                           alignItems: 'center',
                                           padding: '0 6px',
                                           justifyContent: 'space-between',
                                           transition: 'all 0.2s'
                                        }}>
                                        {p ? (
                                          <>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', flex: 1 }}>
                                               <Text strong style={{ fontSize: '11px' }} ellipsis>{p.name}</Text>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                               <LevelTag level={p.level} style={{ transform: 'scale(0.8)', marginRight: -4 }} />
                                               <CloseOutlined 
                                                  onClick={(e) => {
                                                     e.stopPropagation();
                                                     if (pid) togglePlayerSelection(court.id, pid);
                                                  }}
                                                  style={{ fontSize: '9px', color: '#999', cursor: 'pointer', padding: 4 }}
                                               />
                                            </div>
                                          </>
                                        ) : (
                                          <div style={{ width: '100%', textAlign: 'center' }}>
                                            <Text type="secondary" style={{ fontSize: '10px', color: '#d9d9d9' }}>
                                               Empty
                                            </Text>
                                          </div>
                                        )}
                                     </div>
                                  );
                               })}
                             </div>

                             {/* VS */}
                             <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', width: 16 }}>
                                <div style={{ flex: 1, width: 1, background: '#f0f0f0' }} />
                                <span style={{ fontSize: '9px', color: '#ccc', margin: '2px 0', fontWeight: 'bold' }}>VS</span>
                                <div style={{ flex: 1, width: 1, background: '#f0f0f0' }} />
                             </div>

                             {/* Team 2 */}
                             <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                               <Text type="secondary" style={{ fontSize: '9px', textAlign: 'center', marginBottom: -2 }}>Team 2</Text>
                               {[2, 3].map(i => {
                                  const pid = court.players[i];
                                  const p = pid ? players.find(x => x.id === pid) : null;

                                  return (
                                     <div key={i} 
                                        style={{ 
                                           height: 32,
                                           background: p ? '#fff' : '#fafafa',
                                           border: p ? '1px solid #d9d9d9' : '1px dashed #d9d9d9',
                                           borderRadius: 4,
                                           display: 'flex',
                                           alignItems: 'center',
                                           padding: '0 6px',
                                           justifyContent: 'space-between',
                                           transition: 'all 0.2s'
                                        }}>
                                        {p ? (
                                          <>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', flex: 1 }}>
                                               <Text strong style={{ fontSize: '11px' }} ellipsis>{p.name}</Text>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                               <LevelTag level={p.level} style={{ transform: 'scale(0.8)', marginRight: -4 }} />
                                               <CloseOutlined 
                                                  onClick={(e) => {
                                                     e.stopPropagation();
                                                     if (pid) togglePlayerSelection(court.id, pid);
                                                  }}
                                                  style={{ fontSize: '9px', color: '#999', cursor: 'pointer', padding: 4 }}
                                               />
                                            </div>
                                          </>
                                        ) : (
                                          <div style={{ width: '100%', textAlign: 'center' }}>
                                            <Text type="secondary" style={{ fontSize: '10px', color: '#d9d9d9' }}>
                                               Empty
                                            </Text>
                                          </div>
                                        )}
                                     </div>
                                  );
                               })}
                             </div>
                          </div>
                        </div>
                        <Button 
                          type="primary" 
                          block 
                          size="small"
                          disabled={court.players.filter(Boolean).length < 2 || !sessionStartTime}
                          onClick={() => startMatch(court.id)}
                        >
                          {sessionStartTime ? 'Start Match' : 'Start Session First'}
                        </Button>
                      </div>
                    )}
                  </Card>
                </Col>
              ))}
            </Row>
          </Col>

          {/* Right Column: Queue & Players */}
          <Col xs={24} xl={14}>
            <Card 
              style={{ height: 'calc(100vh - 120px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
              styles={{ body: { flex: 1, overflow: 'hidden', padding: 0, display: 'flex', flexDirection: 'column' } }}
            >
              <div style={{ padding: '12px 12px 0 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Title level={5} style={{ margin: 0 }}>Players ({players.length})</Title>
                  <Space size="middle">
                    <Radio.Group 
                      value={playerViewMode} 
                      onChange={e => setPlayerViewMode(e.target.value)} 
                      size="small" 
                      buttonStyle="solid"
                    >
                      <Radio.Button value="list"><BarsOutlined /></Radio.Button>
                      <Radio.Button value="grid"><AppstoreOutlined /></Radio.Button>
                    </Radio.Group>
                    <Statistic 
                      title={<span style={{ fontSize: '10px' }}>Playing</span>}
                      value={players.filter(p => p.isPlaying).length} 
                      valueStyle={{ fontSize: '14px', color: '#52c41a', fontWeight: 'bold' }} 
                    />
                    <Statistic 
                      title={<span style={{ fontSize: '10px' }}>Waiting</span>}
                      value={players.filter(p => !p.isPlaying && p.isActive !== false).length} 
                      valueStyle={{ fontSize: '14px', color: '#1890ff', fontWeight: 'bold' }} 
                    />
                  </Space>
                </div>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: 8 }}>
                    Avg Games: {players.length ? (players.reduce((acc, p) => acc + p.gamesPlayed, 0) / players.length).toFixed(1) : 0}
                </div>
                
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                     <Select
                       mode="multiple"
                       placeholder="Lvl"
                       style={{ flex: '1 1 100px', minWidth: 0 }}
                       maxTagCount="responsive"
                       allowClear
                       value={levelFilter}
                       onChange={setLevelFilter}
                       size="small"
                     >
                       {(Object.keys(LEVEL_COLORS) as PlayerLevel[]).map(level => (
                         <Select.Option key={level} value={level}>
                           <Space>
                             <div style={{ width: 6, height: 6, borderRadius: '50%', background: LEVEL_COLORS[level] }} />
                             {level}
                           </Space>
                         </Select.Option>
                       ))}
                     </Select>
                     
                     <Radio.Group 
                       value={genderFilter} 
                       onChange={e => setGenderFilter(e.target.value)} 
                       buttonStyle="solid"
                       size="small"
                     >
                       <Radio.Button value="All" style={{ padding: '0 8px' }}>All</Radio.Button>
                       <Radio.Button value="Male" style={{ padding: '0 8px' }}><ManOutlined /></Radio.Button>
                       <Radio.Button value="Female" style={{ padding: '0 8px' }}><WomanOutlined /></Radio.Button>
                    </Radio.Group>

                    <div style={{ display: 'flex', gap: 2 }}>
                       <Select
                         style={{ width: 90 }}
                         size="small"
                         value={sortConfig.field}
                         onChange={(val) => setSortConfig({ ...sortConfig, field: val })}
                         options={[
                           { label: 'Idle', value: 'idle_time' },
                           { label: 'Level', value: 'level' },
                           { label: 'Total', value: 'total_idle' },
                           { label: 'Game', value: 'games' },
                           { label: 'Win', value: 'wins' },
                           { label: 'Loss', value: 'losses' },
                         ]}
                       />
                       <Button 
                         size="small"
                         icon={sortConfig.direction === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />}
                         onClick={() => setSortConfig({ ...sortConfig, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}
                       />
                    </div>
                  </div>
                </div>
              </div>

              <Tabs 
                defaultActiveKey="active"
                activeKey={playerTab}
                onChange={(key) => setPlayerTab(key as 'active' | 'inactive')}
                type="card"
                size="small"
                tabBarStyle={{ margin: '0 12px' }}
                items={[
        {
          key: 'active',
          label: `Active (Playing) (${activePlayers.length})`,
          children: <div style={{ height: 'calc(100vh - 250px)', overflowY: 'auto', padding: '0 12px 12px 12px' }}>
            {renderPlayerList(activePlayers)}
          </div>
        },
        {
          key: 'inactive',
          label: `Inactive (Idle) (${inactivePlayers.length})`,
          children: <div style={{ height: 'calc(100vh - 250px)', overflowY: 'auto', padding: '0 12px 12px 12px' }}>
            {renderPlayerList(inactivePlayers)}
          </div>
        }
      ]}
              />
            </Card>
          </Col>
        </Row>
      </Content>

      {/* Add Court Modal */}
      <Modal
        title="Add New Court"
        open={isAddCourtOpen}
        onCancel={() => setIsAddCourtOpen(false)}
        onOk={() => addCourtForm.submit()}
      >
        <Form form={addCourtForm} layout="vertical" onFinish={handleCreateCourt}>
          <Form.Item 
            name="name" 
            label="Court Name" 
            rules={[{ required: true, message: 'Please enter court name' }]}
          >
            <Input autoFocus placeholder="e.g. Court 3" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Player Modal */}
      <Modal
        title="Add New Player"
        open={isAddPlayerOpen}
        onCancel={() => setIsAddPlayerOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsAddPlayerOpen(false)}>
            Cancel
          </Button>,
          <Button 
            key="save_and_new" 
            onClick={() => { 
              setAddPlayerMode('keep'); 
              form.submit(); 
            }}
          >
            Save & Add Another
          </Button>,
          <Button 
            key="save" 
            type="primary" 
            onClick={() => { 
              setAddPlayerMode('close'); 
              form.submit(); 
            }}
          >
            Save
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" onFinish={handleAddPlayer}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Please enter name' }]}>
            <Input autoFocus placeholder="Player Name" />
          </Form.Item>
          <Form.Item name="gender" label="Gender" initialValue="Male" rules={[{ required: true }]}>
            <Radio.Group buttonStyle="solid">
              <Radio.Button value="Male"><ManOutlined /> Male</Radio.Button>
              <Radio.Button value="Female"><WomanOutlined /> Female</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="level" label="Level" initialValue="Intermediate">
            <Select>
              {(Object.keys(LEVEL_COLORS) as PlayerLevel[]).map(level => (
                <Select.Option key={level} value={level}>
                  <Space>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: LEVEL_COLORS[level] }} />
                    {level}
                  </Space>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Finish Match Modal */}
      <Modal
        title="Finish Match"
        open={isFinishMatchOpen}
        onCancel={() => setIsFinishMatchOpen(false)}
        onOk={() => finishForm.submit()}
      >
        <Form form={finishForm} onFinish={handleFinishMatch} layout="vertical">
          <Form.Item name="winningTeam" label="Winning Team" rules={[{ required: true }]}>
            <Select placeholder="Select Winner">
              <Select.Option value={1}>Team 1 (Left/Top)</Select.Option>
              <Select.Option value={2}>Team 2 (Right/Bottom)</Select.Option>
            </Select>
          </Form.Item>
          
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">Optional Scoring:</Text>
          </div>
          <Space>
            <Form.Item name="team1Score" label="Team 1 Score">
              <InputNumber min={0} />
            </Form.Item>
            <Form.Item name="team2Score" label="Team 2 Score">
              <InputNumber min={0} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      {/* Stop Match Modal */}
      <Modal
        title="Stop Match"
        open={isStopMatchOpen}
        onCancel={() => setIsStopMatchOpen(false)}
        onOk={() => stopForm.submit()}
        okText="Stop Match"
        okButtonProps={{ danger: true }}
      >
        <Form form={stopForm} onFinish={handleStopMatch} layout="vertical">
          <Form.Item 
            name="reason" 
            label="Reason for Stopping" 
            rules={[{ required: true, message: 'Please provide a reason' }]}
          >
            <Input placeholder="e.g. Injury, Emergency, Time Limit" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Session History Modal */}
      <Modal
        title="Session Match History"
        open={isHistoryOpen}
        onCancel={() => setIsHistoryOpen(false)}
        footer={null}
        width={900}
      >
        <Table
          dataSource={history}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 10 }}
          columns={[
            { 
              title: 'Time', 
              dataIndex: 'endTime', 
              render: (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              width: 100
            },
            { title: 'Duration', dataIndex: 'duration', render: (d) => formatDuration(d), width: 100 },
            { title: 'Court', dataIndex: 'courtName', width: 100 },
            { 
              title: 'Team 1', 
              render: (_, record) => (
                <Space direction="vertical" size={0}>
                  {record.players.filter(p => p.team === 1).map(p => <span key={p.id}>{p.name}</span>)}
                </Space>
              )
            },
            { 
              title: 'Team 2', 
              render: (_, record) => (
                <Space direction="vertical" size={0}>
                  {record.players.filter(p => p.team === 2).map(p => <span key={p.id}>{p.name}</span>)}
                </Space>
              )
            },
            { 
              title: 'Result', 
              render: (_, record) => {
                 if (record.isStopped) {
                   return (
                     <Space direction="vertical" size={0}>
                       <Tag color="red">STOPPED</Tag>
                       <span style={{ fontSize: '11px', color: '#888' }}>{record.reason}</span>
                     </Space>
                   );
                 }
                 if (!record.winners) return <Tag>DRAW</Tag>;
                 return (
                   <Space>
                     {record.winners === 1 ? <Tag color="green">Team 1 Win</Tag> : <Tag color="green">Team 2 Win</Tag>}
                     {record.score && <span style={{ fontWeight: 'bold' }}>({record.score})</span>}
                   </Space>
                 );
              } 
            }
          ]}
        />
      </Modal>

      {/* Player Details Modal */}
      <Modal
        title={
          viewPlayer ? (
            <Space>
              <Avatar style={{ backgroundColor: LEVEL_COLORS[viewPlayer.level] }}>{viewPlayer.name[0]}</Avatar>
              <span>{viewPlayer.name}</span>
              <Dropdown
                menu={{
                  items: [
                    { label: <Tag color="blue" style={{ margin: 0 }}>Male</Tag>, key: 'Male' },
                    { label: <Tag color="pink" style={{ margin: 0 }}>Female</Tag>, key: 'Female' },
                  ],
                  onClick: ({ key }) => updatePlayerGender(viewPlayer.id, key as 'Male' | 'Female'),
                }}
                trigger={['click']}
              >
                <Tag 
                  color={viewPlayer.gender === 'Female' ? 'pink' : 'blue'} 
                  style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  {viewPlayer.gender} <DownOutlined style={{ fontSize: '10px' }} />
                </Tag>
              </Dropdown>
            </Space>
          ) : 'Player Details'
        }
        open={!!viewPlayer}
        onCancel={() => setViewPlayerId(null)}
        footer={null}
        width={800}
      >
        {viewPlayer && (
          <>
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3 }} style={{ marginBottom: 24 }}>
              <Descriptions.Item label="Level">
                <Select
                  value={viewPlayer.level}
                  onChange={(newLevel) => updatePlayerLevel(viewPlayer.id, newLevel)}
                  size="small"
                  style={{ width: '100%' }}
                  dropdownStyle={{ minWidth: 150 }}
                >
                  {(Object.keys(LEVEL_COLORS) as PlayerLevel[]).map(level => (
                    <Select.Option key={level} value={level}>
                      <Space>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: LEVEL_COLORS[level] }} />
                        <span style={{ color: '#000' }}>{level}</span>
                      </Space>
                    </Select.Option>
                  ))}
                </Select>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                 <Tag color={viewPlayer.isPlaying ? 'green' : 'default'}>{viewPlayer.isPlaying ? 'Playing' : 'Idle'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Idle Time">{formatDuration(viewPlayer.totalIdleTime)}</Descriptions.Item>
              <Descriptions.Item label="Games Played">{viewPlayer.gamesPlayed}</Descriptions.Item>
              <Descriptions.Item label="W / L">
                <span style={{ color: '#389e0d', fontWeight: 'bold' }}>{viewPlayer.wins}</span> / <span style={{ color: '#cf1322', fontWeight: 'bold' }}>{viewPlayer.losses}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Win Rate">
                  {viewPlayer.gamesPlayed ? Math.round((viewPlayer.wins / viewPlayer.gamesPlayed) * 100) : 0}%
               </Descriptions.Item>
               <Descriptions.Item label="Avg Match Time">
                  {(() => {
                    const playerMatches = history.filter(h => h.players.some(p => p.id === viewPlayer.id));
                    if (playerMatches.length === 0) return '-';
                    const totalDuration = playerMatches.reduce((acc, m) => acc + m.duration, 0);
                    return formatDuration(Math.floor(totalDuration / playerMatches.length));
                  })()}
               </Descriptions.Item>
             </Descriptions>
            
            <Divider>Match History</Divider>
            <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
              {history
                .filter(h => h.players.some(p => p.id === viewPlayer.id))
                .map(match => {
                  const myTeamId = match.players.find(p => p.id === viewPlayer.id)?.team;
                  const myTeam = match.players.filter(p => p.team === myTeamId);
                  const oppTeam = match.players.filter(p => p.team !== myTeamId);
                  const isStopped = match.isStopped;
                  const isWinner = match.winners === myTeamId;
                  const isDraw = !match.winners && !isStopped;
                  
                  return (
                    <Card 
                      key={match.id} 
                      size="small" 
                      style={{ marginBottom: 8 }}
                      styles={{ body: { padding: '12px' } }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: '12px', color: '#888' }}>
                        <Space>
                           <ClockCircleOutlined />
                           {new Date(match.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                           <Divider type="vertical" />
                           {formatDuration(match.duration)}
                           <Divider type="vertical" />
                           {match.courtName}
                        </Space>
                        {isStopped ? <Tag color="red">STOPPED</Tag> : (isDraw ? <Tag>DRAW</Tag> : (isWinner ? <Tag color="green">WIN</Tag> : <Tag color="red">LOSS</Tag>))}
                      </div>
                      {isStopped && match.reason && (
                        <div style={{ fontSize: '11px', color: '#ff4d4f', marginBottom: 8, marginTop: -4 }}>
                          Reason: {match.reason}
                        </div>
                      )}
                      
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {/* My Team */}
                        <div style={{ flex: 1, textAlign: 'right' }}>
                          {myTeam.map(p => (
                            <div key={p.id} style={{ fontWeight: p.id === viewPlayer.id ? 'bold' : 'normal', fontSize: '14px' }}>
                              {p.name}
                            </div>
                          ))}
                        </div>
                        
                        {/* VS / Score */}
                        <div style={{ padding: '0 24px', textAlign: 'center' }}>
                          {match.score ? (
                            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{match.score}</div>
                          ) : (
                            <div style={{ fontSize: '14px', color: '#ccc', fontWeight: 'bold' }}>VS</div>
                          )}
                        </div>
                        
                        {/* Opponent Team */}
                        <div style={{ flex: 1, textAlign: 'left' }}>
                          {oppTeam.map(p => (
                            <div key={p.id} style={{ fontSize: '14px' }}>
                              {p.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              {history.filter(h => h.players.some(p => p.id === viewPlayer.id)).length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No matches played yet</div>
              )}
            </div>
          </>
        )}
      </Modal>
    </Layout>
  );
}
