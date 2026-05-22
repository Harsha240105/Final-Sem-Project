import { useState } from "react";
import { Sidebar, Navbar } from "../components";

export default function MainLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-x-hidden text-gray-100" style={{ backgroundColor: "#060812" }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 relative z-10">
        <Navbar onToggleSidebar={() => setSidebarOpen(p => !p)} />
        <main className="flex-1 overflow-auto px-4 py-6 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
