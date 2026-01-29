import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_TARGET_URL || 'http://localhost:3000';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    const body = await request.json();

    const res = await fetch(`${API_URL}/schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.message || 'Failed to create schedule' },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating schedule:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    const { searchParams } = new URL(request.url);
    const query = searchParams.toString();
    
    const res = await fetch(`${API_URL}/schedules?${query}`, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
    const data = await res.json();

    if (!res.ok) {
        return NextResponse.json({ error: data.message || 'Failed to fetch schedules' }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    return NextResponse.json([], { status: 500 });
  }
}
