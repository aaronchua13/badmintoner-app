import AdminLayout from '@/layouts/AdminLayout';
import { Typography, Card, Row, Col, Skeleton, List, Avatar } from 'antd';
import { UserOutlined, TeamOutlined, CalendarOutlined, TrophyOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/utils/api';
import Link from 'next/link';

const { Title, Text } = Typography;

interface DashboardUser {
  first_name: string;
  last_name: string;
  email: string;
}

export default function AdminHome() {
  // Fetch Users
  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      return api.get<DashboardUser[]>('/users', token || undefined);
    },
  });

  // Placeholder queries for other entities - assuming standard REST endpoints
  const { data: clubs = [], isLoading: isLoadingClubs } = useQuery({
    queryKey: ['clubs'],
    queryFn: async () => {
       // Mocking or waiting for API
       // const token = localStorage.getItem('token');
       // return api.get<any[]>('/clubs', token || undefined);
       return [];
    },
    enabled: false // Disable until API is ready
  });

  const { data: events = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
       return [];
    },
    enabled: false
  });

  const { data: players = [], isLoading: isLoadingPlayers } = useQuery({
    queryKey: ['players'],
    queryFn: async () => {
       return [];
    },
    enabled: false
  });

  const stats = [
    {
      title: 'Total Users',
      value: users.length,
      icon: <UserOutlined style={{ fontSize: '24px', color: '#1890ff' }} />,
      color: '#e6f7ff',
      loading: isLoadingUsers,
      link: '/admin/users'
    },
    {
      title: 'Total Clubs',
      value: clubs.length,
      icon: <TeamOutlined style={{ fontSize: '24px', color: '#52c41a' }} />,
      color: '#f6ffed',
      loading: isLoadingClubs,
      link: '/admin/clubs'
    },
    {
      title: 'Total Events',
      value: events.length,
      icon: <CalendarOutlined style={{ fontSize: '24px', color: '#fa8c16' }} />,
      color: '#fff7e6',
      loading: isLoadingEvents,
      link: '/admin/events'
    },
    {
      title: 'Total Players',
      value: players.length,
      icon: <TrophyOutlined style={{ fontSize: '24px', color: '#eb2f96' }} />,
      color: '#fff0f6',
      loading: isLoadingPlayers,
      link: '/admin/players'
    },
  ];

  return (
    <AdminLayout>
      <Title level={2} style={{ marginBottom: '24px' }}>Dashboard</Title>
      
      <Row gutter={[24, 24]}>
        {stats.map((stat, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Link href={stat.link} style={{ display: 'block' }}>
              <Card 
                bordered={false} 
                hoverable 
                style={{ 
                  borderRadius: '8px', 
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  height: '100%'
                }}
                bodyStyle={{ padding: '24px' }}
              >
                <Skeleton loading={stat.loading} active paragraph={{ rows: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <Text type="secondary" style={{ fontSize: '14px' }}>{stat.title}</Text>
                      <div style={{ fontSize: '28px', fontWeight: 'bold', marginTop: '4px', lineHeight: 1 }}>
                        {stat.value}
                      </div>
                    </div>
                    <div style={{ 
                      width: '48px', 
                      height: '48px', 
                      borderRadius: '12px', 
                      background: stat.color, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center' 
                    }}>
                      {stat.icon}
                    </div>
                  </div>
                  {/* Mock Trend */}
                  <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', fontSize: '12px' }}>
                    <span style={{ color: '#52c41a', display: 'flex', alignItems: 'center', marginRight: '8px' }}>
                      <ArrowUpOutlined style={{ marginRight: '4px' }} /> 12%
                    </span>
                    <Text type="secondary">since last month</Text>
                  </div>
                </Skeleton>
              </Card>
            </Link>
          </Col>
        ))}
      </Row>

      <Row gutter={[24, 24]} style={{ marginTop: '24px' }}>
        <Col xs={24} lg={16}>
          <Card 
            title={<Title level={4} style={{ margin: 0 }}>Recent Users</Title>} 
            bordered={false}
            style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
          >
             <List
                loading={isLoadingUsers}
                itemLayout="horizontal"
                dataSource={users.slice(0, 5)}
              renderItem={(item: DashboardUser) => (
                <List.Item>
                  <List.Item.Meta
                      avatar={<Avatar style={{ backgroundColor: '#1890ff' }}>{item.first_name?.[0]}{item.last_name?.[0]}</Avatar>}
                      title={<Text strong>{item.first_name} {item.last_name}</Text>}
                      description={item.email}
                    />
                    <div>
                       <Text type="secondary" style={{ fontSize: '12px' }}>
                         {new Date().toLocaleDateString()} {/* Mock date since we might not have createdAt */}
                       </Text>
                    </div>
                  </List.Item>
                )}
             />
             <div style={{ marginTop: '16px', textAlign: 'center' }}>
               <Link href="/admin/users">View All Users</Link>
             </div>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card 
            title={<Title level={4} style={{ margin: 0 }}>Quick Actions</Title>} 
            bordered={false}
            style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Link href="/admin/users">
                 <div style={{ padding: '12px', background: '#f5f5f5', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.3s' }} className="quick-action">
                    <Text strong><UserOutlined style={{ marginRight: '8px' }} /> Add New User</Text>
                 </div>
              </Link>
              <Link href="/admin/clubs">
                 <div style={{ padding: '12px', background: '#f5f5f5', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.3s' }} className="quick-action">
                    <Text strong><TeamOutlined style={{ marginRight: '8px' }} /> Create Club</Text>
                 </div>
              </Link>
              <Link href="/admin/events">
                 <div style={{ padding: '12px', background: '#f5f5f5', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.3s' }} className="quick-action">
                    <Text strong><CalendarOutlined style={{ marginRight: '8px' }} /> Schedule Event</Text>
                 </div>
              </Link>
            </div>
          </Card>
          
          <Card 
             style={{ marginTop: '24px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)', color: 'white' }}
             bordered={false}
          >
             <Title level={4} style={{ color: 'white', margin: 0 }}>Pro Tip</Title>
             <p style={{ marginTop: '8px', opacity: 0.9 }}>
               You can manage user roles and permissions directly from the Users page. Keep your platform secure!
             </p>
          </Card>
        </Col>
      </Row>
    </AdminLayout>
  );
}
