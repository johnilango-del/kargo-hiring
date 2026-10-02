import Link from 'next/link';
import './globals.css';

export const metadata = {
  title: 'Kargo Hiring',
  description: 'Candidate ranking for Kargo PM and SPM roles',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="container topbar-inner">
            <Link href="/" className="brand">Kargo <span>Hiring</span></Link>
            <nav>
              <Link href="/">Dashboard</Link>
              <Link href="/upload">Upload CVs</Link>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="container footer">
          The system ranks and explains. Arjun decides. No email is sent without a Confirm click.
        </footer>
      </body>
    </html>
  );
}
