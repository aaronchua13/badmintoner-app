import { cookies } from 'next/headers';

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
    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
        // Log error or handle specific status codes
        console.error(`Fetch failed for ${url}: ${res.status}`);
        return null;
    }

    // Check for empty body
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch (error) {
    console.error('Fetch server error:', error);
    return null;
  }
}
