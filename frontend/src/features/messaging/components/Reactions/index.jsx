import { memo } from "react";

const EMOJI_LIST = ["👍", "❤️", "😂", "😮", "🎉", "🔥", "👏", "✅"];

function Reactions({ reactions = [], messageId, onReact, isMine }) {
  if (!reactions || reactions.length === 0) {
    return (
      <div className={`flex items-center gap-1 mt-1 ${isMine ? "justify-end" : "justify-start"}`}>
        <div className="flex -space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {EMOJI_LIST.slice(0, 4).map(emoji => (
            <button
              key={emoji}
              onClick={() => onReact?.(messageId, emoji)}
              className="h-5 w-5 flex items-center justify-center rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-[10px] transition hover:scale-110"
              title={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 mt-1 flex-wrap ${isMine ? "justify-end" : "justify-start"}`}>
      {reactions.map((r) => {
        if (!r.emoji || r.users?.length === 0) return null;
        return (
          <button
            key={r.emoji}
            onClick={() => onReact?.(messageId, r.emoji)}
            className="flex items-center gap-1 rounded-full bg-white/[0.04] px-1.5 py-0.5 text-[10px] hover:bg-white/[0.08] transition active:scale-95"
          >
            <span>{r.emoji}</span>
            <span className="text-[9px] text-gray-400">{r.users.length}</span>
          </button>
        );
      })}
      <div className="relative group">
        <button className="h-4 w-4 flex items-center justify-center rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-[10px] transition opacity-0 group-hover:opacity-100 hover:opacity-100">
          +
        </button>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:flex gap-0.5 bg-gray-900 border border-white/[0.08] rounded-lg px-1.5 py-1 shadow-xl z-50">
          {EMOJI_LIST.map(emoji => (
            <button
              key={emoji}
              onClick={() => onReact?.(messageId, emoji)}
              className="h-5 w-5 flex items-center justify-center hover:bg-white/[0.08] rounded text-[11px] transition hover:scale-125"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default memo(Reactions);
