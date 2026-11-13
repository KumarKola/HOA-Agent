// Copyright line shown at the bottom of every screen.
export const OWNER = 'Dinesh Kumar';

export default function Copyright({ className = 'siteFoot' }: { className?: string }) {
  const year = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Phoenix', year: 'numeric' }).format(new Date());
  return (
    <footer className={className}>
      © {year} {OWNER}. All rights reserved.
    </footer>
  );
}
