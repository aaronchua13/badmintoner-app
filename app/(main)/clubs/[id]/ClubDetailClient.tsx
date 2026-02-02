'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Typography, Card, Space, Spin, Button, Tag, Divider, Row, Col, Segmented, Descriptions, Grid } from 'antd';
import {
  TeamOutlined,
  FacebookFilled,
  CalendarOutlined,
  EnvironmentOutlined,
  ArrowLeftOutlined,
  ClockCircleOutlined,
  UnorderedListOutlined,
  TableOutlined
} from '@ant-design/icons';
import Link from 'next/link';
import { getClubByIdAction } from '@/app/actions/club-event';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

export interface Club {
  id: string;
  _id?: string;
  name: string;
  contact_person_name: string;
  fb_link?: string;
  allowed_player_levels?: string[];
  established_date?: string;
  schedules: {
    id?: string;
    _id?: string;
    day: string;
    start_time: string;
    end_time: string;
    court?: {
      name: string;
      location: string;
    };
  }[];
}

interface ClubDetailClientProps {
  id: string;
  initialClub?: Club | null;
}

export default function ClubDetailClient({ id, initialClub }: ClubDetailClientProps) {
  const router = useRouter();
  const screens = useBreakpoint();
  const [club, setClub] = useState<Club | null>(initialClub || null);
  const [loading, setLoading] = useState(!initialClub);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  useEffect(() => {
    if (initialClub) return; // Skip fetch if we have initial data

    const fetchClub = async () => {
      if (!id) return;
      
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = await getClubByIdAction(id);
        setClub(data);
      } catch (error) {
        console.error('Failed to fetch club:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchClub();
  }, [id, initialClub]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!club) {
    return (
      <div style={{ textAlign: 'center', marginTop: '50px' }}>
        <Title level={3}>Club not found</Title>
        <Button type="primary" onClick={() => router.push('/clubs')}>Back to Clubs</Button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: screens.xs ? '12px 8px' : '24px 16px' }}>
      <Button 
        type="text" 
        icon={<ArrowLeftOutlined />} 
        onClick={() => router.push('/clubs')}
        style={{ marginBottom: '16px', paddingLeft: 0 }}
      >
        Back to Clubs
      </Button>

      <Card 
        variant="borderless" 
        style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
        styles={{ body: { padding: screens.xs ? '12px' : '24px' } }}
      >
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ 
            width: '80px', 
            height: '80px', 
            background: '#f0f2f5', 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <TeamOutlined style={{ fontSize: '40px', color: '#1890ff' }} />
          </div>
          <Title level={2} style={{ marginBottom: '16px', fontSize: screens.xs ? '24px' : '30px' }}>{club.name}</Title>
          
          <Descriptions bordered size="small" column={{ xs: 1, sm: 3 }} style={{ maxWidth: '800px', margin: '0 auto' }}>
            <Descriptions.Item label="In Charge">{club.contact_person_name || 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="Established">
              {club.established_date ? new Date(club.established_date).getFullYear() : 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Player Levels">
              {club.allowed_player_levels && club.allowed_player_levels.length > 0 ? (
                <Space size={4} wrap>
                  {club.allowed_player_levels.map(level => (
                    <Tag key={level} color="blue" style={{ margin: 0 }}>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </Tag>
                  ))}
                </Space>
              ) : 'All Levels'}
            </Descriptions.Item>
            <Descriptions.Item label="Social Media">
              {club.fb_link ? (
                <Link href={club.fb_link} target="_blank" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <FacebookFilled /> Facebook
                </Link>
              ) : 'N/A'}
            </Descriptions.Item>
          </Descriptions>
        </div>

        <Divider style={{ margin: screens.xs ? '12px 0' : '24px 0' }} />

        <Row gutter={[24, 24]}>
          <Col span={24}>
            <div style={{ 
              marginBottom: '16px', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: screens.xs ? 'stretch' : 'center',
              flexDirection: screens.xs ? 'column' : 'row',
              gap: screens.xs ? '12px' : '0'
            }}>
              <Space align="center" style={{ justifyContent: screens.xs ? 'center' : 'flex-start' }}>
                <CalendarOutlined style={{ fontSize: '20px', color: '#1890ff' }} />
                <Title level={4} style={{ margin: 0 }}>Weekly Schedules</Title>
              </Space>
              <Segmented
                block={screens.xs}
                options={[
                  { label: 'List', value: 'list', icon: <UnorderedListOutlined /> },
                  { label: 'Calendar', value: 'calendar', icon: <TableOutlined /> },
                ]}
                value={viewMode}
                onChange={(val) => setViewMode(val as 'list' | 'calendar')}
              />
            </div>

            {viewMode === 'list' ? (
              club.schedules && club.schedules.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {club.schedules.map((schedule, index) => (
                    <Card 
                      key={schedule.id || schedule._id || index} 
                      size="small" 
                      type="inner"
                      style={{ background: '#fafafa' }}
                      styles={{ body: { padding: '16px' } }}
                    >
                      <Row align="middle" gutter={[16, 16]}>
                        <Col xs={24} sm={8}>
                          <Tag color="blue" style={{ fontSize: '14px', padding: '4px 10px' }}>
                            {schedule.day}
                          </Tag>
                        </Col>
                        <Col xs={24} sm={16}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                            <Space>
                              <ClockCircleOutlined style={{ color: '#fa8c16' }} />
                              <Text strong>{schedule.start_time} - {schedule.end_time}</Text>
                            </Space>
                            {schedule.court && (
                              <Space align="start">
                                <EnvironmentOutlined style={{ color: '#52c41a', marginTop: '4px' }} />
                                <div>
                                  <Text strong style={{ display: 'block' }}>{schedule.court.name}</Text>
                                  <Text type="secondary" style={{ fontSize: '12px' }}>{schedule.court.location}</Text>
                                </div>
                              </Space>
                            )}
                          </div>
                        </Col>
                      </Row>
                    </Card>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '32px 0', background: '#fafafa', borderRadius: '8px' }}>
                  <Text type="secondary">No schedules available</Text>
                </div>
              )
            ) : (
              <div style={{ padding: '24px', background: '#fafafa', borderRadius: '8px', textAlign: 'center' }}>
                <Text type="secondary">Calendar view is coming soon!</Text>
              </div>
            )}
          </Col>
        </Row>
      </Card>
    </div>
  );
}
