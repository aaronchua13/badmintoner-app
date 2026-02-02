import { Metadata } from 'next';
import QueuingClient from './QueuingClient';

export const metadata: Metadata = {
  title: 'Badminton Queuing System | Badmintoner',
  description: 'Manage badminton sessions, courts, and player queues efficiently.',
};

export default function QueuingPage() {
  return <QueuingClient />;
}
