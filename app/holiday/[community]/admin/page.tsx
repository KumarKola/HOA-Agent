import { getCommunity } from '@/lib/communities';
import { OrganizerPage } from '../../render';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ community: string }> };

export async function generateMetadata({ params }: Props) {
  const cm = getCommunity((await params).community);
  return { title: `Holiday contest organizer · ${cm?.short ?? ''}`, robots: { index: false } };
}

export default async function CommunityOrganizerPage({ params }: Props) {
  return <OrganizerPage slug={(await params).community} />;
}
