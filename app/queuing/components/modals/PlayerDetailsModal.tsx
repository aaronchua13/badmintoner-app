import React from 'react';
import { Modal, Descriptions, Select, Radio, Space, Tabs, Statistic, Row, Col, List, Tag } from 'antd';
import { ManOutlined, WomanOutlined, TrophyOutlined, FireOutlined } from '@ant-design/icons';
import { Player, PlayerLevel, LEVEL_COLORS, MatchHistory } from '../../types';
import { formatDuration } from '../../utils';
import LevelTag from '../LevelTag';

interface PlayerDetailsModalProps {
  visible: boolean;
  onCancel: () => void;
  player: Player | undefined;
  players: Player[];
  history: MatchHistory[];
  onUpdateLevel: (id: string, level: PlayerLevel) => void;
  onUpdateGender: (id: string, gender: 'Male' | 'Female') => void;
}

const PlayerDetailsModal: React.FC<PlayerDetailsModalProps> = ({
  visible,
  onCancel,
  player,
  players,
  history = [],
  onUpdateLevel,
  onUpdateGender
}) => {
  if (!player) return null;

  const playerHistory = history.filter(h => h.players.some(p => p.id === player.id)).reverse();
  const winRate = player.gamesPlayed > 0 ? Math.round((player.wins / player.gamesPlayed) * 100) : 0;

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{player.name}</span>
          <LevelTag level={player.level} />
        </div>
      }
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={600}
    >
      <Tabs
        defaultActiveKey="overview"
        items={[
          {
            key: 'overview',
            label: 'Overview',
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Row gutter={16}>
                  <Col span={8}>
                    <Statistic title="Games" value={player.gamesPlayed} prefix={<FireOutlined />} />
                  </Col>
                  <Col span={8}>
                    <Statistic 
                      title="Win Rate" 
                      value={winRate} 
                      suffix="%" 
                      prefix={<TrophyOutlined />}
                      valueStyle={{ color: winRate > 50 ? '#3f8600' : '#cf1322' }} 
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic title="Wins/Losses" value={`${player.wins} / ${player.losses}`} />
                  </Col>
                </Row>

                <Descriptions column={1} bordered size="small" layout="horizontal">
                  <Descriptions.Item label="Level">
                    <Select 
                      value={player.level} 
                      onChange={(val) => onUpdateLevel(player.id, val)}
                      style={{ width: '100%' }}
                      size="small"
                    >
                       {(Object.keys(LEVEL_COLORS) as PlayerLevel[]).map(level => (
                         <Select.Option key={level} value={level}>
                           <Space>
                             <LevelTag level={level} />
                             {level}
                           </Space>
                         </Select.Option>
                       ))}
                    </Select>
                  </Descriptions.Item>
                  <Descriptions.Item label="Gender">
                     <Radio.Group 
                       value={player.gender} 
                       onChange={e => onUpdateGender(player.id, e.target.value)}
                       size="small"
                       buttonStyle="solid"
                     >
                        <Radio.Button value="Male"><ManOutlined /> Male</Radio.Button>
                        <Radio.Button value="Female"><WomanOutlined /> Female</Radio.Button>
                     </Radio.Group>
                  </Descriptions.Item>
                  <Descriptions.Item label="Total Idle Time">{formatDuration(player.totalIdleTime)}</Descriptions.Item>
                  <Descriptions.Item label="Joined At">{new Date(player.joinedAt).toLocaleTimeString()}</Descriptions.Item>
                  <Descriptions.Item label="Best Partners">
                     {Object.entries(player.partners).length > 0 ? (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                           {Object.entries(player.partners)
                             .sort(([,a], [,b]) => b - a)
                             .slice(0, 5)
                             .map(([pid, count]) => (
                               <Tag key={pid} style={{ margin: 0 }}>
                                  {players.find(p => p.id === pid)?.name}: {count}
                               </Tag>
                             ))}
                        </div>
                     ) : 'None'}
                  </Descriptions.Item>
                </Descriptions>
              </div>
            )
          },
          {
            key: 'matches',
            label: `Matches (${playerHistory.length})`,
            children: (
              <List
                size="small"
                itemLayout="horizontal"
                dataSource={playerHistory}
                pagination={{ pageSize: 5 }}
                renderItem={(item) => {
                  const playerTeam = item.players.find(p => p.id === player.id)?.team;
                  const isWinner = item.winners === playerTeam;
                  
                  return (
                    <List.Item>
                      <List.Item.Meta
                        avatar={
                          <Tag color={isWinner ? 'green' : 'red'}>
                            {isWinner ? 'WON' : 'LOST'}
                          </Tag>
                        }
                        title={
                          <Space>
                            <span>{new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <Tag>{formatDuration(item.duration)}</Tag>
                          </Space>
                        }
                        description={
                          <div style={{ fontSize: '12px' }}>
                            <div>
                              Team 1: {item.players.filter(p => p.team === 1).map(p => p.name).join(', ')}
                            </div>
                            <div>
                              Team 2: {item.players.filter(p => p.team === 2).map(p => p.name).join(', ')}
                            </div>
                          </div>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            )
          }
        ]}
      />
    </Modal>
  );
};

export default PlayerDetailsModal;
