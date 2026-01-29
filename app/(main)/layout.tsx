import { fetchServer } from '@/lib/api-server';
import { cookies } from 'next/headers';
import MainLayoutClient from './components/MainLayoutClient';

interface UserProfile {
  first_name: string;
  last_name: string;
  email: string;
  image?: string;
  role?: string;
  [key: string]: unknown;
}

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  let user: UserProfile | null = null;

  try {
      const cookieStore = await cookies();
      const token = cookieStore.get('token')?.value;
      console.log('token: ', token);
      const userType = cookieStore.get('user_type')?.value;
      console.log('userType: ', userType);

      if (token) {
        if (userType === 'player') {
             user = await fetchServer<UserProfile>('/players/profile');
             if (user) user.role = 'player';
        } else if (userType === 'admin') {
             user = await fetchServer<UserProfile>('/auth/profile');
             console.log('#######user: ', user);
             if (user) user.role = 'admin';
        }
      }
  } catch (error) {
      if ((error as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) {
          throw error;
      }
      // ignore error, just not logged in
  }

  return (
    <MainLayoutClient user={user}>
      {children}
    </MainLayoutClient>
  );
}
