import MainLayout from '@/layouts/MainLayout';
import { Typography, Card, Form, Input, Button, message } from 'antd';
import { UserOutlined, MailOutlined, LockOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { api } from '@/utils/api';
import { useRouter } from 'next/router';
import Link from 'next/link';

const { Title, Paragraph } = Typography;

interface SignUpFormValues {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface LoginResponse {
  access_token: string;
}

export default function AdminSignUp() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onFinish = async (values: SignUpFormValues) => {
    setLoading(true);
    
    try {
      const response = await api.post<LoginResponse>('/auth/signup', {
        email: values.email,
        password: values.password,
        first_name: values.first_name,
        last_name: values.last_name,
      });

      if (response.access_token) {
        localStorage.setItem('token', response.access_token);
        message.success('Account created successfully!');
        router.push('/admin/home');
      }
    } catch (error) {
      console.error('Sign up error:', error);
      const err = error as Error;
      message.error(err.message || 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        <Card>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <Title level={2}>Admin Sign Up</Title>
            <Paragraph>Create your Badmintoner Admin account</Paragraph>
          </div>

          <Form
            form={form}
            name="signup"
            onFinish={onFinish}
            layout="vertical"
            autoComplete="off"
          >
            <div style={{ display: 'flex', gap: '16px' }}>
              <Form.Item
                label="First Name"
                name="first_name"
                rules={[{ required: true, message: 'Please input your first name!' }]}
                style={{ flex: 1 }}
              >
                <Input prefix={<UserOutlined />} placeholder="John" />
              </Form.Item>
              <Form.Item
                label="Last Name"
                name="last_name"
                rules={[{ required: true, message: 'Please input your last name!' }]}
                style={{ flex: 1 }}
              >
                <Input prefix={<UserOutlined />} placeholder="Doe" />
              </Form.Item>
            </div>

            <Form.Item
              label="Email"
              name="email"
              rules={[
                { required: true, message: 'Please input your email!' },
                { type: 'email', message: 'Please enter a valid email!' },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="john@example.com" />
            </Form.Item>

            <Form.Item
              label="Password"
              name="password"
              rules={[
                { required: true, message: 'Please input your password!' },
                { min: 8, message: 'Password must be at least 8 characters!' },
                {
                  pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                  message: 'Password must contain uppercase, lowercase, and number!',
                },
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Password" />
            </Form.Item>

            <Form.Item
              label="Confirm Password"
              name="confirmPassword"
              dependencies={['password']}
              rules={[
                { required: true, message: 'Please confirm your password!' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('Passwords do not match!'));
                  },
                }),
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Confirm Password" />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block size="large">
                Sign Up
              </Button>
            </Form.Item>

            <div style={{ textAlign: 'center' }}>
              Already have an account? <Link href="/admin/login">Sign In</Link>
            </div>
          </Form>
        </Card>
      </div>
    </MainLayout>
  );
}
