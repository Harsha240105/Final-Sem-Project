<div align="center">
  <h1>◈ Web3Connect</h1>
  <p><strong>Blockchain Enabled Virtual Campus Platform</strong></p>
  <p>
    <a href="https://github.com/Harsha240105/Final-Sem-Project" target="_blank">
      <img src="https://img.shields.io/badge/GitHub-Harsha240105-blue?style=flat&logo=github" alt="GitHub">
    </a>
  </p>
  <p>
    <a href="#features">Features</a> •
    <a href="#tech-stack">Tech Stack</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#installation">Installation</a> •
    <a href="#api-reference">API Reference</a> •
    <a href="#smart-contract">Smart Contract</a>
  </p>
</div>

---

Web3Connect is a decentralized platform where **students**, **teachers**, and **communities** collaborate, complete tasks, and earn **blockchain-backed NFT certificates** minted on the **Polygon Amoy testnet**.

- 🔗 **Wallet-based login** (MetaMask, WalletConnect, Coinbase Wallet)
- 🎓 **NFT certificates** — soulbound ERC-721 tokens via IPFS
- 💬 **Real-time chat** (DM, group, server channels, voice/video)
- 🕸️ **Social graph** — follow, discover, leaderboards, force-graph
- 🤖 **AI-powered student ID verification** (OCR + matching engine)
- 🛡️ **Role-based access** — Student, Teacher, Admin, Community Manager

---

## Features

| Area | Details |
|------|---------|
| **Dashboard** | Real-time overview of tasks, communities, NFT certificates, notifications, and connection stats |
| **Communities** | Join, create, and manage academic communities with tasks, collaborations, and member management |
| **Connections Hub** | Follow/unfollow users with a live interactive connection map (react-force-graph) |
| **NFT Certificates** | Earn and verify blockchain-based certificates minted on Polygon Amoy testnet |
| **Marketplace** | Job, event, project listings with NFT reward capabilities |
| **Messaging** | Real-time direct messages, group chat, and Discord-like server channels |
| **Wallet Integration** | Connect MetaMask, Coinbase Wallet, or WalletConnect for certificate minting |
| **Real-Time Updates** | Socket.IO for live messaging, typing indicators, read receipts, and notifications |
| **AI Verification** | Tesseract.js OCR for student ID verification with 85% similarity threshold |
| **Teacher Verification** | Document upload, admin approval workflow, email/SMS notifications |
| **Admin Panel** | Platform governance, teacher/student approval, blockchain diagnostics |

---

## Tech Stack

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

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  PRESENTATION LAYER                      │
│      React 19 SPA · Tailwind CSS · Framer Motion        │
│      22 Pages · 20+ Components · 5 Context Providers    │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP / WebSocket
┌────────────────────────▼────────────────────────────────┐
│                     API LAYER                            │
│      Express.js · 16 Route Files · 50+ Endpoints        │
│      JWT Middleware · Socket.IO Events · Rate Limited    │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                     DATA LAYER                           │
│      MongoDB · 19 Models · Mongoose ODM · Atlas Cloud   │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                  BLOCKCHAIN LAYER                        │
│   Polygon Amoy Testnet · ERC-721 Soulbound NFT          │
│   IPFS (Pinata) · Ethers.js · OpenZeppelin              │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Action → React Component → API Service → Express Controller → Business Logic → MongoDB / IPFS / Blockchain → Response
```

---

## Installation

### Prerequisites

- Node.js >= 18
- MongoDB (local or Atlas)
- MetaMask browser extension
- Polygon Amoy testnet ETH ([faucet](https://faucet.polygon.technology/))

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials
npm start
```

### Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

### Smart Contract Deployment

```bash
cd smart-contract
npm install
npx hardhat run scripts/deploy.js --network polygonAmoy
```

---

## API Reference

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

## User Roles

| Role | Capabilities |
|------|-------------|
| **Student** | Connect wallet, join communities, complete tasks, earn NFT certificates, follow users, send messages |
| **Teacher** | All student capabilities + create communities, manage tasks, issue NFT certificates, assign managers |
| **Admin** | Full platform access, teacher/student approval, user management, blockchain diagnostics |
| **Community Manager** | Manage assigned community members, moderate content, assist with tasks |

---

## Smart Contract

The `CertificateNFT` contract is deployed on **Polygon Amoy Testnet** (Chain ID: 80002).

- **Standard**: ERC-721URIStorage
- **Soulbound**: ERC-5192 (transfers permanently disabled)
- **Features**: `mintCertificate(address student, string tokenURI)`, `totalSupply()`, `locked(uint256 tokenId)`
- **Storage**: Certificate images and metadata stored on **IPFS via Pinata**

### Minting Pipeline (6 Steps)

1. **Generate** HD certificate image (3200×2200px) using node-canvas
2. **Upload** image to IPFS via Pinata
3. **Create** ERC-721 metadata JSON
4. **Upload** metadata to IPFS
5. **Mint** soulbound NFT on Polygon Amoy via ethers.js
6. **Persist** certificate record to MongoDB

---

## Environment Variables

### Backend (`backend/.env`)
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

### Frontend (`frontend/.env`)
```env
VITE_API_BASE_URL=http://localhost:5001/api
VITE_API_TIMEOUT_MS=15000
```

---

## Project Structure

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
├── index.html                # Project showcase page
└── README.md
```

---

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.

---

<div align="center">
  <p>
    <a href="https://github.com/Harsha240105/Final-Sem-Project" target="_blank">
      <img src="https://img.shields.io/badge/View_on_GitHub-Harsha240105-blue?style=for-the-badge&logo=github" alt="GitHub">
    </a>
  </p>
  <p>Built with React 19 · Node.js · Express · MongoDB · Solidity · Polygon · IPFS · Socket.IO</p>
</div>
