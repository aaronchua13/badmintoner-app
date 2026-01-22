import MainLayout from '@/layouts/MainLayout';
import { Typography, Card, Form, Input, Button, Checkbox, App } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { api } from '@/utils/api';
import { useRouter } from 'next/router';
import Link from 'next/link';

const { Title, Paragraph } = Typography;

interface SignInFormValues {
  email: string;
  password: string;
  remember: boolean;
}

interface LoginResponse {
  access_token: string;
}

export default function PlayerLogin() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { message } = App.useApp();

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          await api.get('/players/profile', token);
          message.info('You are already logged in');
          router.replace('/');
        } catch {
          // Token invalid, stay on sign in page
          localStorage.removeItem('token');
        }
      }
    };
    checkAuth();
  }, [router, message]);

  const onFinish = async (values: SignInFormValues) => {
    setLoading(true);
    
    try {
      const response = await api.post<LoginResponse>('/auth/player/login', {
        email: values.email,
        password: values.password,
      });

      if (response.access_token) {
        localStorage.setItem('token', response.access_token);
        localStorage.setItem('user_type', 'player');
        message.success('Sign in successful!');
        router.push('/');
      } else {
        message.error('Sign in failed: No token received');
      }
    } catch (error) {
      const err = error as Error;
      message.error(err.message || 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div style={{ maxWidth: '400px', margin: '0 auto' }}>
        <Card>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <Title level={2}>Player Sign In</Title>
            <Paragraph>Welcome back, Player!</Paragraph>
          </div>

          <Form
            form={form}
            name="signin"
            onFinish={onFinish}
            layout="vertical"
            autoComplete="off"
            initialValues={{ remember: true }}
          >
            <Form.Item
              label="Email"
              name="email"
              rules={[
                { required: true, message: 'Please input your email!' },
                { type: 'email', message: 'Please enter a valid email!' },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="john@example.com" size="large" />
            </Form.Item>

            <Form.Item
              label="Password"
              name="password"
              rules={[
                { required: true, message: 'Please input your password!' },
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Password" size="large" />
            </Form.Item>

            <Form.Item>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Form.Item name="remember" valuePropName="checked" noStyle>
                  <Checkbox>Remember me</Checkbox>
                </Form.Item>
              </div>
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                Sign in
              </Button>
            </Form.Item>

            <div style={{ textAlign: 'center' }}>
              Don&apos;t have an account? <Link href="/player/signup">Sign Up</Link>
            </div>
          </Form>
        </Card>
      </div>
    </MainLayout>
  );
}
