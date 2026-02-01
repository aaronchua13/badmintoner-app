import { fetchServer } from '@/lib/api-server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import EditClubClient from './EditClubClient';
import { getCourtsAction, getClubByIdAction } from '@/app/actions/club-event';

interface UserProfile {
  _id: string;
  role?: string;
}

export default async function EditClubPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { id } = await params;
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

  const [courts, club] = await Promise.all([
    getCourtsAction(),
    getClubByIdAction(id)
  ]);

  if (!club) {
    redirect('/player/profile');
  }

  return <EditClubClient userId={user._id} initialCourts={Array.isArray(courts) ? courts : []} initialClub={club} />;
}
