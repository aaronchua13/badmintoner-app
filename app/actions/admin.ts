'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

const API_URL = process.env.API_TARGET_URL || 'http://localhost:3000';

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get('token')?.value;
}

async function fetchWithAuth(path: string, options: RequestInit = {}) {
  const token = await getToken();
  if (!token) {
    throw new Error('Unauthorized');
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Request failed');
  }

  return res.json();
}

// --- Users ---
export async function getUsersAction() {
    try {
        return await fetchWithAuth('/users');
    } catch {
        return [];
    }
}

export async function createUserAction(data: unknown) {
    try {
        await fetchWithAuth('/users', {
            method: 'POST',
            body: JSON.stringify(data),
        });
        revalidatePath('/admin/users');
        return { success: true };
    } catch (error: unknown) {
        return { error: (error as Error).message };
    }
}

export async function updateUserAction(id: string, data: unknown) {
    try {
        await fetchWithAuth(`/users/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
        revalidatePath('/admin/users');
        return { success: true };
    } catch (error: unknown) {
        return { error: (error as Error).message };
    }
}

export async function deleteUserAction(id: string) {
    try {
        await fetchWithAuth(`/users/${id}`, {
            method: 'DELETE',
        });
        revalidatePath('/admin/users');
        return { success: true };
    } catch (error: unknown) {
        return { error: (error as Error).message };
    }
}

// --- Clubs ---
export async function getClubsAction() {
    try {
        return await fetchWithAuth('/clubs');
    } catch {
        return [];
    }
}

// Add create/update/delete for clubs if needed (based on users logic)
// Since original code had empty table, I'll add basic stubs or implement if I see fit.
// But "no changing of UI" implies I should match functionality. 
// The original code had a "Coming soon" or empty table for clubs/events but defined columns.
// I'll implement standard CRUD actions for them just in case.

export async function createClubAction(data: unknown) {
    try {
        await fetchWithAuth('/clubs', { method: 'POST', body: JSON.stringify(data) });
        revalidatePath('/admin/clubs');
        return { success: true };
    } catch (error: unknown) { return { error: (error as Error).message }; }
}

export async function updateClubAction(id: string, data: unknown) {
    try {
        await fetchWithAuth(`/clubs/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
        revalidatePath('/admin/clubs');
        return { success: true };
    } catch (error: unknown) { return { error: (error as Error).message }; }
}

export async function deleteClubAction(id: string) {
    try {
        await fetchWithAuth(`/clubs/${id}`, { method: 'DELETE' });
        revalidatePath('/admin/clubs');
        return { success: true };
    } catch (error: unknown) { return { error: (error as Error).message }; }
}

// --- Events ---
export async function getEventsAction() {
    try {
        return await fetchWithAuth('/events');
    } catch {
        return [];
    }
}

export async function createEventAction(data: unknown) {
    try {
        await fetchWithAuth('/events', { method: 'POST', body: JSON.stringify(data) });
        revalidatePath('/admin/events');
        return { success: true };
    } catch (error: unknown) { return { error: (error as Error).message }; }
}

export async function updateEventAction(id: string, data: unknown) {
    try {
        await fetchWithAuth(`/events/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
        revalidatePath('/admin/events');
        return { success: true };
    } catch (error: unknown) { return { error: (error as Error).message }; }
}

export async function deleteEventAction(id: string) {
    try {
        await fetchWithAuth(`/events/${id}`, { method: 'DELETE' });
        revalidatePath('/admin/events');
        return { success: true };
    } catch (error: unknown) { return { error: (error as Error).message }; }
}

// --- Players ---
export async function getPlayersAction() {
    try {
        return await fetchWithAuth('/players');
    } catch {
        return [];
    }
}

export async function createPlayerAction(data: unknown) {
    try {
        await fetchWithAuth('/players/signup', { method: 'POST', body: JSON.stringify(data) });
        revalidatePath('/admin/players');
        return { success: true };
    } catch (error: unknown) { return { error: (error as Error).message }; }
}

export async function updatePlayerAction(id: string, data: unknown) {
    try {
        await fetchWithAuth(`/players/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
        revalidatePath('/admin/players');
        return { success: true };
    } catch (error: unknown) { return { error: (error as Error).message }; }
}

export async function deletePlayerAction(id: string) {
    try {
        await fetchWithAuth(`/players/${id}`, { method: 'DELETE' });
        revalidatePath('/admin/players');
        return { success: true };
    } catch (error: unknown) { return { error: (error as Error).message }; }
}
