import { Layout, Menu, MenuProps, message, Spin } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  TeamOutlined,
  CalendarOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ReactNode, useEffect, useState } from 'react';
import { api } from '@/utils/api';

const { Header, Content, Footer, Sider } = Layout;

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.replace('/signin');
        return;
      }

      try {
        console.log('######token: ', token);
        await api.get('/auth/user-session', token);
        setAuthorized(true);
      } catch (error) {
        localStorage.removeItem('token');
        message.error('Session expired or invalid. Please sign in again.');
        router.replace('/signin');
      }
    };

    checkAuth();
  }, [router]);

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
        <Header style={{ padding: '0 24px', background: '#fff', display: 'flex', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Badmintoner Administration</h2>
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
