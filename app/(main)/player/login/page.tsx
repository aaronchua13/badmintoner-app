'use client';

import { Typography, Card, Input, Button, App } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { useState } from 'react';
import Link from 'next/link';
import { loginPlayerAction } from '@/app/actions/auth';

const { Title, Paragraph } = Typography;

export default function PlayerLoginPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  const onFinish = async (formData: FormData) => {
    setLoading(true);
    const result = await loginPlayerAction(formData);
    console.log('result: ', result);
    setLoading(false);

    if (result?.error) {
        message.error(result.error);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '48px auto', padding: '0 16px' }}>
        <Card>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <Title level={2}>Player Sign In</Title>
            <Paragraph>Welcome back, Player!</Paragraph>
          </div>

          <form action={onFinish}>
             <div style={{ marginBottom: 16 }}>
                <Input 
                    prefix={<MailOutlined />} 
                    placeholder="Email" 
                    name="email"
                    required
                    type="email"
                    size="large"
                />
             </div>
             <div style={{ marginBottom: 24 }}>
                 <Input.Password 
                    prefix={<LockOutlined />} 
                    placeholder="Password" 
                    name="password"
                    required
                    size="large"
                 />
             </div>
             
             <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                Sign In
             </Button>
          </form>

           <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Link href="/player/signup">Don&apos;t have an account? Sign up</Link>
           </div>
        </Card>
    </div>
  );
}
