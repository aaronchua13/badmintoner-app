'use client';

import { Layout, Menu, MenuProps, Dropdown, Avatar, Typography, theme, Button, App } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  TeamOutlined,
  CalendarOutlined,
  TrophyOutlined,
  LogoutOutlined,
  DownOutlined,
  HomeOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { logoutAction } from '@/app/actions/auth';
import { useState } from 'react';

const { Header, Content, Sider } = Layout;
const { Text } = Typography;

interface UserProfile {
  first_name: string;
  last_name: string;
  email: string;
  image?: string;
  role?: string;
  [key: string]: unknown;
}

interface AdminLayoutClientProps {
  children: React.ReactNode;
  user: UserProfile | null;
}

export default function AdminLayoutClient({ children, user }: AdminLayoutClientProps) {
  const router = useRouter();
  const { message } = App.useApp();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const handleLogout = async () => {
    await logoutAction();
    message.success('Logged out successfully');
    window.location.href = '/';
  };

  const userMenu: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile',
      onClick: () => router.push('/admin/home'), // Adjust if there is a specific profile page
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

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        breakpoint="lg"
        collapsedWidth="0"
        onBreakpoint={(broken) => {
            if (broken) setCollapsed(true);
        }}
      >
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {collapsed ? (
                <TrophyOutlined style={{ fontSize: '24px', color: 'white' }} />
            ) : (
                <Text strong style={{ color: 'white', fontSize: '18px', whiteSpace: 'nowrap' }}>
                     Badmintoner
                </Text>
            )}
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[pathname]} items={menuItems} />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
          <div style={{ paddingRight: 24 }}>
            <Dropdown menu={{ items: userMenu }} trigger={['click']}>
                <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Avatar icon={<UserOutlined />} src={user?.image} />
                <Text strong>{user?.first_name} {user?.last_name}</Text>
                <DownOutlined style={{ fontSize: '12px' }} />
                </div>
            </Dropdown>
          </div>
        </Header>
        <Content style={{ margin: '24px 16px 0' }}>
          <div
            style={{
              padding: 24,
              minHeight: 360,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            {children}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
