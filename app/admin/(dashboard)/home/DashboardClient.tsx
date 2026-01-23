'use client';

import { Typography, Card, Row, Col } from 'antd';
import { UserOutlined, TeamOutlined, CalendarOutlined, TrophyOutlined } from '@ant-design/icons';
import Link from 'next/link';

const { Title } = Typography;

interface DashboardStats {
    usersCount: number;
    clubsCount: number;
    eventsCount: number;
    playersCount: number;
}

export default function AdminDashboardClient({ stats }: { stats: DashboardStats }) {
  const statItems = [
    {
      title: 'Total Users',
      value: stats.usersCount,
      icon: <UserOutlined style={{ fontSize: '24px', color: '#1890ff' }} />,
      color: '#e6f7ff',
      link: '/admin/users'
    },
    {
      title: 'Total Clubs',
      value: stats.clubsCount,
      icon: <TeamOutlined style={{ fontSize: '24px', color: '#52c41a' }} />,
      color: '#f6ffed',
      link: '/admin/clubs'
    },
    {
      title: 'Total Events',
      value: stats.eventsCount,
      icon: <CalendarOutlined style={{ fontSize: '24px', color: '#fa8c16' }} />,
      color: '#fff7e6',
      link: '/admin/events'
    },
    {
      title: 'Total Players',
      value: stats.playersCount,
      icon: <TrophyOutlined style={{ fontSize: '24px', color: '#eb2f96' }} />,
      color: '#fff0f6',
      link: '/admin/players'
    },
  ];

  return (
    <>
      <Title level={2} style={{ marginBottom: '24px' }}>Dashboard</Title>
      
      <Row gutter={[24, 24]}>
        {statItems.map((stat, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Link href={stat.link} style={{ display: 'block' }}>
              <Card 
                variant="borderless" 
                hoverable 
                style={{ 
                  borderRadius: '8px',
                  height: '100%'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ 
                    padding: '12px', 
                    borderRadius: '50%', 
                    background: stat.color,
                    marginRight: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {stat.icon}
                  </div>
                  <div>
                    <div style={{ color: '#8c8c8c', fontSize: '14px' }}>{stat.title}</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stat.value}</div>
                  </div>
                </div>
              </Card>
            </Link>
          </Col>
        ))}
      </Row>
    </>
  );
}
