import { Send, Plus, Circle } from "lucide-react";

function timeAgo(date) {
  if (!date) return "";
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`;
  return new Date(date).toLocaleDateString();
}

export default function WorkspacePanel({
  workspace, workspaceMsg, onMsgChange, onSendMsg,
  newTaskTitle, onTaskTitleChange, onAddTask, onUpdateTask, currentUserId,
}) {
  const generalChannel = workspace.channels?.find(c => c.name === "general");
  const messages = generalChannel?.messages || [];
  const tasks = workspace.tasks || [];
  const members = workspace.members || [];

  const todoTasks = tasks.filter(t => t.status === "todo");
  const inProgressTasks = tasks.filter(t => t.status === "in_progress");
  const doneTasks = tasks.filter(t => t.status === "done");

  return (
    <div className="rounded-lg border border-emerald-500/20 bg-slate-900/30 overflow-hidden">
      <div className="px-3 py-2 bg-emerald-500/5 border-b border-emerald-500/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-sm font-semibold text-white">{workspace.name}</span>
        </div>
        <span className="text-xs text-slate-500">{members.length} members</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
        {/* Chat */}
        <div className="md:col-span-2 border-r border-slate-700/30 p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider"># general</span>
          </div>
          <div className="h-48 overflow-y-auto space-y-2 mb-2 scrollbar-thin">
            {messages.length === 0 && (
              <p className="text-xs text-slate-600 text-center pt-8">No messages yet. Start the conversation!</p>
            )}
            {messages.map((msg, i) => (
              <div key={msg._id || i} className="flex items-start gap-2">
                <div className="h-5 w-5 shrink-0 rounded-full bg-cyan-500/20 flex items-center justify-center text-[8px] font-bold text-white mt-0.5">
                  {msg.author?.name?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-300">{msg.author?.name || "Unknown"}</span>
                    <span className="text-[9px] text-slate-600">{timeAgo(msg.createdAt)}</span>
                  </div>
                  <p className="text-xs text-slate-400">{msg.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={workspaceMsg} onChange={e => onMsgChange(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onSendMsg(); } }} placeholder="Type a message..." className="flex-1 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/40" />
            <button onClick={onSendMsg} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-white hover:bg-emerald-400 transition">
              <Send size={14} />
            </button>
          </div>
        </div>

        {/* Sidebar: Tasks + Members */}
        <div className="p-3 space-y-3">
          {/* Tasks */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tasks ({tasks.length})</h4>
            <div className="space-y-1.5 max-h-32 overflow-y-auto scrollbar-thin">
              {todoTasks.map(t => (
                <div key={t._id} className="flex items-center gap-2 text-xs">
                  <button onClick={() => onUpdateTask(t._id, "in_progress")} className="shrink-0 text-slate-600 hover:text-emerald-400 transition">
                    <Circle size={10} />
                  </button>
                  <span className="text-slate-300 truncate flex-1">{t.title}</span>
                </div>
              ))}
              {inProgressTasks.map(t => (
                <div key={t._id} className="flex items-center gap-2 text-xs">
                  <button onClick={() => onUpdateTask(t._id, "done")} className="shrink-0 text-amber-400">
                    <Circle size={10} fill="currentColor" />
                  </button>
                  <span className="text-amber-300 truncate flex-1">{t.title}</span>
                </div>
              ))}
              {doneTasks.map(t => (
                <div key={t._id} className="flex items-center gap-2 text-xs">
                  <span className="shrink-0 text-emerald-400">✓</span>
                  <span className="text-slate-500 line-through truncate flex-1">{t.title}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-1 mt-2">
              <input value={newTaskTitle} onChange={e => onTaskTitleChange(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onAddTask(); } }} placeholder="Add task..." className="flex-1 rounded-lg border border-slate-700 bg-slate-900/50 px-2 py-1 text-[10px] text-slate-200 outline-none focus:border-emerald-500/40" />
              <button onClick={onAddTask} className="rounded-lg bg-emerald-500/20 px-2 py-1 text-emerald-400 hover:bg-emerald-500/30 transition">
                <Plus size={10} />
              </button>
            </div>
          </div>

          {/* Members */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Members</h4>
            <div className="space-y-1">
              {members.map((m, i) => (
                <div key={m._id || i} className="flex items-center gap-2 text-xs">
                  <div className="h-4 w-4 shrink-0 rounded-full bg-cyan-500/20 flex items-center justify-center text-[7px] font-bold text-white">
                    {m.name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <span className="text-slate-300 truncate flex-1">{m.name || "Unknown"}</span>
                  {m._id === currentUserId && <span className="text-[9px] text-cyan-400">you</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
