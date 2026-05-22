import * as THREE from "three";

const ROLE_COLORS = {
  admin: "#a855f7",
  teacher: "#3b82f6",
  student: "#06b6d4",
  community_manager: "#f59e0b",
};
const RELATION_COLORS = {
  self: "#06b6d4",
  mutual: "#10b981",
  following: "#6366f1",
  follower: "#ec4899",
  discover: "#6b7280",
};

const TEXTURE_SIZE = 256;
const GLOW_SIZE = 512;
const API_ORIGIN = (typeof window !== "undefined" && typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL)
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/api$/, "")
  : "http://localhost:5001";

export function resolveAvatarUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (/^\/uploads\//i.test(path)) return `${API_ORIGIN}${path}`;
  return null;
}

export function getNodeColor(node) {
  if (node.relation === "self") return "#06b6d4";
  if (node.role === "admin") return "#a855f7";
  if (node.role === "teacher") return "#3b82f6";
  if ((node.nftCount || 0) > 0) return "#fbbf24";
  return RELATION_COLORS[node.relation] || "#8b5cf6";
}

export function getNodeGlowColor(node) {
  if (node.relation === "self") return "#06b6d4";
  if (node.role === "admin") return "#a855f7";
  if (node.role === "teacher") return "#3b82f6";
  if ((node.nftCount || 0) > 0) return "#f59e0b";
  return getNodeColor(node);
}

export function getNodeSize(node) {
  if (node.relation === "self") return 22;
  if (node.role === "admin") return 14;
  if (node.role === "teacher") return 12;
  const hasNft = (node.nftCount || 0) > 0;
  const fc = node.stats?.followers || 0;
  let s = node.role === "community_manager" ? 11 : 10;
  if (hasNft) s += 2;
  if (fc > 50) s += 2;
  if (fc > 200) s += 2;
  return Math.min(s, 20);
}

export function getLinkColor(sourceNode, targetNode) {
  if (sourceNode?.relation === "self" || targetNode?.relation === "self") return "rgba(6,182,212,0.5)";
  return "rgba(99,102,241,0.3)";
}

export function getInitials(name) {
  if (!name) return "?";
  return name.split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("");
}

export function processGraphData(apiGraph) {
  if (!apiGraph) return { nodes: [], links: [] };
  const nodes = (apiGraph.nodes || []).map((n) => ({
    ...n,
    color: getNodeColor(n),
    size: getNodeSize(n),
  }));
  const links = (apiGraph.edges || []).map((e) => ({
    source: e.source,
    target: e.target,
    type: e.relation || "following",
    color: getLinkColor(
      nodes.find((n) => n.id === e.source),
      nodes.find((n) => n.id === e.target)
    ),
  }));
  return { nodes, links };
}

export function processExpandedUsers(users, viewerId) {
  const nodes = [];
  const links = [];
  users.forEach((user) => {
    if (user.id === viewerId) return;
    nodes.push({ ...user, color: getNodeColor(user), size: getNodeSize(user) });
  });
  return { nodes, links };
}

const CIRCULAR_RING_RADII = {
  self: 0,
  mutual: 100,
  following: 180,
  follower: 280,
  discover: 380,
};

export function computeCircularPositions(nodes) {
  if (!nodes || nodes.length < 2) return;
  const selfNode = nodes.find((n) => n.relation === "self");
  if (!selfNode) return;
  selfNode.fx = 0; selfNode.fy = 0; selfNode.fz = 0;
  selfNode.depthLayer = 0;

  const CURVE_FACTOR = 0.00008;
  const DEPTH_LAYER_SPACING = 10;

  const rings = { self: [selfNode] };
  nodes.forEach((n) => {
    if (n.relation === "self") return;
    const rel = n.relation || "discover";
    if (!rings[rel]) rings[rel] = [];
    rings[rel].push(n);
  });

  const order = ["self", "mutual", "following", "follower", "discover"];
  order.forEach((rel) => {
    const ring = rings[rel];
    if (!ring || ring.length === 0) return;
    const radius = CIRCULAR_RING_RADII[rel] || 200;
    const count = ring.length;
    const angleOffset = order.indexOf(rel) * 0.4;
    const layerIdx = order.indexOf(rel);
    ring.forEach((node, i) => {
      const angle = angleOffset + (2 * Math.PI * i) / count;
      const rJitter = (Math.random() - 0.5) * radius * 0.1;
      const vJitter = (Math.random() - 0.5) * 18;
      const curvatureY = CURVE_FACTOR * radius * radius;
      const depthOffset = (layerIdx - 2) * DEPTH_LAYER_SPACING;
      node.fx = Math.cos(angle) * (radius + rJitter);
      node.fz = Math.sin(angle) * (radius + rJitter) + depthOffset;
      node.fy = vJitter + curvatureY;
      node.depthLayer = layerIdx;
    });
  });
}

export function parse3DGraphData(graphData) {
  const nodes = (graphData.nodes || []).map((n) => ({
    id: n.id,
    name: n.name || "Unknown",
    role: n.role || "student",
    val: n.size || 10,
    color: n.color || "#8b5cf6",
    avatar: resolveAvatarUrl(n.avatar),
    nftCount: n.nftCount || 0,
    collegeName: n.collegeName || n.institutionName || "",
    relation: n.relation || "discover",
    stats: n.stats || { followers: 0, following: 0 },
    communityCount: n.communityCount || 0,
    walletAddress: n.walletAddress || null,
    verified: n.verified || false,
    online: n.online || false,
  }));
  const links = (graphData.links || []).map((l) => ({
    source: typeof l.source === "object" ? l.source.id : l.source,
    target: typeof l.target === "object" ? l.target.id : l.target,
    type: l.type || (l.relation === "mutual" ? "mutual" : "following"),
  }));
  return { nodes, links };
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function createNodeTexture(name, avatarUrl, color, size) {
  try {
    const S = TEXTURE_SIZE;
    const cx = S / 2;
    const canvas = document.createElement("canvas");
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, S, S);

    const gradient = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
    gradient.addColorStop(0, hexToRgba(color, 0.5));
    gradient.addColorStop(0.85, hexToRgba(color, 0.15));
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cx, cx, 0, Math.PI * 2);
    ctx.fill();

    const innerR = cx - 4;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cx, innerR, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, S, S);

    const loaded = avatarUrl ? tryDrawAvatar(ctx, avatarUrl, cx, innerR) : false;

    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cx, innerR, 0, Math.PI * 2);
    ctx.strokeStyle = hexToRgba(color, 0.6);
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cx, innerR - 1.5, 0, Math.PI * 2);
    ctx.strokeStyle = hexToRgba("#ffffff", 0.08);
    ctx.lineWidth = 1;
    ctx.stroke();

    if (!loaded) {
      ctx.fillStyle = "#1f2937";
      ctx.beginPath();
      ctx.arc(cx, cx, innerR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${cx * 0.55}px "Inter", "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(getInitials(name), cx, cx);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.anisotropy = 8;

    if (avatarUrl && !loaded) {
      loadAvatarAsync(ctx, canvas, texture, avatarUrl, cx, innerR, name, color);
    }

    return texture;
  } catch (e) {
    console.error("createNodeTexture error:", e);
    return createFallbackTexture(color);
  }
}

function tryDrawAvatar(ctx, url, cx, innerR) {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const cacheKey = url;
    if (window.__avatarCache?.has(cacheKey)) {
      const cached = window.__avatarCache.get(cacheKey);
      if (cached.complete && cached.naturalWidth > 0) {
        const aspect = cached.naturalWidth / cached.naturalHeight;
        let dw, dh;
        if (aspect > 1) { dw = innerR * 2; dh = innerR * 2 / aspect; }
        else { dh = innerR * 2; dw = innerR * 2 * aspect; }
        const dx = cx - dw / 2, dy = cx - dh / 2;
        ctx.drawImage(cached, dx, dy, dw, dh);
        return true;
      }
    }
    if (img.complete && img.naturalWidth > 0) {
      const aspect = img.naturalWidth / img.naturalHeight;
      let dw, dh;
      if (aspect > 1) { dw = innerR * 2; dh = innerR * 2 / aspect; }
      else { dh = innerR * 2; dw = innerR * 2 * aspect; }
      ctx.drawImage(img, cx - dw / 2, cx - dh / 2, dw, dh);
      return true;
    }
  } catch {}
  return false;
}

function loadAvatarAsync(ctx, canvas, texture, url, cx, innerR, name, color) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  if (!window.__avatarCache) window.__avatarCache = new Map();
  img.onload = () => {
    try {
      window.__avatarCache.set(url, img);
      ctx.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
      const gradient = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
      gradient.addColorStop(0, hexToRgba(color, 0.5));
      gradient.addColorStop(0.85, hexToRgba(color, 0.15));
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.arc(cx, cx, cx, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cx, innerR, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = "#111827";
      ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
      const aspect = img.naturalWidth / img.naturalHeight;
      let dw, dh;
      if (aspect > 1) { dw = innerR * 2; dh = innerR * 2 / aspect; }
      else { dh = innerR * 2; dw = innerR * 2 * aspect; }
      ctx.drawImage(img, cx - dw / 2, cx - dh / 2, dw, dh);
      ctx.restore();
      ctx.beginPath(); ctx.arc(cx, cx, innerR, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(color, 0.6);
      ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cx, innerR - 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba("#ffffff", 0.08);
      ctx.lineWidth = 1; ctx.stroke();
      texture.needsUpdate = true;
    } catch {}
  };
  img.src = url;
}

function createFallbackTexture(color) {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  const fctx = canvas.getContext("2d");
  fctx.fillStyle = color || "#8b5cf6";
  fctx.beginPath(); fctx.arc(32, 32, 32, 0, Math.PI * 2); fctx.fill();
  fctx.fillStyle = "#fff";
  fctx.font = "bold 24px sans-serif";
  fctx.textAlign = "center"; fctx.textBaseline = "middle";
  fctx.fillText("?", 32, 32);
  return new THREE.CanvasTexture(canvas);
}

const TEXTURE_CACHE = new Map();

export function clearTextureCache() {
  TEXTURE_CACHE.forEach(t => t.dispose());
  TEXTURE_CACHE.clear();
}

export function createGlowTexture(color, size) {
  const key = `glow:${color}`;
  const cached = TEXTURE_CACHE.get(key);
  if (cached) return cached;
  try {
    const S = GLOW_SIZE;
    const cx = S / 2;
    const canvas = document.createElement("canvas");
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext("2d");

    const gradient = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.08, hexToRgba(color, 0.7));
    gradient.addColorStop(0.25, hexToRgba(color, 0.3));
    gradient.addColorStop(0.5, hexToRgba(color, 0.08));
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, S, S);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.anisotropy = 8;
    TEXTURE_CACHE.set(key, texture);
    return texture;
  } catch (e) {
    console.error("createGlowTexture error:", e);
    return createFallbackTexture(color);
  }
}

export function createGalaxyCoreTexture() {
  const key = "galaxy-core";
  const cached = TEXTURE_CACHE.get(key);
  if (cached) return cached;
  const S = 512;
  const cx = S / 2;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
  gradient.addColorStop(0, "rgba(6,182,212,1)");
  gradient.addColorStop(0.1, "rgba(6,182,212,0.8)");
  gradient.addColorStop(0.25, "rgba(139,92,246,0.5)");
  gradient.addColorStop(0.5, "rgba(6,182,212,0.15)");
  gradient.addColorStop(0.7, "rgba(139,92,246,0.05)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, S, S);

  for (let i = 0; i < 80; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * cx * 0.8;
    const px = cx + Math.cos(angle) * dist;
    const py = cx + Math.sin(angle) * dist;
    const size = 0.5 + Math.random() * 1.5;
    const alpha = 0.1 + Math.random() * 0.3;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath(); ctx.arc(px, py, size, 0, Math.PI * 2); ctx.fill();
  }

  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(cx, cx, 30 + i * 25, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(6,182,212,${0.04 + i * 0.02})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  texture.anisotropy = 8;
  TEXTURE_CACHE.set(key, texture);
  return texture;
}

export function buildNodeObject(node, isHovered, context) {
  const { getNodeColor, getNodeSize } = context;
  const color = getNodeColor(node);
  const size = getNodeSize(node);
  const scale = isHovered ? 1.4 : 1;
  const group = new THREE.Group();

  const glowMat = new THREE.SpriteMaterial({
    map: createGlowTexture(color, size),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: isHovered ? 0.8 : 0.4,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(size * 4 * scale, size * 4 * scale, 1);
  group.add(glow);

  const spriteMap = createNodeTexture(node.name || "?", node.avatar, color, size * scale);
  const spriteMat = new THREE.SpriteMaterial({ map: spriteMap, transparent: true, depthTest: true, depthWrite: false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(size * 2 * scale, size * 2 * scale, 1);
  group.add(sprite);

  if (node.relation === "self" || isHovered) {
    const ringGeo = new THREE.RingGeometry(size * 1.3 * scale, size * 1.6 * scale, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: isHovered ? 0.5 : 0.25, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.z = -0.1;
    group.add(ring);
  }

  if (node.relation === "self") {
    const outerRingGeo = new THREE.RingGeometry(size * 1.8 * scale, size * 2.3 * scale, 64);
    const outerRingMat = new THREE.MeshBasicMaterial({ color: "#06b6d4", transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false });
    const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    outerRing.position.z = -0.15;
    group.add(outerRing);
  }

  if ((node.nftCount || 0) > 0 && node.relation !== "self") {
    const nftGlowMat = new THREE.SpriteMaterial({
      map: createGlowTexture("#fbbf24", size * 0.5),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6,
    });
    const nftGlow = new THREE.Sprite(nftGlowMat);
    nftGlow.scale.set(size * 2.5 * scale, size * 2.5 * scale, 1);
    nftGlow.position.z = -0.2;
    group.add(nftGlow);
  }

  return group;
}

export function createLinkParticles(source, target, color) {
  const dx = source.x - target.x, dy = source.y - target.y, dz = source.z - target.z;
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (!length || length < 1) return null;
  const mid = new THREE.Vector3((source.x + target.x) / 2, (source.y + target.y) / 2, (source.z + target.z) / 2);
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(3);
  pos[0] = mid.x; pos[1] = mid.y; pos[2] = mid.z;
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: color || "#6366f1", size: 1.5, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  return new THREE.Points(geo, mat);
}
