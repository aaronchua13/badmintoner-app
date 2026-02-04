import React, { useState } from 'react';
import { Modal, Tag, Typography, Button, Space, Alert } from 'antd';
import { Player, QueueItem, Court } from '../../types';
import LevelTag from '../LevelTag';

const { Title, Text } = Typography;

interface AssignToQueueModalProps {
  visible: boolean;
  onCancel: () => void;
  playerId: string | null;
  players: Player[];
  courts: Court[];
  queue: QueueItem[];
  onCreateQueue: () => string;
  onAddPlayerToQueue: (queueId: string, playerId: string) => void;
}

const AssignToQueueModal: React.FC<AssignToQueueModalProps> = ({
  visible,
  onCancel,
  playerId,
  players,
  courts,
  queue,
  onCreateQueue,
  onAddPlayerToQueue
}) => {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const player = players.find(p => p.id === playerId);
  const groupCount = (g: QueueItem) => g.team1.length + g.team2.length;

  const isPlayerOnCourt = playerId ? courts.some(c => c.players.includes(playerId)) : false;


  return (
    <Modal
      title="Assign to Queue"
      open={visible}
      onCancel={onCancel}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <Button onClick={() => {
            const id = onCreateQueue();
            setSelectedGroupId(id);
          }}>Create Queue</Button>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={onCancel}>Cancel</Button>
            <Button 
              type="primary" 
              disabled={!selectedGroupId || !playerId || isPlayerOnCourt}
              onClick={() => {
                if (!selectedGroupId || !playerId || isPlayerOnCourt) return;
                onAddPlayerToQueue(selectedGroupId, playerId);
                onCancel();
              }}
            >
              Add to Queue
            </Button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {isPlayerOnCourt && (
          <Alert
            message="This player is currently assigned to a court."
            type="warning"
            showIcon
          />
        )}
        <Title level={5} style={{ margin: 0, fontSize: 14 }}>Select Queue</Title>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '60vh', overflowY: 'auto' }}>
          {queue.length === 0 ? (
            <Text type="secondary">No queues yet. Click Create Queue to start.</Text>
          ) : (
            queue.map((g, index) => {
              const count = groupCount(g);
              const isFull = count >= 4;
              const isSelected = selectedGroupId === g.id;
              
              return (
                <div
                  key={g.id}
                  onClick={() => !isFull && setSelectedGroupId(g.id)}
                  style={{
                    border: isSelected ? '1px solid #1890ff' : '1px solid #d9d9d9',
                    background: isSelected ? '#e6f7ff' : '#fff',
                    borderRadius: 6,
                    padding: 12,
                    cursor: isFull ? 'not-allowed' : 'pointer',
                    opacity: isFull ? 0.6 : 1,
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong>Queue {index + 1}</Text>
                    <Tag color={isFull ? 'red' : 'green'}>{count}/4</Tag>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {[...g.team1, ...g.team2].length === 0 && (
                      <Text type="secondary" style={{ fontSize: 12 }}>Empty</Text>
                    )}
                    {[...g.team1, ...g.team2].map(pid => {
                      const p = players.find(x => x.id === pid);
                      if (!p) return null;
                      return (
                        <div key={pid} style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          background: 'rgba(0,0,0,0.05)', 
                          borderRadius: 4, 
                          padding: '2px 6px',
                          maxWidth: '100%'
                        }}>
                          <LevelTag level={p.level} />
                          <Text style={{ fontSize: 12, marginLeft: 6 }} ellipsis>{p.name}</Text>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        {player && (
          <div style={{ marginTop: 12 }}>
            <Text>Player: </Text>
            <Space>
              <LevelTag level={player.level} />
              <Text strong>{player.name}</Text>
            </Space>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default AssignToQueueModal;
