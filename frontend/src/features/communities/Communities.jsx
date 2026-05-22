import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../shared/hooks/useAuth";
import { useToast } from "../../shared/hooks/useToast";
import { getCommunities } from "../../shared/services/api";

const CATEGORY_COLORS = {
  Academic: "from-blue-500/20 to-blue-600/5 border-blue-500/20 text-blue-400",
  Technology: "from-cyan-500/20 to-cyan-600/5 border-cyan-500/20 text-cyan-400",
  Arts: "from-pink-500/20 to-pink-600/5 border-pink-500/20 text-pink-400",
  Science: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/20 text-emerald-400",
  Sports: "from-orange-500/20 to-orange-600/5 border-orange-500/20 text-orange-400",
  Cultural: "from-purple-500/20 to-purple-600/5 border-purple-500/20 text-purple-400",
  Social: "from-rose-500/20 to-rose-600/5 border-rose-500/20 text-rose-400",
  Career: "from-amber-500/20 to-amber-600/5 border-amber-500/20 text-amber-400",
};

function Communities() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const fetchCommunities = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await getCommunities(token);
      setCommunities(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch communities:", err);
      addToast("Failed to load communities", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchCommunities(); }, [fetchCommunities]);
  useEffect(() => {
    const handler = () => fetchCommunities();
    window.addEventListener("communities-updated", handler);
    return () => window.removeEventListener("communities-updated", handler);
  }, [fetchCommunities]);

  const categories = ["all", ...new Set(communities.map(c => c.category).filter(Boolean))];

  const filtered = communities.filter(c => {
    const matchSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.description?.toLowerCase().includes(search.toLowerCase()) ||
      c.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchCategory = activeCategory === "all" || c.category === activeCategory;
    return matchSearch && matchCategory;
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold text-white">Communities</h1>
        <p className="text-sm text-gray-500 mt-1">Collaborate, learn, and build together</p>
      </motion.div>

      {/* Search + Create */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search communities..."
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] pl-10 pr-4 py-2.5 text-sm text-white outline-none focus:border-cyan-500/40 transition"
          />
        </div>
        <button
          onClick={() => navigate("/communities/create")}
          className="shrink-0 rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-400 transition"
        >
          + Create
        </button>
      </div>

      {/* Category pills */}
      <div className="mb-6 flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-[10px] font-medium transition ${
              activeCategory === cat
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                : "text-gray-500 hover:text-white border border-transparent"
            }`}
          >
            {cat === "all" ? "All" : cat}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-40 rounded-xl shimmer-skeleton" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] py-16 text-center"
        >
          <div className="text-4xl mb-3 opacity-30">🏛️</div>
          <p className="text-lg font-bold text-white">No communities found</p>
          <p className="text-sm text-gray-500 mt-1">Create one or adjust your search</p>
        </motion.div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {filtered.map((c, i) => (
              <motion.div
                key={c._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => navigate(`/communities/${c._id}`)}
                className="group cursor-pointer rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:bg-white/[0.04] hover:border-white/[0.10] transition"
              >
                <div className="flex items-start gap-3">
                  <div className={`h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br ${CATEGORY_COLORS[c.category]?.split(" ")[0] || "from-gray-500/20 to-gray-600/5"} flex items-center justify-center text-lg font-bold text-white`}>
                    {c.name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate group-hover:text-cyan-400 transition">{c.name}</h3>
                    <p className="text-[10px] text-gray-600 mt-0.5 truncate">{c.college_name || c.description?.slice(0, 60) || ""}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-[10px] text-gray-600">
                  {c.category && (
                    <span className={`rounded-full px-2 py-0.5 border ${CATEGORY_COLORS[c.category]?.split(" ").slice(2).join(" ") || "border-gray-500/20 text-gray-500"}`}>
                      {c.category}
                    </span>
                  )}
                  <span className="ml-auto">{c.members?.length || 0} member{(c.members?.length || 0) !== 1 ? "s" : ""}</span>
                </div>
                {c.tags?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {c.tags.slice(0, 3).map((t, ti) => (
                      <span key={ti} className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-gray-600">{t}</span>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export default Communities;
