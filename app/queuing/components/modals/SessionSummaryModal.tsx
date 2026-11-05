import React, { useState } from 'react';
import { Modal, Tabs, Statistic, Row, Col, Table, Tag, Typography, Button, Grid, Empty, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { MatchHistory, Player, Court, CourtHistoryItem } from '../../types';
import { formatSessionDuration, formatMatchTime, getTotalIdleTime } from '../../utils';
import {
  TrophyOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  HistoryOutlined
} from '@ant-design/icons';

const { Title } = Typography;

interface SessionSummaryModalProps {
  onOpenPayments?: () => void;
  visible: boolean;
  onClose: () => void;
  sessionStartTime: number | null;
  sessionEndTime: number | null;
  currentTime: number;
  players: Player[];
  history: MatchHistory[];
  courts?: Court[];
  courtHistory?: CourtHistoryItem[];
}

interface PlayerWithStats extends Player {
  displayIdleTime: number;
}

const SessionSummaryModal: React.FC<SessionSummaryModalProps> = ({
  onOpenPayments,
  visible,
  onClose,
  sessionStartTime,
  sessionEndTime,
  currentTime,
  players,
  history,
  courtHistory = []
}) => {
  const { md } = Grid.useBreakpoint();
  const isMobile = !md;
  const { token } = theme.useToken();
  const [leaderboardPage, setLeaderboardPage] = useState({ current: 1, pageSize: 10 });

  const duration = sessionStartTime !== null
    ? Math.max(0, Math.floor(((sessionEndTime ?? currentTime) - sessionStartTime) / 1000)) 
    : 0;
  
  const totalMatches = history.length;
  const completedMatches = history.filter(h => !h.isStopped).length;
  
  const playersWithStats: PlayerWithStats[] = players.map(p => ({
    ...p,
    displayIdleTime: getTotalIdleTime(p, sessionStartTime, sessionEndTime ?? currentTime),
  }));

  // Sort players by wins then games played
  const sortedPlayers = [...playersWithStats].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.gamesPlayed - a.gamesPlayed;
  });

  const topPlayers = sortedPlayers.filter(p => p.gamesPlayed > 0).slice(0, 3);
  const finishedMatches = history.filter(h => !h.isStopped);
  const averageMatch = finishedMatches.length ? Math.round(finishedMatches.reduce((sum, h) => sum + h.duration, 0) / finishedMatches.length) : 0;

  const playerColumns: ColumnsType<PlayerWithStats> = [
    { 
      title: 'Rank', 
      render: (_: unknown, __: unknown, index: number) =>
        (leaderboardPage.current - 1) * leaderboardPage.pageSize + index + 1, 
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

  const downloadSummary = () => {
    const now = currentTime;
    const dateObj = new Date(now);
    const dateLabel = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeLabel = dateObj.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }).replace(/:/g, '');
    const filename = `Summary - ${dateLabel} ${timeLabel}`;
    const xmlHeader = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>`;
    const wbOpen = `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">`;
    const wbClose = `</Workbook>`;
    const sheet = (name: string, rows: string) => `<Worksheet ss:Name="${name}"><Table>${rows}</Table></Worksheet>`;
    const escapeXml = (value: string) => value.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]!));
    const cellStr = (v: string) => `<Cell><Data ss:Type="String">${escapeXml(v)}</Data></Cell>`;
    const row = (cells: string[]) => `<Row>${cells.join('')}</Row>`;
    
    const leaderboardRows = [
      row(['Rank','Name','Level','Games','Wins','Win Rate','Idle Time'].map(cellStr)),
      ...sortedPlayers.map((p, i) => row([
        String(i+1),
        p.name,
        String(p.level),
        String(p.gamesPlayed),
        String(p.wins),
        p.gamesPlayed > 0 ? `${Math.round((p.wins / p.gamesPlayed) * 100)}%` : '0%',
        formatSessionDuration(playersWithStats.find(x => x.id === p.id)?.displayIdleTime || 0)
      ].map(cellStr)))
    ].join('');
    
    const historyRows = [
      row(['Time','Court','Duration','Result','Players T1','Players T2'].map(cellStr)),
      ...history.map(h => {
        const t1 = h.players.filter(p => p.team === 1).map(p => p.name).join(', ');
        const t2 = h.players.filter(p => p.team === 2).map(p => p.name).join(', ');
        const res = h.isStopped ? `Stopped: ${h.reason || ''}` : (h.score || '-') + (h.winners ? ` (Team ${h.winners})` : '');
        return row([
          new Date(h.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          h.courtName,
          formatMatchTime(h.duration),
          res,
          t1,
          t2
        ].map(cellStr));
      })
    ].join('');

    const courtHistoryRows = [
      row(['Court Name', 'Added Time', 'Removed Time', 'Games Played'].map(cellStr)),
      ...courtHistory.map(ch => row([
        ch.name,
        new Date(ch.addedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ch.removedAt ? new Date(ch.removedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
        String(ch.gamesPlayed)
      ].map(cellStr)))
    ].join('');

    const xml = [
      xmlHeader,
      wbOpen,
      sheet('Overview', [row(['Session duration', formatSessionDuration(duration)].map(cellStr)), row(['Completed matches', String(completedMatches)].map(cellStr)), row(['Stopped matches', String(totalMatches - completedMatches)].map(cellStr)), row(['Players', String(players.length)].map(cellStr))].join('')),
      sheet('Leaderboard', leaderboardRows),
      sheet('MatchHistory', historyRows),
      sheet('CourtHistory', courtHistoryRows),
      wbClose
    ].join('');
    const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.xls`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <Modal
      title={<Title level={5} style={{ margin: 0 }}>Session Summary</Title>}
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="download" onClick={downloadSummary} size="small">
          Download Excel
        </Button>,
        <Button key="close" type="primary" size="small" onClick={onClose}>
          Close
        </Button>
      ]}
      width={900}
      styles={{ body: { padding: isMobile ? '8px' : '12px' } }}
      style={{ top: 20 }}
    >
      {onOpenPayments && <div style={{ marginBottom: 16 }}><p>Review actual expenses and player charges to finalize payment settlement.</p><Button onClick={onOpenPayments}>Review payments</Button></div>}
      <div style={{ marginBottom: 20 }}>
        <Tag color={sessionEndTime !== null ? 'default' : sessionStartTime !== null ? 'green' : 'blue'}>{sessionEndTime !== null ? 'Final results' : sessionStartTime !== null ? 'Live overview' : 'Session setup'}</Tag>
        <p style={{ color: token.colorTextSecondary, margin: '10px 0 16px' }}>
          {sessionStartTime !== null ? `Started ${new Date(sessionStartTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}` : 'Start a session to track playing time and results.'}
        </p>
        <Row gutter={[8, 8]}>
          <Col xs={12} md={6}>
            <div style={{ padding: 16, background: token.colorFillAlter, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 10 }}>
              <Statistic 
                title={<span style={{ fontSize: 12 }}>Duration</span>}
                value={formatSessionDuration(duration)} 
                styles={{ content: { fontSize: 16 } }}
                prefix={<ClockCircleOutlined style={{ fontSize: 14 }} />} 
              />
            </div>
          </Col>
          <Col xs={12} md={6}>
             <div style={{ padding: 16, background: token.colorFillAlter, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 10 }}>
              <Statistic 
                title={<span style={{ fontSize: 12 }}>Matches</span>}
                value={totalMatches} 
                suffix={<span style={{ fontSize: 12 }}>({completedMatches} done)</span>}
                styles={{ content: { fontSize: 16 } }}
                prefix={<HistoryOutlined style={{ fontSize: 14 }} />} 
              />
            </div>
          </Col>
          <Col xs={12} md={6}>
             <div style={{ padding: 16, background: token.colorFillAlter, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 10 }}>
              <Statistic 
                title={<span style={{ fontSize: 12 }}>Players who played</span>}
                value={players.filter(p => p.gamesPlayed > 0).length} 
                styles={{ content: { fontSize: 16 } }}
                suffix={<span style={{ fontSize: 12 }}>/ {players.length}</span>}
                prefix={<TeamOutlined style={{ fontSize: 14 }} />} 
              />
            </div>
          </Col>
          <Col xs={12} md={6}>
            <div style={{ padding: 16, background: token.colorFillAlter, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 10 }}>
              <Statistic title={<span style={{ fontSize: 12 }}>Average match</span>} value={averageMatch ? formatMatchTime(averageMatch) : '—'} styles={{ content: { fontSize: 16 } }} prefix={<ClockCircleOutlined style={{ fontSize: 14 }} />} />
            </div>
          </Col>
        </Row>
        <p style={{ margin: '12px 0 0', color: token.colorTextSecondary, fontSize: 12 }}>{completedMatches} completed · {totalMatches - completedMatches} stopped · {players.filter(p => p.isPlaying).length} playing now</p>
      </div>

      <Tabs
        defaultActiveKey="leaderboard"
        size="small"
        items={[
          {
            key: 'leaderboard',
            label: `Leaderboard (${players.length})`,
            children: (
              <div>
                <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
                   {topPlayers.length === 0 && <Col span={24}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Complete a match to see session leaders" /></Col>}
                   {topPlayers.map((p, i) => (
                     <Col span={8} key={p.id}>
                       <div style={{ 
                         background: i === 0 ? token.colorPrimaryBg : token.colorFillAlter, 
                         padding: 8, 
                         borderRadius: 6, 
                         textAlign: 'center',
                         border: `1px solid ${i === 0 ? token.colorPrimaryBorder : token.colorBorderSecondary}`,
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
                  pagination={{ ...leaderboardPage, size: 'small' }}
                  onChange={(pagination) => setLeaderboardPage({
                    current: pagination.current ?? 1,
                    pageSize: pagination.pageSize ?? 10,
                  })}
                  size="small"
                  scroll={{ x: 600, y: 300 }}
                  style={{ fontSize: 12 }}
                />
              </div>
            )
          },
          {
            key: 'history',
            label: `Match history (${history.length})`,
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
