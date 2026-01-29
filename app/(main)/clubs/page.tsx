'use client';

import { Typography, Card, Row, Col, Space, Spin, Pagination, Button } from 'antd';
import {
  TeamOutlined,
  CalendarOutlined,
  UserOutlined,
  EnvironmentOutlined,
  FacebookFilled,
  EyeOutlined
} from '@ant-design/icons';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getClubsAction } from '@/app/actions/club-event';

const { Title, Text } = Typography;
const { Meta } = Card;

interface Club {
  id: string;
  _id?: string;
  name: string;
  contact_person_name: string;
  fb_link?: string;
  schedules: {
    day: string;
    start_time: string;
    end_time: string;
    court?: {
      name: string;
      location: string;
    };
  }[];
}

export default function ClubsPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    const fetchClubs = async () => {
      setLoading(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: any = await getClubsAction(currentPage, pageSize);
        if (result && result.data) {
          setClubs(result.data);
          setTotal(result.total);
        } else {
          setClubs([]);
          setTotal(0);
        }
      } catch (error) {
        console.error('Failed to fetch clubs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchClubs();
  }, [currentPage]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <Title level={1} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', fontSize: '1.8rem' }}>
          <TeamOutlined style={{ color: '#1890ff' }} />
          Badminton Clubs
        </Title>
        <Text type="secondary" style={{ fontSize: '16px' }}>
          Find the perfect club to join and play
        </Text>
      </div>

      <Row gutter={[16, 16]}>
        {clubs.map((club) => (
          <Col xs={24} sm={12} lg={8} key={club.id || club._id}>
            <Card
              hoverable
              cover={
                <div style={{ height: '200px', overflow: 'hidden', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   <TeamOutlined style={{ fontSize: '64px', color: '#ccc' }} />
                </div>
              }
              actions={[
                <Link href={`/clubs/${club.id || club._id}`} key="view" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                   <EyeOutlined /> View Details
                </Link>,
                ...(club.fb_link ? [
                  <Link href={club.fb_link} target="_blank" key="facebook" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', color: '#1877F2' }}>
                     <FacebookFilled /> Facebook
                  </Link>
                ] : [])
              ]}
              style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
              styles={{ body: { flex: 1, padding: '12px' } }}
            >
              <Meta
                title={
                  <div style={{ textAlign: 'center', marginBottom: '12px', fontSize: '1.2em' }}>
                    <Link href={`/clubs/${club.id || club._id}`} style={{ color: 'inherit' }}>
                      {club.name}
                    </Link>
                  </div>
                }
                description={
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    <div style={{ textAlign: 'center' }}>
                      <Space>
                        <UserOutlined style={{ color: '#1890ff' }} />
                        <Text type="secondary">In Charge:</Text>
                        <Text strong>{club.contact_person_name}</Text>
                      </Space>
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <CalendarOutlined style={{ color: '#1890ff' }} />
                        <Text strong>Schedules:</Text>
                      </div>
                      {club.schedules && club.schedules.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {club.schedules.map((schedule, index) => (
                            <div key={index} style={{ 
                              padding: '8px', 
                              background: '#f9f9f9', 
                              borderRadius: '4px',
                              border: '1px solid #f0f0f0',
                              fontSize: '0.9em'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <Text strong style={{ color: '#1890ff' }}>{schedule.day}</Text>
                                <Text type="secondary">{schedule.start_time} - {schedule.end_time}</Text>
                              </div>
                              {schedule.court && (
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                                  <EnvironmentOutlined style={{ marginTop: '3px', color: '#52c41a' }} />
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <Text strong>{schedule.court.name}</Text>
                                    <Text type="secondary" style={{ fontSize: '0.85em' }}>{schedule.court.location}</Text>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Text type="secondary" italic>No schedules available</Text>
                      )}
                    </div>

                  </div>
                }
              />
            </Card>
          </Col>
        ))}
      </Row>

      <div style={{ marginTop: '32px', textAlign: 'center' }}>
        <Pagination
          current={currentPage}
          total={total}
          pageSize={pageSize}
          onChange={(page) => setCurrentPage(page)}
          showSizeChanger={false}
        />
      </div>
    </div>
  );
}
