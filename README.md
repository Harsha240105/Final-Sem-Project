# Web3Connect - Blockchain Enabled Virtual Campus Platform

A decentralized platform for students, teachers, and communities to collaborate, complete tasks, and earn blockchain-backed NFT certificates.

## Features

- **Dashboard** - Real-time overview of tasks, communities, NFT certificates, notifications, and connection stats
- **Communities** - Join, create, and manage academic communities with tasks, collaborations, and member management
- **Connections Hub** - Follow/unfollow students, teachers, and community managers with a live connection map
- **NFT Certificates** - Earn and verify blockchain-based certificates minted on Polygon Amoy testnet
- **Marketplace** - Trade and reward NFTs within the campus ecosystem
- **Wallet Integration** - Connect MetaMask wallets for certificate minting and on-chain verification
- **Role-Based Access** - Student, Teacher, Admin, and Community Manager roles with granular permissions
- **Real-Time Updates** - Live polling for tasks, certificates, notifications, and connection stats

## Tech Stack

### Frontend
- **React 19** with Vite
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **Axios** for API communication
- **MetaMask / Ethers.js** for wallet integration
- **React Router DOM** for navigation

### Backend
- **Node.js** with Express
- **MongoDB** with Mongoose ODM
- **JWT** for authentication
- **Multer** for file uploads
- **Helmet, CORS, Rate Limiting** for security

### Blockchain
- **Solidity** smart contracts
- **Polygon Amoy** testnet
- **IPFS** for metadata and certificate storage
- **Ethers.js** for on-chain interactions

## Installation

### Prerequisites

- Node.js >= 18
- MongoDB (local or Atlas)
- MetaMask browser extension
- Polygon Amoy testnet ETH (faucet)

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Configure your .env:
# MONGO_URI=mongodb+srv://your-connection-string
# JWT_SECRET=your-secret-key
# PORT=5000
# ADMIN_SECRET=your-admin-secret
# INFURA_URL=https://polygon-amoy.infura.io/v3/your-key
# WALLET_PRIVATE_KEY=your-wallet-private-key
# CONTRACT_ADDRESS=your-deployed-contract-address
# IPFS_PINATA_JWT=your-pinata-jwt

# Start the server
npm start
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Configure your .env:
# VITE_API_BASE_URL=http://localhost:5001/api

# Start the development server
npm run dev
```

## Project Structure

```
Blockchain Enabled Virtual Campus Platform/
├── backend/
│   ├── database/
│   │   ├── models/           # Mongoose schemas
│   │   │   ├── User.js
│   │   │   ├── Student.js
│   │   │   ├── Teacher.js
│   │   │   ├── Admin.js       # Pending teacher accounts
│   │   │   ├── AdminUser.js   # Admin accounts
│   │   │   ├── Community.js
│   │   │   ├── Follow.js
│   │   │   ├── Certificate.js
│   │   │   ├── NFTCertificate.js
│   │   │   ├── Notification.js
│   │   │   ├── Marketplace.js
│   │   │   └── task.model.js
│   │   └── db.js              # MongoDB connection
│   ├── server/
│   │   ├── controllers/       # Request handlers
│   │   │   ├── authController.js
│   │   │   ├── adminController.js
│   │   │   ├── communityController.js
│   │   │   ├── taskController.js
│   │   │   ├── certificateController.js
│   │   │   ├── connectionController.js
│   │   │   ├── leaderboardController.js
│   │   │   └── notificationController.js
│   │   ├── middleware/        # Auth middleware
│   │   ├── routes/            # API routes
│   │   ├── utils/             # Helper utilities
│   │   ├── uploads/           # File uploads
│   │   └── server.js          # Express app entry
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Navbar.jsx
│   │   │   ├── NotificationBell.jsx
│   │   │   ├── ProtectedRoute.jsx
│   │   │   ├── PageTransition.jsx
│   │   │   └── ErrorBoundary.jsx
│   │   ├── pages/             # Route pages
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Communities.jsx
│   │   │   ├── CommunityView.jsx
│   │   │   ├── Connections.jsx
│   │   │   ├── Profile.jsx
│   │   │   ├── MyCertificates.jsx
│   │   │   ├── Marketplace.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   └── ...
│   │   ├── hooks/             # Custom React hooks
│   │   ├── context/           # React context providers
│   │   ├── services/          # API service layer
│   │   ├── App.jsx            # Main app component
│   │   └── main.jsx           # Entry point
│   └── package.json
└── contracts/                  # Solidity smart contracts
```

## API Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register-student` | Register a new student |
| POST | `/api/auth/register-teacher` | Register a new teacher (pending approval) |
| POST | `/api/auth/login` | Login with email/password |
| PUT | `/api/auth/reset-password` | Reset user password |
| GET | `/api/auth/profile` | Get current user profile |
| PUT | `/api/auth/wallet` | Save/remove wallet address |
| GET | `/api/auth/teachers/pending` | Get pending teacher approvals (admin) |
| PATCH | `/api/auth/teachers/:id/approve` | Approve teacher (admin) |
| DELETE | `/api/auth/teachers/:id/reject` | Reject teacher (admin) |

### User

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user/me` | Get current user data |
| POST | `/api/user/avatar` | Upload avatar |
| DELETE | `/api/user/avatar` | Remove avatar |
| GET | `/api/user/certificates` | Get user certificates |
| GET | `/api/user/nfts` | Get user NFT certificates |
| PUT | `/api/user/wallet` | Update wallet address |

### Communities

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/communities` | List all communities |
| POST | `/api/communities` | Create new community |
| GET | `/api/communities/:id` | Get community details |
| PUT | `/api/communities/:id` | Update community |
| DELETE | `/api/communities/:id` | Delete community |
| POST | `/api/communities/:id/join` | Join a community |
| POST | `/api/communities/:id/leave` | Leave a community |
| POST | `/api/communities/:id/comment` | Add comment |
| DELETE | `/api/communities/:id/comments/:commentId` | Delete comment |
| DELETE | `/api/communities/:id/members/:memberId` | Remove member |
| POST | `/api/communities/:id/assign-manager` | Assign community manager |
| GET | `/api/communities/:id/leaderboard` | Get community leaderboard |

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/tasks` | Create task (teacher/admin) |
| GET | `/api/tasks/community/:communityId` | Get tasks by community |
| GET | `/api/tasks/my` | Get current user tasks |
| POST | `/api/tasks/:id/complete` | Complete task & issue certificates |
| PATCH | `/api/tasks/:id/mark-complete` | Mark task as complete |
| POST | `/api/tasks/upload/:taskId` | Upload task file |
| POST | `/api/tasks/chat/:taskId` | Send task chat message |
| GET | `/api/tasks/chat/:taskId` | Get task chat messages |

### Connections

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/connections/overview` | Get connections overview with graph data |
| GET | `/api/connections/dashboard-stats` | Get dashboard follower/following stats |
| GET | `/api/connections/user/:userId` | Get user profile with follow status |
| POST | `/api/connections/:targetUserId/follow` | Follow a user |
| DELETE | `/api/connections/:targetUserId/follow` | Unfollow a user |

### Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | Get user notifications |
| PUT | `/api/notifications/:id/read` | Mark notification as read |
| PUT | `/api/notifications/read-all` | Mark all notifications as read |

### Certificates

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/certificates/:certificateId` | Verify a certificate |
| POST | `/api/certificates/save` | Save certificate after mint |
| POST | `/api/certificates/sync` | Sync certificate status with blockchain |

### Blockchain

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/blockchain/mint` | Mint NFT certificate |
| GET | `/api/blockchain/status` | Get blockchain connection status |

## User Roles

- **Student** - Join communities, complete tasks, earn NFT certificates, follow other users
- **Teacher** - Create communities, manage tasks, issue certificates, approve teacher accounts
- **Admin** - Full platform access, manage users, create accounts
- **Community Manager** - Manage assigned community, moderate members

## Smart Contract

The platform uses a Solidity smart contract deployed on Polygon Amoy testnet for:
- Minting NFT certificates
- Storing certificate metadata on IPFS
- On-chain verification of credentials

## Environment Variables

### Backend (.env)

```env
MONGO_URI=mongodb+srv://your-connection-string
JWT_SECRET=your-super-secret-jwt-key
PORT=5000
PORT_RETRIES=20
ALLOW_START_WITHOUT_DB=true
MONGO_RETRY_INTERVAL_MS=15000
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
ADMIN_SECRET=your-admin-setup-secret
INFURA_URL=https://polygon-amoy.infura.io/v3/your-project-id
WALLET_PRIVATE_KEY=your-wallet-private-key
CONTRACT_ADDRESS=0xYourDeployedContractAddress
IPFS_PINATA_JWT=your-pinata-jwt-token
```

### Frontend (.env)

```env
VITE_API_BASE_URL=http://localhost:5001/api
VITE_API_TIMEOUT_MS=15000
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

