'use client';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="auth">
      <div className="auth__card" style={{ textAlign: 'center' }}>
        <h1>Something went wrong</h1>
        <p className="auth__lead">The server hit an unexpected problem. Your computers and settings are safe. Check the server log for details.</p>
        <button type="button" className="btn" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
