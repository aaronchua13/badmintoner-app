import React from 'react';
import { Modal, Table, Tag, Grid, Space, Typography } from 'antd';
import { MatchHistory } from '../../types';
import { formatMatchTime } from '../../utils';

const { Text } = Typography;

interface HistoryModalProps {
  visible: boolean;
  onCancel: () => void;
  history: MatchHistory[];
}

const HistoryModal: React.FC<HistoryModalProps> = ({
  visible,
  onCancel,
  history
}) => {
  const { md } = Grid.useBreakpoint();
  const isMobile = !md;

  const columns = [
    { title: 'Time', dataIndex: 'endTime', render: (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    { title: 'Court', dataIndex: 'courtName' },
    { title: 'Duration', dataIndex: 'duration', render: (d: number) => formatMatchTime(d) },
    { title: 'Score', dataIndex: 'score', render: (s: string, r: MatchHistory) => r.isStopped ? 'Stopped' : s },
    { title: 'Winner', render: (_: unknown, r: MatchHistory) => {
       if (r.isStopped) return <Tag color="default">Stopped: {r.reason}</Tag>;
       if (r.winners === 1) return <Tag color="green">Team 1</Tag>;
       if (r.winners === 2) return <Tag color="green">Team 2</Tag>;
       return '-';
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
      title="Match History"
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={isMobile ? '100%' : 800}
      style={isMobile ? { top: 0, margin: 0, maxWidth: '100%' } : {}}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      styles={isMobile ? { content: { height: '100vh', display: 'flex', flexDirection: 'column' }, body: { flex: 1, overflowY: 'auto' } } as any : {}}
      centered={!isMobile}
    >
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {history.map((item) => (
            <div
              key={item.id}
              style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Space>
                        <Text strong>{new Date(item.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                        <Tag>{formatMatchTime(item.duration)}</Tag>
                    </Space>
                    <Tag>{item.courtName}</Tag>
                </div>

                {item.isStopped ? (
                     <Tag color="default" style={{ width: '100%', textAlign: 'center', marginBottom: 8 }}>Stopped: {item.reason}</Tag>
                ) : (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 12, background: '#f9f9f9', padding: '8px', borderRadius: '8px' }}>
                         <div style={{ flex: 1, textAlign: 'right', fontWeight: item.winners === 1 ? 'bold' : 'normal', color: item.winners === 1 ? '#52c41a' : 'inherit', fontSize: '16px' }}>
                             {item.score?.split('-')[0].trim() || '0'}
                         </div>
                         <div style={{ margin: '0 12px', color: '#999', fontSize: '12px' }}>VS</div>
                         <div style={{ flex: 1, textAlign: 'left', fontWeight: item.winners === 2 ? 'bold' : 'normal', color: item.winners === 2 ? '#52c41a' : 'inherit', fontSize: '16px' }}>
                             {item.score?.split('-')[1].trim() || '0'}
                         </div>
                    </div>
                )}

                <div style={{ fontSize: '12px', color: '#666' }}>
                    <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: item.winners === 1 ? '#f6ffed' : 'transparent', borderRadius: '4px' }}>
                        <span>Team 1:</span>
                        <span style={{ fontWeight: item.winners === 1 ? 'bold' : 'normal', color: item.winners === 1 ? '#389e0d' : 'inherit' }}>
                            {item.players.filter(p => p.team === 1).map(p => p.name).join(', ')}
                        </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: item.winners === 2 ? '#f6ffed' : 'transparent', borderRadius: '4px' }}>
                        <span>Team 2:</span>
                        <span style={{ fontWeight: item.winners === 2 ? 'bold' : 'normal', color: item.winners === 2 ? '#389e0d' : 'inherit' }}>
                            {item.players.filter(p => p.team === 2).map(p => p.name).join(', ')}
                        </span>
                    </div>
                </div>
            </div>
          ))}
        </div>
      ) : (
        <Table 
            dataSource={history} 
            columns={columns} 
            rowKey="id" 
            size="small"
            pagination={{ pageSize: 5 }}
        />
      )}
    </Modal>
  );
};

export default HistoryModal;
