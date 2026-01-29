import { fetchServer } from '@/lib/api-server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import CreateClubClient from './CreateClubClient';
import { getCourtsAction } from '@/app/actions/club-event';

interface UserProfile {
  _id: string;
  role?: string;
}

export default async function CreateClubPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  const userType = cookieStore.get('user_type')?.value;

  if (!token || userType !== 'player') {
    redirect('/player/login');
  }

  const user = await fetchServer<UserProfile>('/players/profile');

  if (!user) {
    redirect('/player/login');
  }

  // Fetch courts on the server side
  const courts = await getCourtsAction();

  return <CreateClubClient userId={user._id} initialCourts={Array.isArray(courts) ? courts : []} />;
}
