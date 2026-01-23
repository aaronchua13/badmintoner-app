import { fetchServer } from '@/lib/api-server';
import { cookies } from 'next/headers';
import AdminLayoutClient from './components/AdminLayoutClient';
import { redirect } from 'next/navigation';

interface UserProfile {
  first_name: string;
  last_name: string;
  email: string;
  image?: string;
  role?: string;
  [key: string]: unknown;
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let user: UserProfile | null = null;

  try {
      const cookieStore = await cookies();
      const token = cookieStore.get('token')?.value;
      const userType = cookieStore.get('user_type')?.value;

      if (token) {
        if (userType === 'player') {
            // Players cannot access admin
             redirect('/not-found');
        } else {
             user = await fetchServer<UserProfile>('/auth/profile');
             if (user) {
                 user.role = 'admin';
             }
        }
      }
  } catch {
      // ignore
  }

  // Double check if not authorized (Middleware should handle this, but safe to check)
  // If user is null, AdminLayoutClient will handle it (or we can redirect here)
  
  return (
    <AdminLayoutClient user={user}>
      {children}
    </AdminLayoutClient>
  );
}
