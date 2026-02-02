import React from 'react';
import { Row, Col, Typography, Tag, Badge, Avatar, Button, Dropdown, Space } from 'antd';
import { TeamOutlined, InfoCircleOutlined, MoreOutlined, ManOutlined, WomanOutlined, PauseCircleOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { Player, Court, LEVEL_COLORS } from '../types';
import LevelTag from './LevelTag';
import { formatDuration, getWaitTime, getWaitDuration } from '../utils';

const { Text } = Typography;

interface PlayerListProps {
  sortedPlayers: Player[];
  courts: Court[];
  playerViewMode: 'list' | 'grid';
  sessionStartTime: number | null;
  currentTime: number;
  onToggleSelection: (courtId: string, playerId: string) => void;
  onViewPlayer: (id: string) => void;
  onRemovePlayer: (id: string) => void;
  onToggleActive: (id: string) => void;
}

const getWaitColor = (seconds: number) => {
  const minutes = seconds / 60;
  if (minutes >= 20) return '#ff4d4f'; // Red (Danger)
  if (minutes >= 15) return '#faad14'; // Orange (Warning)
  return undefined; // Default
};

const PlayerList: React.FC<PlayerListProps> = ({
  sortedPlayers,
  courts,
  playerViewMode,
  sessionStartTime,
  currentTime,
  onToggleSelection,
  onViewPlayer,
  onRemovePlayer,
  onToggleActive
}) => {
  if (sortedPlayers.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px', color: '#999' }}>
         <TeamOutlined style={{ fontSize: 24, marginBottom: 8 }} /><br />
         No players found
      </div>
    );
  }

  if (playerViewMode === 'grid') {
    return (
      <Row gutter={[12, 12]}>
        {sortedPlayers.map(player => {
          const idleCourts = courts.filter(c => c.status === 'idle');
          const showCourtButtons = !player.isPlaying && player.isActive && idleCourts.length > 0;
          const waitSeconds = getWaitDuration(player, sessionStartTime, currentTime);
          const waitColor = getWaitColor(waitSeconds);
          
          return (
            <Col xs={24} sm={12} md={12} lg={12} xl={8} xxl={6} key={player.id}>
              <div style={{ 
                background: player.isPlaying ? '#f6ffed' : (!player.isActive ? '#fafafa' : '#fff'), 
                border: '1px solid #f0f0f0', 
                borderRadius: '6px',
                padding: '8px',
                position: 'relative',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                opacity: !player.isActive ? 0.6 : 1
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text strong style={{ fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '65%', cursor: 'pointer' }} onClick={() => onViewPlayer(player.id)}>
                    {player.name}
                  </Text>
                  <Tag 
                    color={player.isPlaying ? 'green' : (waitColor || 'default')} 
                    style={{ margin: 0, fontSize: '10px', lineHeight: '16px', padding: '0 4px', color: waitColor ? '#fff' : undefined, border: 'none' }}
                  >
                    {getWaitTime(player, sessionStartTime, currentTime)}
                  </Tag>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flex: 1 }}>
                  <Badge dot={player.isPlaying} color="green" offset={[-2, 2]}>
                    <Avatar size={32} style={{ backgroundColor: LEVEL_COLORS[player.level] || '#ccc', fontSize: '14px' }}>
                      {player.name[0]?.toUpperCase()}
                    </Avatar>
                  </Badge>
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

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 6, borderTop: '1px solid #f5f5f5' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: '100%', alignItems: 'center' }}>
                    {showCourtButtons ? (
                      <>
                        <span style={{ fontSize: '10px', color: '#888', lineHeight: 'normal' }}>Assign to:</span>
                        {idleCourts.map(court => {
                          const isSelected = court.players.includes(player.id);
                          return (
                            <Button 
                              key={court.id} 
                              size="small" 
                              type={isSelected ? 'primary' : 'default'}
                              onClick={() => onToggleSelection(court.id, player.id)}
                              style={{ fontSize: '10px', height: '20px', padding: '0 8px', minWidth: '24px' }}
                            >
                              {court.name.replace('Court ', 'C')}
                            </Button>
                          );
                        })}
                      </>
                    ) : (
                      <span style={{ fontSize: '10px', color: '#ccc' }}>
                        {player.isPlaying ? 'Playing' : (!player.isActive ? 'Away' : 'No Courts')}
                      </span>
                    )}
                  </div>
                  
                  <Space size={0}>
                    <Button 
                      type="text" size="small" icon={<InfoCircleOutlined />} 
                      onClick={() => onViewPlayer(player.id)}
                      style={{ width: 22, height: 22, minWidth: 22, fontSize: '11px', color: '#1890ff' }}
                    />
                    <Dropdown 
                      menu={{ items: [
                        { 
                          key: 'toggle-active', 
                          label: player.isActive ? 'Set Away' : 'Set Active', 
                          icon: player.isActive ? <PauseCircleOutlined /> : <PlayCircleOutlined />,
                          onClick: () => onToggleActive(player.id),
                          disabled: player.isPlaying
                        },
                        { 
                        key: 'remove', 
                        label: 'Remove', 
                        danger: true, 
                        onClick: () => onRemovePlayer(player.id),
                        disabled: player.isPlaying
                      }] }} 
                      trigger={['click']}
                    >
                      <Button 
                        type="text" size="small" icon={<MoreOutlined />} 
                        style={{ width: 22, height: 22, minWidth: 22, fontSize: '11px', color: '#999' }}
                      />
                    </Dropdown>
                  </Space>
                </div>
              </div>
            </Col>
          );
        })}
      </Row>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {sortedPlayers.map(player => {
        const idleCourts = courts.filter(c => c.status === 'idle');
        const waitSeconds = getWaitDuration(player, sessionStartTime, currentTime);
        const waitColor = getWaitColor(waitSeconds);

        return (
          <div key={player.id} style={{ 
            display: 'flex', 
            flexDirection: 'column',
            padding: '6px 8px',
            background: player.isPlaying ? '#f6ffed' : (!player.isActive ? '#fafafa' : '#fff'),
            border: '1px solid #f0f0f0',
            borderRadius: '4px',
            opacity: !player.isActive ? 0.6 : 1
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <Avatar size={24} style={{ backgroundColor: LEVEL_COLORS[player.level], fontSize: '12px' }}>
                    {player.name[0]?.toUpperCase()}
                  </Avatar>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Text strong style={{ fontSize: '13px' }} ellipsis>{player.name}</Text>
                        {player.gender === 'Male' ? <ManOutlined style={{ fontSize: '10px', color: '#1890ff' }} /> : <WomanOutlined style={{ fontSize: '10px', color: '#eb2f96' }} />}
                     </div>
                     <div style={{ display: 'flex', gap: 6, fontSize: '10px', color: '#666', flexWrap: 'wrap', alignItems: 'center' }}>
                        <LevelTag level={player.level} style={{ transform: 'scale(0.8)', marginLeft: -4 }} />
                        <span>G: {player.gamesPlayed}</span>
                        <span>
                           <span style={{ color: '#389e0d', fontWeight: 600 }}>W{player.wins}</span>
                           <span style={{ margin: '0 2px' }}>-</span>
                           <span style={{ color: '#cf1322', fontWeight: 600 }}>L{player.losses}</span>
                        </span>
                        <span>Idle: {formatDuration(player.totalIdleTime + ((player.isPlaying || player.gamesPlayed === 0 || sessionStartTime === null) ? 0 : Math.floor((currentTime - Math.max(player.lastMatchEndTime, sessionStartTime))/1000)))}</span>
                     </div>
                  </div>
               </div>

               <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Tag 
                    style={{ margin: 0, fontSize: '10px', padding: '0 4px', color: waitColor ? '#fff' : undefined, border: 'none' }}
                    color={waitColor}
                  >
                     {getWaitTime(player, sessionStartTime, currentTime)}
                  </Tag>
                  <Button 
                     type="text" size="small" icon={<InfoCircleOutlined />} 
                     onClick={() => onViewPlayer(player.id)}
                     style={{ fontSize: '12px', color: '#1890ff', width: 24 }}
                  />
                  <Dropdown 
                    menu={{ items: [
                      { 
                        key: 'toggle-active', 
                        label: player.isActive ? 'Set Away' : 'Set Active', 
                        icon: player.isActive ? <PauseCircleOutlined /> : <PlayCircleOutlined />,
                        onClick: () => onToggleActive(player.id),
                        disabled: player.isPlaying
                      },
                      { 
                      key: 'remove', 
                      label: 'Remove', 
                      danger: true, 
                      onClick: () => onRemovePlayer(player.id),
                      disabled: player.isPlaying
                    }] }} 
                    trigger={['click']}
                  >
                    <Button 
                      type="text" size="small" icon={<MoreOutlined />} 
                      style={{ width: 24, height: 24, minWidth: 24, fontSize: '12px', color: '#999' }}
                    />
                  </Dropdown>
               </div>
            </div>

            <div style={{ marginTop: 6, paddingLeft: 32 }}>
               {player.isPlaying ? (
                  <Tag color="green" style={{ margin: 0, fontSize: '10px', padding: '0 4px' }}>Playing</Tag>
                ) : !player.isActive ? (
                  <Tag style={{ margin: 0, fontSize: '10px', padding: '0 4px' }}>Away</Tag>
                ) : (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {idleCourts.length > 0 ? (
                      <>
                        <span style={{ fontSize: '10px', color: '#888', lineHeight: 'normal' }}>Assign to:</span>
                        {idleCourts.map(court => {
                           const isSelected = court.players.includes(player.id);
                           return (
                             <Button 
                               key={court.id} 
                               size="small" 
                               type={isSelected ? 'primary' : 'default'}
                               onClick={() => onToggleSelection(court.id, player.id)}
                               style={{ fontSize: '10px', height: '20px', padding: '0 8px', minWidth: '24px' }}
                             >
                               {court.name.replace('Court ', 'C')}
                             </Button>
                           );
                         })}
                      </>
                    ) : (
                       <span style={{ fontSize: '10px', color: '#ccc' }}>No Courts</span>
                     )}
                  </div>
                )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PlayerList;
