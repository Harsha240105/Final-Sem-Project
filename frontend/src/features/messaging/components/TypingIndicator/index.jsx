import { memo } from "react";

function TypingIndicator({ typingUsers, activeChat }) {
  const name = activeChat ? typingUsers[activeChat] : null;
  if (!name) return null;
  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <div className="flex items-center gap-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
      <span className="text-[10px] text-cyan-400">{name} is typing...</span>
    </div>
  );
}

export default memo(TypingIndicator);
