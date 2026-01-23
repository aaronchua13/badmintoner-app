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
      const userType = cookieStore.get('user_type')?.value;

      if (token) {
        if (userType === 'player') {
             user = await fetchServer<UserProfile>('/players/profile');
             if (user) user.role = 'player';
        } else {
             // Admin might visit home page too
             user = await fetchServer<UserProfile>('/auth/profile');
             if (user) user.role = 'admin';
        }
      }
  } catch {
      // ignore error, just not logged in
  }

  return (
    <MainLayoutClient user={user}>
      {children}
    </MainLayoutClient>
  );
}
