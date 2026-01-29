import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const API_URL = process.env.API_TARGET_URL || 'http://localhost:3000';

export async function fetchServer<T>(path: string, options: RequestInit = {}): Promise<T | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Basic Auth for initial connection if needed, but usually handled by token
    // If no token, maybe we are logging in, so we don't send Authorization header unless provided in options

    const url = `${API_URL}${path}`;
    console.log('url: ', url);
    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
        // Handle Unauthorized (401) or Forbidden (403) by redirecting to logout
        if (res.status === 401 || res.status === 403) {
            console.log('res#########: ', res.ok, res.status, headers); 
            redirect('/api/logout');
        }

        // Log error or handle specific status codes
        console.error(`Fetch failed for ${url}: ${res.status}`);
        return null;
    }

    // Check for empty body
    const text = await res.text();
    console.log('text ? JSON.parse(text) : null: ', text ? JSON.parse(text) : null);
    return text ? JSON.parse(text) : null;
  } catch (error) {
    // Rethrow redirect errors so Next.js can handle them
    if ((error as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) {
        throw error;
    }
    console.error('Fetch server error:', error);
    return null;
  }
}