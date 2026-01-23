import { getEventsAction } from '@/app/actions/admin';
import EventsClient from './EventsClient';

export default async function EventsPage() {
  const events = await getEventsAction();
  return <EventsClient initialEvents={events} />;
}
