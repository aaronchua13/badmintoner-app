import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { api } from '@/utils/api';
import { Spin, App } from 'antd';
import MainLayout from '@/layouts/MainLayout';

interface ProfileResponse {
  _id: string;
  username?: string;
}

export default function ProfileRedirect() {
  const router = useRouter();
  const { message } = App.useApp();

  useEffect(() => {
    const fetchAndRedirect = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/player/login');
        return;
      }

      try {
        const data = await api.get<ProfileResponse>('/players/profile', token);
        const identifier = data.username || data._id;
        router.replace(`/player/profile/${identifier}`);
      } catch {
        message.error('Failed to load profile');
        router.push('/player/login');
      }
    };

    fetchAndRedirect();
  }, [router, message]);

  return (
    <MainLayout>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Spin size="large" tip="Redirecting to your profile..." />
      </div>
    </MainLayout>
  );
}
