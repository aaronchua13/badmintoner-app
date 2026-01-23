import { Button, Result } from 'antd';
import Link from 'next/link';
import { fetchServer } from '@/lib/api-server';
import { cookies } from 'next/headers';
import MainLayoutClient from '@/app/(main)/components/MainLayoutClient';

interface UserProfile {
  first_name: string;
  last_name: string;
  email: string;
  image?: string;
  role?: string;
  [key: string]: unknown;
}

export default async function NotFound() {
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
            user = await fetchServer<UserProfile>('/auth/profile');
            if (user) user.role = 'admin';
        }
     }
  } catch {
      // ignore
  }

  return (
    <MainLayoutClient user={user}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '60vh' 
      }}>
        <Result
          status="404"
          title="404"
          subTitle="Sorry, the page you visited does not exist."
          extra={
            <Link href="/">
                <Button type="primary">Back Home</Button>
            </Link>
          }
        />
      </div>
    </MainLayoutClient>
  );
}
