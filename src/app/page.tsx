import agendaData from '@/data/agenda.json';
import type { Agenda } from '@/types';
import AgendaApp from '@/components/AgendaApp';

export default function Page() {
  return <AgendaApp agenda={agendaData as Agenda} />;
}
