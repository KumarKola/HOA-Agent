import './treats.css';

export const metadata = {
  title: 'Trick-or-Treat Map · Liberty',
  description: 'Find the houses handing out candy in the Liberty community this Halloween, or add yours.',
};

export const viewport = { themeColor: '#17141f' };

export default function TreatsLayout({ children }: { children: React.ReactNode }) {
  return <div className="tt">{children}</div>;
}
