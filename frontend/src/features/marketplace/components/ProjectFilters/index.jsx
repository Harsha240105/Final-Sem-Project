import { POST_TYPE_META } from "../../utils";

const STATUS_OPTIONS = [
  { value: "", label: "All Status" },
  { value: "recruiting", label: "Recruiting" },
  { value: "active", label: "Active" },
  { value: "reviewing", label: "Reviewing" },
  { value: "completed", label: "Completed" },
];

export default function ProjectFilters({ filters, onChange }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1">
      <div className="flex items-center gap-1 shrink-0">
        {Object.entries(POST_TYPE_META).map(([key, meta]) => (
          <button
            key={key}
            onClick={() => onChange({ ...filters, postType: filters.postType === key ? "" : key })}
            className={`shrink-0 rounded-md px-2.5 py-1 text-[10px] font-medium whitespace-nowrap transition border ${
              filters.postType === key ? `${meta.color} border-current` : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {meta.icon} {meta.label}
          </button>
        ))}
      </div>
      <div className="w-px h-4 bg-slate-700/50 shrink-0" />
      <select
        value={filters.status || ""}
        onChange={e => onChange({ ...filters, status: e.target.value || "" })}
        className="rounded-md border border-slate-700/50 bg-transparent px-2 py-1 text-[10px] text-slate-400 outline-none shrink-0"
      >
        {STATUS_OPTIONS.map(s => (
          <option key={s.value} value={s.value} className="bg-slate-900">{s.label}</option>
        ))}
      </select>
      {filters.postType && (
        <button
          onClick={() => onChange({})}
          className="rounded-md px-2 py-1 text-[10px] text-red-400 hover:text-red-300 border border-red-500/20 shrink-0"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
