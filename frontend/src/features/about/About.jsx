import { motion } from "framer-motion";
import { ExternalLink, BookOpen, Code2, Globe, Shield, GraduationCap, FileText } from "lucide-react";

const stats = [
  { icon: Code2, value: "19", label: "DB Models" },
  { icon: FileText, value: "50+", label: "API Endpoints" },
  { icon: Globe, value: "22", label: "Pages" },
  { icon: Shield, value: "50k+", label: "Lines of Code" },
];

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

export default function About() {
  return (
    <div className="min-h-screen bg-[#050816] p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <motion.div className="text-center space-y-4" {...fadeUp}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 text-xs font-mono tracking-wider">
            FINAL YEAR PROJECT 2024-2025
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-black">
            <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent bg-[length:200%_200%] animate-gradient">
              Web3Connect
            </span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
            A decentralized platform for students, teachers, and communities to collaborate,
            complete tasks, and earn blockchain-backed NFT certificates on Polygon Amoy testnet.
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
          initial="initial"
          animate="animate"
          variants={{
            animate: { transition: { staggerChildren: 0.1 } },
          }}
        >
          {stats.map((stat) => (
            <motion.div
              key={stat.label}
              className="relative rounded-xl border border-cyan-500/10 bg-[rgba(11,16,35,0.5)] backdrop-blur-sm p-4 text-center group hover:border-cyan-500/30 transition-colors"
              variants={{
                initial: { opacity: 0, y: 20 },
                animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
              }}
            >
              <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <stat.icon className="relative w-5 h-5 text-cyan-400 mx-auto mb-2" />
              <div className="relative text-2xl font-bold font-display bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                {stat.value}
              </div>
              <div className="relative text-xs text-gray-500 mt-1 font-mono">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Description */}
        <motion.div
          className="rounded-xl border border-purple-500/10 bg-[rgba(11,16,35,0.5)] backdrop-blur-sm p-6 md:p-8 space-y-4"
          {...fadeUp}
        >
          <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-purple-400" />
            About the Project
          </h2>
          <div className="space-y-3 text-gray-400 leading-relaxed">
            <p>
              Web3Connect is a <span className="text-cyan-400 font-medium">Blockchain-Enabled Virtual Campus Platform</span>{" "}
              that bridges traditional education with Web3 technology. Teachers create subject communities,
              assign tasks, and issue verifiable NFT certificates minted on the Polygon Amoy testnet.
            </p>
            <p>
              Students connect their wallets (MetaMask, Coinbase Wallet, WalletConnect), complete tasks,
              and earn <span className="text-purple-400 font-medium">soulbound ERC-721 tokens</span> as
              permanent proof of their achievements. Certificates are publicly verifiable on-chain,
              meaning they can never be forged or lost.
            </p>
          </div>
        </motion.div>

        {/* Tech Stack */}
        <motion.div
          className="rounded-xl border border-cyan-500/10 bg-[rgba(11,16,35,0.5)] backdrop-blur-sm p-6 md:p-8 space-y-4"
          {...fadeUp}
        >
          <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
            <Code2 className="w-5 h-5 text-cyan-400" />
            Built With
          </h2>
          <div className="flex flex-wrap gap-2">
            {[
              { name: "React 19", href: "https://react.dev", color: "border-cyan-500/20 bg-cyan-500/5 text-cyan-300 hover:border-cyan-400" },
              { name: "Node.js 22", href: "https://nodejs.org", color: "border-green-500/20 bg-green-500/5 text-green-300 hover:border-green-400" },
              { name: "Express", href: "https://expressjs.com", color: "border-green-500/20 bg-green-500/5 text-green-300 hover:border-green-400" },
              { name: "MongoDB", href: "https://www.mongodb.com", color: "border-yellow-500/20 bg-yellow-500/5 text-yellow-300 hover:border-yellow-400" },
              { name: "Mongoose", href: "https://mongoosejs.com", color: "border-yellow-500/20 bg-yellow-500/5 text-yellow-300 hover:border-yellow-400" },
              { name: "Solidity", href: "https://soliditylang.org", color: "border-pink-500/20 bg-pink-500/5 text-pink-300 hover:border-pink-400" },
              { name: "Polygon", href: "https://polygon.technology", color: "border-pink-500/20 bg-pink-500/5 text-pink-300 hover:border-pink-400" },
              { name: "IPFS", href: "https://pinata.cloud", color: "border-pink-500/20 bg-pink-500/5 text-pink-300 hover:border-pink-400" },
              { name: "Socket.IO", href: "https://socket.io", color: "border-blue-500/20 bg-blue-500/5 text-blue-300 hover:border-blue-400" },
              { name: "Tailwind CSS", href: "https://tailwindcss.com", color: "border-cyan-500/20 bg-cyan-500/5 text-cyan-300 hover:border-cyan-400" },
              { name: "Ethers.js", href: "https://ethers.org", color: "border-pink-500/20 bg-pink-500/5 text-pink-300 hover:border-pink-400" },
              { name: "Wagmi", href: "https://wagmi.sh", color: "border-pink-500/20 bg-pink-500/5 text-pink-300 hover:border-pink-400" },
              { name: "JWT", href: "https://jwt.io", color: "border-red-500/20 bg-red-500/5 text-red-300 hover:border-red-400" },
              { name: "ERC-721", href: "https://ethereum.org/developers/docs/standards/tokens/erc-721", color: "border-pink-500/20 bg-pink-500/5 text-pink-300 hover:border-pink-400" },
            ].map((tech) => (
              <a
                key={tech.name}
                href={tech.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono border ${tech.color} transition-all hover:scale-105`}
              >
                {tech.name}
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            ))}
          </div>
        </motion.div>

        {/* Key Features */}
        <motion.div
          className="rounded-xl border border-purple-500/10 bg-[rgba(11,16,35,0.5)] backdrop-blur-sm p-6 md:p-8 space-y-4"
          {...fadeUp}
        >
          <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-purple-400" />
            Key Features
          </h2>
          <div className="grid md:grid-cols-2 gap-3">
            {[
              "Wallet-based login (MetaMask + SIWE)",
              "Teacher verification with admin approval",
              "Community management with tasks & collaborations",
              "Teacher-controlled NFT certificate minting",
              "Real-time messaging (DM, group chat, channels)",
              "Social graph: follow/unfollow, discover, leaderboard",
              "Admin panel for platform governance",
              "AI-powered OCR verification for student IDs",
            ].map((feature) => (
              <div key={feature} className="flex items-start gap-2 text-gray-400 text-sm">
                <span className="text-cyan-400 mt-0.5 shrink-0">▸</span>
                {feature}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Showcase CTA */}
        <motion.div className="text-center" {...fadeUp}>
          <a
            href="/showcase.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-display font-bold text-sm tracking-wider hover:shadow-[0_0_30px_rgba(123,97,255,0.4)] hover:scale-105 transition-all duration-300"
          >
            <ExternalLink className="w-5 h-5" />
            OPEN FULL PROJECT SHOWCASE
          </a>
          <p className="mt-3 text-xs text-gray-600 font-mono">
            Interactive 3D showcase with live app screenshots and feature demos
          </p>
        </motion.div>

        {/* Footer */}
        <motion.div className="text-center pt-4 pb-8" {...fadeUp}>
          <p className="text-xs text-gray-600 font-mono">
            Built with React 19 · Node.js · Express · MongoDB · Solidity · Polygon · IPFS · Socket.IO
          </p>
          <p className="text-xs text-gray-700 mt-2 font-mono">
            &copy; 2024-2025 Final Year Project · All Rights Reserved
          </p>
        </motion.div>
      </div>
    </div>
  );
}
