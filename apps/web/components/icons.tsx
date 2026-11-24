export function LockIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={className}>
      <path fillRule="evenodd" d="M10 2a4 4 0 0 0-4 4v2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1V6a4 4 0 0 0-4-4Zm2 6V6a2 2 0 1 0-4 0v2h4Z" clipRule="evenodd" />
    </svg>
  );
}

export function EyeOffIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M3.3 2.3a1 1 0 0 0-1.4 1.4l14 14a1 1 0 0 0 1.4-1.4l-1.6-1.6A9.7 9.7 0 0 0 19 10c-1.4-3.5-5-6-9-6-1.4 0-2.7.3-3.9.8L3.3 2.3ZM8 6.4l1.6 1.6a2 2 0 0 1 2.4 2.4l1.6 1.6A4 4 0 0 0 8 6.4ZM1 10a9.8 9.8 0 0 1 2.5-3.6l2.6 2.6a4 4 0 0 0 4.9 4.9l1.9 1.9c-.9.3-1.9.4-2.9.4-4 0-7.6-2.5-9-6Z" />
    </svg>
  );
}
