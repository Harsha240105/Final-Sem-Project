import { useState } from "react";

function CommunityRules({ rules, isAdmin, onSave }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(rules || "");

  if (!rules && !isAdmin) return null;

  const handleSave = () => {
    onSave?.(text);
    setEditing(false);
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">📋 Rules</h3>
        {isAdmin && !editing && (
          <button onClick={() => setEditing(true)} className="text-[10px] text-gray-500 hover:text-white transition">
            {rules ? "Edit" : "Add"}
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-xs text-white outline-none resize-none focus:border-cyan-500/40"
            rows={4}
            maxLength={3000}
            placeholder="Enter community rules..."
          />
          <div className="flex gap-2">
            <button onClick={handleSave} className="rounded-lg bg-cyan-500 px-3 py-1 text-[10px] font-semibold text-white hover:bg-cyan-400 transition">Save</button>
            <button onClick={() => { setEditing(false); setText(rules || ""); }} className="rounded-lg border border-white/[0.08] px-3 py-1 text-[10px] text-gray-400 hover:text-white transition">Cancel</button>
          </div>
        </div>
      ) : rules ? (
        <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{rules}</p>
      ) : (
        <p className="text-xs text-gray-500 italic">No rules set</p>
      )}
    </div>
  );
}

export default CommunityRules;
