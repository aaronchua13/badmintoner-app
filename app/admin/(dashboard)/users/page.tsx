import { getUsersAction } from '@/app/actions/admin';
import UsersClient from './UsersClient';

export default async function UsersPage() {
  const users = await getUsersAction();
  return <UsersClient initialUsers={users} />;
}
