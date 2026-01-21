import { Layout, Menu, MenuProps, message, Spin, Dropdown, Avatar, Space, Typography, Badge, Button } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  TeamOutlined,
  CalendarOutlined,
  TrophyOutlined,
  LogoutOutlined,
  DownOutlined,
  BellOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ReactNode, useEffect, useState } from 'react';
import { api } from '@/utils/api';

const { Header, Content, Footer, Sider } = Layout;
const { Text } = Typography;

interface AdminLayoutProps {
  children: ReactNode;
}

interface UserProfile {
  first_name: string;
  last_name: string;
  email: string;
  image?: string;
  role?: string;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.replace('/signin');
        return;
      }

      try {
        const profile = await api.get('/auth/profile', token) as UserProfile;
        setUser(profile);
        setAuthorized(true);
      } catch (error) {
        localStorage.removeItem('token');
        message.error('Session expired or invalid. Please sign in again.');
        router.replace('/signin');
      }
    };

    checkAuth();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/signin');
  };

  const userMenu: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile',
      onClick: () => router.push('/admin/home'),
    },
    {
      key: 'home-page',
      icon: <HomeOutlined />,
      label: 'Home page',
      onClick: () => router.push('/'),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      danger: true,
      onClick: handleLogout,
    },
  ];

  const menuItems: MenuProps['items'] = [
    {
      key: '/admin/home',
      icon: <DashboardOutlined />,
      label: <Link href="/admin/home">Dashboard</Link>,
    },
    {
      key: '/admin/users',
      icon: <UserOutlined />,
      label: <Link href="/admin/users">Users</Link>,
    },
    {
      key: '/admin/clubs',
      icon: <TeamOutlined />,
      label: <Link href="/admin/clubs">Clubs</Link>,
    },
    {
      key: '/admin/events',
      icon: <CalendarOutlined />,
      label: <Link href="/admin/events">Events</Link>,
    },
    {
      key: '/admin/players',
      icon: <TrophyOutlined />,
      label: <Link href="/admin/players">Players</Link>,
    },
  ];

  if (!authorized) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Spin size="large" tip="Verifying session..." />
      </div>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        breakpoint="lg"
        collapsedWidth="0"
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
      >
        <div style={{ 
          color: 'white', 
          fontSize: '18px', 
          fontWeight: 'bold', 
          padding: '16px',
          textAlign: 'center'
        }}>
          Admin Panel
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[router.pathname]}
          items={menuItems}
        />
      </Sider>
      <Layout style={{ marginLeft: 200 }}>
        <Header style={{ padding: '0 24px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,21,41,0.08)', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>Badmintoner Admin</h2>
          </div>
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <Dropdown menu={{ items: userMenu }} placement="bottomRight" arrow={{ pointAtCenter: true }} trigger={['click']}>
                <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '4px 0', transition: 'all 0.3s' }}>
                  <Avatar 
                    src={user.image} 
                    icon={<UserOutlined />} 
                    style={{ backgroundColor: '#1890ff', marginRight: '12px', border: '2px solid #e6f7ff' }} 
                    size={40}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', marginRight: '12px', lineHeight: '1.3' }}>
                    <Text strong style={{ fontSize: '14px', color: '#262626' }}>{user.first_name} {user.last_name}</Text>
                    <Text style={{ fontSize: '12px', color: '#8c8c8c', textTransform: 'capitalize' }}>{user.role || 'Admin'}</Text>
                  </div>
                  <DownOutlined style={{ fontSize: '12px', color: '#bfbfbf' }} />
                </div>
              </Dropdown>
            </div>
          )}
        </Header>
        <Content style={{ margin: '24px 16px 0', overflow: 'initial' }}>
          <div style={{ padding: 24, background: '#fff', minHeight: 'calc(100vh - 134px)' }}>
            {children}
          </div>
        </Content>
        <Footer style={{ textAlign: 'center' }}>
          Badmintoner Admin ©{new Date().getFullYear()}
        </Footer>
      </Layout>
    </Layout>
  );
}
