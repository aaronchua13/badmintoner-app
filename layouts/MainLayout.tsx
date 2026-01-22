import { Layout, Menu, MenuProps, Button, Dropdown, Avatar, Space, Typography } from 'antd';
import { HomeOutlined, TeamOutlined, CalendarOutlined, LoginOutlined, UserOutlined, LogoutOutlined, DownOutlined } from '@ant-design/icons';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ReactNode, useEffect, useState } from 'react';
import { api } from '@/utils/api';

const { Header, Content, Footer } = Layout;
const { Text } = Typography;

interface MainLayoutProps {
  children: ReactNode;
}

interface UserProfile {
  first_name: string;
  last_name: string;
  email: string;
  image?: string;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [userType, setUserType] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem('token');
      const type = localStorage.getItem('user_type');
      setUserType(type);

      if (token) {
        try {
          let profile: UserProfile;
          if (type === 'player') {
            profile = await api.get('/player/profile', token) as UserProfile;
          } else {
            profile = await api.get('/auth/profile', token) as UserProfile;
          }
          setUser(profile);
        } catch {
          localStorage.removeItem('token');
          localStorage.removeItem('user_type');
          setUser(null);
          setUserType(null);
        }
      }
      setLoading(false);
    };
    fetchProfile();
  }, []);

  const handleLogout = () => {
    const type = localStorage.getItem('user_type');
    localStorage.removeItem('token');
    localStorage.removeItem('user_type');
    setUser(null);
    setUserType(null);
    
    if (type === 'admin') {
      router.push('/admin/login');
    } else {
      router.push('/player/login');
    }
  };

  const userMenu: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile',
      onClick: () => router.push(userType === 'player' ? '/player/profile' : '/admin/home'),
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

  const hideLoginButton = ['/admin/login', '/admin/signup', '/player/login', '/player/signup'].includes(router.pathname);

  return (
    <Layout className="layout" style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', padding: '0 24px' }}>
        <div style={{ color: 'white', fontSize: '20px', fontWeight: 'bold', marginRight: '40px' }}>
          Badmintoner
        </div>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[router.pathname]}
          items={menuItems}
          style={{ flex: 1, minWidth: 0 }}
        />
        {user ? (
          <Dropdown menu={{ items: userMenu }} placement="bottomRight" arrow={{ pointAtCenter: true }}>
            <Space style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', transition: 'all 0.3s' }}>
              <Avatar 
                src={user.image} 
                icon={<UserOutlined />} 
                style={{ backgroundColor: '#1890ff', border: '2px solid rgba(255,255,255,0.2)' }} 
              />
              <Text style={{ color: 'white', fontSize: '14px' }}>
                <span style={{ fontWeight: 'normal', opacity: 0.85 }}>Hi,</span>{' '}
                <span style={{ fontWeight: 600 }}>{user.first_name}</span>
              </Text>
              <DownOutlined style={{ color: 'white', fontSize: '12px', opacity: 0.85 }} />
            </Space>
          </Dropdown>
        ) : (
          !hideLoginButton && (
            <Button 
              type="primary" 
              icon={<LoginOutlined />} 
              onClick={() => router.push('/player/login')}
              loading={loading}
            >
              Login
            </Button>
          )
        )}
      </Header>
      <Content style={{ padding: '24px 50px', minHeight: 'calc(100vh - 134px)' }}>
        {children}
      </Content>
      <Footer style={{ textAlign: 'center' }}>
        Badmintoner ©{new Date().getFullYear()} Created with Next.js
      </Footer>
    </Layout>
  );
}
