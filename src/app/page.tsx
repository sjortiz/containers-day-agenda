import agendaData from '@/data/agenda.json';
import type { Agenda } from '@/types';
import AgendaApp from '@/components/AgendaApp';
import { CONTAINERS_DAY_EVENT_ID } from '@/lib/event-id';

export default function Page() {
  return <AgendaApp eventId={CONTAINERS_DAY_EVENT_ID} agenda={agendaData as Agenda} />;
}
