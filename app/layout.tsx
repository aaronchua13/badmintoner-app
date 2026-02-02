import type { Metadata, Viewport } from 'next';
import './globals.css';
import Providers from './providers';
import Footer from './components/Footer';

export const metadata: Metadata = {
  metadataBase: new URL('https://badmintoner.vercel.app'),
  title: {
    template: '%s | Badmintoner',
    default: 'Badmintoner - Badminton Club Management & Queuing System',
  },
  description: 'Manage badminton clubs, track player stats, organize queuing sessions, and monitor court usage efficiently with Badmintoner.',
  keywords: ['badminton', 'club management', 'queuing system', 'player stats', 'court management', 'sports organizer', 'tournament', 'badminton queue'],
  authors: [{ name: 'Nooons' }],
  creator: 'Nooons',
  applicationName: 'Badmintoner',
  openGraph: {
    title: 'Badmintoner - Badminton Club Management',
    description: 'Efficiently manage badminton courts, player queues, and match history. The ultimate tool for badminton organizers.',
    url: 'https://badmintoner.vercel.app', 
    siteName: 'Badmintoner',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/og-image.png', // Placeholder for actual OG image
        width: 1200,
        height: 630,
        alt: 'Badmintoner Preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Badmintoner - Badminton Club Management',
    description: 'Efficiently manage badminton courts, player queues, and match history.',
    images: ['/og-image.png'], // Placeholder
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
