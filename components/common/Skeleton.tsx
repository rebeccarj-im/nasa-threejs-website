export default function Skeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="aspect-4/3 bg-gray-200" />
            <div className="space-y-2 p-3">
              <div className="h-3 w-3/4 rounded bg-gray-200" />
              <div className="h-3 w-1/2 rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
