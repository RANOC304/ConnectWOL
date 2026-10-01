import Link from 'next/link';
import { EmptyArt } from '@/components/devices/EmptyArt';

export default function NotFound() {
  return (
    <div className="auth">
      <div className="auth__card" style={{ textAlign: 'center' }}>
        <EmptyArt className="empty__art" />
        <h1>Nothing here</h1>
        <p className="auth__lead">This page does not exist. It may have moved, or the link is mistyped.</p>
        <Link className="btn" href="/">
          Back to your computers
        </Link>
      </div>
    </div>
  );
}
