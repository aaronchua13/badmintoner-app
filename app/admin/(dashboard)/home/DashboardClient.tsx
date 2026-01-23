'use client';

import {
  Typography,
  Card,
  Row,
  Col,
  Button,
  Avatar,
  Tabs,
  Statistic,
  theme,
} from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  CalendarOutlined,
  TrophyOutlined,
  PlusOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const { Title, Text } = Typography;

interface DashboardStats {
  usersCount: number;
  clubsCount: number;
  eventsCount: number;
  playersCount: number;
}

interface User {
  first_name?: string;
  last_name?: string;
  email?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface Club {
  name: string;
  location?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface Event {
  name?: string;
  title?: string;
  start_date: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface Player {
  first_name?: string;
  last_name?: string;
  email?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface AdminDashboardClientProps {
  stats: DashboardStats;
  recentUsers: User[];
  recentClubs: Club[];
  recentEvents: Event[];
  recentPlayers: Player[];
}

export default function AdminDashboardClient({
  stats,
  recentUsers,
  recentClubs,
  recentEvents,
  recentPlayers,
}: AdminDashboardClientProps) {
  const router = useRouter();
  const {
    token: { borderRadiusLG },
  } = theme.useToken();

  const statItems = [
    {
      title: 'Total Users',
      value: stats.usersCount,
      icon: <UserOutlined style={{ fontSize: '24px', color: '#1890ff' }} />,
      color: '#e6f7ff',
      link: '/admin/users',
      bgColor: '#fff',
    },
    {
      title: 'Total Clubs',
      value: stats.clubsCount,
      icon: <TeamOutlined style={{ fontSize: '24px', color: '#52c41a' }} />,
      color: '#f6ffed',
      link: '/admin/clubs',
      bgColor: '#fff',
    },
    {
      title: 'Total Events',
      value: stats.eventsCount,
      icon: <CalendarOutlined style={{ fontSize: '24px', color: '#fa8c16' }} />,
      color: '#fff7e6',
      link: '/admin/events',
      bgColor: '#fff',
    },
    {
      title: 'Total Players',
      value: stats.playersCount,
      icon: <TrophyOutlined style={{ fontSize: '24px', color: '#eb2f96' }} />,
      color: '#fff0f6',
      link: '/admin/players',
      bgColor: '#fff',
    },
  ];

  const quickActions = [
    {
      label: 'Add User',
      icon: <UserOutlined />,
      action: () => router.push('/admin/users'),
    },
    {
      label: 'Add Club',
      icon: <TeamOutlined />,
      action: () => router.push('/admin/clubs'),
    },
    {
      label: 'Create Event',
      icon: <CalendarOutlined />,
      action: () => router.push('/admin/events'),
    },
    {
      label: 'Add Player',
      icon: <TrophyOutlined />,
      action: () => router.push('/admin/players'),
    },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderList = (
    data: any[],
    type: 'user' | 'club' | 'event' | 'player',
  ) => {
    if (!data || data.length === 0) {
      return (
        <div
          style={{
            textAlign: 'center',
            padding: '16px',
            color: 'rgba(0,0,0,0.45)',
          }}
        >
          No data
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {data.map((item, index) => {
          let title = '';
          let description = '';
          let avatarIcon = null;

          switch (type) {
            case 'user':
              title = `${item.first_name || ''} ${item.last_name || ''}`;
              description = item.email;
              avatarIcon = <UserOutlined />;
              break;
            case 'club':
              title = item.name;
              description = item.location || 'No location';
              avatarIcon = <TeamOutlined />;
              break;
            case 'event':
              title = item.name || item.title;
              description = new Date(item.start_date).toLocaleDateString();
              avatarIcon = <CalendarOutlined />;
              break;
            case 'player':
              title = `${item.first_name || ''} ${item.last_name || ''}`;
              description = item.email;
              avatarIcon = <TrophyOutlined />;
              break;
          }

          return (
            <div
              key={item.id || item._id || index}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 0',
                borderBottom:
                  index !== data.length - 1 ? '1px solid #f0f0f0' : 'none',
              }}
            >
              <Avatar
                icon={avatarIcon}
                style={{
                  backgroundColor: '#f0f2f5',
                  color: '#1890ff',
                  marginRight: 16,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ marginBottom: 4 }}>
                  <Text
                    strong
                    style={{
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {title}
                  </Text>
                </div>
                <div
                  style={{
                    color: 'rgba(0, 0, 0, 0.45)',
                    fontSize: '14px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {description}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const tabItems = [
    {
      key: '1',
      label: 'Recent Users',
      children: renderList(recentUsers, 'user'),
    },
    {
      key: '2',
      label: 'Recent Clubs',
      children: renderList(recentClubs, 'club'),
    },
    {
      key: '3',
      label: 'Recent Events',
      children: renderList(recentEvents, 'event'),
    },
    {
      key: '4',
      label: 'Recent Players',
      children: renderList(recentPlayers, 'player'),
    },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0 }}>
            Dashboard
          </Title>
          <Text type='secondary'>Welcome to the Badmintoner Admin Panel</Text>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            type='primary'
            icon={<PlusOutlined />}
            onClick={() => router.push('/admin/events')}
          >
            Create Event
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {statItems.map((stat, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Link href={stat.link} style={{ display: 'block', height: '100%' }}>
              <Card
                variant='borderless'
                hoverable
                style={{
                  borderRadius: borderRadiusLG,
                  height: '100%',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}
                >
                  <Statistic
                    title={stat.title}
                    value={stat.value}
                    styles={{ content: { fontWeight: 'bold' } }}
                  />
                  <div
                    style={{
                      padding: '12px',
                      borderRadius: '12px',
                      background: stat.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {stat.icon}
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 16,
                    display: 'flex',
                    alignItems: 'center',
                    color: '#1890ff',
                    fontSize: 12,
                  }}
                >
                  View Details <ArrowRightOutlined style={{ marginLeft: 4 }} />
                </div>
              </Card>
            </Link>
          </Col>
        ))}
      </Row>

      <Row gutter={[24, 24]}>
        {/* Recent Activity */}
        <Col xs={24} lg={16}>
          <Card
            title='Recent Activity'
            variant='borderless'
            style={{
              borderRadius: borderRadiusLG,
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            }}
          >
            <Tabs defaultActiveKey='1' items={tabItems} />
          </Card>
        </Col>

        {/* Quick Actions */}
        <Col xs={24} lg={8}>
          <Card
            title='Quick Actions'
            variant='borderless'
            style={{
              borderRadius: borderRadiusLG,
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              height: '100%',
            }}
          >
            <Row gutter={[16, 16]}>
              {quickActions.map((action, idx) => (
                <Col span={12} key={idx}>
                  <Button
                    block
                    style={{
                      height: 80,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                    onClick={action.action}
                  >
                    {action.icon}
                    {action.label}
                  </Button>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
}