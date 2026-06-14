<div align="center">
  <img src="https://readme-typing-svg.demolab.com?font=Orbitron&weight=700&size=32&duration=2500&pause=500&color=00F5FF&center=true&vCenter=true&width=500&lines=%E2%97%88+Web3Connect;Blockchain+Virtual+Campus;NFT+Certificates+on+Polygon" alt="Web3Connect" />
  <p><strong>Blockchain Enabled Virtual Campus Platform</strong></p>
  <p>
    <a href="https://harsha240105.github.io/Final-Sem-Project/">
      <img src="https://img.shields.io/badge/%F0%9F%9A%80_Live_Demo-7B61FF?style=for-the-badge&logo=github" alt="Live Demo">
    </a>
    <a href="#tech-stack">
      <img src="https://img.shields.io/badge/%F0%9F%9B%A0%EF%B8%8F_Tech_Stack-00F5FF?style=for-the-badge" alt="Tech Stack">
    </a>
    <a href="#installation">
      <img src="https://img.shields.io/badge/%F0%9F%93%A6_Setup-FF4FD8?style=for-the-badge" alt="Setup">
    </a>
  </p>
  <p>
    <img src="https://img.shields.io/github/stars/Harsha240105/Final-Sem-Project?style=flat-square&logo=github&color=FFD166">
    <img src="https://img.shields.io/github/forks/Harsha240105/Final-Sem-Project?style=flat-square&logo=github&color=00FFA3">
    <img src="https://img.shields.io/github/last-commit/Harsha240105/Final-Sem-Project?style=flat-square&logo=github&color=00F5FF">
    <img src="https://img.shields.io/github/license/Harsha240105/Final-Sem-Project?style=flat-square&color=7B61FF">
  </p>
</div>

---

## 🎬 What Is Web3Connect?

A decentralized platform where **students**, **teachers**, and **communities** collaborate, complete tasks, and earn **blockchain-backed NFT certificates** minted on the **Polygon Amoy testnet**.

```
Frontend ←→ Backend ←→ Database ←→ Blockchain
React 19     Express    MongoDB     Polygon Amoy
Wagmi        JWT        Mongoose    ERC-721 Soulbound
```

### ✨ Core Features

| Layer | Feature | Why It Matters |
|-------|---------|---------------|
| 🎨 **Frontend** | Real-time dashboard, wallet login (MetaMask), interactive force-graph | 60 FPS experience via React 19 + Vite 7 |
| ⚙️ **Backend** | 50+ API endpoints, Socket.IO real-time chat, JWT auth | Handles 100 req/min with rate limiting |
| 🗄️ **Database** | MongoDB Atlas, 19 Mongoose models, atomic job queues | Cloud-native, auto-scaled |
| ⛓️ **Blockchain** | ERC-721 soulbound NFT certificates, IPFS storage | Immutable, verifiable, student-owned |
| 🤖 **AI** | Tesseract.js OCR for student ID verification | 85% similarity threshold matching |

---

## 🚀 Live Demo

Experience the full interactive learning hub — no install required.

👉 **[Launch the Learning Hub](https://harsha240105.github.io/Final-Sem-Project/)**

| What you can do | Details |
|----------------|---------|
| 🖱️ Click modules | Explore 11 learning modules with detailed explanations |
| 🧠 Take quizzes | Random knowledge quiz with 10 questions per round |
| 🎤 Viva prep | 25+ viva questions with reveal answers |
| 🔍 Search | Filter modules by name/keyword |
| 📱 Responsive | Works on mobile, tablet, desktop |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                            │
│        React 19 SPA · Tailwind CSS · Framer Motion              │
│        22 Pages · 20+ Components · 5 Context Providers          │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP / WebSocket
┌───────────────────────────▼─────────────────────────────────────┐
│                       API LAYER                                  │
│        Express.js · 16 Route Files · 50+ Endpoints              │
│        JWT Middleware · Socket.IO · Rate Limited                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
┌─────────────▼─────┐ ┌────▼──────────┐ ┌▼──────────────┐
│   DATA LAYER      │ │ BLOCKCHAIN    │ │ STORAGE       │
│   MongoDB Atlas   │ │ Polygon Amoy  │ │ IPFS / Pinata │
│   19 Models       │ │ Solidity      │ │ Decentralized │
│   Mongoose ODM    │ │ ERC-721       │ │ Content Addr. │
└───────────────────┘ └───────────────┘ └───────────────┘
```

**Data Flow:**
```
User Action → React Component → API Service → Express Controller
  → Business Logic → MongoDB / IPFS / Blockchain → Response
```

---

## ⚙️ How It Works (Core Loop)

```javascript
// Simplified: certificate minting pipeline
async function mintCertificate(studentWallet, taskId) {
  // 1. Generate HD certificate image (3200×2200px)
  const imagePath = await generateCertificateImage(studentWallet, taskId);

  // 2. Upload to IPFS via Pinata
  const imageURI = await uploadToIPFS(imagePath);

  // 3. Create ERC-721 metadata
  const metadata = { name: "Web3Connect Certificate", image: imageURI };
  const metadataURI = await uploadToIPFS(metadata);

  // 4. Mint soulbound NFT on Polygon Amoy
  const tx = await certificateContract.mintCertificate(studentWallet, metadataURI);

  // 5. Persist on-chain receipt to MongoDB
  await Certificate.create({ student: studentWallet, txHash: tx.hash, tokenURI: metadataURI });
}
```

---

## 🛠️ Built With

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19 | UI framework |
| Vite | 7.3 | Build tool |
| Tailwind CSS | 3.4 | Styling |
| Framer Motion | 12 | Animations |
| React Router | 7.8 | Routing |
| Axios | 1.7 | HTTP client |
| Recharts | 3.7 | Charts |
| Wagmi | 3.6 | Wallet hooks |
| Viem | 2.48 | Ethereum interactions |
| Socket.IO (client) | 4.8 | Real-time |
| Three.js | 0.160 | 3D background |
| Tesseract.js | — | OCR |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 22 | Runtime |
| Express | 4.19 | Web framework |
| Mongoose | 8.23 | MongoDB ODM |
| Socket.IO | 4.8 | Real-time server |
| JWT | — | Authentication |
| bcrypt | 6 | Password hashing |
| Multer | 2 | File uploads |
| Helmet | 7 | Security headers |
| Nodemailer | 8 | Email sending |

### Blockchain
| Technology | Purpose |
|------------|---------|
| Solidity ^0.8.20 | Smart contract language |
| ERC-721 | NFT standard |
| ERC-5192 | Soulbound (non-transferable) |
| Polygon Amoy | Layer 2 testnet (Chain ID: 80002) |
| IPFS (Pinata) | Decentralized storage |
| Ethers.js 6 | On-chain interactions |
| OpenZeppelin | Audited contract base |

---

## 📦 Getting Started

### Prerequisites
- Node.js >= 18
- MongoDB (local or [Atlas](https://www.mongodb.com/atlas))
- [MetaMask](https://metamask.io/) browser extension
- Polygon Amoy testnet ETH ([faucet](https://faucet.polygon.technology/))

### Installation

```bash
# Clone the repo
git clone https://github.com/Harsha240105/Final-Sem-Project.git
cd Final-Sem-Project

# Backend setup
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials
npm start

# Frontend setup (new terminal)
cd frontend
npm install
cp .env.example .env
npm run dev

# Smart contract deployment
cd smart-contract
npm install
npx hardhat run scripts/deploy.js --network polygonAmoy
```

### Environment Variables

**Backend** (`backend/.env`):
```env
MONGO_URI=mongodb+srv://your-connection-string
JWT_SECRET=your-super-secret-jwt-key
PORT=5001
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
ADMIN_SECRET=your-admin-setup-secret
INFURA_URL=https://polygon-amoy.infura.io/v3/your-project-id
WALLET_PRIVATE_KEY=your-wallet-private-key
CONTRACT_ADDRESS=0xYourDeployedContractAddress
IPFS_PINATA_JWT=your-pinata-jwt-token
```

**Frontend** (`frontend/.env`):
```env
VITE_API_BASE_URL=http://localhost:5001/api
VITE_API_TIMEOUT_MS=15000
```

---

## 📡 API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register-student` | Register a new student |
| POST | `/api/auth/register-teacher` | Register a teacher (pending approval) |
| POST | `/api/auth/login` | Login with email/password |
| POST | `/api/auth/wallet-login` | Login with wallet |
| POST | `/api/auth/siwe/nonce` | SIWE nonce generation |
| POST | `/api/auth/siwe/verify` | SIWE signature verification |
| GET | `/api/auth/profile` | Get current user profile |
| PUT | `/api/auth/reset-password` | Reset password |
| PUT | `/api/auth/wallet` | Save/remove wallet address |

### Communities
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/communities` | List all communities |
| POST | `/api/communities` | Create a community |
| GET | `/api/communities/:id` | Get community details |
| PUT | `/api/communities/:id` | Update community |
| DELETE | `/api/communities/:id` | Delete community |
| POST | `/api/communities/:id/join` | Join a community |
| POST | `/api/communities/:id/leave` | Leave a community |
| POST | `/api/communities/:id/assign-manager` | Assign community manager |
| GET | `/api/communities/:id/leaderboard` | Community leaderboard |

### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/tasks` | Create task |
| GET | `/api/tasks/community/:id` | Tasks by community |
| GET | `/api/tasks/my` | Current user's tasks |
| POST | `/api/tasks/:id/complete` | Complete task & issue certificate |
| POST | `/api/tasks/upload/:taskId` | Upload task file |

### Blockchain
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/blockchain/mint` | Mint NFT certificate |
| GET | `/api/blockchain/status` | Blockchain connection status |
| GET | `/api/blockchain/diagnose` | Run blockchain diagnostics |
| POST | `/api/blockchain/retry-certificate` | Retry failed certificate mint |

### Certificates
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/certificates/my` | Get user's certificates |
| GET | `/api/certificates/:id` | Verify a certificate |
| POST | `/api/certificates/save` | Save certificate after mint |
| POST | `/api/certificates/sync` | Sync with blockchain |

### Connections / Social
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/connections/overview` | Graph overview with force-graph data |
| GET | `/api/connections/dashboard-stats` | Follower/following stats |
| GET | `/api/connections/discover` | Discover new users |
| GET | `/api/connections/user/:userId` | User profile with follow status |
| POST | `/api/follow/:targetUserId` | Follow a user |
| DELETE | `/api/follow/:targetUserId` | Unfollow a user |

### Messaging
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dm/conversations` | List conversations |
| GET | `/api/dm/messages/:conversationId` | Get messages |
| POST | `/api/dm/send` | Send a message |
| GET | `/api/servers` | List servers |
| POST | `/api/servers` | Create server |
| GET | `/api/servers/discover` | Discover servers |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/create` | Create admin account |
| GET | `/api/admin/dashboard` | Platform dashboard stats |
| GET | `/api/admin/pending-teachers` | Pending teacher approvals |
| POST | `/api/admin/approve-teacher/:id` | Approve teacher |
| POST | `/api/admin/reject-teacher/:id` | Reject teacher |
| GET | `/api/admin/blockchain/diagnose` | Blockchain diagnostics |

---

## 👥 User Roles

| Role | Capabilities |
|------|-------------|
| **Student** | Connect wallet, join communities, complete tasks, earn NFT certificates, follow users, send messages |
| **Teacher** | All student capabilities + create communities, manage tasks, issue NFT certificates, assign managers |
| **Admin** | Full platform access, teacher/student approval, user management, blockchain diagnostics |
| **Community Manager** | Manage assigned community members, moderate content, assist with tasks |

---

## ⛓️ Smart Contract

The `CertificateNFT` contract is deployed on **Polygon Amoy Testnet** (Chain ID: 80002).

- **Standard**: ERC-721URIStorage
- **Soulbound**: ERC-5192 (transfers permanently disabled)
- **Features**: `mintCertificate(address student, string tokenURI)`, `totalSupply()`, `locked(uint256 tokenId)`
- **Storage**: Certificate images and metadata stored on **IPFS via Pinata**

### Minting Pipeline

```
1. Generate HD certificate image (3200×2200px) via node-canvas
2. Upload image to IPFS via Pinata
3. Create ERC-721 metadata JSON
4. Upload metadata to IPFS
5. Mint soulbound NFT on Polygon Amoy via ethers.js
6. Persist certificate record to MongoDB
```

---

## 🗂️ Project Structure

```
Web3Connect/
├── backend/
│   ├── blockchain/           # NFT service, IPFS service, contract ABI
│   ├── certificates/         # Certificate image generator
│   ├── database/models/      # 19 Mongoose models
│   ├── server/               # Controllers, routes, middleware, utils
│   ├── server.js             # Express entry point
│   └── socket.js             # Socket.IO server
├── frontend/
│   ├── src/pages/            # 22 route pages
│   ├── src/components/       # 20+ shared components
│   ├── src/context/          # Auth, Socket, Wallet, Follow, Toast
│   ├── src/hooks/            # useAuth, useWallet, useToast, useWebRTC
│   └── src/services/         # API client
├── smart-contract/
│   ├── CertificateNFT.sol    # Solidity contract
│   ├── hardhat.config.js
│   └── scripts/deploy.js
├── scripts/
│   └── cleanup-db.js         # DB maintenance
├── technologies.json          # Data source for auto-generated pages
├── build.js                   # Generates index.html pages from JSON
├── index.html                 # Root landing page (auto-generated)
└── viva-web3connect/          # Learning hub (auto-generated, deployed to Pages)
    └── index.html
```

---

## 🔄 Auto-Sync System

Both `index.html` (root) and `viva-web3connect/index.html` (learning hub) are **auto-generated** from a single data source.

```
Edit technologies.json → Push to GitHub
  → GitHub Actions runs node build.js
  → Both index.html files regenerate
  → viva-web3connect/ deploys to GitHub Pages
```

To add a new technology or module, just edit `technologies.json` and push. Everything stays in sync.

| File | Purpose |
|------|---------|
| `technologies.json` | Single source of truth — edit this |
| `build.js` | Reads JSON, generates both HTML files |
| `index.html` | Root landing page (auto-generated) |
| `viva-web3connect/index.html` | Full learning hub (auto-generated) |
| `.github/workflows/deploy.yml` | Runs build + deploys to Pages |

---

## 🧹 Database Maintenance

```bash
node scripts/cleanup-db.js
```

Removes self-follows, drops empty collections, and purges stale authentication nonces (>24h).

---

## 👥 Team

| Name | GitHub | Role |
|------|--------|------|
| **Harsha** | [@Harsha240105](https://github.com/Harsha240105) | Lead Developer |
| **Vivek** | [@vivek032005](https://github.com/vivek032005) | Team Member |

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<div align="center">
  <a href="https://github.com/Harsha240105/Final-Sem-Project">
    <img src="https://img.shields.io/badge/%E2%97%88_Web3Connect-030712?style=for-the-badge&logo=github&logoColor=00F5FF" alt="Web3Connect">
  </a>
  <p>
    <sub>Built with React 19 · Node.js · Express · MongoDB · Solidity · Polygon · IPFS · Socket.IO</sub>
  </p>
  <img src="https://img.shields.io/github/last-commit/Harsha240105/Final-Sem-Project?style=flat-square&color=7B61FF">
  <img src="https://img.shields.io/github/stars/Harsha240105/Final-Sem-Project?style=flat-square&color=FFD166">
</div>
