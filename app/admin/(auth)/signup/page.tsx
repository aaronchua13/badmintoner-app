'use client';

import { Typography, Card, Form, Input, Button, message } from 'antd';
import { UserOutlined, MailOutlined, LockOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { registerAdminAction, RegisterAdminData } from '@/app/actions/auth';
import Link from 'next/link';

const { Title, Paragraph } = Typography;

export default function AdminSignUpPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onFinish = async (values: RegisterAdminData) => {
    setLoading(true);
    const result = await registerAdminAction(values);
    setLoading(false);

    if (result.error) {
        message.error(result.error);
    } else {
        message.success('Account created successfully!');
        router.push('/admin/home');
        router.refresh();
    }
  };

  return (
    <div style={{ maxWidth: '500px', margin: '48px auto', padding: '0 16px' }}>
        <Card>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <Title level={2} style={{ margin: 0 }}>Admin Sign Up</Title>
            <Paragraph>Create your Badmintoner Admin account</Paragraph>
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
              <Button type="primary" htmlType="submit" block loading={loading} size="large">
                Sign Up
              </Button>
            </Form.Item>
            
            <div style={{ textAlign: 'center' }}>
                <Link href="/admin/login">Already have an account? Log in</Link>
            </div>
          </Form>
        </Card>
    </div>
  );
}
