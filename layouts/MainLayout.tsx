import { Layout, Menu, MenuProps, Button } from 'antd';
import { HomeOutlined, TeamOutlined, CalendarOutlined, LoginOutlined } from '@ant-design/icons';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ReactNode } from 'react';
import { api } from '@/utils/api';

const { Header, Content, Footer } = Layout;

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const router = useRouter();

  const handleLoginClick = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        await api.get('/auth/profile', token);
        router.push('/admin/home');
        return;
      } catch {
        localStorage.removeItem('token');
      }
    }
    router.push('/signin');
  };

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

  return (
    <Layout style={{ minHeight: '100vh' }}>
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
        <Button 
          type="primary" 
          icon={<LoginOutlined />} 
          onClick={handleLoginClick}
        >
          Login
        </Button>
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
