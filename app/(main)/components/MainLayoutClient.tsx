'use client';

import { Layout, Menu, MenuProps, Button, Dropdown, Avatar, Space, Typography, Grid, Drawer, App } from 'antd';
import { HomeOutlined, TeamOutlined, CalendarOutlined, LoginOutlined, UserOutlined, LogoutOutlined, DownOutlined, MenuOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/app/actions/auth';
import { useState, useEffect } from 'react';

const { Header, Content, Footer } = Layout;
const { Text } = Typography;
const { useBreakpoint } = Grid;

interface UserProfile {
  first_name: string;
  last_name: string;
  email: string;
  image?: string;
  role?: string;
  [key: string]: unknown;
}

interface MainLayoutClientProps {
  children: React.ReactNode;
  user: UserProfile | null;
}

export default function MainLayoutClient({ children, user }: MainLayoutClientProps) {
  const pathname = usePathname();
  const { message } = App.useApp();
  const screens = useBreakpoint();
  const [drawerVisible, setDrawerVisible] = useState(false);
  // Fix hydration mismatch by only rendering responsive parts after mount
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line
    setMounted(true);
  }, []);

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
      onClick: () => {
          if (user?.role === 'admin') {
              window.location.href = '/admin/home';
          } else {
              window.location.href = '/player/profile';
          }
      },
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
      key: '/',
      icon: <HomeOutlined />,
      label: <Link href="/">Home</Link>,
    },
    {
      key: '/club',
      icon: <TeamOutlined />,
      label: <Link href="/club">Club</Link>,
    },
    {
      key: '/event',
      icon: <CalendarOutlined />,
      label: <Link href="/event">Event</Link>,
    },
  ];

  // Mobile check
  const isMobile = !screens.md;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ 
        position: 'sticky', 
        top: 0, 
        zIndex: 1, 
        width: '100%', 
        display: 'flex', 
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#fff',
        boxShadow: '0 2px 8px #f0f1f2',
        padding: isMobile ? '0 16px' : '0 50px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div className="logo" style={{ 
            fontSize: '24px', 
            fontWeight: 'bold', 
            marginRight: isMobile ? '0' : '48px',
            color: '#1890ff'
          }}>
            <Link href="/" style={{ color: 'inherit' }}>Badmintoner</Link>
          </div>
          
          {mounted && !isMobile && (
            <Menu
              mode="horizontal"
              selectedKeys={[pathname]}
              items={menuItems}
              style={{ borderBottom: 'none', minWidth: '300px' }}
            />
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          {mounted && isMobile ? (
            <Button 
                type="text" 
                icon={<MenuOutlined />} 
                onClick={() => setDrawerVisible(true)}
                style={{ fontSize: '18px' }}
            />
          ) : (
             mounted && (user ? (
                <Dropdown menu={{ items: userMenu }} placement="bottomRight" arrow>
                  <Space style={{ cursor: 'pointer' }}>
                    <Avatar src={user.image} icon={<UserOutlined />} />
                    <span style={{ color: '#000' }}>{user.first_name}</span>
                    <DownOutlined style={{ fontSize: '12px', color: '#999' }} />
                  </Space>
                </Dropdown>
              ) : (
                <Space>
                  <Link href="/player/login">
                    <Button type="text" icon={<LoginOutlined />}>Login</Button>
                  </Link>
                  <Link href="/player/signup">
                    <Button type="primary">Sign Up</Button>
                  </Link>
                </Space>
              ))
          )}
        </div>
      </Header>

      <Content className="site-layout" style={{ padding: isMobile ? '16px' : '24px 50px', marginTop: '16px' }}>
        <div style={{ minHeight: 380 }}>
            {children}
        </div>
      </Content>

      <Footer style={{ textAlign: 'center' }}>
        Badmintoner ©{new Date().getFullYear()} Created with Ant Design
      </Footer>

      {/* Mobile Drawer */}
      <Drawer
        title="Menu"
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        styles={{ wrapper: { width: 250 } }}
      >
        <Menu
            mode="vertical"
            selectedKeys={[pathname]}
            items={menuItems}
            style={{ borderRight: 'none', marginBottom: '24px' }}
            onClick={() => setDrawerVisible(false)}
        />
        
        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '16px' }}>
            {user ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <Space>
                        <Avatar src={user.image} icon={<UserOutlined />} />
                        <Text strong>{user.first_name} {user.last_name}</Text>
                    </Space>
                    <Button 
                        block 
                        icon={<UserOutlined />} 
                        onClick={() => {
                            if (user?.role === 'admin') {
                                window.location.href = '/admin/home';
                            } else {
                                window.location.href = '/player/profile';
                            }
                        }}
                    >
                        Profile
                    </Button>
                    <Button 
                        block 
                        danger 
                        icon={<LogoutOutlined />} 
                        onClick={handleLogout}
                    >
                        Logout
                    </Button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <Link href="/player/login" style={{ width: '100%' }}>
                        <Button block icon={<LoginOutlined />}>Login</Button>
                    </Link>
                    <Link href="/player/signup" style={{ width: '100%' }}>
                        <Button block type="primary">Sign Up</Button>
                    </Link>
                </div>
            )}
        </div>
      </Drawer>
    </Layout>
  );
}
