import { memo, useCallback, useState } from "react";
import { toggleReaction } from "../../../../shared/services/api";
import Reactions from "../Reactions";
import { formatTime, resolveAvatar } from "../../utils";

const EMOJI_PICKER = ["👍", "❤️", "😂", "😮", "🎉", "🔥", "👏", "✅"];

function MessageItem({ msg, isMine, currentUserId, onDelete, onEdit, onReply, onPin, onReact }) {
  const [showActions, setShowActions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleStartEdit = useCallback(() => {
    setEditText(msg.text || "");
    setEditing(true);
  }, [msg.text]);

  const handleSaveEdit = useCallback(() => {
    onEdit?.(msg._id, editText.trim());
    setEditing(false);
  }, [msg._id, editText, onEdit]);

  const handleReact = useCallback(async (messageId, emoji) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      await toggleReaction(messageId, emoji, token);
    } catch { /* silent */ }
  }, []);

  const hasAttachments = msg.attachments?.length > 0;
  const firstAttachment = hasAttachments ? msg.attachments[0] : null;

  return (
    <div
      className={`group flex ${isMine ? "justify-end" : "justify-start"}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowEmojiPicker(false); }}
    >
      <div className={`relative max-w-[75%] ${isMine ? "items-end" : "items-start"}`}>
        {/* Reply indicator */}
        {msg.replyTo && (
          <div className="mb-1 px-3 py-1 rounded-lg bg-white/[0.03] border-l-2 border-cyan-400/50 text-[10px] text-gray-500">
            Replying to a message
          </div>
        )}

        {/* Message body */}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm ${
            isMine
              ? "bg-cyan-500/10 border border-cyan-500/20 text-white"
              : "bg-white/[0.04] border border-white/[0.06] text-gray-200"
          }`}
        >
          {/* Image attachment */}
          {msg.image && (
            <div className="mb-2">
              <img
                src={resolveAvatar(msg.image)}
                alt=""
                className="max-w-full max-h-64 rounded-lg object-cover cursor-pointer hover:opacity-90 transition"
                loading="lazy"
                onClick={() => window.open(resolveAvatar(msg.image), "_blank")}
              />
            </div>
          )}

          {/* File attachment */}
          {!msg.image && firstAttachment && firstAttachment.type === "file" && (
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2 border border-white/[0.06]">
              <span className="text-sm">📎</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-white truncate">{firstAttachment.name}</p>
                <p className="text-[10px] text-gray-500">
                  {firstAttachment.size ? `${(firstAttachment.size / 1024).toFixed(1)} KB` : ""}
                </p>
              </div>
              <a
                href={resolveAvatar(firstAttachment.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-cyan-400 hover:text-cyan-300 shrink-0"
              >
                Open
              </a>
            </div>
          )}

          {/* Video attachment */}
          {firstAttachment && firstAttachment.type === "video" && (
            <div className="mb-2 rounded-lg overflow-hidden">
              <video
                src={resolveAvatar(firstAttachment.url)}
                controls
                className="max-w-full max-h-64 rounded-lg"
                preload="metadata"
              />
            </div>
          )}

          {/* Voice message */}
          {msg.messageType === "voice" && msg.audioUrl && (
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2">
              <audio
                src={resolveAvatar(msg.audioUrl)}
                controls
                className="h-8 max-w-[200px]"
                preload="none"
              />
              {msg.audioDuration ? (
                <span className="text-[10px] text-gray-500 font-mono">
                  {Math.floor(msg.audioDuration / 60)}:{String(msg.audioDuration % 60).padStart(2, "0")}
                </span>
              ) : null}
            </div>
          )}

          {/* Text content */}
          {editing ? (
            <div className="flex flex-col gap-1">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full rounded-lg bg-black/30 border border-white/[0.08] px-2 py-1 text-sm text-white outline-none resize-none"
                rows={2}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                  if (e.key === "Escape") setEditing(false);
                }}
              />
              <div className="flex items-center gap-2">
                <button onClick={handleSaveEdit} className="text-[10px] text-cyan-400 hover:text-cyan-300">Save</button>
                <button onClick={() => setEditing(false)} className="text-[10px] text-gray-500 hover:text-gray-300">Cancel</button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words">{msg.text}</p>
          )}

          {/* Edited indicator */}
          {msg.edited && !editing && (
            <span className="text-[9px] text-gray-600 ml-1">(edited)</span>
          )}
        </div>

        {/* Reactions */}
        <Reactions
          reactions={msg.reactions}
          messageId={msg._id}
          isMine={isMine}
          onReact={handleReact}
        />

        {/* Meta row */}
        <div className={`flex items-center gap-2 mt-0.5 ${isMine ? "justify-end" : "justify-start"}`}>
          <span className="text-[10px] text-gray-600">{formatTime(msg.createdAt)}</span>
          {msg.read && isMine && (
            <span className="text-[10px] text-cyan-400">✓✓</span>
          )}
          {msg.pinned && (
            <span className="text-[10px] text-yellow-500">📌</span>
          )}
        </div>

        {/* Hover actions */}
        {showActions && isMine && !editing && (
          <div className={`absolute -top-6 flex items-center gap-0.5 rounded-lg bg-gray-900 border border-white/[0.08] px-1 py-0.5 shadow-lg z-10 ${isMine ? "right-0" : "left-0"}`}>
            <button onClick={() => onReply?.(msg)} className="px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-white transition" title="Reply">↩</button>
            <button onClick={handleStartEdit} className="px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-white transition" title="Edit">✏️</button>
            <button onClick={() => onPin?.(msg._id)} className="px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-yellow-400 transition" title="Pin">📌</button>
            <button onClick={() => onDelete?.(msg._id)} className="px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-red-400 transition" title="Delete">🗑️</button>
            <div className="relative">
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-white transition"
                title="React"
              >
                😊
              </button>
              {showEmojiPicker && (
                <div className={`absolute bottom-full mb-1 flex gap-0.5 bg-gray-900 border border-white/[0.08] rounded-lg px-1.5 py-1 shadow-xl z-50 ${isMine ? "right-0" : "left-0"}`}>
                  {EMOJI_PICKER.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => { handleReact(msg._id, emoji); setShowEmojiPicker(false); }}
                      className="h-5 w-5 flex items-center justify-center hover:bg-white/[0.08] rounded text-[11px] transition hover:scale-125"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {showActions && !isMine && !editing && (
          <div className={`absolute -top-6 flex items-center gap-0.5 rounded-lg bg-gray-900 border border-white/[0.08] px-1 py-0.5 shadow-lg z-10 ${isMine ? "right-0" : "left-0"}`}>
            <button onClick={() => onReply?.(msg)} className="px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-white transition" title="Reply">↩</button>
            <div className="relative">
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-white transition"
                title="React"
              >
                😊
              </button>
              {showEmojiPicker && (
                <div className={`absolute bottom-full mb-1 flex gap-0.5 bg-gray-900 border border-white/[0.08] rounded-lg px-1.5 py-1 shadow-xl z-50 ${isMine ? "right-0" : "left-0"}`}>
                  {EMOJI_PICKER.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => { handleReact(msg._id, emoji); setShowEmojiPicker(false); }}
                      className="h-5 w-5 flex items-center justify-center hover:bg-white/[0.08] rounded text-[11px] transition hover:scale-125"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(MessageItem);
