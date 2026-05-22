import { useAuth } from "../../shared/hooks/useAuth";
import { useSocket } from "../../shared/services/SocketContext";
import ActiveCommunities from "./components/ActiveCommunities";
import ActiveCollaborations from "./components/ActiveCollaborations";
import RecentMessages from "./components/RecentMessages";
import PendingTasks from "./components/PendingTasks";
import NFTCertificates from "./components/NFTCertificates";
import WorkspaceActivity from "./components/WorkspaceActivity";

const WIDGETS = [
  { title: "Active Communities", icon: "🏛️", component: ActiveCommunities, grid: "md:col-span-1" },
  { title: "Active Collaborations", icon: "🤝", component: ActiveCollaborations, grid: "md:col-span-1" },
  { title: "Recent Messages", icon: "💬", component: RecentMessages, grid: "md:col-span-1" },
  { title: "Pending Tasks", icon: "📋", component: PendingTasks, grid: "md:col-span-1" },
  { title: "NFT Certificates", icon: "🏅", component: NFTCertificates, grid: "md:col-span-2" },
  { title: "Workspace Activity", icon: "⚡", component: WorkspaceActivity, grid: "md:col-span-2" },
];

function Dashboard() {
  const { user } = useAuth();
  const { connected } = useSocket();

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">
            Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-sm text-gray-500">Here's what's happening in your workspace</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-green-400" : "bg-red-400"} shadow-[0_0_6px_rgba(0,0,0,0.3)]`} />
          <span className="text-xs text-gray-500">{connected ? "Connected" : "Disconnected"}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {WIDGETS.map(w => {
          const Component = w.component;
          return (
            <div key={w.title} className={`rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 ${w.grid}`}>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-sm">{w.icon}</span>
                <h2 className="text-sm font-semibold text-white">{w.title}</h2>
              </div>
              <Component />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Dashboard;
