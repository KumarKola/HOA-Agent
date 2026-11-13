import { ContestPage, contestMetadata } from '../render';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ community: string }> };

export async function generateMetadata({ params }: Props) {
  return contestMetadata((await params).community);
}

export default async function CommunityHolidayPage({ params }: Props) {
  return <ContestPage slug={(await params).community} />;
}
