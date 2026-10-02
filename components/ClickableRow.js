'use client';

import { useRouter } from 'next/navigation';

export default function ClickableRow({ href, className = '', children }) {
  const router = useRouter();
  return (
    <tr className={`row ${className}`} onClick={() => router.push(href)}>
      {children}
    </tr>
  );
}
