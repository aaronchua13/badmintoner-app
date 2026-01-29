import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_TARGET_URL || 'http://localhost:3000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const res = await fetch(`${API_URL}/courts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    
    if (!res.ok) {
        return NextResponse.json({ error: data.message || 'Failed to create court' }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating court:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const res = await fetch(`${API_URL}/courts`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching courts:', error);
    return NextResponse.json([], { status: 500 });
  }
}
