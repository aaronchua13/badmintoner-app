import { fetchServer } from '@/lib/api-server';
import AdminDashboardClient from './DashboardClient';

export default async function AdminHomePage() {
  // Fetch data on server
  const users = await fetchServer<unknown[]>('/users') || [];
  // Mock other data as they were empty in original
  const clubs = [];
  const events = [];
  const players = [];

  const stats = {
      usersCount: users.length,
      clubsCount: clubs.length,
      eventsCount: events.length,
      playersCount: players.length,
  };

  return <AdminDashboardClient stats={stats} />;
}
