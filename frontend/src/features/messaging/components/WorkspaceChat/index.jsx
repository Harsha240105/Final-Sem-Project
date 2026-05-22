function WorkspaceChat({ title, type, messages, onSend, currentUserId }) {
  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-white/[0.06] px-4 py-3 bg-black/10">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 uppercase tracking-wider">{type}</span>
          <span className="text-sm font-semibold text-white">{title}</span>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl mb-2 opacity-30">🏗️</div>
          <p className="text-sm text-gray-500">Workspace chat coming soon</p>
          <p className="text-xs text-gray-600">This will connect communities, tasks, and collaborations</p>
        </div>
      </div>
    </div>
  );
}

export default WorkspaceChat;
