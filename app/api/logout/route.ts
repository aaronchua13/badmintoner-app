import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('#######logout: ');
  const cookieStore = await cookies();
  
  // Clear cookies
  cookieStore.delete('token');
  cookieStore.delete('user_type');

  redirect('/?reason=session_expired');
}
