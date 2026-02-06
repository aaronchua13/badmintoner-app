import React, { useState, useEffect } from 'react';
import { Card, Typography, Radio, Space, Select, Button, Tabs, Input } from 'antd';
import { BarsOutlined, AppstoreOutlined, ManOutlined, WomanOutlined, SortAscendingOutlined, SortDescendingOutlined, SearchOutlined } from '@ant-design/icons';
import { Player, Court, PlayerLevel, LEVEL_COLORS, QueueItem } from '../types';
import { usePlayerFilters } from '../hooks/usePlayerFilters';
import PlayerList from './PlayerList';
import QueueTab from './QueueTab';
import AssignToQueueModal from './modals/AssignToQueueModal';

const { Title } = Typography;

interface PlayerPanelProps {
  players: Player[];
  courts: Court[];
  sessionStartTime: number | null;
  currentTime: number;
  onToggleSelection: (courtId: string, playerId: string) => void;
  onViewPlayer: (id: string) => void;
  onRemovePlayer: (id: string) => void;
  onToggleActive: (id: string) => void;
  isMobile?: boolean;
  queue: QueueItem[];
  // unified queue model: no draft
  autoAssignQueue: boolean;
  onSetAutoAssignQueue: (enabled: boolean) => void;
  onAssignQueueToCourt: (queueId: string, courtId: string) => void;
  onRemoveQueueItem: (id: string) => void;
  onMoveQueueItem: (fromIndex: number, toIndex: number) => void;
  onRemovePlayerFromQueue?: (queueId: string, playerId: string) => void;
  onRemovePlayersFromQueue?: (queueId: string) => void;
  onCreateQueue: () => string;
  onAddPlayerToQueue: (queueId: string, playerId: string) => void;
}

const PlayerPanel: React.FC<PlayerPanelProps> = ({
  players,
  courts,
  sessionStartTime,
  currentTime,
  onToggleSelection,
  onViewPlayer,
  onRemovePlayer,
  onToggleActive,
  isMobile = false,
  queue,
  autoAssignQueue,
  onSetAutoAssignQueue,
  onAssignQueueToCourt,
  onRemoveQueueItem,
  onMoveQueueItem,
  onRemovePlayerFromQueue,
  onRemovePlayersFromQueue,
  onCreateQueue,
  onAddPlayerToQueue
}) => {
  const {
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
    playerTab,
    setPlayerTab,
    activePlayers,
    inactivePlayers,
    allPlayers
  } = usePlayerFilters(players, sessionStartTime, currentTime);

  const [localSearch, setLocalSearch] = useState(searchQuery);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(localSearch);
    }, 300);
    return () => clearTimeout(handler);
  }, [localSearch, setSearchQuery]);

  const [assignPlayerId, setAssignPlayerId] = useState<string | null>(null);
  const [isAssignOpen, setIsAssignOpen] = useState(false);

  const openAssignModal = (playerId: string) => {
    setAssignPlayerId(playerId);
    setIsAssignOpen(true);
  };

  const renderPlayerList = (list: Player[]) => (
    <PlayerList
      sortedPlayers={list}
      courts={courts}
      playerViewMode={playerViewMode}
      sessionStartTime={sessionStartTime}
      currentTime={currentTime}
      onToggleSelection={onToggleSelection}
      onViewPlayer={onViewPlayer}
      onRemovePlayer={onRemovePlayer}
      onToggleActive={onToggleActive}
      onAddToQueue={openAssignModal}
      queue={queue}
  
    />
  );

  return (
    <Card 
      style={{ 
        height: isMobile ? 'auto' : 'calc(100vh - 120px)', 
        overflow: isMobile ? 'visible' : 'hidden', 
        display: 'flex', 
        flexDirection: 'column' 
      }}
      styles={{ 
        body: { 
          flex: 1, 
          overflow: isMobile ? 'visible' : 'hidden', 
          padding: 0, 
          display: 'flex', 
          flexDirection: 'column' 
        } 
      }}
    >
      <div style={{ padding: isMobile ? '8px 8px 0 8px' : '8px 8px 0 8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <Title level={5} style={{ margin: 0, fontSize: '14px' }}>Players ({players.length})</Title>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Radio.Group 
              value={playerViewMode} 
              onChange={e => setPlayerViewMode(e.target.value)} 
              size="small" 
              buttonStyle="solid"
            >
              <Radio.Button value="list" style={{ padding: '0 8px' }}><BarsOutlined /></Radio.Button>
              <Radio.Button value="grid" style={{ padding: '0 8px' }}><AppstoreOutlined /></Radio.Button>
            </Radio.Group>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                 <span style={{ fontSize: '9px', color: '#999', marginBottom: 2 }}>Playing</span>
                 <span style={{ fontSize: '14px', color: '#52c41a', fontWeight: 'bold' }}>
                   {players.filter(p => p.isPlaying).length}
                 </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                 <span style={{ fontSize: '9px', color: '#999', marginBottom: 2 }}>Waiting</span>
                 <span style={{ fontSize: '14px', color: '#1890ff', fontWeight: 'bold' }}>
                   {players.filter(p => !p.isPlaying && p.isActive !== false).length}
                 </span>
              </div>
            </div>
          </div>
        </div>
        <div style={{ fontSize: '10px', color: '#888', marginBottom: 4 }}>
            Avg Games: {players.length ? (players.reduce((acc, p) => acc + p.gamesPlayed, 0) / players.length).toFixed(1) : 0}
        </div>

        <div style={{ marginBottom: 4 }}>
          <Input 
            size="small"
            placeholder="Search players" 
            prefix={<SearchOutlined style={{ color: '#ccc' }} />} 
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            allowClear
          />
        </div>
        
        <div style={{ marginBottom: 4 }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
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
        defaultActiveKey="all"
        activeKey={playerTab}
        onChange={(key) => setPlayerTab(key as 'all' | 'active' | 'inactive' | 'queue')}
        type="card"
        size="small"
        tabBarStyle={{ margin: isMobile ? '0 8px' : '0 12px' }}
        items={[
        {
          key: 'active',
          label: `Active (${activePlayers.length})`,
          children: <div style={{ 
            height: isMobile ? 'auto' : 'calc(100vh - 250px)', 
            overflowY: isMobile ? 'visible' : 'auto', 
            padding: isMobile ? '0 8px 8px 8px' : '0 12px 12px 12px' 
          }}>
            {renderPlayerList(activePlayers)}
          </div>
        },
        {
          key: 'inactive',
          label: `Inactive (${inactivePlayers.length})`,
          children: <div style={{ 
            height: isMobile ? 'auto' : 'calc(100vh - 250px)', 
            overflowY: isMobile ? 'visible' : 'auto', 
            padding: isMobile ? '0 8px 8px 8px' : '0 12px 12px 12px' 
          }}>
            {renderPlayerList(inactivePlayers)}
          </div>
        },
        {
          key: 'all',
          label: `All (${allPlayers.length})`,
          children: <div style={{ 
            height: isMobile ? 'auto' : 'calc(100vh - 250px)', 
            overflowY: isMobile ? 'visible' : 'auto', 
            padding: isMobile ? '0 8px 8px 8px' : '0 12px 12px 12px' 
          }}>
            {renderPlayerList(allPlayers)}
          </div>
        },
        {
          key: 'queue',
          label: `Queue (${queue.length})`,
          children: <div style={{ 
            height: isMobile ? 'auto' : 'calc(100vh - 250px)', 
            overflowY: isMobile ? 'visible' : 'auto', 
            padding: isMobile ? '0 8px 8px 8px' : '0 12px 12px 12px' 
          }}>
            <QueueTab
              queue={queue}
              players={players}
              courts={courts}
              autoAssignQueue={autoAssignQueue}
              onSetAutoAssign={onSetAutoAssignQueue}
              onAssignToCourt={onAssignQueueToCourt}
              onRemoveQueueItem={onRemoveQueueItem}
              onMoveQueueItem={onMoveQueueItem}
              onRemovePlayerFromQueue={onRemovePlayerFromQueue}
              onRemovePlayersFromQueue={onRemovePlayersFromQueue}
            />
          </div>
        }
      ]}
      />
      <AssignToQueueModal
        key={isAssignOpen ? 'open' : 'closed'}
        visible={isAssignOpen}
        onCancel={() => setIsAssignOpen(false)}
        playerId={assignPlayerId}
        players={players}
        courts={courts}
        queue={queue}
        onCreateQueue={onCreateQueue}
        onAddPlayerToQueue={onAddPlayerToQueue}
      />
    </Card>
  );
};

export default PlayerPanel;
