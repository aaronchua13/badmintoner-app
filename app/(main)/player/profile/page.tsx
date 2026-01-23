import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

const API_URL = process.env.API_TARGET_URL || 'http://localhost:3000';

async function getProfile() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
        return null;
    }

    try {
        const res = await fetch(`${API_URL}/players/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!res.ok) {
            return null;
        }

        return await res.json();
    } catch {
        return null;
    }
}

export default async function ProfileRedirectPage() {
    const profile = await getProfile();

    if (!profile) {
        redirect('/player/login');
    }

    const identifier = profile.username || profile._id;
    redirect(`/player/profile/${identifier}`);
}
