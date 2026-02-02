import type { Metadata, Viewport } from 'next';
import './globals.css';
import Providers from './providers';
import Footer from './components/Footer';

export const metadata: Metadata = {
  metadataBase: new URL('https://badmintoner-app.vercel.app'),
  title: {
    template: '%s | Badmintoner',
    default: 'Badmintoner | Manage Badminton Clubs, Games & Events',
  },
  description: 'Badmintoner helps badminton clubs manage player queues, games, courts, and club schedules in one simple platform.',
  keywords: ['badminton', 'club management', 'queuing system', 'player stats', 'court management', 'sports organizer', 'tournament', 'badminton queue'],
  authors: [{ name: 'Nooons' }],
  creator: 'Nooons',
  applicationName: 'Badmintoner',
  openGraph: {
    title: 'Badmintoner | Manage Badminton Clubs, Games & Events',
    description: 'Badmintoner helps badminton clubs manage player queues, games, courts, and club schedules in one simple platform.',
    url: 'https://badmintoner-app.vercel.app', 
    siteName: 'Badmintoner',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/og-image.jpg?v=2',
        width: 1200,
        height: 630,
        alt: 'Badmintoner Preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Badmintoner | Manage Badminton Clubs, Games & Events',
    description: 'Badmintoner helps badminton clubs manage player queues, games, courts, and club schedules in one simple platform.',
    images: ['/og-image.jpg?v=2'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: '#52c41a', // Green theme color matching the app
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1 }}>
              {children}
            </div>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
