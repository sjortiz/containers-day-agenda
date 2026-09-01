import agendaData from '@/data/agenda.json';
import type { Agenda } from '@/types';
import EventLibrary from '@/components/EventLibrary';

export default function Page() {
  return <EventLibrary bundledAgenda={agendaData as Agenda} />;
}
