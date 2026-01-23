'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const API_URL = process.env.API_TARGET_URL || 'http://localhost:3000';

// Basic Auth Creds (matches client-side logic)
const username = process.env.NEXT_PUBLIC_API_BASIC_AUTH_USER || 'admin';
const password = process.env.NEXT_PUBLIC_API_BASIC_AUTH_PASSWORD || 'password123';
const basicAuth = `Basic ${btoa(`${username}:${password}`)}`;

export async function loginAdminAction(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  try {
    const res = await fetch(`${API_URL}/auth/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': basicAuth,
      },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      return { error: 'Invalid credentials' };
    }

    const data = await res.json();
    const token = data.access_token;

    if (token) {
      const cookieStore = await cookies();
      console.log('Setting token cookie:', token);
      cookieStore.set('token', token, { 
        httpOnly: true, 
        secure: false, // process.env.NODE_ENV === 'production', // Force false for debugging
        path: '/',
        maxAge: 60 * 60 * 24 * 7 // 1 week
      });
      cookieStore.set('user_type', 'admin', { path: '/' });
    }
    console.log('Login successful, redirecting...');
  } catch (error) {
    console.error('Login error:', error);
    return { error: 'Network error' };
  }

  redirect('/admin/home');
}

export async function loginPlayerAction(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  console.log('Attempting player login for:', email);

  try {
    const res = await fetch(`${API_URL}/auth/player/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': basicAuth,
        },
        body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
        console.log('Login failed with status:', res.status);
        return { error: 'Invalid credentials' };
    }

    const data = await res.json();
    const token = data.access_token;

    if (token) {
        const cookieStore = await cookies();
        console.log('Setting player token cookie');
        cookieStore.set('token', token, {
            httpOnly: true,
            secure: false, // process.env.NODE_ENV === 'production', // Force false for debugging
            path: '/',
            maxAge: 60 * 60 * 24 * 7 // 1 week
        });
        cookieStore.set('user_type', 'player', { path: '/' });
    }
  } catch (error) {
      console.error('Player login error:', error);
      return { error: 'Network error' };
  }
  
  redirect('/');
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete('token');
  cookieStore.delete('user_type');
  return { success: true };
}

export interface RegisterAdminData {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    confirmPassword?: string;
}

export async function registerAdminAction(data: RegisterAdminData) {
    const basicAuth = `Basic ${btoa(`${process.env.NEXT_PUBLIC_API_BASIC_AUTH_USER || 'admin'}:${process.env.NEXT_PUBLIC_API_BASIC_AUTH_PASSWORD || 'password123'}`)}`;
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { confirmPassword, ...payload } = data;

    try {
        const res = await fetch(`${API_URL}/auth/admin/signup`, {
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
                maxAge: 60 * 60 * 24 * 7 // 1 week
            });
            cookieStore.set('user_type', 'admin', { path: '/' });
        }
        return { success: true };
    } catch {
        return { error: 'Network error' };
    }
}
