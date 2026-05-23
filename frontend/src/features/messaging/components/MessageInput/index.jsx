import { useState, useRef, useCallback, useEffect } from "react";
import VoiceRecorder from "../VoiceRecorder";
import { useMessageUpload } from "../../hooks/useMessageUpload";

function MessageInput({ activeChat, activeUser, onSend, onVoiceSend, socket, replyTo, onCancelReply }) {
  const [text, setText] = useState("");
  const [showVoice, setShowVoice] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const { upload, uploading, progress } = useMessageUpload();

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend?.(trimmed);
    setText("");
  }, [text, onSend]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleChange = useCallback((e) => {
    setText(e.target.value);
    if (socket && activeChat) {
      socket.emit("typing", { receiverId: activeChat });
      clearTimeout(e.target._typingTimer);
      e.target._typingTimer = setTimeout(() => {
        socket.emit("stop_typing", { receiverId: activeChat });
      }, 1500);
    }
  }, [socket, activeChat]);

  const handleFileSelect = useCallback(async (e) => {
    const files = e.target.files;
    if (!files?.length || !activeChat) return;
    for (const file of files) {
      try {
        await upload(file, activeChat, "", replyTo?._id || null);
      } catch { /* silent */ }
    }
    e.target.value = "";
  }, [activeChat, upload, replyTo]);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (!files?.length || !activeChat) return;
    for (const file of files) {
      try {
        await upload(file, activeChat, text.trim(), replyTo?._id || null);
        setText("");
      } catch { /* silent */ }
    }
  }, [activeChat, upload, text, replyTo]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleVoiceSend = useCallback(async (blob, duration) => {
    if (!activeChat) return;
    try {
      await onVoiceSend?.(blob, duration);
    } catch { /* silent */ }
    setShowVoice(false);
  }, [activeChat, onVoiceSend]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  }, [text]);

  return (
    <div
      className={`border-t border-white/[0.06] p-3 bg-black/10 transition-colors ${dragOver ? "bg-cyan-500/5 border-cyan-500/30" : ""}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {uploading && (
        <div className="mb-2 flex items-center gap-2">
          <div className="h-1 flex-1 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[10px] text-gray-500">Uploading... {progress}%</span>
        </div>
      )}

      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-white/[0.03] border-l-2 border-cyan-400 px-3 py-1.5">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-cyan-400 font-medium">Replying</p>
            <p className="text-xs text-gray-400 truncate">{replyTo.text || "[attachment]"}</p>
          </div>
          <button onClick={onCancelReply} className="text-gray-500 hover:text-white text-xs">✕</button>
        </div>
      )}

      <div className="flex items-end gap-2">
        {showVoice ? (
          <VoiceRecorder onSend={handleVoiceSend} onCancel={() => setShowVoice(false)} />
        ) : (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-shrink-0 rounded-lg px-2 py-2 text-gray-500 hover:text-white hover:bg-white/[0.04] transition"
              title="Attach file"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              multiple
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.zip,.txt,.csv"
            />
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={activeUser ? `Message ${activeUser.name || "user"}...` : "Select a chat..."}
              rows={1}
              className="flex-1 rounded-xl border border-white/[0.08] bg-black/30 px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none resize-none focus:border-cyan-500/40 transition min-h-[38px] max-h-[120px]"
            />
            <button
              onClick={() => setShowVoice(true)}
              className="flex-shrink-0 rounded-lg px-2 py-2 text-gray-500 hover:text-white hover:bg-white/[0.04] transition"
              title="Voice message"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3z" />
                <path d="M17 11a1 1 0 0 0-2 0 3 3 0 0 1-6 0 1 1 0 0 0-2 0 5 5 0 0 0 4 4.9V18H8a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2h-3v-2.1a5 5 0 0 0 4-4.9z" />
              </svg>
            </button>
            <button
              onClick={handleSend}
              disabled={!text.trim()}
              className="flex-shrink-0 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40 hover:bg-cyan-400 transition active:scale-95"
            >
              Send
            </button>
          </>
        )}
      </div>

      {dragOver && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl border-2 border-dashed border-cyan-400/30 bg-black/40 backdrop-blur-sm z-20">
          <p className="text-sm text-cyan-400">Drop files to upload</p>
        </div>
      )}
    </div>
  );
}

export default MessageInput;
