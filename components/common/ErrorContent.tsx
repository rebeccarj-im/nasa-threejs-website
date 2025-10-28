'use client';

export default function ErrorContent({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-md border border-red-300 bg-red-50 p-4 text-red-800">
      <div className="text-sm font-medium">Error</div>
      <p className="mt-1 text-sm">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 inline-flex rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs text-red-700 hover:bg-red-100"
        >
          Retry
        </button>
      )}
    </div>
  );
}
