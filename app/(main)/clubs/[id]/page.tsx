import { Metadata, ResolvingMetadata } from 'next';
import { getClubByIdAction } from '@/app/actions/club-event';
import ClubDetailClient from './ClubDetailClient';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { id } = await params;
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const club: any = await getClubByIdAction(id);

  if (!club) {
    return {
      title: 'Club Not Found | Badmintoner',
      description: 'The requested badminton club could not be found.',
    };
  }

  const previousImages = (await parent).openGraph?.images || [];
  const clubName = club.name || 'Badminton Club';
  const description = `Join ${clubName} for badminton sessions. Contact: ${club.contact_person_name || 'N/A'}. View schedules and player levels.`;

  return {
    title: `${clubName} | Badmintoner`,
    description: description,
    openGraph: {
      title: `${clubName} | Badmintoner`,
      description: description,
      url: `https://badmintoner-app.vercel.app/clubs/${id}`,
      siteName: 'Badmintoner',
      images: [
        {
          url: '/opengraph-image.jpg',
          width: 1200,
          height: 630,
          alt: clubName,
        },
        ...previousImages,
      ],
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${clubName} | Badmintoner`,
      description: description,
      images: ['/opengraph-image.jpg'],
    },
  };
}

export default async function ClubDetailPage({ params }: Props) {
  const { id } = await params;
  
  // Fetch data on the server to pass to client (SSR)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const club: any = await getClubByIdAction(id);

  return <ClubDetailClient id={id} initialClub={club} />;
}
