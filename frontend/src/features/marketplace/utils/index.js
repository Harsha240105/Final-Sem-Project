const POST_TYPE_META = {
  looking_for_dev: { label: "Looking for Developer", icon: "💻", color: "bg-blue-500/20 text-blue-400 border-blue-500/20" },
  looking_for_designer: { label: "Looking for Designer", icon: "🎨", color: "bg-pink-500/20 text-pink-400 border-pink-500/20" },
  open_collaboration: { label: "Open Collaboration", icon: "🤝", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/20" },
  research_project: { label: "Research Project", icon: "🔬", color: "bg-purple-500/20 text-purple-400 border-purple-500/20" },
  community_recruitment: { label: "Community Recruitment", icon: "🌐", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/20" },
};

const STATUS_META = {
  recruiting: { label: "Recruiting", color: "bg-amber-500/20 text-amber-400 border-amber-500/20" },
  active: { label: "Active", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/20" },
  reviewing: { label: "Reviewing", color: "bg-blue-500/20 text-blue-400 border-blue-500/20" },
  completed: { label: "Completed", color: "bg-purple-500/20 text-purple-400 border-purple-500/20" },
  archived: { label: "Archived", color: "bg-gray-500/20 text-gray-400 border-gray-500/20" },
};

export { POST_TYPE_META, STATUS_META };
