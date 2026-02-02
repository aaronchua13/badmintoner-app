import { Metadata } from 'next';
import ClubsClient from './ClubsClient';

export const metadata: Metadata = {
  title: 'Badminton Clubs | Badmintoner',
  description: 'Find and join badminton clubs, sessions, and events near you.',
  openGraph: {
    title: 'Badminton Clubs | Badmintoner',
    description: 'Find and join badminton clubs, sessions, and events near you. View schedules, locations, and player levels.',
    url: 'https://badmintoner-app.vercel.app/clubs',
    siteName: 'Badmintoner',
    images: [
      {
        url: '/opengraph-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Badminton Clubs',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Badminton Clubs | Badmintoner',
    description: 'Find and join badminton clubs, sessions, and events near you.',
    images: ['/opengraph-image.jpg'],
  },
};

export default function ClubsPage() {
  return <ClubsClient />;
}
