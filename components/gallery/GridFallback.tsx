export default function GridFallback({ count = 12 }: { count?: number }) {
  return (
    <div className="mt-4 animate-pulse">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="aspect-4/3 bg-gray-200" />
            <div className="p-3">
              <div className="mb-2 h-3 w-3/4 rounded bg-gray-200" />
              <div className="h-3 w-1/2 rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
