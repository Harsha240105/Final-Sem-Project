import { memo } from "react";
import { formatTime, resolveAvatar } from "../../utils";

function PinnedMessages({ messages = [], onUnpin }) {
  if (!messages || messages.length === 0) return null;

  return (
    <div className="border-b border-white/[0.06] bg-yellow-500/5">
      <div className="flex items-center gap-2 px-4 py-2">
        <span className="text-yellow-500 text-sm">📌</span>
        <span className="text-[10px] text-yellow-400 font-semibold uppercase tracking-wider">Pinned</span>
        <span className="text-[10px] text-gray-500">{messages.length}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-thin">
        {messages.slice(0, 3).map((msg) => (
          <div
            key={msg._id}
            className="flex-shrink-0 max-w-[200px] rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2"
          >
            <div className="flex items-center gap-2 mb-1">
              {msg.sender?.avatar ? (
                <img src={resolveAvatar(msg.sender.avatar)} alt="" className="h-4 w-4 rounded-full object-cover" />
              ) : (
                <div className="h-4 w-4 rounded-full bg-cyan-500/30 flex items-center justify-center text-[8px] text-white font-bold">
                  {msg.sender?.name?.charAt(0) || "?"}
                </div>
              )}
              <span className="text-[10px] text-gray-400 truncate">{msg.sender?.name || "Unknown"}</span>
            </div>
            <p className="text-[10px] text-gray-300 line-clamp-2">{msg.text || "[attachment]"}</p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[8px] text-gray-600">{formatTime(msg.pinnedAt || msg.createdAt)}</span>
              {onUnpin && (
                <button
                  onClick={() => onUnpin(msg._id)}
                  className="text-[8px] text-gray-600 hover:text-red-400 transition"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(PinnedMessages);
