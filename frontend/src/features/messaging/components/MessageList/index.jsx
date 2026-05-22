import { memo, useRef, useCallback, useEffect } from "react";
import MessageItem from "../MessageItem";

function MessageList({ messages, currentUserId, onDelete, onEdit, onReply, onPin }) {
  const endRef = useRef(null);
  const containerRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages?.length, scrollToBottom]);

  if (!messages || messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl mb-2 opacity-30">💬</div>
          <p className="text-sm text-gray-500">No messages yet</p>
          <p className="text-xs text-gray-600">Send a message to start the conversation</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin">
      {messages.map((msg) => {
        const isMine = msg.sender?._id === currentUserId || msg.sender === currentUserId;
        return (
          <MessageItem
            key={msg._id}
            msg={msg}
            isMine={isMine}
            currentUserId={currentUserId}
            onDelete={onDelete}
            onEdit={onEdit}
            onReply={onReply}
            onPin={onPin}
          />
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

export default memo(MessageList);
