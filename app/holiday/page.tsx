import { ContestPage, contestMetadata } from './render';

export const dynamic = 'force-dynamic';
export const metadata = contestMetadata('liberty');

// Liberty's contest (the original link). Other communities: /holiday/<community>.
export default function HolidayPage() {
  return <ContestPage slug="liberty" />;
}
