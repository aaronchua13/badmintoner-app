import MainLayout from '@/layouts/MainLayout';
import { Typography, Card, Form, Input, Button, Checkbox, App, Alert, Modal } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { useState, useEffect, useRef } from 'react';
import { api } from '@/utils/api';
import { useRouter } from 'next/router';

const { Title, Paragraph } = Typography;

interface SignInFormValues {
  email: string;
  password: string;
  remember: boolean;
}

interface LoginResponse {
  access_token: string;
}

export default function AdminLogin() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { message } = App.useApp();
  const [securityChecked, setSecurityChecked] = useState(false);
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    // Security check for admin access
    const checkSecurity = () => {
      const password = prompt('Please enter the security password to access Admin Login:');
      if (password === 'iamadmin') {
        setSecurityChecked(true);
      } else {
        message.error('Incorrect security password.');
        router.replace('/');
      }
    };

    // Check existing auth first
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          await api.get('/auth/profile', token);
          message.info('You are already logged in');
          router.replace('/admin/home');
          setSecurityChecked(true); // Skip security check if already logged in
        } catch (error) {
          localStorage.removeItem('token');
          checkSecurity();
        }
      } else {
        checkSecurity();
      }
    };
    
    // Only run on client side
    if (typeof window !== 'undefined') {
      checkAuth();
    }
  }, [router, message]);

  const onFinish = async (values: SignInFormValues) => {
    setLoading(true);
    
    try {
      const response = await api.post<LoginResponse>('/auth/login', {
        email: values.email,
        password: values.password,
      });

      if (response.access_token) {
        localStorage.setItem('token', response.access_token);
        localStorage.setItem('user_type', 'admin');
        message.success('Sign in successful!');
        router.push('/admin/home');
      } else {
        message.error('Sign in failed: No token received');
      }
    } catch (error: any) {
      message.error(error.message || 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!securityChecked) {
    return null; // Or a loading spinner
  }

  return (
    <MainLayout>
      <div style={{ maxWidth: '400px', margin: '0 auto' }}>
        <Card>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <Title level={2}>Admin Sign In</Title>
            <Paragraph>Welcome back to Badmintoner Admin</Paragraph>
            <Alert
              message="Test Credentials"
              description={
                <div>
                  <p>Email: aaronchua13@gmail.com</p>
                  <p>Password: aaron123</p>
                </div>
              }
              type="info"
              showIcon
              style={{ marginBottom: 16, textAlign: 'left' }}
            />
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
              Don&apos;t have an account? <a href="/admin/signup">Sign Up</a>
            </div>
          </Form>
        </Card>
      </div>
    </MainLayout>
  );
}
