import { getClubsAction } from '@/app/actions/admin';
import ClubsClient from './ClubsClient';

export default async function ClubsPage() {
  const clubs = await getClubsAction();
  return <ClubsClient initialClubs={clubs} />;
}
