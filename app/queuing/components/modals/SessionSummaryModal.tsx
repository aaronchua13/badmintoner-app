import React from 'react';
import { Modal, Tabs, Statistic, Row, Col, Table, Tag, Typography, Button, Grid } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { MatchHistory, Player } from '../../types';
import { formatSessionDuration, formatMatchTime } from '../../utils';
import {
  TrophyOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  HistoryOutlined
} from '@ant-design/icons';

const { Title } = Typography;

interface SessionSummaryModalProps {
  visible: boolean;
  onClose: () => void;
  sessionStartTime: number | null;
  sessionEndTime: number | null;
  currentTime: number;
  players: Player[];
  history: MatchHistory[];
}

interface PlayerWithStats extends Player {
  displayIdleTime: number;
}

const SessionSummaryModal: React.FC<SessionSummaryModalProps> = ({
  visible,
  onClose,
  sessionStartTime,
  sessionEndTime,
  currentTime,
  players,
  history
}) => {
  const { md } = Grid.useBreakpoint();
  const isMobile = !md;

  const duration = sessionStartTime && sessionEndTime 
    ? Math.floor((sessionEndTime - sessionStartTime) / 1000) 
    : 0;
  
  const totalMatches = history.length;
  const completedMatches = history.filter(h => !h.isStopped).length;
  
  // Calculate idle time for display
  const playersWithStats: PlayerWithStats[] = players.map(p => {
    let currentIdle = 0;
    
    // Logic matches PlayerList/usePlayerFilters: 
    // Only count current idle time if player has played at least one game
    // and is not currently playing.
    if (!p.isPlaying && p.gamesPlayed > 0 && sessionStartTime !== null) {
       const effectiveStartTime = Math.max(p.lastMatchEndTime, sessionStartTime);
       const effectiveEndTime = sessionEndTime || currentTime;
       currentIdle = Math.floor((effectiveEndTime - effectiveStartTime) / 1000);
    }
    
    const totalIdle = p.totalIdleTime + (currentIdle > 0 ? currentIdle : 0);
    
    return {
      ...p,
      displayIdleTime: totalIdle
    };
  });

  // Sort players by wins then games played
  const sortedPlayers = [...playersWithStats].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.gamesPlayed - a.gamesPlayed;
  });

  const topPlayers = sortedPlayers.slice(0, 3);

  const playerColumns: ColumnsType<PlayerWithStats> = [
    { 
      title: 'Rank', 
      render: (_: unknown, __: unknown, index: number) => index + 1, 
      width: 60, 
      fixed: isMobile ? 'left' : undefined 
    },
    { 
      title: 'Name', 
      dataIndex: 'name', 
      key: 'name', 
      fixed: isMobile ? 'left' : undefined 
    },
    { 
      title: 'Level', 
      dataIndex: 'level', 
      key: 'level', 
      render: (l: string) => <Tag>{l}</Tag>, 
      responsive: ['md'] 
    },
    { 
      title: 'Games', 
      dataIndex: 'gamesPlayed', 
      key: 'gamesPlayed', 
      sorter: (a: PlayerWithStats, b: PlayerWithStats) => a.gamesPlayed - b.gamesPlayed 
    },
    { 
      title: 'Wins', 
      dataIndex: 'wins', 
      key: 'wins', 
      sorter: (a: PlayerWithStats, b: PlayerWithStats) => a.wins - b.wins, 
      defaultSortOrder: 'descend' 
    },
    { 
      title: 'Win Rate', 
      key: 'winRate', 
      render: (_: unknown, r: PlayerWithStats) => r.gamesPlayed > 0 ? `${Math.round((r.wins / r.gamesPlayed) * 100)}%` : '0%', 
      responsive: ['sm'] 
    },
    { 
      title: 'Idle Time', 
      key: 'idleTime', 
      render: (_: unknown, r: PlayerWithStats) => formatSessionDuration(r.displayIdleTime),
      sorter: (a: PlayerWithStats, b: PlayerWithStats) => a.displayIdleTime - b.displayIdleTime
    },
  ];

  const historyColumns = [
    { title: 'Time', dataIndex: 'endTime', render: (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    { title: 'Court', dataIndex: 'courtName' },
    { title: 'Duration', dataIndex: 'duration', render: (d: number) => formatMatchTime(d) },
    { title: 'Result', render: (_: unknown, r: MatchHistory) => {
       if (r.isStopped) return <Tag color="default">Stopped: {r.reason}</Tag>;
       return (
         <span>
           {r.score || '-'} 
           {r.winners ? <Tag color="green" style={{ marginLeft: 8 }}>Team {r.winners}</Tag> : null}
         </span>
       );
    }},
    { title: 'Players', render: (_: unknown, r: MatchHistory) => (
       <div style={{ fontSize: '12px' }}>
          <div>T1: {r.players.filter(p => p.team === 1).map(p => p.name).join(', ')}</div>
          <div>T2: {r.players.filter(p => p.team === 2).map(p => p.name).join(', ')}</div>
       </div>
    )}
  ];

  return (
    <Modal
      title={<Title level={5} style={{ margin: 0 }}>Session Summary</Title>}
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" type="primary" size="small" onClick={onClose}>
          Close
        </Button>
      ]}
      width={900}
      styles={{ body: { padding: isMobile ? '8px' : '12px' } }}
      style={{ top: 20 }}
    >
      <div style={{ marginBottom: 12 }}>
        <Row gutter={[8, 8]}>
          <Col span={isMobile ? 24 : 8}>
            <div style={{ padding: 8, background: '#fafafa', borderRadius: 4 }}>
              <Statistic 
                title={<span style={{ fontSize: 12 }}>Duration</span>}
                value={formatSessionDuration(duration)} 
                valueStyle={{ fontSize: 16 }}
                prefix={<ClockCircleOutlined style={{ fontSize: 14 }} />} 
              />
            </div>
          </Col>
          <Col span={isMobile ? 12 : 8}>
             <div style={{ padding: 8, background: '#fafafa', borderRadius: 4 }}>
              <Statistic 
                title={<span style={{ fontSize: 12 }}>Matches</span>}
                value={totalMatches} 
                valueStyle={{ fontSize: 16 }}
                suffix={<span style={{ fontSize: 12 }}>({completedMatches} done)</span>}
                prefix={<HistoryOutlined style={{ fontSize: 14 }} />} 
              />
            </div>
          </Col>
          <Col span={isMobile ? 12 : 8}>
             <div style={{ padding: 8, background: '#fafafa', borderRadius: 4 }}>
              <Statistic 
                title={<span style={{ fontSize: 12 }}>Active Players</span>}
                value={players.filter(p => p.gamesPlayed > 0).length} 
                valueStyle={{ fontSize: 16 }}
                suffix={<span style={{ fontSize: 12 }}>/ {players.length}</span>}
                prefix={<TeamOutlined style={{ fontSize: 14 }} />} 
              />
            </div>
          </Col>
        </Row>
      </div>

      <Tabs
        defaultActiveKey="leaderboard"
        size="small"
        items={[
          {
            key: 'leaderboard',
            label: 'Leaderboard',
            children: (
              <div>
                <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
                   {topPlayers.map((p, i) => (
                     <Col span={8} key={p.id}>
                       <div style={{ 
                         background: i === 0 ? '#fffbe6' : '#f9f9f9', 
                         padding: 8, 
                         borderRadius: 6, 
                         textAlign: 'center',
                         border: i === 0 ? '1px solid #ffe58f' : '1px solid #f0f0f0',
                         display: 'flex',
                         flexDirection: 'column',
                         alignItems: 'center',
                         justifyContent: 'center',
                         gap: 4,
                         height: '100%'
                       }}>
                         <TrophyOutlined style={{ fontSize: 16, color: i === 0 ? '#faad14' : i === 1 ? '#d9d9d9' : '#d48806', marginBottom: 4 }} />
                         <div style={{ textAlign: 'center', width: '100%' }}>
                           <div style={{ fontWeight: 'bold', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                           <div style={{ fontSize: 11 }}>{p.wins} W / {p.gamesPlayed} G</div>
                         </div>
                       </div>
                     </Col>
                   ))}
                </Row>
                <Table 
                  dataSource={sortedPlayers} 
                  columns={playerColumns} 
                  rowKey="id" 
                  pagination={{ pageSize: 10, size: 'small' }} 
                  size="small"
                  scroll={{ x: 600, y: 300 }}
                  style={{ fontSize: 12 }}
                />
              </div>
            )
          },
          {
            key: 'history',
            label: 'Match History',
            children: (
              <Table 
                dataSource={history} 
                columns={historyColumns} 
                rowKey="id" 
                pagination={{ pageSize: 10, size: 'small' }} 
                size="small"
                scroll={{ x: 800, y: 300 }}
              />
            )
          }
        ]}
      />
    </Modal>
  );
};

export default SessionSummaryModal;
