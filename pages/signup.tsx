import MainLayout from '@/layouts/MainLayout';
import { Typography, Card, Form, Input, Button, message } from 'antd';
import { UserOutlined, MailOutlined, LockOutlined, PhoneOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { api } from '@/utils/api';
import { useRouter } from 'next/router';

const { Title, Paragraph } = Typography;

interface SignUpFormValues {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

interface LoginResponse {
  access_token: string;
}

export default function SignUp() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onFinish = async (values: SignUpFormValues) => {
    setLoading(true);
    
    try {
      // Split name into firstName and lastName
      const nameParts = values.name.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || '';

      const response = await api.post<LoginResponse>('/auth/signup', {
        email: values.email,
        password: values.password,
        firstName,
        lastName: lastName || firstName, // Fallback if no last name
        // phone is not supported by API yet
      });

      if (response.access_token) {
        localStorage.setItem('token', response.access_token);
        message.success('Account created successfully!');
        router.push('/');
      }
    } catch (error: any) {
      console.error('Sign up error:', error);
      message.error(error.message || 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        <Card>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <Title level={2}>Sign Up</Title>
            <Paragraph>Create your Badmintoner account</Paragraph>
          </div>

          <Form
            form={form}
            name="signup"
            onFinish={onFinish}
            layout="vertical"
            autoComplete="off"
          >
            <Form.Item
              label="Full Name"
              name="name"
              rules={[
                { required: true, message: 'Please input your name!' },
                { min: 2, message: 'Name must be at least 2 characters!' },
              ]}
            >
              <Input prefix={<UserOutlined />} placeholder="John Doe" />
            </Form.Item>

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
              label="Phone Number"
              name="phone"
              rules={[
                { required: true, message: 'Please input your phone number!' },
                { pattern: /^[0-9]{10,15}$/, message: 'Please enter a valid phone number!' },
              ]}
            >
              <Input prefix={<PhoneOutlined />} placeholder="1234567890" />
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
              Already have an account? <a href="/signin">Sign In</a>
            </div>
          </Form>
        </Card>
      </div>
    </MainLayout>
  );
}
