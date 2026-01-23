'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

const API_URL = process.env.API_TARGET_URL || 'http://localhost:3000';

// Helper to get token
async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get('token')?.value;
}

export async function updateProfileAction(data: { 
  first_name: string; 
  last_name: string; 
  username?: string; 
  bio?: string 
}) {
  const token = await getToken();
  if (!token) return { error: 'Unauthorized' };

  try {
    const res = await fetch(`${API_URL}/players/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return { error: errorData.message || 'Update failed' };
    }

    revalidatePath('/player/profile');
    revalidatePath(`/player/profile/${data.username}`); // Revalidate the new slug if changed
    return { success: true };
  } catch {
    return { error: 'Network error' };
  }
}

export interface UpdateAccountData {
    email?: string;
    password?: string;
}

export async function updateAccountAction(data: UpdateAccountData) {
    const token = await getToken();
    if (!token) return { error: 'Unauthorized' };
  
    try {
      const res = await fetch(`${API_URL}/players/profile/account`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
  
      if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          return { error: errorData.message || 'Update failed' };
      }
  
      revalidatePath('/player/profile');
      return { success: true };
    } catch {
      return { error: 'Network error' };
    }
}

export interface RegisterPlayerData {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    username?: string;
    confirmPassword?: string;
}

export async function registerPlayerAction(data: RegisterPlayerData) {
    const basicAuth = `Basic ${btoa(`${process.env.NEXT_PUBLIC_API_BASIC_AUTH_USER || 'admin'}:${process.env.NEXT_PUBLIC_API_BASIC_AUTH_PASSWORD || 'password123'}`)}`;
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { confirmPassword, ...payload } = data;

    try {
        const res = await fetch(`${API_URL}/auth/player/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': basicAuth,
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            return { error: errorData.message || 'Signup failed' };
        }

        const responseData = await res.json();
        const token = responseData.access_token;

        if (token) {
            const cookieStore = await cookies();
            cookieStore.set('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                path: '/',
                maxAge: 60 * 60 * 24 * 7
            });
            cookieStore.set('user_type', 'player', { path: '/' });
            return { success: true };
        }
        return { error: 'No token received' };

    } catch {
        return { error: 'Network error' };
    }
}
