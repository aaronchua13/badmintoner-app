import { Metadata } from 'next';
import QueuingClient from './QueuingClient';

export const metadata: Metadata = {
  title: 'Badminton Queuing System | Badmintoner',
  description: 'Manage badminton sessions, courts, and player queues efficiently. Track games, wins, losses, and idle times in real-time.',
  openGraph: {
    title: 'Badminton Queuing System | Badmintoner',
    description: 'Manage badminton sessions, courts, and player queues efficiently. Track games, wins, losses, and idle times in real-time.',
    url: 'https://badmintoner-app.vercel.app/queuing',
    siteName: 'Badmintoner',
    images: [
      {
        url: '/og-image.jpg?v=2',
        width: 1200,
        height: 630,
        alt: 'Badminton Queuing System',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Badminton Queuing System | Badmintoner',
    description: 'Manage badminton sessions, courts, and player queues efficiently.',
    images: ['/og-image.jpg?v=2'],
  },
};

export default function QueuingPage() {
  return <QueuingClient />;
}
