'use client';

import { Typography, Card, Input, Button } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { loginAdminAction } from '@/app/actions/auth';

const { Title, Paragraph } = Typography;

export default function AdminLoginPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [securityChecked, setSecurityChecked] = useState(false);
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    // Security check for admin access
    const checkSecurity = () => {
      // We use a simple prompt as in the original code
      // In a real app, this should be better UI, but "no changing of UI" (mostly)
      // However, prompt is blocking and bad UX. I'll make it a simple state check.
      const password = prompt('Please enter the security password to access Admin Login:');
      if (password === 'iamadmin') {
        setSecurityChecked(true);
      } else {
        alert('Incorrect security password.');
        router.replace('/');
      }
    };

    checkSecurity();
  }, [router]);

  const onFinish = async (formData: FormData) => {
    setLoading(true);
    const result = await loginAdminAction(formData);
    if (result?.error) {
        alert(result.error);
        setLoading(false);
    }
  };

  if (!securityChecked) {
      return null; 
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center',
      background: '#f0f2f5',
      padding: '0 16px'
    }}>
      <Card style={{ width: '100%', maxWidth: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={2}>Admin Login</Title>
          <Paragraph type="secondary">Welcome back, Administrator</Paragraph>
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
      </Card>
    </div>
  );
}
