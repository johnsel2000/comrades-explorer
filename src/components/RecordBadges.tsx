export default function RecordBadges({ records }: { records?: string[] }) {
  if (!records || records.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5 ml-1">
      {records.includes("overall") && (
        <span className="inline-flex items-center px-1 py-px rounded text-[9px] font-bold bg-amber-400 text-amber-900" title="Course record">CR</span>
      )}
      {records.includes("up") && (
        <span className="inline-flex items-center px-1 py-px rounded text-[9px] font-bold bg-red-100 text-red-700" title="Up record">↑R</span>
      )}
      {records.includes("down") && (
        <span className="inline-flex items-center px-1 py-px rounded text-[9px] font-bold bg-blue-100 text-blue-700" title="Down record">↓R</span>
      )}
    </span>
  );
}
