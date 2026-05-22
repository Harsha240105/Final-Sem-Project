import { memo } from "react";
import { Users } from "lucide-react";

export const PresenceIndicators = memo(function PresenceIndicators({ presences }) {
  const users = [...presences.values()].filter((p) => p.online);

  if (users.length === 0) return null;

  return (
    <div className="absolute top-4 right-4 z-40 flex items-center gap-2">
      <div className="flex items-center -space-x-2">
        {users.slice(0, 5).map((user) => (
          <div
            key={user.userId}
            className="relative h-7 w-7 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-slate-900"
            title={user.userName}
          >
            {user.userName?.split(" ").map((w) => w[0]).join("").slice(0, 2) || "U"}
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-400 ring-1 ring-slate-900" />
          </div>
        ))}
        {users.length > 5 && (
          <div className="h-7 w-7 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-slate-300 font-medium ring-2 ring-slate-900">
            +{users.length - 5}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800/60 text-slate-400">
        <Users size={12} />
        <span className="text-[10px] font-medium">{users.length}</span>
      </div>
    </div>
  );
});
