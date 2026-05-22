import { useRef, useCallback, useEffect, useMemo, useState, forwardRef, useImperativeHandle } from "react";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";
import {
  parse3DGraphData,
  getNodeColor,
  getNodeSize,
  createNodeTexture,
  createGlowTexture,
  createGalaxyCoreTexture,
  computeCircularPositions,
  resolveAvatarUrl,
} from "./graphUtils";
import useGraphPhysics from "./useGraphPhysics";

const BG_COLOR = "#050510";
const LINK_COLORS = {
  mutual: "#10b981",
  following: "#6366f1",
  follower: "#ec4899",
  community: "#22d3ee",
  nft: "#f59e0b",
};

function createParallaxStars() {
  const g = new THREE.Group();
  const layers = [
    { count: 1500, minR: 200, maxR: 600, size: 0.3, speed: 0.0003, spread: 0.3, opacity: 0.5 },
    { count: 2000, minR: 400, maxR: 1200, size: 0.6, speed: 0.00015, spread: 0.5, opacity: 0.6 },
    { count: 1000, minR: 800, maxR: 2000, size: 1.2, speed: 0.00007, spread: 0.7, opacity: 0.7 },
  ];
  layers.forEach((cfg) => {
    const positions = new Float32Array(cfg.count * 3);
    const colors = new Float32Array(cfg.count * 3);
    for (let i = 0; i < cfg.count; i++) {
      const radius = cfg.minR + Math.pow(Math.random(), 0.5) * (cfg.maxR - cfg.minR);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * cfg.spread;
      positions[i * 3 + 2] = radius * Math.cos(phi);
      const tint = Math.random();
      let r = 0.5 + Math.random() * 0.5;
      let g = 0.5 + Math.random() * 0.5;
      let b = 0.6 + Math.random() * 0.4;
      if (tint < 0.1) { r = 0.3; g = 0.2; b = 0.7; }
      else if (tint < 0.2) { r = 0.7; g = 0.4; b = 0.3; }
      else if (tint < 0.3) { r = 0.3; g = 0.7; b = 0.5; }
      colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: cfg.size, vertexColors: true, transparent: true, opacity: cfg.opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    points.userData = { speed: cfg.speed, type: "parallax-star" };
    g.add(points);
  });
  return g;
}

function createAmbientGlow() {
  const S = 512;
  const cx = S / 2;
  const canvas = document.createElement("canvas");
  canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
  g.addColorStop(0, "rgba(139,92,246,0.15)");
  g.addColorStop(0.2, "rgba(6,182,212,0.08)");
  g.addColorStop(0.5, "rgba(30,27,75,0.03)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({
    map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    opacity: 1.0,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(800, 800, 1);
  sprite.position.set(0, 0, -150);
  sprite.userData = { type: "ambient-glow" };
  return sprite;
}

function createDriftParticles() {
  const count = 200;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const data = [];
  for (let i = 0; i < count; i++) {
    const radius = 40 + Math.random() * 180;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = (Math.random() - 0.5) * 80;
    positions[i * 3 + 2] = radius * Math.cos(phi);
    const tint = Math.random();
    if (tint < 0.33) { colors[i * 3] = 0.4; colors[i * 3 + 1] = 0.2; colors[i * 3 + 2] = 0.8; }
    else if (tint < 0.66) { colors[i * 3] = 0.2; colors[i * 3 + 1] = 0.6; colors[i * 3 + 2] = 0.8; }
    else { colors[i * 3] = 0.8; colors[i * 3 + 1] = 0.3; colors[i * 3 + 2] = 0.6; }
    data.push({
      phaseX: Math.random() * Math.PI * 2, phaseY: Math.random() * Math.PI * 2, phaseZ: Math.random() * Math.PI * 2,
      speedX: 0.15 + Math.random() * 0.25, speedY: 0.08 + Math.random() * 0.15, speedZ: 0.15 + Math.random() * 0.25,
      ampX: 5 + Math.random() * 15, ampY: 3 + Math.random() * 10, ampZ: 5 + Math.random() * 15,
      baseX: positions[i * 3], baseY: positions[i * 3 + 1], baseZ: positions[i * 3 + 2],
    });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 1.0, vertexColors: true, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.userData = { type: "drift-particle", particleData: data };
  return points;
}

const Web3Graph = forwardRef(function Web3Graph(
  {
    graphData, onNodeClick, onNodeDoubleClick, onNodeHover,
    onBackgroundClick, onExpandNode, autoRotate = true, width, height, className = "",
  },
  ref
) {
  const fgRef = useRef(null);
  const hoveredNode = useRef(null);
  const [hoverId, setHoverId] = useState(null);
  const nodeCount = graphData?.nodes?.length || 0;
  const physics = useGraphPhysics(nodeCount);
  const animFrameRef = useRef(null);
  const lastClickRef = useRef(0);
  const clickTimeoutRef = useRef(null);
  const nodeGroupsRef = useRef(new Map());
  const timeRef = useRef(0);
  const lastLodRef = useRef(1);

  const data = useMemo(() => {
    const parsed = parse3DGraphData(graphData);
    computeCircularPositions(parsed.nodes);
    return parsed;
  }, [graphData]);

  useEffect(() => {
    if (!fgRef.current) return;
    const timeout = setTimeout(() => {
      try { fgRef.current?.zoomToFit(300, 100); } catch {}
    }, 400);
    return () => clearTimeout(timeout);
  }, [nodeCount, data]);

  useEffect(() => {
    if (!fgRef.current) return;
    const effects = [];
    const timeout = setTimeout(() => {
      try {
        const scene = fgRef.current?.scene?.();
        if (!scene) return;

        if (!scene.children.find(c => c.userData?.type === "parallax-star-container")) {
          const starGroup = createParallaxStars();
          starGroup.userData.type = "parallax-star-container";
          scene.add(starGroup);
          effects.push(starGroup);
        }

        if (!scene.children.find(c => c.userData?.type === "ambient-glow")) {
          const glow = createAmbientGlow();
          scene.add(glow);
          effects.push(glow);
        }

        if (!scene.children.find(c => c.userData?.type === "drift-particle")) {
          const drift = createDriftParticles();
          scene.add(drift);
          effects.push(drift);
        }

        try {
          const renderer = fgRef.current?.renderer?.();
          if (renderer && !renderer.__toneMappingSet) {
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.2;
            renderer.__toneMappingSet = true;
          }
        } catch {}
      } catch {}
    }, 200);
    return () => {
      clearTimeout(timeout);
      effects.forEach((obj) => {
        try {
          const scene = fgRef.current?.scene?.();
          if (scene) scene.remove(obj);
          obj.traverse((c) => { c.geometry?.dispose(); c.material?.dispose(); });
        } catch {}
      });
    };
  }, []);

  useEffect(() => {
    if (!autoRotate || !fgRef.current) return;
    let angle = 0;
    let fogInited = false;
    const fogDensity = 0.0012;
    const tempVec = new THREE.Vector3();

    const animate = () => {
      timeRef.current += 0.016;
      const t = timeRef.current;
      const fg = fgRef.current;
      if (fg && fg.camera) {
        angle += 0.0015;
        const dist = 320;
        fg.camera.position.x = dist * Math.sin(angle);
        fg.camera.position.z = dist * Math.cos(angle);
        fg.camera.position.y = 25 + Math.sin(angle * 0.3) * 8;
        fg.camera.lookAt(0, 0, 0);

        const scene = fg.scene;
        if (scene) {
          if (!fogInited) {
            scene.fog = new THREE.FogExp2(BG_COLOR, fogDensity);
            fogInited = true;
          }
          scene.traverse((child) => {
            if (child.isPoints && child.userData?.type === "parallax-star") {
              child.rotation.y += child.userData.speed;
              child.rotation.x += child.userData.speed * 0.3;
            }
            if (child.isPoints && child.userData?.type === "drift-particle") {
              const pos = child.geometry.attributes.position;
              const arr = pos.array;
              const pd = child.userData.particleData;
              const tm = timeRef.current;
              for (let i = 0; i < pd.length; i++) {
                const d = pd[i];
                arr[i * 3]     = d.baseX + Math.sin(tm * d.speedX + d.phaseX) * d.ampX;
                arr[i * 3 + 1] = d.baseY + Math.sin(tm * d.speedY + d.phaseY) * d.ampY;
                arr[i * 3 + 2] = d.baseZ + Math.sin(tm * d.speedZ + d.phaseZ) * d.ampZ;
              }
              pos.needsUpdate = true;
            }
          });
        }

        const camDist = fg.camera.position.length();
        const lodT = Math.max(0, Math.min(1, (camDist - 80) / (600 - 80)));
        const lodScale = 1.4 - lodT * 0.8;
        const spriteLodOpacity = 1.0 - Math.max(0, (lodT - 0.5) * 2) * 0.8;
        const lodChanged = Math.abs(lodScale - lastLodRef.current) > 0.005;
        if (lodChanged) lastLodRef.current = lodScale;

        nodeGroupsRef.current.forEach((group) => {
          const phase = group.userData.phase || 0;

          group.getWorldPosition(tempVec);
          const distFromCenter = tempVec.length();
          const fogFactor = Math.exp(-Math.pow(fogDensity * distFromCenter, 2));

          group.children.forEach((child) => {
            const ctype = child.userData?.type;

            if (ctype === "glow" || ctype === "innerGlow" || ctype === "nftGlow" || ctype === "haloGlow") {
              const baseOp = child.userData?.baseOpacity ?? 0.5;
              const breathe = 0.85 + Math.sin(t * 1.2 + phase) * 0.15;
              child.material.opacity = baseOp * breathe * Math.max(0.25, fogFactor);
            }

            if (ctype === "sprite") {
              child.material.opacity = spriteLodOpacity * Math.max(0.25, fogFactor);
            }

            if (child.isMesh && child.geometry?.type === "RingGeometry" && child.userData?.pulse) {
              const s = 1 + Math.sin(t * 1.5 + phase) * 0.06;
              child.scale.set(s, s, 1);
              const breathe = 0.7 + Math.sin(t * 2 + phase) * 0.3;
              child.material.opacity = (child.userData?.baseOp || 0.2) * breathe * Math.max(0.25, fogFactor);
            }

            if (child.isMesh && child.userData?.floatY) {
              child.position.y = Math.sin(t * child.userData.floatSpeed + (child.userData.floatPhase || 0)) * (child.userData.floatAmplitude || 1);
            }
          });

          if (lodChanged) group.scale.setScalar(lodScale);
        });

        if (fg.controls) fg.controls.update();
      }
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (fgRef.current?.scene) { fgRef.current.scene.fog = null; }
    };
  }, [autoRotate]);

  const handleNodeClick = useCallback((node, event) => {
    const now = Date.now();
    if (now - lastClickRef.current < 350) {
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null; lastClickRef.current = 0;
      if (onNodeDoubleClick) onNodeDoubleClick(node);
      return;
    }
    lastClickRef.current = now;
    clickTimeoutRef.current = setTimeout(() => {
      clickTimeoutRef.current = null;
      if (onNodeClick) onNodeClick(node);
      if (onExpandNode && node.relation !== "self") onExpandNode(node);
    }, 300);
  }, [onNodeClick, onNodeDoubleClick, onExpandNode]);

  const handleNodeHover = useCallback((node) => {
    hoveredNode.current = node;
    setHoverId(node?.id || null);
    if (onNodeHover) onNodeHover(node);
  }, [onNodeHover]);

  const handleBackgroundClick = useCallback(() => { if (onBackgroundClick) onBackgroundClick(); }, [onBackgroundClick]);

  useImperativeHandle(ref, () => ({
    centerAt: (x, y, ms) => fgRef.current?.centerAt(x, y, ms),
    zoom: (val, ms) => fgRef.current?.zoom(val, ms),
    zoomToFit: (ms, pad) => fgRef.current?.zoomToFit(ms, pad),
    d3Force: (key, val) => fgRef.current?.d3Force(key, val),
    emitParticle: (link) => { try { fgRef.current?.emitParticle(link); } catch {} },
    refresh: () => fgRef.current?.d3ReheatSimulation(),
    graph: () => fgRef.current,
    cameraPosition: (pos, lookAt, ms) => fgRef.current?.cameraPosition(pos, lookAt, ms),
    scene: () => fgRef.current?.scene,
  }));

  const nodeThreeObject = useCallback((node) => {
    try {
      const color = getNodeColor(node);
      const nodeSize = getNodeSize(node);
      const isHovered = hoverId === node.id;
      const scale = isHovered ? 1.3 : 1;
      const isSelf = node.relation === "self";
      const s = nodeSize * scale;
      const group = new THREE.Group();
      group.userData.phase = Math.random() * Math.PI * 2;

      const glowR = isSelf ? s * 6 : s * 3.5;
      const glowMat = new THREE.SpriteMaterial({
        map: isSelf ? createGalaxyCoreTexture() : createGlowTexture(color, s),
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
        opacity: isHovered ? 1.0 : isSelf ? 0.8 : 0.55,
      });
      glowMat.userData = glowMat.userData || {};
      const glow = new THREE.Sprite(glowMat);
      glow.scale.set(glowR * 2, glowR * 2, 1);
      glow.userData = { baseOpacity: isSelf ? 0.8 : 0.55, type: "glow" };
      group.add(glow);

      if (isSelf) {
        const innerGlowMat = new THREE.SpriteMaterial({
          map: createGlowTexture("#06b6d4", s),
          transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6,
        });
        const innerGlow = new THREE.Sprite(innerGlowMat);
        innerGlow.scale.set(s * 4, s * 4, 1);
        innerGlow.position.z = 0.1;
        innerGlow.userData = { baseOpacity: 0.6, type: "innerGlow" };
        group.add(innerGlow);
      }

      const hasNft = (node.nftCount || 0) > 0;
      if (hasNft && !isSelf) {
        const nftMat = new THREE.SpriteMaterial({
          map: createGlowTexture("#fbbf24", s),
          transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5,
        });
        const nftGlow = new THREE.Sprite(nftMat);
        nftGlow.scale.set(s * 4, s * 4, 1);
        nftGlow.position.z = -0.3;
        nftGlow.userData = { baseOpacity: 0.5, type: "nftGlow" };
        group.add(nftGlow);
      }

      const spriteMap = createNodeTexture(node.name || "?", node.avatar, color, s);
      const spriteMat = new THREE.SpriteMaterial({ map: spriteMap, transparent: true, depthTest: true, depthWrite: false });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(s * 2, s * 2, 1);
      sprite.userData = { type: "sprite" };
      group.add(sprite);

      if (isSelf) {
        for (let i = 0; i < 3; i++) {
          const r = new THREE.Mesh(
            new THREE.RingGeometry(s * (1.8 + i * 0.6), s * (2.2 + i * 0.6), 64),
            new THREE.MeshBasicMaterial({
              color: i === 0 ? "#06b6d4" : i === 1 ? "#818cf8" : "#a855f7",
              transparent: true, opacity: 0.15 - i * 0.04, side: THREE.DoubleSide, depthWrite: false,
            })
          );
          r.position.z = -0.3 - i * 0.1;
          r.userData = { pulse: true, baseOp: 0.15 - i * 0.04, ringIndex: i, rotSpeed: 0.3 + i * 0.2 };
          group.add(r);
        }

        const haloGlowMat = new THREE.SpriteMaterial({
          map: createGlowTexture("#06b6d4", s * 2),
          transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.3,
        });
        const haloGlow = new THREE.Sprite(haloGlowMat);
        haloGlow.scale.set(s * 5, s * 5, 1);
        haloGlow.position.z = -0.5;
        haloGlow.userData = { baseOpacity: 0.3, type: "haloGlow" };
        group.add(haloGlow);
      }

      if (isHovered) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(s * 1.3, s * 1.7, 48),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false })
        );
        ring.position.z = -0.1;
        ring.userData = { pulse: true, baseOp: 0.6 };
        group.add(ring);
      }

      if (node.verified) {
        const pulseRing = new THREE.Mesh(
          new THREE.RingGeometry(s * 0.8, s * 1.2, 32),
          new THREE.MeshBasicMaterial({ color: "#10b981", transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })
        );
        pulseRing.position.z = 0.15;
        pulseRing.userData = { pulse: true, baseOp: 0.5 };
        group.add(pulseRing);
      }

      if (node.online || isHovered) {
        const dot = new THREE.Mesh(
          new THREE.CircleGeometry(s * 0.25, 12),
          new THREE.MeshBasicMaterial({ color: "#10b981", transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide })
        );
        dot.position.set(s * 1.4, -s * 1.4, 0.3);
        group.add(dot);
      }

      nodeGroupsRef.current.set(node.id, group);
      return group;
    } catch (e) {
      console.error("[nodeThreeObject] error", node?.id, e);
      return new THREE.Mesh(new THREE.SphereGeometry(8, 8, 8), new THREE.MeshBasicMaterial({ color: "#8b5cf6" }));
    }
  }, [hoverId]);

  const linkColorFn = useCallback((link) => LINK_COLORS[link.type || "following"] || "#6366f1", []);
  const linkWidthFn = useCallback((link) => link.type === "mutual" ? 1.2 : link.type === "following" ? 0.8 : 0.5, []);
  const particleColorFn = useCallback((link) => LINK_COLORS[link.type || "following"] || "#818cf8", []);

  if (nodeCount === 0) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width, height }}>
        <p className="text-sm text-gray-500">No connections yet</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      <ForceGraph3D
        ref={fgRef}
        graphData={data}
        width={width}
        height={height}
        backgroundColor={BG_COLOR}
        nodeThreeObject={nodeThreeObject}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        onBackgroundClick={handleBackgroundClick}
        nodeRelSize={physics.nodeRelSize}
        linkColor={linkColorFn}
        linkWidth={linkWidthFn}
        linkResolution={8}
        linkDirectionalParticles={4}
        linkDirectionalParticleWidth={2.5}
        linkDirectionalParticleSpeed={0.006}
        linkDirectionalParticleColor={particleColorFn}
        d3AlphaDecay={0}
        d3VelocityDecay={0}
        d3Alpha={0}
        d3AlphaMin={0.001}
        warmupTicks={0}
        cooldownTicks={0}
        cooldownTime={0}
        enableNodeDrag={true}
        enableNavigationControls={true}
        enablePointerInteraction={true}
        showNavInfo={false}
        cameraPosition={{ x: 0, y: 25, z: 320 }}
        rendererConfig={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      />
    </div>
  );
});

export default Web3Graph;
