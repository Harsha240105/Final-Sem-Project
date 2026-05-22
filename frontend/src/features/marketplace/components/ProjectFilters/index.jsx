import { POST_TYPE_META } from "../../utils";

const PROJECT_STATUSES = [
  { value: "", label: "All Status" },
  { value: "recruiting", label: "Recruiting" },
  { value: "active", label: "Active" },
  { value: "reviewing", label: "Reviewing" },
  { value: "completed", label: "Completed" },
];

function ProjectFilters({ filters, onChange }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1">
      <div className="flex items-center gap-1">
        {POST_TYPE_META && Object.entries(POST_TYPE_META).map(([key, meta]) => (
          <button
            key={key}
            onClick={() => onChange({ ...filters, postType: filters.postType === key ? "" : key })}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-[10px] font-medium whitespace-nowrap transition border ${
              filters.postType === key
                ? `${meta.color}`
                : "border-transparent text-gray-500 hover:text-white"
            }`}
          >
            {meta.icon} {meta.label}
          </button>
        ))}
      </div>
      <div className="w-px h-5 bg-white/[0.06]" />
      <select
        value={filters.status || ""}
        onChange={e => onChange({ ...filters, status: e.target.value })}
        className="rounded-lg border border-white/[0.08] bg-transparent px-2 py-1.5 text-[10px] text-gray-400 outline-none"
      >
        {PROJECT_STATUSES.map(s => (
          <option key={s.value} value={s.value} className="bg-gray-900">{s.label}</option>
        ))}
      </select>
    </div>
  );
}

export default ProjectFilters;
