import { motion } from "framer-motion";

const shimmer = "bg-gradient-to-r from-white/[0.02] via-neon-cyan/10 to-white/[0.02] bg-[length:200%_100%] animate-shimmer rounded-lg";

export function CardSkeleton({ count = 6 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="h-52 rounded-xl bg-gray-800/10 border border-white/[0.04] overflow-hidden"
        >
          <div className="h-28 bg-gray-800/20" />
          <div className="p-4 space-y-2">
            <div className={`h-4 w-3/4 ${shimmer}`} />
            <div className={`h-3 w-1/2 ${shimmer}`} />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-6">
        <div className="w-24 h-24 rounded-full bg-gray-800/20 border border-white/[0.04]" />
        <div className="space-y-3 flex-1">
          <div className={`h-6 w-48 ${shimmer}`} />
          <div className={`h-4 w-32 ${shimmer}`} />
        </div>
      </div>
      <div className="space-y-3">
        <div className={`h-4 w-full ${shimmer}`} />
        <div className={`h-4 w-5/6 ${shimmer}`} />
        <div className={`h-4 w-4/6 ${shimmer}`} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`h-24 rounded-xl bg-gray-800/10 border border-white/[0.04] p-4`}>
            <div className={`h-3 w-16 mb-2 ${shimmer}`} />
            <div className={`h-5 w-24 ${shimmer}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 5 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.04 }}
          className="flex items-center gap-4 p-4 rounded-xl bg-gray-800/10 border border-white/[0.04]"
        >
          <div className="w-10 h-10 rounded-full bg-gray-800/20 shrink-0" />
          <div className="space-y-2 flex-1">
            <div className={`h-4 w-2/5 ${shimmer}`} />
            <div className={`h-3 w-1/3 ${shimmer}`} />
          </div>
          <div className={`h-8 w-20 rounded-lg ${shimmer}`} />
        </motion.div>
      ))}
    </div>
  );
}

export function MessageSkeleton() {
  return (
    <div className="flex h-full">
      <div className="w-72 border-r border-white/[0.04] p-4 space-y-3 shrink-0">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-800/20 shrink-0" />
            <div className="space-y-2 flex-1">
              <div className={`h-3 w-3/4 ${shimmer}`} />
              <div className={`h-2 w-1/2 ${shimmer}`} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex-1 flex flex-col p-6">
        <div className={`h-6 w-1/4 mb-6 ${shimmer}`} />
        <div className="flex-1 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`flex gap-3 ${i % 2 === 0 ? "" : "flex-row-reverse"}`}>
              <div className="w-8 h-8 rounded-full bg-gray-800/20 shrink-0" />
              <div className={`h-16 w-3/5 rounded-xl bg-gray-800/10 border border-white/[0.04] p-3`}>
                <div className={`h-3 w-3/4 mb-2 ${shimmer}`} />
                <div className={`h-3 w-1/2 ${shimmer}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MarketplaceSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`h-10 w-28 rounded-full ${shimmer}`} />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl bg-gray-800/10 border border-white/[0.04] overflow-hidden"
          >
            <div className="h-40 bg-gray-800/20" />
            <div className="p-4 space-y-2">
              <div className={`h-4 w-3/4 ${shimmer}`} />
              <div className={`h-3 w-full ${shimmer}`} />
              <div className={`h-8 w-24 rounded-lg ${shimmer}`} />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
