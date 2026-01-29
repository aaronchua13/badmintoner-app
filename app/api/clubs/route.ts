import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_TARGET_URL || 'http://localhost:3000';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    const body = await request.json();
    const { schedules, ...clubData } = body;

    // 1. Create Club
    const clubRes = await fetch(`${API_URL}/clubs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify(clubData),
    });

    const club = await clubRes.json();

    if (!clubRes.ok) {
      return NextResponse.json(
        { error: club.message || 'Failed to create club' },
        { status: clubRes.status }
      );
    }

    const clubId = club.id || club._id;

    // 2. Create Schedules if they exist
    if (schedules && Array.isArray(schedules) && schedules.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const schedulePromises = schedules.map((schedule: any) => {
        const { temp_id, ...restSchedule } = schedule; // Remove temp_id
        const scheduleData = {
          ...restSchedule,
          club_id: clubId,
        };

        return fetch(`${API_URL}/schedules`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify(scheduleData),
        });
      });

      await Promise.all(schedulePromises);
    }

    return NextResponse.json(club);
  } catch (error) {
    console.error('Error creating club:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    const res = await fetch(`${API_URL}/clubs`, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
    const data = await res.json();
    
    if (!res.ok) {
        return NextResponse.json({ error: data.message || 'Failed to fetch clubs' }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching clubs:', error);
    return NextResponse.json([], { status: 500 });
  }
}
