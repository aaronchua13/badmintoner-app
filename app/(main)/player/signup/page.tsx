'use client';

import { Typography, Card, Form, Input, Button, message } from 'antd';
import { UserOutlined, MailOutlined, LockOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { registerPlayerAction, RegisterPlayerData } from '@/app/actions/player';
import Link from 'next/link';

const { Title, Paragraph } = Typography;

export default function PlayerSignUpPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onFinish = async (values: RegisterPlayerData) => {
    setLoading(true);
    const result = await registerPlayerAction(values);
    setLoading(false);

    if (result.error) {
        message.error(result.error);
    } else {
        message.success('Account created successfully!');
        router.push('/');
        router.refresh();
    }
  };

  return (
    <div style={{ maxWidth: '500px', margin: '48px auto', padding: '0 16px' }}>
        <Card>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <Title level={2}>Player Sign Up</Title>
            <Paragraph>Create your Player account</Paragraph>
          </div>

          <Form
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
              label="Username"
              name="username"
              rules={[
                { pattern: /^[a-zA-Z0-9_]+$/, message: 'Username can only contain letters, numbers and underscores' }
              ]}
              tooltip="Optional. If left blank, one will be generated from your email."
            >
              <Input prefix={<UserOutlined />} placeholder="johndoe123" />
            </Form.Item>

            <Form.Item
              label="Email"
              name="email"
              rules={[
                { required: true, message: 'Please input your email!' },
                { type: 'email', message: 'Please enter a valid email!' }
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="john@example.com" />
            </Form.Item>

            <Form.Item
              label="Password"
              name="password"
              rules={[{ required: true, message: 'Please input your password!' }]}
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
                    return Promise.reject(new Error('The two passwords that you entered do not match!'));
                  },
                }),
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Confirm Password" />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                Sign Up
              </Button>
            </Form.Item>
            
            <div style={{ textAlign: 'center' }}>
                <Link href="/player/login">Already have an account? Sign in</Link>
            </div>
          </Form>
        </Card>
    </div>
  );
}
