// app/not-found.tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] grid place-items-center p-8">
      <div className="text-center">
        <h1 className="mb-2 text-2xl font-semibold">404 — Page Not Found</h1>
        <p className="mb-6 text-sm text-gray-500">The page you’re looking for doesn’t exist or was moved.</p>
        <Link href="/" className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
          Back to Home
        </Link>
      </div>
    </div>
  );
}
