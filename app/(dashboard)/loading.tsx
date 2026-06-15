export default function DashboardLoading() {
  return (
    <div className="space-y-5">
      <div>
        <div className="h-6 w-44 animate-pulse rounded-md bg-[#D0E8DA]" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded-md bg-[#F0EDE6]" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="rounded-xl border border-[#D0E8DA] bg-white p-5 shadow-[var(--shadow-sm)]">
            <div className="h-3 w-28 animate-pulse rounded bg-[#F0EDE6]" />
            <div className="mt-4 h-8 w-24 animate-pulse rounded bg-[#D0E8DA]" />
            <div className="mt-3 h-3 w-36 animate-pulse rounded bg-[#F0EDE6]" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#D0E8DA] bg-white p-5 shadow-[var(--shadow-sm)]">
        <div className="mb-4 h-4 w-36 animate-pulse rounded bg-[#D0E8DA]" />
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((item) => (
            <div key={item} className="h-10 animate-pulse rounded-md bg-[#FAFAF8]" />
          ))}
        </div>
      </div>
    </div>
  );
}
