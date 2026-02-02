import React from 'react';
import { Modal, Tabs, Statistic, Row, Col, Table, Tag, Typography, Button, Grid } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { MatchHistory, Player } from '../../types';
import { formatSessionDuration, formatMatchTime } from '../../utils';
import { TrophyOutlined, TeamOutlined, ClockCircleOutlined, FireOutlined, HistoryOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface SessionSummaryModalProps {
  visible: boolean;
  onClose: () => void;
  sessionStartTime: number | null;
  sessionEndTime: number | null;
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
    const currentIdle = !p.isPlaying 
      ? Math.floor(((sessionEndTime || Date.now()) - p.lastMatchEndTime) / 1000)
      : 0;
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
  ];

  return (
    <Modal
      title={<Title level={3} style={{ margin: 0 }}>Session Summary</Title>}
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" type="primary" onClick={onClose}>
          Close
        </Button>
      ]}
      width={900}
      styles={{ body: { padding: isMobile ? '12px' : '24px' } }}
    >
      <div style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col span={isMobile ? 24 : 8}>
            <Statistic 
              title="Session Duration" 
              value={formatSessionDuration(duration)} 
              prefix={<ClockCircleOutlined />} 
            />
          </Col>
          <Col span={isMobile ? 12 : 8}>
            <Statistic 
              title="Total Matches" 
              value={totalMatches} 
              suffix={`(${completedMatches} completed)`}
              prefix={<HistoryOutlined />} 
            />
          </Col>
          <Col span={isMobile ? 12 : 8}>
            <Statistic 
              title="Active Players" 
              value={players.filter(p => p.gamesPlayed > 0).length} 
              suffix={`/ ${players.length}`}
              prefix={<TeamOutlined />} 
            />
          </Col>
        </Row>
      </div>

      <Tabs
        defaultActiveKey="leaderboard"
        items={[
          {
            key: 'leaderboard',
            label: 'Leaderboard',
            children: (
              <div>
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                   {topPlayers.map((p, i) => (
                     <Col span={isMobile ? 24 : 8} key={p.id}>
                       <div style={{ 
                         background: i === 0 ? '#fffbe6' : '#f9f9f9', 
                         padding: 16, 
                         borderRadius: 8, 
                         textAlign: 'center',
                         border: i === 0 ? '1px solid #ffe58f' : '1px solid #f0f0f0',
                         display: 'flex',
                         flexDirection: isMobile ? 'row' : 'column',
                         alignItems: 'center',
                         justifyContent: isMobile ? 'flex-start' : 'center',
                         gap: isMobile ? 16 : 0
                       }}>
                         <TrophyOutlined style={{ fontSize: 24, color: i === 0 ? '#faad14' : i === 1 ? '#d9d9d9' : '#d48806', marginBottom: isMobile ? 0 : 8 }} />
                         <div style={{ textAlign: isMobile ? 'left' : 'center' }}>
                           <div style={{ fontWeight: 'bold', fontSize: 16 }}>{p.name}</div>
                           <div>{p.wins} Wins / {p.gamesPlayed} Games</div>
                         </div>
                       </div>
                     </Col>
                   ))}
                </Row>
                <Table 
                  dataSource={sortedPlayers} 
                  columns={playerColumns} 
                  rowKey="id" 
                  pagination={{ pageSize: 10 }} 
                  size="small"
                  scroll={{ x: 600 }}
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
                pagination={{ pageSize: 10 }} 
                size="small"
                scroll={{ x: 500 }}
              />
            )
          }
        ]}
      />
    </Modal>
  );
};

export default SessionSummaryModal;
