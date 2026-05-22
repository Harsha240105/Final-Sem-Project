# Phase 7–10 Architecture & Implementation Report

## 1. Connection Architecture (Phase 7, Complete)

### Done
| Component | Description |
|-----------|-------------|
| `Follow.js` model | follower/following with unique compound index, self-follow guard |
| `FriendRequest.js` model | requester/recipient/status with unique index |
| `connectionController.js` | 12 controller functions incl. `buildGraphPayload` returning nodes + edges |
| `connection.routes.js` | 8 endpoints: overview, dashboard-stats, profile, discover, follow/unfollow |
| `socialController.js` | Public profile, followers/following/mutuals with follow-status enrichment |
| `networkController.js` | Graph expansion endpoint for network drill-down |
| `FollowButton.jsx` | Animated button with 3 states (follow/following/mutual), optimistic updates |
| `FollowContext.jsx` | Socket-driven real-time follow state tracking across the app |
| `Connections.jsx` | Tabbed followers/following list with search + network graph visualization |
| `NetworkGraph.jsx` | Force-directed SVG graph of user's network, expandable, clickable to profiles |

### Design Decisions
- **No algorithmic feed**: Follow system is purely for collaboration discovery
- **Denormalized counters**: `followersCount`/`followingCount` on User/Student/Teacher for fast reads
- **Auto DM creation**: Following a user automatically creates a DM conversation
- **Graph payload**: Backend returns node/edge structure ready for any frontend visualization

---

## 2. Collaboration Canvas Engine (Phase 7, Core Feature)

### Architecture Overview

```
CollaborationHub (page)
  ├── CanvasList (canvas browser)
  └── CanvasView
       ├── Toolbar (zoom/undo/redo/add-node)
       ├── CollaborationCanvas (main engine)
       │    ├── CSS transform container (zoom + pan)
       │    ├── SVG overlay (node connections)
       │    ├── CanvasNode[] (draggable React components)
       │    └── PresenceIndicators (live user avatars)
       ├── MiniMap (scaled navigator overlay)
       └── RoomTypeContent (5 room variants)
            ├── TextRoomContent (chat preview, message count)
            ├── VoiceRoomContent (active users, mic indicator)
            ├── FileRoomContent (file count, shared resources)
            ├── PublishingRoomContent (published works, NFT link)
            └── WorkspaceContent (tasks, members, progress bar)
```

### Rendering Engine

| Feature | Implementation |
|---------|---------------|
| Infinite zoom | Wheel → `calculateZoomLevel()` → `setViewport({zoom, panX, panY})` |
| Pan | Middle-click or Shift+click → track delta on mousemove |
| Draggable nodes | `useCanvasDrag` hook → mousedown/move/up with selected-node group drag |
| Grid snap | `snapToGrid(value, 20)` — toggleable |
| Connection lines | SVG `<path>` elements, 3 types: straight, curved, dashed |
| MiniMap | Scaled SVG view of all nodes + edges + viewport indicator |
| Virtualization | Node rendering uses just CSS transforms (no re-renders on pan/zoom) |

### Canvas Store (State Management)

Custom publish-subscribe store (`canvasStore.js`) instead of Redux/Context for performance:
- Single object with `nodes[]`, `edges[]`, viewport, selected sets
- `subscribe()`/`notify()` pattern — only re-renders components that subscribe
- History stack (50 undo/redo) with deep-cloned snapshots
- No unnecessary re-renders during drag/zoom

### Node Types (5 Room Types)

| Type | Purpose | Key Data |
|------|---------|----------|
| `text_room` | Chat, threads, task discussion | messageCount, channelName, preview |
| `voice_room` | Live voice, meetings | activeUsers |
| `file_room` | Uploads, shared resources | fileCount |
| `publishing_room` | Completed works, NFT proofs | publishedItems[], nftLinked |
| `workspace` | Tasks, members, progress | taskCount, memberCount, progress% |

Each node has: `nodeId`, `type`, `position`, `size`, `parentId` (nesting), `metadata` (dynamic), `style`.

### Real-Time Synchronization

Uses existing socket infrastructure — no new connections:
- `canvas:join`/`canvas:leave` → room-based presence per canvas
- `canvas:node-move` → remote position sync during drag-end
- `canvas:node-add/remove/update` → CRUD sync
- `canvas:edge-add/remove` → connection sync
- `canvas:viewport` → optional viewport sharing
- Events emit to `canvas:<canvasId>` room only

### Performance Optimizations

- **CSS transform rendering**: No canvas redraws — GPU-composited divs
- **SVG overlay**: Only re-renders when edges/nodes change, not on pan/zoom
- **Memoized components**: `CanvasNode`, `NodeConnections`, `MiniMap` all wrapped in `React.memo`
- **Event delegation**: Single mousemove/mouseup on the canvas container, not per-node
- **No FP analytics**: No requestAnimationFrame loops — only fires on actual user interaction

---

## 3. Phase 8 — Live Workbench (Architecture Plan)

### Concept
A real-time collaborative workspace inside each Canvas workspace node. Users can upload files, discuss, track tasks, and publish results — all within the canvas context.

### Suggested Structure
```
collaboration/
  components/
    Workbench/
      ├── Workbench.jsx              — Main workbench view
      ├── FilePanel/index.jsx        — File upload/preview
      ├── DiscussionPanel/index.jsx  — Threaded chat
      ├── TaskBoard/index.jsx        — Kanban-style task board
      ├── ActivityTimeline/index.jsx — Shared activity feed
      └── PublishingPanel/index.jsx  — Showcase/publish controls
  hooks/
    useWorkbench.js                  — Socket + state for workbench
```

### Data Flow
- Each workspace node's `metadata.workbenchId` references a `Workbench` collection
- Workbench has its own socket room (`workbench:<id>`) for file edits, discussion updates
- Task board uses existing `Task` model with `workbenchId` reference
- Publishing panel creates entries through existing `marketplaceController.publishShowcase`

### Backend Collections Needed
- `Workbench` model — channels[], files[], activityLog[], linkedCanvas
- File references stay in existing `uploads/` structure

---

## 4. Phase 9 — Workspace Servers (Architecture Plan)

### Concept
Rename/reframe server concept from "gaming server" to "professional collaboration ecosystem." Each Workspace Server contains channels, communities, projects, and collaboration groups.

### Suggested Approach
- **No model changes needed** — existing `Server.js` model already has channels, members, roles
- **UI rename**: Update `Servers.jsx` to use "Workspace Server" terminology
- **New views**:
  - Workspace landing: dashboard of projects, recent activity, member list
  - Channel categories: `collaboration/`, `projects/`, `resources/` instead of text/voice
- **Integration**: Each server can link to a Canvas for visual structure

### Suggested File Changes
```
features/collaboration/
  components/
    WorkspaceServer/
      ├── WorkspaceServer.jsx    — Renamed/refactored Servers.jsx wrapper
      ├── ServerDashboard.jsx    — Overview of projects + activity
      ├── ServerChannels.jsx     — Reorganized channel list
      └── ServerCanvas.jsx       — Embedded canvas in server context
```

---

## 5. Phase 10 — Full UI Redesign (Architecture Plan)

### Current Issues
- Glowing effects, particles, floating animations, excessive blur
- Inconsistent spacing and visual hierarchy
- Performance from heavy framer-motion animations

### Recommended Direction

| System | Replace With |
|--------|-------------|
| Glowing gradients | Subtle flat gradients (e.g., `from-cyan-500/10 to-blue-500/5`) |
| framer-motion heavy animations | CSS transitions (`transition-all duration-150`) |
| Particle decorations | Clean backgrounds with minimal dot grid |
| Blur-heavy glassmorphism | Solid dark backgrounds with thin borders |
| Oversized cards | Compact cards with tighter spacing |

### Implementation Strategy
1. **CSS variables** in `index.css` for spacing, colors, border-radius
2. **Remove heavy global animations** from layout wrappers
3. **Replace framer-motion** with Tailwind transitions in new components
4. **Standardize card patterns** into shared `CompactCard`, `ListRow` components

### Performance Targets (Phase 10)
| Metric | Target |
|--------|--------|
| Build time | <20s |
| Initial JS | <200KB |
| Interaction delay | <50ms |
| Canvas frame rate | 60fps at 50 nodes |

---

## 6. Summary of All Changes Made

### Backend (new/modified)
| File | Change |
|------|--------|
| `backend/database/models/Canvas.js` | **New** — Canvas document with embedded nodes[], edges[], viewport, collaborators |
| `backend/server/controllers/canvasController.js` | **New** — 12 CRUD functions for canvases, nodes, edges, collaborators |
| `backend/server/routes/canvas.routes.js` | **New** — 10 RESTful endpoints |
| `backend/server/socket.js` | **Modified** — Added 9 canvas socket events |
| `backend/server/server.js` | **Modified** — Registered `/api/canvas` routes |

### Frontend (new/modified)
| File | Change | Size |
|------|--------|------|
| `collaboration/pages/CollaborationHub.jsx` | **New** — Main canvas page with list + canvas view | 7KB |
| `collaboration/components/CollaborationCanvas/index.jsx` | **New** — Infinite zoom canvas engine | 5KB |
| `collaboration/components/CanvasNode/index.jsx` | **New** — Draggable node with context menu | 4KB |
| `collaboration/components/NodeConnections/index.jsx` | **New** — SVG connection lines (3 types) | 2KB |
| `collaboration/components/MiniMap/index.jsx` | **New** — Scaled navigator overlay | 3KB |
| `collaboration/components/PresenceIndicators/index.jsx` | **New** — Live user avatars | 2KB |
| `collaboration/components/Toolbar/index.jsx` | **New** — Zoom/undo/redo/add-node bar | 4KB |
| `collaboration/components/RoomTypes/index.jsx` | **New** — 5 room type preview components | 3KB |
| `collaboration/store/canvasStore.js` | **New** — Pub/sub state with undo/redo | 4KB |
| `collaboration/hooks/useCanvasSocket.js` | **New** — Socket event bridge | 3KB |
| `collaboration/hooks/useCanvasDrag.js` | **New** — Drag handling with multi-select | 2KB |
| `collaboration/utils/canvasUtils.js` | **New** — Layout math, node config, helpers | 3KB |
| `profiles/Connections.jsx` | **Modified** — Added network graph + canvas link | 5KB |
| `profiles/components/NetworkGraph.jsx` | **New** — Force-directed SVG network visualization | 3KB |
| `shared/components/Sidebar.jsx` | **Modified** — Added "Collaboration" link | 0.5KB |
| `shared/services/api.js` | **Modified** — Added 13 canvas API functions | 2KB |
| `App.jsx` | **Modified** — Added `/collaboration` + `/collaboration/:canvasId` routes | 1KB |

### Total: ~50KB of new/modified frontend code, ~8KB backend code
