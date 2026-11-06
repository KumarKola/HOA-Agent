import '../treats/treats.css';
import './holiday.css';

export const metadata = {
  title: 'Holiday Decor Contest · Liberty',
  description: 'Enter your decorated home on the Liberty community map, then vote for your favorite.',
};

export const viewport = { themeColor: '#10241c' };

export default function HolidayLayout({ children }: { children: React.ReactNode }) {
  return <div className="tt hd">{children}</div>;
}
