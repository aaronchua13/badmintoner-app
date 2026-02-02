import React from 'react';
import { Card, Typography, Tag, Button, Grid } from 'antd';
import { EditOutlined, ClockCircleOutlined, DeleteOutlined, StopOutlined, CloseOutlined } from '@ant-design/icons';
import { Court, Player } from '../types';
import LevelTag from './LevelTag';
import { formatMatchTime, getMatchOdds } from '../utils';

const { Text } = Typography;

interface CourtCardProps {
  court: Court;
  players: Player[];
  currentTime: number;
  sessionStartTime: number | null;
  onUpdateName: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onStartMatch: (id: string) => void;
  onFinishMatch: (id: string) => void;
  onStopMatch: (id: string) => void;
  onTogglePlayer: (courtId: string, playerId: string) => void;
}

const CourtCard: React.FC<CourtCardProps> = ({
  court,
  players,
  currentTime,
  sessionStartTime,
  onUpdateName,
  onRemove,
  onStartMatch,
  onFinishMatch,
  onStopMatch,
  onTogglePlayer
}) => {
  const { md } = Grid.useBreakpoint();
  const isMobile = !md;

  return (
    <Card 
      size="small"
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600 }}>
              <Text 
                editable={{ 
                  onChange: (val) => onUpdateName(court.id, val),
                  icon: <EditOutlined style={{ color: '#8c8c8c' }} />,
                  triggerType: ['icon', 'text']
                }}
                style={{ fontWeight: 600, fontSize: '14px', margin: 0 }}
              >
                {court.name}
              </Text>
            </span>
            {court.players.length >= 2 && (() => {
              const odds = getMatchOdds(court.players, players);
              return odds && (
                <Tag color={odds.color === 'success' ? 'green' : odds.color === 'error' ? 'red' : 'orange'} style={{ margin: 0, fontSize: '10px', lineHeight: '16px', padding: '0 6px', border: 'none' }}>
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
              onClick={() => onRemove(court.id)}
              disabled={court.status === 'active'}
            />
          </div>
        </div>
      }
      style={{ 
        borderTop: `4px solid ${court.status === 'active' ? '#52c41a' : '#d9d9d9'}`,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        width: '100%'
      }}
      styles={{ 
        body: { 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          padding: '4px' 
        } 
      }}
    >
      {court.status === 'active' ? (
        // Active Match View
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
          <div style={{ marginBottom: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: isMobile ? 4 : 8 }}>
              {/* Team 1 */}
              <div style={{ textAlign: 'right', flex: 1 }}>
                {court.players.slice(0, Math.ceil(court.players.length/2)).map(pid => {
                  const p = players.find(x => x.id === pid);
                  return (
                    <div key={pid} style={{ fontWeight: 600, marginBottom: 2, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                      <span style={{ fontSize: isMobile ? '11px' : '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: isMobile ? '80px' : '120px' }}>{p?.name}</span>
                      {p && <LevelTag level={p.level} style={{ transform: isMobile ? 'scale(0.8)' : 'scale(0.9)' }} />}
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
                    <div key={pid} style={{ fontWeight: 600, marginBottom: 2, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 4 }}>
                      {p && <LevelTag level={p.level} style={{ transform: isMobile ? 'scale(0.8)' : 'scale(0.9)' }} />}
                      <span style={{ fontSize: isMobile ? '11px' : '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: isMobile ? '80px' : '120px' }}>{p?.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <Button type="primary" size="small" block onClick={() => onFinishMatch(court.id)}>
              Finish
            </Button>
            <Button danger size="small" block icon={<StopOutlined />} onClick={() => onStopMatch(court.id)}>
              Stop
            </Button>
          </div>
        </div>
      ) : (
        // Idle / Setup View
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ flex: 1, marginBottom: 2 }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 2 }}>
               {/* Team 1 */}
               <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                 <Text type="secondary" style={{ fontSize: '9px', textAlign: 'center', marginBottom: -2 }}>Team 1</Text>
                 {[0, 1].map(i => {
                    const pid = court.players[i];
                    const p = pid ? players.find(x => x.id === pid) : null;

                    return (
                       <div key={i} 
                          style={{ 
                             height: 22,
                             background: p ? '#fff' : '#fafafa',
                             border: p ? '1px solid #d9d9d9' : '1px dashed #d9d9d9',
                             borderRadius: 4,
                             display: 'flex',
                             alignItems: 'center',
                             padding: '0 4px',
                             justifyContent: 'space-between',
                             transition: 'all 0.2s'
                          }}>
                          {p ? (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', flex: 1 }}>
                                 <Text strong style={{ fontSize: '11px' }} ellipsis>{p.name}</Text>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                 <LevelTag level={p.level} style={{ transform: 'scale(0.7)', marginRight: -4 }} />
                                 <CloseOutlined 
                                    onClick={(e) => {
                                       e.stopPropagation();
                                       if (pid) onTogglePlayer(court.id, pid);
                                    }}
                                    style={{ fontSize: '9px', color: '#999', cursor: 'pointer', padding: 2 }}
                                 />
                              </div>
                            </>
                          ) : (
                            <div style={{ width: '100%', textAlign: 'center' }}>
                              <Text type="secondary" style={{ fontSize: '9px', color: '#d9d9d9' }}>
                                 Empty
                              </Text>
                            </div>
                          )}
                       </div>
                    );
                 })}
               </div>

               {/* VS */}
               <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', width: 12 }}>
                  <div style={{ flex: 1, width: 1, background: '#f0f0f0' }} />
                  <span style={{ fontSize: '9px', color: '#ccc', margin: '2px 0', fontWeight: 'bold' }}>VS</span>
                  <div style={{ flex: 1, width: 1, background: '#f0f0f0' }} />
               </div>

               {/* Team 2 */}
               <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                 <Text type="secondary" style={{ fontSize: '9px', textAlign: 'center', marginBottom: -2 }}>Team 2</Text>
                 {[2, 3].map(i => {
                    const pid = court.players[i];
                    const p = pid ? players.find(x => x.id === pid) : null;

                    return (
                       <div key={i} 
                          style={{ 
                             height: 22,
                             background: p ? '#fff' : '#fafafa',
                             border: p ? '1px solid #d9d9d9' : '1px dashed #d9d9d9',
                             borderRadius: 4,
                             display: 'flex',
                             alignItems: 'center',
                             padding: '0 4px',
                             justifyContent: 'space-between',
                             transition: 'all 0.2s'
                          }}>
                          {p ? (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', flex: 1 }}>
                                 <Text strong style={{ fontSize: '11px' }} ellipsis>{p.name}</Text>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                 <LevelTag level={p.level} style={{ transform: 'scale(0.7)', marginRight: -4 }} />
                                 <CloseOutlined 
                                    onClick={(e) => {
                                       e.stopPropagation();
                                       if (pid) onTogglePlayer(court.id, pid);
                                    }}
                                    style={{ fontSize: '9px', color: '#999', cursor: 'pointer', padding: 2 }}
                                 />
                              </div>
                            </>
                          ) : (
                            <div style={{ width: '100%', textAlign: 'center' }}>
                              <Text type="secondary" style={{ fontSize: '9px', color: '#d9d9d9' }}>
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
            onClick={() => onStartMatch(court.id)}
          >
            {sessionStartTime ? 'Start Match' : 'Start Session First'}
          </Button>
        </div>
      )}
    </Card>
  );
};

export default CourtCard;
