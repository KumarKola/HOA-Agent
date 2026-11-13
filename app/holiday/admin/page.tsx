import { OrganizerPage } from '../render';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Holiday contest organizer · Liberty', robots: { index: false } };

export default function Page() {
  return <OrganizerPage slug="liberty" />;
}
