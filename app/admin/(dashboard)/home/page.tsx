import { 
  getUsersAction, 
  getClubsAction, 
  getEventsAction, 
  getPlayersAction 
} from '@/app/actions/admin';
import AdminDashboardClient from './DashboardClient';

export default async function AdminHomePage() {
  // Fetch data on server
  const [users, clubs, events, players] = await Promise.all([
    getUsersAction(),
    getClubsAction(),
    getEventsAction(),
    getPlayersAction()
  ]);

  const stats = {
      usersCount: Array.isArray(users) ? users.length : 0,
      clubsCount: Array.isArray(clubs) ? clubs.length : 0,
      eventsCount: Array.isArray(events) ? events.length : 0,
      playersCount: Array.isArray(players) ? players.length : 0,
  };

  // Prepare recent activity data (taking latest 5 from each if available)
  // Assuming the API returns latest first or we can slice the array.
  // We'll pass the raw lists to the client component to handle display logic for "Recent Activity"
  
  return (
    <AdminDashboardClient 
      stats={stats} 
      recentUsers={Array.isArray(users) ? users.slice(0, 5) : []}
      recentClubs={Array.isArray(clubs) ? clubs.slice(0, 5) : []}
      recentEvents={Array.isArray(events) ? events.slice(0, 5) : []}
      recentPlayers={Array.isArray(players) ? players.slice(0, 5) : []}
    />
  );
}
