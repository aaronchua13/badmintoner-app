import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Badmintoner - Badminton Queuing System';
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f0f2f5',
          backgroundImage: 'linear-gradient(135deg, #f0f2f5 0%, #d9f7be 100%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'white',
            padding: '40px 80px',
            borderRadius: '20px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.1)',
          }}
        >
          <div
            style={{
              fontSize: 80,
              fontWeight: 'bold',
              color: '#389e0d', // Ant Design Green-7
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            🏸 Badmintoner
          </div>
          <div
            style={{
              fontSize: 32,
              color: '#52c41a', // Ant Design Green-6
              textAlign: 'center',
              maxWidth: '800px',
            }}
          >
            Smart Badminton Queue Management System
          </div>
          <div
            style={{
              marginTop: 40,
              display: 'flex',
              gap: '20px',
            }}
          >
            <div
              style={{
                padding: '10px 20px',
                backgroundColor: '#f6ffed',
                border: '2px solid #b7eb8f',
                borderRadius: '10px',
                color: '#389e0d',
                fontSize: 24,
              }}
            >
              Queue Management
            </div>
            <div
              style={{
                padding: '10px 20px',
                backgroundColor: '#f6ffed',
                border: '2px solid #b7eb8f',
                borderRadius: '10px',
                color: '#389e0d',
                fontSize: 24,
              }}
            >
              Match Tracking
            </div>
            <div
              style={{
                padding: '10px 20px',
                backgroundColor: '#f6ffed',
                border: '2px solid #b7eb8f',
                borderRadius: '10px',
                color: '#389e0d',
                fontSize: 24,
              }}
            >
              Player Stats
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
