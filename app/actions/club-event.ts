'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

const API_URL = process.env.API_TARGET_URL || 'http://localhost:3000';

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get('token')?.value;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createClubAction(data: any) {
  const token = await getToken();

  if (!token) {
    return { error: 'Unauthorized' };
  }

  try {
    const res = await fetch(`${API_URL}/clubs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return { error: errorData.message || 'Failed to create club' };
    }
    
    revalidatePath('/clubs');
    revalidatePath('/player/profile');
    return { success: true, data: await res.json() };
  } catch (error) {
    return { error: 'Failed to create club' };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateClubAction(id: string, data: any) {
    const token = await getToken();
  
    if (!token) {
      return { error: 'Unauthorized' };
    }
  
    try {
      const res = await fetch(`${API_URL}/clubs/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
  
      if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          return { error: errorData.message || 'Failed to update club' };
      }
      
      revalidatePath('/clubs');
      revalidatePath(`/clubs/${id}`);
      revalidatePath('/player/profile');
      return { success: true };
    } catch (error) {
      return { error: 'Failed to update club' };
    }
  }

  export async function deleteClubAction(id: string) {
    const token = await getToken();
  
    if (!token) {
      return { error: 'Unauthorized' };
    }
  
    try {
      const res = await fetch(`${API_URL}/clubs/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
  
      if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          return { error: errorData.message || 'Failed to delete club' };
      }
      
      revalidatePath('/clubs');
      revalidatePath('/player/profile');
      return { success: true };
    } catch (error) {
      return { error: 'Failed to delete club' };
    }
  }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createEventAction(data: any) {
    const token = await getToken();
  
    if (!token) {
      return { error: 'Unauthorized' };
    }
  
    // TODO: Replace with actual API call when backend is ready
    console.log('Creating event with data:', data);
    revalidatePath('/events');
    return { success: true };
}

 
export async function getClubsAction(page: number = 1, limit: number = 10) {
  try {
    const res = await fetch(`${API_URL}/clubs/detailed-list?page=${page}&limit=${limit}`, {
      cache: 'no-store'
    });
    
    if (!res.ok) return { data: [], total: 0 };
    
    return await res.json();
  } catch (error) {
    console.error('Failed to fetch clubs:', error);
    return { data: [], total: 0 };
  }
}

export async function getClubsByPlayerAction(playerId: string) {
  try {
    const res = await fetch(`${API_URL}/clubs`, { cache: 'no-store' });
    if (!res.ok) return [];
    
    const allClubs = await res.json();
    if (!Array.isArray(allClubs)) return [];

    // Filter by player_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const playerClubs = allClubs.filter((c: any) => c.player_id === playerId);

    // Fetch schedules and courts for each club
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clubsWithSchedules = await Promise.all(playerClubs.map(async (club: any) => {
        try {
            const clubId = club.id || club._id;
            const scheduleRes = await fetch(`${API_URL}/schedules?club_id=${clubId}`, { cache: 'no-store' });
            let schedules = scheduleRes.ok ? await scheduleRes.json() : [];

            if (Array.isArray(schedules)) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                schedules = schedules.filter((s: any) => s.club_id === clubId);
            } else {
                schedules = [];
            }

             
            const schedulesWithCourts = await Promise.all(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                schedules.map(async (schedule: any) => {
                    const courtRes = await fetch(`${API_URL}/courts/${schedule.court_id}`);
                    const court = courtRes.ok ? await courtRes.json() : null;
                    return { ...schedule, court };
                })
            );
            return { ...club, schedules: schedulesWithCourts };
        } catch (err) {
            console.error(`Failed to fetch schedules for club ${club.id}:`, err);
            return { ...club, schedules: [] };
        }
    }));

    return clubsWithSchedules;
  } catch (error) {
    console.error('Failed to fetch player clubs:', error);
    return [];
  }
}

export async function getClubByIdAction(id: string) {
  try {
    const res = await fetch(`${API_URL}/clubs/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const club = await res.json();

    // Fetch schedules
    const scheduleRes = await fetch(`${API_URL}/schedules?club_id=${id}`, { cache: 'no-store' });
    let schedules = scheduleRes.ok ? await scheduleRes.json() : [];

    // Filter schedules manually if backend doesn't
    if (Array.isArray(schedules)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        schedules = schedules.filter((s: any) => s.club_id === id);
    }

    // Fetch court details for each schedule
    const schedulesWithCourts = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        schedules.map(async (schedule: any) => {
            const courtRes = await fetch(`${API_URL}/courts/${schedule.court_id}`);
            const court = courtRes.ok ? await courtRes.json() : null;
            return { ...schedule, court };
        })
    );

    return { ...club, schedules: schedulesWithCourts };
  } catch (error) {
    console.error('Failed to fetch club:', error);
    return null;
  }
}

export async function getCourtsAction() {
  try {
    const res = await fetch(`${API_URL}/courts`);
    
    if (!res.ok) return [];
    
    return await res.json();
  } catch (error) {
    console.error('Failed to fetch courts:', error);
    return [];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createCourtAction(data: any) {
  try {
    const res = await fetch(`${API_URL}/courts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!res.ok) {
        return { error: 'Failed to create court' };
    }

    const newCourt = await res.json();
    return { success: true, court: newCourt };
  } catch (error) {
    console.error('Error creating court:', error);
    return { error: 'Failed to create court' };
  }
}
