import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function GET() {
  console.log('#######logout: ');
  const cookieStore = await cookies();
  
  // Clear cookies
  cookieStore.delete('token');
  cookieStore.delete('user_type');

  redirect('/?reason=session_expired');
}
