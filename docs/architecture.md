# Architecture Overview

## Blockchain Enabled Virtual Campus Platform

---

## Project Structure

```
├── frontend/                   # React 19 + Vite 7 SPA
│   ├── src/
│   │   ├── components/         # Reusable UI components (Navbar, Sidebar, Card, etc.)
│   │   ├── context/            # React Context providers (Auth, Toast, Wallet)
│   │   ├── hooks/              # Custom hooks (useAuth, useToast, useWallet)
│   │   ├── pages/              # Route-level page components
│   │   ├── services/           # API client functions (axios)
│   │   └── utils/              # Frontend helper utilities
│   └── public/                 # Static assets
│
├── backend/
│   ├── server/                 # Express application layer
│   │   ├── server.js           # App entry point (Express config, middleware, routes)
│   │   ├── controllers/        # Route handler logic
│   │   ├── routes/             # Express route definitions
│   │   ├── middleware/         # Auth & admin guard middleware
│   │   └── uploads/            # User-uploaded files (avatars, community assets)
│   │
│   ├── database/               # Data persistence layer
│   │   ├── db.js               # MongoDB connection via Mongoose
│   │   └── models/             # Mongoose schemas & models
│   │
│   ├── blockchain/             # Web3 / on-chain integration
│   │   ├── nftService.js       # Mints ERC-721 NFTs on Polygon Amoy via ethers.js
│   │   ├── ipfsService.js      # Pins certificate images & metadata to IPFS (Pinata)
│   │   ├── contractABI.json    # ABI of deployed CertificateNFT contract
│   │   └── contractAddress.js  # Reads deployed contract address from env
│   │
│   ├── certificates/           # Certificate generation utilities
│   │   └── certificateGenerator.js  # Generates styled PNG certificates (node-canvas)
│   │
│   └── package.json            # Backend dependencies & scripts
│
├── smart-contract/             # Solidity source & deployment artifacts
│   ├── CertificateNFT.sol      # ERC-721 smart contract (Polygon Amoy)
│   └── deployment/
│       └── README.md           # Deployment instructions (Remix / Hardhat)
│
├── config/
│   ├── env/
│   │   └── .env.example        # Environment variable template
│   └── constants/
│       └── index.js            # Shared application constants
│
├── docs/
│   └── architecture.md         # ← You are here
│
├── package.json                # Root workspace scripts (dev, install)
└── README.md
```

---

## Technology Stack

| Layer        | Technology                                |
| ------------ | ----------------------------------------- |
| Frontend     | React 19, Vite 7, Tailwind CSS, Framer Motion, Recharts |
| Backend API  | Node.js, Express 4, Mongoose 8            |
| Database     | MongoDB Atlas                             |
| Blockchain   | Polygon Amoy Testnet (ERC-721), ethers.js v6 |
| IPFS Storage | Pinata Cloud                              |
| Auth         | JWT + bcrypt                              |
| Wallet       | MetaMask (browser extension)              |

---

## Data Flow

### 1. User Authentication
```
Browser → POST /api/auth/register|login → authController
  → bcrypt hash / compare → JWT issued → stored in localStorage
  → Subsequent requests carry Authorization: Bearer <token>
  → auth.middleware.js verifies JWT on protected routes
```

### 2. Community & Task Management
```
Admin creates community → POST /api/communities
Admin creates tasks     → POST /api/tasks
Student joins community → PUT  /api/communities/:id/join
Student completes task  → PUT  /api/tasks/:id/complete
  → taskController.completeTask() checks if ALL tasks in that community are done
  → If yes → triggers automatic NFT certificate minting pipeline
```

### 3. NFT Certificate Minting Pipeline
```
All community tasks completed
  │
  ├─ 1. certificateGenerator.js
  │     Renders a styled PNG certificate with student name,
  │     community name, college name, and unique certificate ID.
  │
  ├─ 2. ipfsService.js
  │     Uploads certificate PNG to IPFS via Pinata → gets image CID
  │     Creates ERC-721 metadata JSON → uploads to IPFS → gets metadata CID
  │
  ├─ 3. nftService.js
  │     Calls CertificateNFT.mintCertificate(walletAddress, metadataURI)
  │     on Polygon Amoy using the server-side private key (ethers.js)
  │     Returns transaction hash + token ID
  │
  └─ 4. User.nftCertificates[]
        Saves { certificateId, communityId, transactionHash,
                tokenId, metadataURI, imageURI, mintedAt }
```

### 4. Wallet Integration
```
Frontend WalletContext.jsx
  → window.ethereum.request({ method: 'eth_requestAccounts' })
  → Detects chain ID → switches to Polygon Amoy (0x13882) if needed
  → Saves wallet address to backend: PUT /api/user/wallet
  → Wallet address used for on-chain NFT minting
```

---

## API Endpoints

### Auth (`/api/auth`)
| Method | Path             | Auth | Description          |
| ------ | ---------------- | ---- | -------------------- |
| POST   | /register        | No   | Create account       |
| POST   | /login           | No   | Get JWT              |
| POST   | /create-admin    | Yes  | Create admin account |
| GET    | /profile         | Yes  | Get current profile  |
| PUT    | /wallet          | Yes  | Save wallet address  |

### Communities (`/api/communities`)
| Method | Path              | Auth | Description              |
| ------ | ----------------- | ---- | ------------------------ |
| POST   | /                 | Yes  | Create community         |
| GET    | /                 | Yes  | List all communities     |
| GET    | /:id              | Yes  | Get community by ID      |
| PUT    | /:id              | Yes  | Update community         |
| DELETE | /:id              | Yes  | Delete community         |
| PUT    | /:id/join         | Yes  | Join community           |

### Tasks (`/api/tasks`)
| Method | Path              | Auth | Description              |
| ------ | ----------------- | ---- | ------------------------ |
| POST   | /                 | Yes  | Create task              |
| GET    | /community/:id    | Yes  | Get tasks by community   |
| PUT    | /:id/complete     | Yes  | Complete task (+ mint)   |
| GET    | /my-tasks         | Yes  | Get user's assigned tasks|

### Blockchain (`/api/blockchain`)
| Method | Path              | Auth | Description              |
| ------ | ----------------- | ---- | ------------------------ |
| POST   | /mint             | Yes  | Manual NFT mint          |
| GET    | /status           | No   | Wallet & contract status |

### User (`/api/user`)
| Method | Path              | Auth | Description              |
| ------ | ----------------- | ---- | ------------------------ |
| PUT    | /avatar           | Yes  | Upload avatar            |
| DELETE | /avatar           | Yes  | Remove avatar            |
| GET    | /:userId          | Yes  | Get user info            |
| PUT    | /wallet           | Yes  | Save wallet address      |
| GET    | /nfts             | Yes  | Get NFT certificates     |

### Marketplace (`/api/marketplace`)
| Method | Path              | Auth | Description              |
| ------ | ----------------- | ---- | ------------------------ |
| POST   | /                 | Yes  | Create listing           |
| GET    | /                 | No   | Get all listings         |
| GET    | /:id              | No   | Get single listing       |

---

## Database Models

### User
- `name`, `email`, `password` (hashed)
- `walletAddress` — MetaMask Polygon Amoy address
- `communities[]` — joined community references
- `completedTasks[]` — completed task references
- `nftCertificates[]` — minted on-chain certificates
- `avatar`, `role` (student / admin)

### Community
- `name`, `college_name`, `description`, `image`
- `certificate_template_id` — links to certificate template
- `members[]` — user references
- `collaborations[]`, `comments[]`, `messages[]`

### Task
- `community_id` — parent community
- `title`, `description`, `assignedTo`
- `completed_status` — boolean

### Marketplace
- `title`, `description`, `type`, `link`, `image`
- `comments[]`, `collaborators[]`, `participants[]`

### NFTCertificate
- `communityId`, `userId`
- `nftTokenId`, `ipfsHash`

---

## Security

- **JWT Authentication** — Tokens issued on login, verified via `auth.middleware.js`
- **Admin Guard** — `admin.middleware.js` checks role before admin-only routes
- **Password Hashing** — bcrypt with salt rounds
- **Rate Limiting** — express-rate-limit on API endpoints
- **Helmet** — HTTP security headers
- **CORS** — Restricted origins
- **Private Key** — Server-side only, never exposed to frontend

---

## Running the Project

```bash
# Install all dependencies
npm run install:all

# Start both frontend & backend in dev mode
npm run dev

# Or start individually
npm run server    # Backend on port 5000
npm run client    # Frontend on port 5173
```

Required environment variables — see `config/env/.env.example`.
