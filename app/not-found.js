import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="empty">
      <h1>Not found</h1>
      <p>That candidate doesn't exist. <Link href="/">Back to dashboard</Link></p>
    </div>
  );
}
