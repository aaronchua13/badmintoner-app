import { Layout, Menu, MenuProps, message, Dropdown, Avatar, Typography, Badge, Button, Skeleton, theme } from 'antd';
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
  MenuUnfoldOutlined,
  MenuFoldOutlined,
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
  const [collapsed, setCollapsed] = useState(false);
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      const userType = localStorage.getItem('user_type');

      if (!token) {
        router.replace('/admin/login');
        return;
      }

      // Prevent Players from accessing Admin area
      if (userType === 'player') {
        // Do not clear token, just redirect to not-found to simulate non-existence
        // localStorage.removeItem('token');
        // localStorage.removeItem('user_type');
        // message.error('Access denied: You are logged in as a Player. Please log in as Admin.');
        router.replace('/not-found');
        return;
      }

      try {
        const profile = await api.get('/auth/profile', token) as UserProfile;
        setUser(profile);
        setAuthorized(true);
      } catch (error) {
        console.error('Authentication check failed:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user_type');
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        message.error(`Session expired or invalid: ${errorMessage}`);
        router.replace('/admin/login');
      }
    };

    checkAuth();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_type');
    router.push('/admin/login');
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
      <Layout style={{ minHeight: '100vh' }}>
         <Content style={{ padding: '50px' }}>
            <Skeleton active avatar paragraph={{ rows: 4 }} />
         </Content>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        breakpoint="lg"
        onBreakpoint={(broken) => {
          if (broken) setCollapsed(true);
        }}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 1001,
          boxShadow: '2px 0 8px 0 rgba(29,35,41,.05)',
        }}
        width={220}
      >
        <div style={{ 
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255, 255, 255, 0.1)',
          margin: '16px',
          borderRadius: '6px',
          overflow: 'hidden',
          transition: 'all 0.2s'
        }}>
           {collapsed ? (
             <span style={{ color: 'white', fontWeight: 'bold', fontSize: '18px' }}>B</span>
           ) : (
             <span style={{ color: 'white', fontWeight: 'bold', fontSize: '18px' }}>Badmintoner</span>
           )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[router.pathname]}
          items={menuItems}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 80 : 220, transition: 'all 0.2s' }}>
        <Header style={{ 
          padding: 0, 
          background: colorBgContainer, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          boxShadow: '0 1px 4px rgba(0,21,41,0.08)'
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: '16px',
              width: 64,
              height: 64,
            }}
          />
          
          <div style={{ display: 'flex', alignItems: 'center', marginRight: '24px', gap: '20px' }}>
            <Badge count={5} size="small">
               <Button type="text" icon={<BellOutlined />} style={{ fontSize: '18px' }} />
            </Badge>
            
            {user && (
              <Dropdown menu={{ items: userMenu }} placement="bottomRight" arrow={{ pointAtCenter: true }} trigger={['click']}>
                <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', transition: 'all 0.3s' }} className="user-dropdown">
                  <Avatar 
                    src={user.image} 
                    icon={<UserOutlined />} 
                    style={{ backgroundColor: '#1890ff', marginRight: '8px' }} 
                    size={32}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', marginRight: '8px', lineHeight: '1.2' }}>
                    <Text strong style={{ fontSize: '14px' }}>{user.first_name}</Text>
                    <Text type="secondary" style={{ fontSize: '11px', textTransform: 'capitalize' }}>{user.role || 'Admin'}</Text>
                  </div>
                  <DownOutlined style={{ fontSize: '10px', color: '#bfbfbf' }} />
                </div>
              </Dropdown>
            )}
          </div>
        </Header>
        <Content style={{ margin: '24px 16px 0', overflow: 'initial' }}>
          <div style={{ 
            padding: 24, 
            background: colorBgContainer, 
            minHeight: 'calc(100vh - 112px)', // Adjusted calculation
            borderRadius: borderRadiusLG
          }}>
            {children}
          </div>
        </Content>
        <Footer style={{ textAlign: 'center', background: 'transparent' }}>
          Badmintoner Admin ©{new Date().getFullYear()}
        </Footer>
      </Layout>
    </Layout>
  );
}
