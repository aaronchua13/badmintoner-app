import { getPlayersAction } from '@/app/actions/admin';
import PlayersClient from './PlayersClient';

export default async function PlayersPage() {
  const players = await getPlayersAction();
  return <PlayersClient initialPlayers={players} />;
}
