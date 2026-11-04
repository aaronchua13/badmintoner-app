import { Metadata, Viewport } from 'next';

export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 5, userScalable: true, themeColor: '#047857' };
import QueuingClient from './QueuingClient';

export const metadata: Metadata = {
  title: 'Badminton Queuing System | Badmintoner',
  description: 'Manage badminton sessions, courts, and player queues efficiently. Track games, wins, losses, and idle times in real-time.',
  openGraph: {
    title: 'Badminton Queuing System | Badmintoner',
    description: 'Manage badminton sessions, courts, and player queues efficiently. Track games, wins, losses, and idle times in real-time.',
    url: 'https://badmintoner-app.vercel.app/queuing',
    siteName: 'Badmintoner',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Badminton Queuing System | Badmintoner',
    description: 'Manage badminton sessions, courts, and player queues efficiently.',
  },
};

export default function QueuingPage() {
  return <QueuingClient />;
}
