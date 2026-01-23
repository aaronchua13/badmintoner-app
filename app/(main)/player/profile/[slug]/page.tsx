import { fetchServer } from '@/lib/api-server';
import ProfileClient from './ProfileClient';
import { notFound } from 'next/navigation';

interface PlayerProfileData {
  _id: string;
  first_name: string;
  last_name: string;
  email: string;
  username?: string;
  image?: string;
  bio?: string;
  clubs?: string[];
  created_at?: string;
  createdAt?: string;
}

export default async function PlayerProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  
  // Fetch profile by slug
  const profile = await fetchServer<PlayerProfileData>(`/players/profile/${slug}`);
  console.log('Server Profile Data:', profile);
  
  if (!profile) {
    notFound();
  }

  // Fetch current user (if logged in) to check ownership
  const currentUser = await fetchServer<PlayerProfileData>('/players/profile');

  return <ProfileClient profile={profile} currentUser={currentUser} />;
}
