import { memo } from "react";
import { MessageSquare, Headphones, FolderOpen, ExternalLink, Layout, FileText, Hash, Mic, Paperclip, Share2, CheckSquare } from "lucide-react";

function TextRoomContent({ node }) {
  const msgCount = node.metadata?.messageCount || 0;
  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
        <Hash size={10} />
        <span>Chat · {node.metadata?.channelName || "general"}</span>
      </div>
      <div className="flex-1 flex flex-col gap-1">
        {node.metadata?.preview ? (
          <p className="text-[11px] text-slate-300 line-clamp-3">{node.metadata.preview}</p>
        ) : (
          <p className="text-[11px] text-slate-500 italic">No messages yet</p>
        )}
      </div>
      <div className="flex items-center gap-2 text-[10px] text-slate-500">
        <MessageSquare size={10} />
        <span>{msgCount} messages</span>
      </div>
    </div>
  );
}

function VoiceRoomContent({ node }) {
  return (
    <div className="flex flex-col gap-2 h-full items-center justify-center">
      <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
        <Headphones size={18} className="text-purple-400" />
      </div>
      <p className="text-[11px] text-slate-400">Voice channel</p>
      {node.metadata?.activeUsers && (
        <div className="flex items-center gap-1 text-[10px] text-green-400">
          <Mic size={10} />
          <span>{node.metadata.activeUsers} connected</span>
        </div>
      )}
    </div>
  );
}

function FileRoomContent({ node }) {
  const fileCount = node.metadata?.fileCount || 0;
  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
        <FolderOpen size={10} />
        <span>Shared files</span>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-1">
          <Paperclip size={16} className="text-emerald-400/60" />
          <p className="text-[11px] text-slate-500">
            {fileCount > 0 ? `${fileCount} files` : "No files yet"}
          </p>
        </div>
      </div>
    </div>
  );
}

function PublishingRoomContent({ node }) {
  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
        <Share2 size={10} />
        <span>Published works</span>
      </div>
      <div className="flex-1 flex flex-col gap-1 items-center justify-center">
        {node.metadata?.publishedItems?.length > 0 ? (
          node.metadata.publishedItems.slice(0, 3).map((item, i) => (
            <div key={i} className="flex items-center gap-1 text-[10px] text-slate-300 w-full truncate">
              <FileText size={8} className="text-orange-400" />
              <span className="truncate">{item.title}</span>
            </div>
          ))
        ) : (
          <p className="text-[11px] text-slate-500 italic">No publications</p>
        )}
      </div>
      {node.metadata?.nftLinked && (
        <div className="flex items-center gap-1 text-[10px] text-cyan-400">
          <ExternalLink size={10} />
          <span>NFT linked</span>
        </div>
      )}
    </div>
  );
}

function WorkspaceContent({ node }) {
  const taskCount = node.metadata?.taskCount || 0;
  const memberCount = node.metadata?.memberCount || 0;
  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
        <Layout size={10} />
        <span>Workspace</span>
      </div>
      <div className="flex-1 grid grid-cols-2 gap-1.5">
        <div className="rounded-md bg-blue-500/5 p-2 text-center">
          <CheckSquare size={12} className="text-blue-400 mx-auto mb-0.5" />
          <p className="text-[10px] text-slate-300 font-medium">{taskCount}</p>
          <p className="text-[8px] text-slate-500">Tasks</p>
        </div>
        <div className="rounded-md bg-slate-500/5 p-2 text-center">
          <MessageSquare size={12} className="text-slate-400 mx-auto mb-0.5" />
          <p className="text-[10px] text-slate-300 font-medium">{memberCount}</p>
          <p className="text-[8px] text-slate-500">Members</p>
        </div>
      </div>
      {node.metadata?.progress !== undefined && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
              style={{ width: `${node.metadata.progress}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-400">{node.metadata.progress}%</span>
        </div>
      )}
    </div>
  );
}

export const RoomTypeContent = memo(function RoomTypeContent({ node }) {
  switch (node.type) {
    case "text_room":
      return <TextRoomContent node={node} />;
    case "voice_room":
      return <VoiceRoomContent node={node} />;
    case "file_room":
      return <FileRoomContent node={node} />;
    case "publishing_room":
      return <PublishingRoomContent node={node} />;
    case "workspace":
      return <WorkspaceContent node={node} />;
    default:
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-[11px] text-slate-500">{node.type} node</p>
        </div>
      );
  }
});
