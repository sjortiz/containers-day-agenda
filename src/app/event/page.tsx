import agendaData from '@/data/agenda.json';
import type { Agenda } from '@/types';
import EventPageLoader from '@/components/EventPageLoader';

export default function EventPage() {
  return <EventPageLoader bundledAgenda={agendaData as Agenda} />;
}
