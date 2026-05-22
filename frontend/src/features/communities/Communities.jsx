import PropTypes from "prop-types";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../shared/hooks/useAuth";
import { useToast } from "../../shared/hooks/useToast";
import { API_BASE_URL, getCommunitiesMap, createCommunityForm, API_SERVER_ORIGIN } from "../../shared/services/api";
import { MediaBanner, isVideoUrl } from "../../shared/components/MediaBanner";
import {
  Search, Users, Plus, X, Minus, Maximize2, Map as MapIcon,
  Globe, Lock, Eye, ExternalLink,
} from "lucide-react";

/* ── Constants ── */
const CATEGORIES = ["Technology","Academic","Science","Arts","Sports","Cultural","Social","Career"];

const SUB_CATEGORIES = {
  Technology: ["Programming","Web Development","App Development","AI & ML","Cybersecurity","Blockchain & Web3","Cloud Computing","DevOps","UI/UX Design","Game Development","Robotics","IoT","Open Source","Hackathons"],
  Academic: ["Commerce & Finance","FinTech","Stock Market","Law","Public Policy","Competitive Exams","Research","Mathematics","Physics","Chemistry"],
  Science: ["Data Science","Biotechnology","Medical Research","Healthcare","Genetics","Research & Innovation"],
  Arts: ["Photography","Videography","Graphic Design","Animation & VFX","Music","Dance","Drama","Film Making","Creative Media","Content Creation"],
  Sports: ["Esports","Fitness","Athletics","Cricket","Football","Basketball","Yoga"],
  Cultural: ["Cultural Club","Debate Club","Public Speaking","Event Management","Leadership","NSS","NGO","Volunteering","Environment"],
  Social: ["Networking","Community Service","Mentorship","Peer Learning","International Relations"],
  Career: ["Entrepreneurship","Startup Founders","Business","Marketing","Freelancing","Placement Prep","DSA","Resume Building","AI Startups","Creator Economy"],
};

const CAT_ICONS = {
  Technology:"💻", Academic:"📚", Arts:"🎨", Science:"🔬",
  Sports:"⚽", Cultural:"🎭", Social:"🤝", Career:"💼",
};

const CAT_COLORS = {
  Technology:{ border:"#1a4a6a", text:"#8ac0e8", bg:"rgba(26,74,106,0.15)" },
  Academic:{ border:"#2d4a7a", text:"#8ab0e8", bg:"rgba(45,74,122,0.15)" },
  Arts:{ border:"#6a2d5e", text:"#d08ab8", bg:"rgba(106,45,94,0.15)" },
  Science:{ border:"#1a5e4a", text:"#6ab8a0", bg:"rgba(26,94,74,0.15)" },
  Sports:{ border:"#4a5e2d", text:"#a0c878", bg:"rgba(74,94,45,0.15)" },
  Cultural:{ border:"#5e2d6a", text:"#b078d8", bg:"rgba(94,45,106,0.15)" },
  Social:{ border:"#6a4a2d", text:"#d8a078", bg:"rgba(106,74,45,0.15)" },
  Career:{ border:"#2d5e5e", text:"#78b8b8", bg:"rgba(45,94,94,0.15)" },
  Other:{ border:"#3a3a4a", text:"#9a9aaa", bg:"rgba(58,58,74,0.15)" },
};

const NODE_W = 244;
const NODE_H = 108;
const PREVIEW_W = 280;
const CAT_GAP_X = 340;
const NODE_GAP_Y = 140;
const ORIGIN_X = 120;
const ORIGIN_Y = 100;
const CONNECTOR_HEIGHT = 36;
const POSITIONS_KEY = "eco-map-positions";

function loadPositions() {
  try { return JSON.parse(localStorage.getItem(POSITIONS_KEY) || "{}"); } catch { return {}; }
}
function savePositions(p) {
  try { localStorage.setItem(POSITIONS_KEY, JSON.stringify(p)); } catch {}
}

function computeInitialPositions(communities) {
  const pos = {};
  const cats = {};
  for (const c of communities) {
    const cat = c.category || "Other";
    if (!cats[cat]) cats[cat] = [];
    cats[cat].push(c);
  }
  const keys = Object.keys(cats).sort();
  let ci = 0;
  const used = new Set();
  for (const cat of keys) {
    const items = cats[cat];
    items.forEach((c, i) => {
      let x = ORIGIN_X + ci * CAT_GAP_X + (ci % 2) * 20;
      let y = ORIGIN_Y + i * NODE_GAP_Y + Math.sin(i * 0.5) * 10;
      const k = `${Math.round(x)},${Math.round(y)}`;
      if (used.has(k)) { x += 30; y += 30; }
      used.add(k);
      pos[c._id] = { x, y };
    });
    ci++;
  }
  return pos;
}

function getActivityColor(s) {
  return { active:"#4a9bd2", moderate:"#c2a84a", quiet:"#5a5a6a" }[s] || "#4a9bd2";
}
function getActivityLabel(s) {
  return { active:"Active", moderate:"Moderate", quiet:"Quiet" }[s] || "Active";
}

/* ── Mini Map ── */
function MiniMap({ positions, communities, pan, zoom, vpRef, onNavigate }) {
  const vals = Object.values(positions);
  if (!vals.length) return null;
  const maxX = Math.max(...vals.map(p => p.x), 800);
  const maxY = Math.max(...vals.map(p => p.y), 600);
  const sc = Math.min(140 / (maxX + 200), 80 / (maxY + 200), 0.8);
  const vpW = vpRef.current?.clientWidth || 800;
  const vpH = vpRef.current?.clientHeight || 500;

  return (
    <div data-control
      className="absolute bottom-4 right-4 z-20 rounded-lg border overflow-hidden select-none"
      style={{ width:160, height:110, backgroundColor:"#060812", borderColor:"rgba(255,255,255,0.06)" }}
    >
      <div className="px-2 py-1 border-b" style={{ borderColor:"rgba(255,255,255,0.06)" }}>
        <span className="text-[8px] uppercase tracking-widest font-semibold" style={{ color:"#6a6a7a" }}>Overview</span>
      </div>
      <div className="relative p-2">
        {Object.entries(positions).slice(0,120).map(([id,p]) => {
          const c = communities.find(cc => cc._id === id);
          if (!c) return null;
          const col = CAT_COLORS[c.category||"Other"]||CAT_COLORS.Other;
          return (
            <div key={id}
              className="absolute rounded-sm cursor-pointer hover:opacity-100 transition-opacity"
              style={{ left:p.x*sc+4, top:p.y*sc+4, width:3, height:3, backgroundColor:col.border, opacity:0.6 }}
              onClick={() => onNavigate(-(p.x*zoom)+vpW/2, -(p.y*zoom)+vpH/2)}
            />
          );
        })}
        <div className="absolute border pointer-events-none rounded"
          style={{
            left:4+(-pan.x/zoom)*sc, top:4+(-pan.y/zoom)*sc,
            width:Math.max(8,vpW/zoom*sc), height:Math.max(5,vpH/zoom*sc),
            borderColor:"rgba(74,155,210,0.3)", opacity:0.6,
          }}
        />
      </div>
    </div>
  );
}
MiniMap.propTypes = {
  positions:PropTypes.object.isRequired, communities:PropTypes.array.isRequired,
  pan:PropTypes.object.isRequired, zoom:PropTypes.number.isRequired,
  vpRef:PropTypes.object.isRequired, onNavigate:PropTypes.func.isRequired,
};

/* ── Category Selector ── */
function CategorySelector({ value, onChange }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return CATEGORIES;
    const q = search.toLowerCase();
    return CATEGORIES.filter(c =>
      c.toLowerCase().includes(q) ||
      (SUB_CATEGORIES[c]||[]).some(s => s.toLowerCase().includes(q))
    );
  }, [search]);

  return (
    <div>
      <label className="text-[9px] uppercase tracking-widest font-semibold" style={{ color:"#6a6a7a" }}>Community Type</label>
      <div className="mt-1 mb-2">
        <div className="flex items-center gap-1.5 rounded-lg border px-2 py-1" style={{ backgroundColor:"rgba(255,255,255,0.03)", borderColor:"rgba(255,255,255,0.08)" }}>
          <Search size={11} style={{ color:"#6a6a7a" }} />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search types..."
            className="bg-transparent text-[11px] outline-none w-full" style={{ color:"#e0e0f0" }}
          />
          {search&&<button onClick={()=>setSearch("")}><X size={10} style={{ color:"#6a6a7a" }}/></button>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
        {filtered.map(cat => {
          const col = CAT_COLORS[cat]||CAT_COLORS.Other;
          const active = value === cat;
          const subs = SUB_CATEGORIES[cat]||[];
          return (
            <button key={cat} type="button"
              onClick={() => onChange(cat)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition border"
              style={{
                backgroundColor: active ? col.bg : "rgba(255,255,255,0.02)",
                borderColor: active ? col.border+"60" : "rgba(255,255,255,0.05)",
              }}
            >
              <span style={{ fontSize:14 }}>{CAT_ICONS[cat]||"🌐"}</span>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-medium block truncate" style={{ color:active?col.text:"#e0e0f0" }}>{cat}</span>
                <span className="text-[8px]" style={{ color:"#7a7a8a" }}>{subs.length} sub-types</span>
              </div>
              {active&&<div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor:col.border }}/>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
CategorySelector.propTypes = { value:PropTypes.string.isRequired, onChange:PropTypes.func.isRequired };

/* ── Create Panel ── */
function CreatePanel({ onClose, onSubmit, submitting, position }) {
  const [form, setForm] = useState({
    name:"", description:"", category:"Technology", type:"public",
    privacy:"open", tags:"", rules:"", communityType:"",
    linkedSubjects:"", colorAccent:"",
    image:null, imagePreview:null, logo:null, logoPreview:null,
  });

  const handleFile = (field, previewField) => (e) => {
    const f = e.target.files?.[0];
    if (f) setForm(p => ({...p, [field]:f, [previewField]:URL.createObjectURL(f)}));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.description.trim()) return;
    const fd = new FormData();
    fd.append("name", form.name.trim());
    fd.append("description", form.description.trim());
    fd.append("category", form.category);
    fd.append("type", form.type);
    fd.append("privacy", form.privacy);
    if (form.rules.trim()) fd.append("rules", form.rules.trim());
    if (form.tags.trim()) form.tags.split(",").map(t=>t.trim()).filter(Boolean).forEach(t=>fd.append("tags",t));
    if (form.linkedSubjects.trim()) form.linkedSubjects.split(",").map(s=>s.trim()).filter(Boolean).forEach(s=>fd.append("linkedSubjects",s));
    if (form.image) fd.append("image", form.image);
    if (form.logo) fd.append("logo", form.logo);
    onSubmit(fd);
  };

  return (
    <motion.div
      initial={{ opacity:0, scale:0.92, y:15 }}
      animate={{ opacity:1, scale:1, y:0 }}
      exit={{ opacity:0, scale:0.92, y:15 }}
      transition={{ duration:0.3, ease:[0.16,1,0.3,1] }}
      className="absolute z-10"
      style={{ left:position.x, top:position.y, width:380 }}
    >
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor:"#0a0e1e", borderColor:"rgba(255,255,255,0.07)" }}>
        <div style={{ height:3, background:"linear-gradient(90deg, #1a4a6a, #2d4a7a)" }}/>
        <div className="px-4 pt-3 pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)" }}>
                <Plus size={13} style={{ color:"#8a8a9a" }}/>
              </div>
              <div>
                <h3 className="text-sm font-semibold" style={{ color:"#f0f0ff" }}>New Ecosystem Node</h3>
                <p className="text-[9px]" style={{ color:"#7a7a8a" }}>Add a community to the map</p>
              </div>
            </div>
            <button onClick={onClose} className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/[0.08]">
              <X size={10} style={{ color:"#7a7a8a" }}/>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-2.5">
            <div>
              <label className="text-[9px] uppercase tracking-widest font-semibold" style={{ color:"#6a6a7a" }}>Name</label>
              <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}
                className="mt-0.5 w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none"
                style={{ backgroundColor:"rgba(255,255,255,0.03)", borderColor:"rgba(255,255,255,0.08)", color:"#f0f0ff" }}
                placeholder="Community name"
              />
            </div>
            <div>
              <label className="text-[9px] uppercase tracking-widest font-semibold" style={{ color:"#6a6a7a" }}>Description</label>
              <textarea rows={2} value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))}
                className="mt-0.5 w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none resize-none"
                style={{ backgroundColor:"rgba(255,255,255,0.03)", borderColor:"rgba(255,255,255,0.08)", color:"#f0f0ff" }}
                placeholder="What is this community about?"
              />
            </div>

            <CategorySelector value={form.category} onChange={cat=>setForm(p=>({...p,category:cat}))} />

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[9px] uppercase tracking-widest font-semibold" style={{ color:"#6a6a7a" }}>Tags</label>
                <input value={form.tags} onChange={e=>setForm(p=>({...p,tags:e.target.value}))}
                  className="mt-0.5 w-full rounded-lg border px-2.5 py-1.5 text-[10px] outline-none"
                  style={{ backgroundColor:"rgba(255,255,255,0.03)", borderColor:"rgba(255,255,255,0.08)", color:"#f0f0ff" }}
                  placeholder="tech, education, web3"
                />
              </div>
              <div className="flex-1">
                <label className="text-[9px] uppercase tracking-widest font-semibold" style={{ color:"#6a6a7a" }}>Subjects</label>
                <input value={form.linkedSubjects} onChange={e=>setForm(p=>({...p,linkedSubjects:e.target.value}))}
                  className="mt-0.5 w-full rounded-lg border px-2.5 py-1.5 text-[10px] outline-none"
                  style={{ backgroundColor:"rgba(255,255,255,0.03)", borderColor:"rgba(255,255,255,0.08)", color:"#f0f0ff" }}
                  placeholder="math, cs, physics"
                />
              </div>
            </div>

            <div>
              <label className="text-[9px] uppercase tracking-widest font-semibold" style={{ color:"#6a6a7a" }}>Community Rules</label>
              <textarea rows={1} value={form.rules} onChange={e=>setForm(p=>({...p,rules:e.target.value}))}
                className="mt-0.5 w-full rounded-lg border px-2.5 py-1.5 text-[10px] outline-none resize-none"
                style={{ backgroundColor:"rgba(255,255,255,0.03)", borderColor:"rgba(255,255,255,0.08)", color:"#f0f0ff" }}
                placeholder="Be respectful, stay on topic..."
              />
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[9px] uppercase tracking-widest font-semibold" style={{ color:"#6a6a7a" }}>Type</label>
                <select value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}
                  className="mt-0.5 w-full rounded-lg border px-2.5 py-1.5 text-[10px] outline-none"
                  style={{ backgroundColor:"rgba(255,255,255,0.03)", borderColor:"rgba(255,255,255,0.08)", color:"#f0f0ff" }}
                >
                  <option value="public" style={{backgroundColor:"#0a0e1e"}}>Public</option>
                  <option value="private" style={{backgroundColor:"#0a0e1e"}}>Private</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-[9px] uppercase tracking-widest font-semibold" style={{ color:"#6a6a7a" }}>Join Approval</label>
                <div className="mt-0.5 flex gap-1">
                  {[
                    {value:"open", icon:Globe},
                    {value:"approval", icon:Eye},
                    {value:"invite", icon:Lock},
                  ].map(opt => {
                    const Icon = opt.icon;
                    const active = form.privacy === opt.value;
                    return (
                      <button key={opt.value} type="button"
                        onClick={()=>setForm(p=>({...p,privacy:opt.value}))}
                        className="flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-[9px] font-medium transition border"
                        style={{
                          backgroundColor: active ? "rgba(255,255,255,0.05)" : "transparent",
                          borderColor: active ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)",
                          color: active ? "#e0e0f0" : "#7a7a8a",
                        }}
                      >
                        <Icon size={10}/>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[9px] uppercase tracking-widest font-semibold" style={{ color:"#6a6a7a" }}>Logo</label>
                {form.logoPreview ? (
                  <div className="relative mt-0.5 h-14 rounded-lg border overflow-hidden" style={{ borderColor:"rgba(255,255,255,0.08)" }}>
                    <img src={form.logoPreview} alt="" className="w-full h-full object-cover"/>
                    <button type="button" onClick={()=>setForm(p=>({...p,logo:null,logoPreview:null}))}
                      className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ backgroundColor:"rgba(0,0,0,0.7)" }}>
                      <X size={7} style={{color:"#fff"}}/>
                    </button>
                  </div>
                ) : (
                  <label className="flex mt-0.5 h-14 cursor-pointer items-center justify-center rounded-lg border border-dashed hover:bg-white/[0.03]"
                    style={{ borderColor:"rgba(255,255,255,0.07)" }}>
                    <span className="text-[9px]" style={{color:"#7a7a8a"}}>Upload</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleFile("logo","logoPreview")}/>
                  </label>
                )}
              </div>
              <div className="flex-1">
                <label className="text-[9px] uppercase tracking-widest font-semibold" style={{ color:"#6a6a7a" }}>Banner</label>
                {form.imagePreview ? (
                  <div className="relative mt-0.5 h-14 rounded-lg border overflow-hidden" style={{ borderColor:"rgba(255,255,255,0.08)" }}>
                    <MediaBanner src={form.imagePreview} className="w-full h-full object-cover" />
                    <button type="button" onClick={()=>setForm(p=>({...p,image:null,imagePreview:null}))}
                      className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ backgroundColor:"rgba(0,0,0,0.7)" }}>
                      <X size={7} style={{color:"#fff"}}/>
                    </button>
                  </div>
                ) : (
                  <label className="flex mt-0.5 h-14 cursor-pointer items-center justify-center rounded-lg border border-dashed hover:bg-white/[0.03]"
                    style={{ borderColor:"rgba(255,255,255,0.07)" }}>
                    <span className="text-[9px]" style={{color:"#7a7a8a"}}>Upload</span>
                    <input type="file" accept="image/*,video/mp4,video/webm,video/ogg" className="hidden" onChange={handleFile("image","imagePreview")}/>
                  </label>
                )}
              </div>
            </div>

            <button type="submit" disabled={submitting||!form.name.trim()||!form.description.trim()}
              className="w-full rounded-lg py-2 text-xs font-semibold transition border"
              style={{ backgroundColor:"rgba(26,74,106,0.3)", borderColor:"rgba(26,74,106,0.4)", color:"#c8dcee" }}
            >
              {submitting ? "Creating..." : "Create Ecosystem Node"}
            </button>
          </form>
        </div>
      </div>
    </motion.div>
  );
}
CreatePanel.propTypes = { onClose:PropTypes.func, onSubmit:PropTypes.func, submitting:PropTypes.bool, position:PropTypes.object };

/* ───────────────────────────────────────────────
   NODE-ATTACHED PREVIEW PANEL
   Expands BELOW the node via a dotted thread
   ─────────────────────────────────────────────── */
const PREVIEW_HEIGHT = 360;

function NodePreview({ community, communities, position, onJoin, onClose, onOpenFull, isMember, onDragStart }) {
  if (!community) return null;
  const col = CAT_COLORS[community.category||"Other"]||CAT_COLORS.Other;
  const actCol = getActivityColor(community.activityStatus);
  const BASE = API_SERVER_ORIGIN;
  const memberCount = community.memberCount??community.members?.length??0;
  const tags = community.tags||[];
  const connections = community.connections||[];

  const previewLeft = position.x + (NODE_W - PREVIEW_W) / 2;
  const previewTop = position.y + NODE_H + CONNECTOR_HEIGHT;

  const handleMDown = (e) => {
    if (e.target.closest("button") || e.target.closest("input") || e.target.closest("textarea") || e.target.closest("select")) return;
    if (onDragStart) onDragStart(e);
  };

  return (
    <motion.div
      initial={{ opacity:0, y:-6 }}
      animate={{ opacity:1, y:0 }}
      exit={{ opacity:0, y:-6 }}
      transition={{ duration:0.25, ease:[0.16,1,0.3,1] }}
      data-panel
      className="absolute z-20"
      style={{ left: previewLeft, top: previewTop, width: PREVIEW_W }}
      onClick={e => e.stopPropagation()}
      onMouseDown={handleMDown}
    >
      <div className="rounded-xl border overflow-hidden shadow-lg" style={{ backgroundColor:"#0a0e1e", borderColor:"rgba(255,255,255,0.12)" }}>
        {/* Banner */}
        <div className="h-20 relative overflow-hidden" style={{ backgroundColor:col.bg }}>
          {community.image ? (
            <MediaBanner
              src={community.image.startsWith("http")?community.image:`${BASE}${community.image}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <MapIcon size={18} style={{color:"rgba(255,255,255,0.08)"}}/>
            </div>
          )}
          <div className="absolute inset-0" style={{ background:"linear-gradient(to top, #0a0e1e 0%, transparent 50%)" }}/>
          {community.logo && (
            <div className="absolute -bottom-4 left-3 w-8 h-8 rounded-lg border-2 overflow-hidden" style={{ borderColor:"#0a0e1e", backgroundColor:"#0a0e1e" }}>
              <img src={community.logo.startsWith("http")?community.logo:`${BASE}${community.logo}`}
                alt="" className="w-full h-full object-cover"/>
            </div>
          )}
          <button onClick={onClose}
            className="absolute top-2 right-2 w-5 h-5 rounded flex items-center justify-center transition hover:opacity-80"
            style={{ backgroundColor:"rgba(0,0,0,0.7)" }}>
            <X size={9} style={{color:"#e0e0f0"}}/>
          </button>
        </div>

        <div className="px-3 pt-4 pb-3 space-y-2.5">
          {/* Name + Activity */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold" style={{ color:"#f0f0ff" }}>{community.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] flex items-center gap-1" style={{ color:"#a0a0b0" }}>
                  <Users size={10}/> {memberCount} members
                </span>
                <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor:col.bg, color:col.text }}>
                  {community.category||"Other"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor:actCol }}/>
              <span className="text-[9px] font-semibold" style={{ color:actCol }}>{getActivityLabel(community.activityStatus)}</span>
            </div>
          </div>

          {/* Description */}
          {community.description && (
            <p className="text-[10px] leading-relaxed line-clamp-2" style={{ color:"#b0b0c0" }}>
              {community.description}
            </p>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0,4).map((t,i)=>(
                <span key={i} className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor:"rgba(255,255,255,0.05)", color:"#b0b0c0" }}>
                  #{t}
                </span>
              ))}
            </div>
          )}

          {/* Connected nodes */}
          {connections.length > 0 && (
            <div>
              <span className="text-[7px] uppercase tracking-widest font-semibold" style={{ color:"#8a8a9a" }}>Connected</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {connections.slice(0,4).map(conn=>{
                  const cc = communities.find(c=>c._id===conn.communityId);
                  if (!cc) return null;
                  return (
                    <span key={conn.communityId} className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor:"rgba(255,255,255,0.04)", color:"#b0b0c0" }}>
                      {CAT_ICONS[cc.category]||"•"} {cc.name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            {!isMember ? (
              <button onClick={(e)=>onJoin(e,community._id)}
                className="flex-1 text-[10px] font-medium py-1.5 rounded-lg transition border text-center"
                style={{ backgroundColor:"rgba(26,74,106,0.3)", borderColor:"rgba(26,74,106,0.4)", color:"#b0d0e8" }}>
                Join Community
              </button>
            ) : (
              <div className="flex-1 text-[10px] font-medium py-1.5 rounded-lg text-center" style={{ backgroundColor:"rgba(74,155,210,0.12)", color:"#7ac0e8", border:"1px solid rgba(74,155,210,0.25)" }}>
                Joined
              </div>
            )}
            <button onClick={()=>onOpenFull(community._id)}
              className="flex items-center gap-1 text-[10px] font-medium py-1.5 px-3 rounded-lg transition border"
              style={{ borderColor:"rgba(255,255,255,0.15)", color:"#c0c0d0" }}
            >
              Open <ExternalLink size={10}/>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
NodePreview.propTypes = {
  community:PropTypes.object, communities:PropTypes.array,
  position:PropTypes.object,
  onJoin:PropTypes.func, onClose:PropTypes.func, onOpenFull:PropTypes.func,
  isMember:PropTypes.bool, onDragStart:PropTypes.func,
};

/* ───────────────────────────────────────────────
   MAIN COMPONENT
   ─────────────────────────────────────────────── */
function Communities() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const vpRef = useRef(null);

  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x:0, y:0 });
  const [panning, setPanning] = useState(false);
  const [panOrg, setPanOrg] = useState({ x:0, y:0 });
  const [clickCheck, setClickCheck] = useState(null);

  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("all");
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoveredLine, setHoveredLine] = useState(null);
  const [showMini, setShowMini] = useState(true);
  const [nodePositions, setNodePositions] = useState({});
  const [dragging, setDragging] = useState(null);
  const [positionsReady, setPositionsReady] = useState(false);

  const canCreate = user?.role === "teacher";
  const BASE = API_SERVER_ORIGIN;

  /* ── Create node position: to the right of the rightmost community, or visible if empty ── */
  const createNodePos = useMemo(() => {
    const xs = Object.values(nodePositions).map(p => p.x);
    const x = xs.length > 0 ? Math.max(...xs) + CAT_GAP_X : ORIGIN_X;
    return { x, y: ORIGIN_Y };
  }, [nodePositions]);

  /* ── Init positions ── */
  useEffect(() => {
    if (communities.length > 0 && !positionsReady) {
      const saved = loadPositions();
      const hasAll = communities.every(c => saved[c._id]);
      setNodePositions(hasAll ? saved : computeInitialPositions(communities));
      if (!hasAll) savePositions(computeInitialPositions(communities));
      setPositionsReady(true);
    }
  }, [communities, positionsReady]);

  useEffect(() => {
    if (positionsReady && Object.keys(nodePositions).length > 0) savePositions(nodePositions);
  }, [nodePositions, positionsReady]);

  /* ── Visible filter ── */
  const visibleIds = useMemo(() => {
    if (!search && activeCat === "all") return null;
    return new Set(communities.filter(c => {
      if (search && !c.name?.toLowerCase().includes(search.toLowerCase()) &&
          !c.description?.toLowerCase().includes(search.toLowerCase())) return false;
      if (activeCat !== "all" && c.category !== activeCat) return false;
      return true;
    }).map(c => c._id));
  }, [communities, search, activeCat]);

  /* ── Connections ── */
  const connections = useMemo(() => {
    const lines = [];
    const seen = new Set();
    for (const c of communities) {
      if (!nodePositions[c._id]) continue;
      if (visibleIds && !visibleIds.has(c._id)) continue;
      for (const conn of c.connections||[]) {
        const key = [c._id, conn.communityId].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        const toPos = nodePositions[conn.communityId];
        if (toPos) {
          const from = nodePositions[c._id];
          lines.push({
            from:{ x:from.x+NODE_W/2, y:from.y+NODE_H/2 },
            to:{ x:toPos.x+NODE_W/2, y:toPos.y+NODE_H/2 },
            type:conn.type, fromId:c._id, toId:conn.communityId,
          });
        }
      }
    }
    return lines;
  }, [communities, nodePositions, visibleIds]);

  /* ── Data fetching ── */
  const fetchMap = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) { setLoading(false); return; }
      const data = await getCommunitiesMap(token);
      setCommunities(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[Map] error:", err?.response?.status, err?.response?.data||err?.message);
      addToast(err?.response?.data?.error||"Failed to load communities", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchMap(); }, [fetchMap]);
  useEffect(() => {
    const onUpd = () => fetchMap();
    window.addEventListener("communities-updated", onUpd);
    return () => window.removeEventListener("communities-updated", onUpd);
  }, [fetchMap]);

  /* ── Wheel zoom (RAF-throttled) ── */
  useEffect(() => {
    const el = vpRef.current;
    if (!el) return;
    let raf = null;
    let pending = null;
    const onWheel = (e) => {
      e.preventDefault();
      const dz = -e.deltaY * 0.001;
      pending = (z) => Math.max(0.25, Math.min(3, z + dz));
      if (!raf) {
        raf = requestAnimationFrame(() => {
          if (pending) setZoom(pending);
          pending = null;
          raf = null;
        });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  const panRafRef = useRef(null);
  const panLatestRef = useRef({ x:0, y:0 });

  /* ── Pan handlers ── */
  const handleMDown = useCallback((e) => {
    if (e.target.closest("[data-node]")||e.target.closest("[data-panel]")||e.target.closest("[data-control]")) return;
    setPanning(true);
    setPanOrg({ x:e.clientX-pan.x, y:e.clientY-pan.y });
    setClickCheck({ x:e.clientX, y:e.clientY });
  }, [pan]);

  const handleTouchStart = useCallback((e) => {
    if (e.target.closest("[data-node]")||e.target.closest("[data-panel]")||e.target.closest("[data-control]")) return;
    if (e.touches.length === 1) {
      const t = e.touches[0];
      setPanning(true);
      setPanOrg({ x:t.clientX-pan.x, y:t.clientY-pan.y });
      setClickCheck({ x:t.clientX, y:t.clientY });
    }
  }, [pan]);

  const handleMMove = useCallback((e) => {
    if (!panning) return;
    panLatestRef.current = { x:e.clientX-panOrg.x, y:e.clientY-panOrg.y };
    if (panRafRef.current) return;
    panRafRef.current = requestAnimationFrame(() => {
      setPan(panLatestRef.current);
      panRafRef.current = null;
    });
  }, [panning, panOrg]);

  const handleTouchMove = useCallback((e) => {
    if (!panning || e.touches.length !== 1) return;
    const t = e.touches[0];
    panLatestRef.current = { x:t.clientX-panOrg.x, y:t.clientY-panOrg.y };
    if (panRafRef.current) return;
    panRafRef.current = requestAnimationFrame(() => {
      setPan(panLatestRef.current);
      panRafRef.current = null;
    });
  }, [panning, panOrg]);

  const handleMUp = useCallback(() => {
    setPanning(false);
    setClickCheck(null);
    if (panRafRef.current) { cancelAnimationFrame(panRafRef.current); panRafRef.current = null; }
  }, []);

  const handleTouchEnd = useCallback(() => {
    setPanning(false);
    setClickCheck(null);
    if (panRafRef.current) { cancelAnimationFrame(panRafRef.current); panRafRef.current = null; }
  }, []);

  /* ── Node drag ── */
  const handleNodeMDown = useCallback((e, id) => {
    e.stopPropagation();
    setDragging({ id, startMX:e.clientX, startMY:e.clientY, origX:nodePositions[id]?.x||0, origY:nodePositions[id]?.y||0 });
  }, [nodePositions]);

  const handleNodeTouchStart = useCallback((e, id) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    e.stopPropagation();
    setDragging({ id, startMX:t.clientX, startMY:t.clientY, origX:nodePositions[id]?.x||0, origY:nodePositions[id]?.y||0 });
  }, [nodePositions]);

  useEffect(() => {
    if (!dragging) return;
    let raf = null;
    let pending = null;
    const onMove = (e) => {
      const dx = (e.clientX-dragging.startMX)/zoom;
      const dy = (e.clientY-dragging.startMY)/zoom;
      let fx = dragging.origX+dx, fy = dragging.origY+dy;
      for (const [id,pos] of Object.entries(nodePositions)) {
        if (id===dragging.id) continue;
        if (Math.abs(fx-pos.x)<NODE_W+12&&Math.abs(fy-pos.y)<NODE_H+12) {
          if (Math.abs(fx-pos.x)<Math.abs(fy-pos.y)) fx = pos.x+(NODE_W+12)*(fx>pos.x?1:-1);
          else fy = pos.y+(NODE_H+12)*(fy>pos.y?1:-1);
        }
      }
      pending = { x:fx, y:fy };
      if (!raf) {
        raf = requestAnimationFrame(() => {
          if (pending) setNodePositions(prev => ({...prev, [dragging.id]:pending}));
          raf = null;
        });
      }
    };
    const onUp = () => {
      if (raf) cancelAnimationFrame(raf);
      setDragging(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging, nodePositions, zoom]);

  /* ── Node click ── */
  const handleNodeClick = useCallback((c, e) => {
    if (e.defaultPrevented) return;
    if (clickCheck && (Math.abs(e.clientX-clickCheck.x)>5||Math.abs(e.clientY-clickCheck.y)>5)) return;
    setSelectedNode(prev => prev?._id===c._id ? null : c);
  }, [clickCheck]);

  /* ── Actions ── */
  const handleJoin = useCallback(async (e, cid) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API_BASE_URL}/communities/${cid}/join`, {}, { headers:{Authorization:`Bearer ${token}`} });
      addToast("Joined community!", "success");
      setSelectedNode(null);
      fetchMap();
    } catch (err) {
      if (err.response?.data?.error !== "Already a member") addToast(err.response?.data?.error||"Failed to join","error");
    }
  }, [addToast, fetchMap]);

  const handleOpenFull = useCallback((id) => {
    navigate(`/communities/${id}`);
  }, [navigate]);

  const handleCreate = async (fd) => {
    try {
      setSubmitting(true);
      const token = localStorage.getItem("token");
      const nc = await createCommunityForm(fd, token);
      setCommunities(prev => [nc, ...prev]);
      setCreating(false);
      addToast("Community created!", "success");
    } catch (err) {
      addToast(err.response?.data?.error||"Failed to create","error");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePreviewDragStart = useCallback((e) => {
    if (!selectedNode) return;
    handleNodeMDown(e, selectedNode._id);
  }, [selectedNode, handleNodeMDown]);

  const isMember = (c) => c.members?.some(m => (m._id||m)===user?.id);
  const resetView = () => { setZoom(1.0); setPan({ x:0, y:0 }); };

  const lineStyles = {
    similar:{ stroke:"rgba(255,255,255,0.09)", width:1.5, dash:"" },
    strong:{ stroke:"rgba(255,255,255,0.13)", width:2, dash:"" },
    connection:{ stroke:"rgba(255,255,255,0.06)", width:1, dash:"6 4" },
    related:{ stroke:"rgba(255,255,255,0.04)", width:0.8, dash:"3 5" },
  };

  /* ── Selected node position (for connector line + preview placement) ── */
  const selPos = selectedNode ? nodePositions[selectedNode._id] : null;

  return (
    <div
      ref={vpRef}
      className="relative w-full h-full overflow-hidden select-none"
      style={{ backgroundColor:"#060812", cursor:panning?"grabbing":dragging?"grabbing":"grab" }}
      onMouseDown={handleMDown}
      onMouseMove={handleMMove}
      onMouseUp={handleMUp}
      onMouseLeave={handleMUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Animated Grid background */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:"radial-gradient(circle, rgba(255,255,255,0.03) 0.8px, transparent 0.8px)",
          backgroundSize:"28px 28px",
          transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
          transformOrigin:"0 0",
        }}
      />
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:"radial-gradient(circle, rgba(74,155,210,0.04) 1px, transparent 1px)",
          backgroundSize:"56px 56px",
          backgroundPosition:"14px 14px",
          transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
          transformOrigin:"0 0",
          animation:"gridPulse 8s ease-in-out infinite",
        }}
      />

      {/* Map layer */}
      <div className="absolute inset-0" style={{
        transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
        transformOrigin:"0 0", willChange:"transform",
      }}>
        {/* ── Connection lines between nodes ── */}
        <svg className="absolute pointer-events-none" style={{ width:12000, height:12000, left:-3000, top:-3000 }}>
          {connections.map((line,i) => {
            const style = lineStyles[line.type]||lineStyles.related;
            const isHovered = hoveredLine&&(
              (hoveredLine.fromId===line.fromId&&hoveredLine.toId===line.toId)||
              (hoveredLine.fromId===line.toId&&hoveredLine.toId===line.fromId)
            );
            const isRelated = hoveredNode&&(line.fromId===hoveredNode||line.toId===hoveredNode);
            const finalStroke = isHovered ? "rgba(74,155,210,0.5)" : isRelated ? "rgba(74,155,210,0.25)" : style.stroke;
            return (
              <g key={i}>
                <line x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y}
                  stroke={finalStroke} strokeWidth={isHovered?style.width+1:style.width}
                  strokeDasharray={style.dash||"none"} className={style.dash?"animate-dash-flow":""}
                  style={style.dash?{animationDuration:"2s"}:{}}
                />
                <line x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y}
                  stroke="transparent" strokeWidth={14} className="pointer-events-auto cursor-pointer"
                  onMouseEnter={()=>setHoveredLine(line)} onMouseLeave={()=>setHoveredLine(null)}
                />
              </g>
            );
          })}

          {/* ── Connector thread from selected node down to preview ── */}
          {selPos && (
            <>
              <line
                x1={selPos.x+NODE_W/2} y1={selPos.y+NODE_H}
                x2={selPos.x+NODE_W/2} y2={selPos.y+NODE_H+CONNECTOR_HEIGHT}
                stroke="rgba(74,155,210,0.4)" strokeWidth={1.5}
                strokeDasharray="4 4" className="animate-dash-flow"
                style={{ animationDuration:"1s" }}
              />
              {/* Endpoint dot at preview top */}
              <circle
                cx={selPos.x+NODE_W/2} cy={selPos.y+NODE_H+CONNECTOR_HEIGHT} r={2.5}
                fill="rgba(74,155,210,0.5)"
              />
            </>
          )}
        </svg>

        {/* ── Connection ports ── */}
        {Object.entries(nodePositions).map(([id,pos]) => {
          if (visibleIds&&!visibleIds.has(id)) return null;
          return (
            <div key={`pl-${id}`} className="absolute pointer-events-none" style={{ left:pos.x-3, top:pos.y+NODE_H/2-3 }}>
              <div className="w-1.5 h-1.5 rounded-full animate-port-pulse" style={{ backgroundColor:"rgba(74,155,210,0.35)", border:"1px solid rgba(74,155,210,0.2)" }}/>
            </div>
          );
        })}
        {Object.entries(nodePositions).map(([id,pos]) => {
          if (visibleIds&&!visibleIds.has(id)) return null;
          return (
            <div key={`pr-${id}`} className="absolute pointer-events-none" style={{ left:pos.x+NODE_W-3, top:pos.y+NODE_H/2-3 }}>
              <div className="w-1.5 h-1.5 rounded-full animate-port-pulse" style={{ backgroundColor:"rgba(74,155,210,0.35)", border:"1px solid rgba(74,155,210,0.2)", animationDelay:"1s" }}/>
            </div>
          );
        })}

        {/* ── Community Nodes ── */}
        {communities.map((c) => {
          const pos = nodePositions[c._id];
          if (!pos||!positionsReady) return null;
          if (visibleIds&&!visibleIds.has(c._id)) return null;
          const col = CAT_COLORS[c.category||"Other"]||CAT_COLORS.Other;
          const actCol = getActivityColor(c.activityStatus);
          const mCount = c.memberCount??c.members?.length??0;
          const mem = isMember(c);
          const isHovered = hoveredNode===c._id;
          const selected = selectedNode?._id===c._id;
          const isDragging = dragging?.id===c._id;
          const tags = c.tags||[];

          return (
            <motion.div
              key={c._id} data-node
              initial={{ opacity:0, scale:0.85 }}
              animate={{ opacity:1, scale:1, y:isDragging?0:[0,-1.5,0] }}
              transition={{
                opacity:{duration:0.3}, scale:{duration:0.3},
                y:isDragging?{}:{duration:3+((c._id?.charCodeAt(c._id.length-1)%5)*0.6), repeat:Infinity, ease:"easeInOut"},
              }}
              className="absolute cursor-grab active:cursor-grabbing"
              style={{
                left:pos.x, top:pos.y, width:NODE_W,
                zIndex:isDragging?100:selected?50:isHovered?40:10,
              }}
              onMouseDown={(e)=>handleNodeMDown(e,c._id)}
              onTouchStart={(e)=>handleNodeTouchStart(e,c._id)}
              onMouseEnter={()=>setHoveredNode(c._id)}
              onMouseLeave={()=>{setHoveredNode(null);setHoveredLine(null);}}
              onClick={(e)=>handleNodeClick(c,e)}
            >
              <div className="rounded-xl border transition-all duration-200 overflow-hidden"
                style={{
                  backgroundColor: isDragging ? "#0e1226" : isHovered ? "#0c1124" : "#080b18",
                  borderColor: selected ? col.border+"80" : isHovered ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
                  boxShadow: selected ? `0 0 0 1px ${col.border}40` : isDragging ? "0 4px 24px rgba(0,0,0,0.4)" : "0 1px 3px rgba(0,0,0,0.2)",
                }}
              >
                <div style={{ height:2.5, backgroundColor:col.border, opacity:0.6 }}/>
                <div className="flex items-start gap-2.5 p-2.5">
                  <div className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center text-sm font-bold overflow-hidden"
                    style={{ backgroundColor:col.bg, color:col.text, border:`1px solid ${col.border}30` }}>
                    {c.logo ? <img src={c.logo.startsWith("http")?c.logo:`${BASE}${c.logo}`} alt="" className="w-full h-full object-cover"/>
                    : (c.name?.charAt(0).toUpperCase()||"C")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-xs font-semibold truncate" style={{ color:"#f0f0ff" }}>{c.name}</h3>
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor:actCol }}/>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-0.5 text-[9px]" style={{ color:"#8a8a9a" }}>
                        <Users size={9}/> {mCount}
                      </span>
                      <span className="text-[8px] px-1 py-0.5 rounded" style={{ backgroundColor:col.bg, color:col.text }}>
                        {c.category||"Other"}
                      </span>
                    </div>
                    {tags.length>0&&(
                      <div className="flex items-center gap-1 mt-0.5">
                        {tags.slice(0,2).map((t,i)=><span key={i} className="text-[7px]" style={{color:"#7a7a8a"}}>#{t}</span>)}
                      </div>
                    )}
                  </div>
                  {mem&&<span className="text-[8px] font-medium flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded" style={{ color:"#6ab8e8", backgroundColor:"rgba(74,155,210,0.1)" }}>Joined</span>}
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* ── Create Node ── */}
        {canCreate&&!creating&&(
          <motion.div data-node initial={{opacity:0,scale:0.85}} animate={{opacity:1,scale:1}}
            className="absolute cursor-pointer"
            style={{ left:createNodePos.x, top:createNodePos.y, width:NODE_W }}
            onClick={()=>setCreating(true)}
          >
            <div className="rounded-xl border border-dashed overflow-hidden hover:bg-white/[0.03] transition"
              style={{ borderColor:"rgba(255,255,255,0.07)", backgroundColor:"rgba(8,11,24,0.7)" }}>
              <div style={{ height:2.5, backgroundColor:"rgba(255,255,255,0.04)" }}/>
              <div className="flex items-center gap-2.5 p-2.5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)" }}>
                  <Plus size={15} style={{ color:"#8a8a9a" }}/>
                </div>
                <div>
                  <span className="text-xs font-medium" style={{ color:"#8a8a9a" }}>Create Community</span>
                  <p className="text-[8px]" style={{ color:"#6a6a7a" }}>Add a new ecosystem node</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Create Panel ── */}
        <AnimatePresence>{creating&&canCreate&&<CreatePanel position={createNodePos} onClose={()=>setCreating(false)} onSubmit={handleCreate} submitting={submitting}/>}</AnimatePresence>

        {/* ── Node Preview Panel (attached below selected node) ── */}
        <AnimatePresence>
          {selPos && (
            <NodePreview
              community={selectedNode}
              communities={communities}
              position={selPos}
              onJoin={handleJoin}
              onClose={()=>setSelectedNode(null)}
              onOpenFull={handleOpenFull}
              isMember={isMember(selectedNode)}
              onDragStart={handlePreviewDragStart}
            />
          )}
        </AnimatePresence>
      </div>

      {/* ── Controls ── */}
      <div data-control className="absolute top-3 left-3 z-20 flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5" style={{ backgroundColor:"rgba(6,8,18,0.95)", borderColor:"rgba(255,255,255,0.06)" }}>
          <Search size={12} style={{ color:"#6a6a7a" }}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search nodes..."
            className="bg-transparent text-[11px] outline-none w-24" style={{ color:"#e0e0f0" }}
          />
          {search&&<button onClick={()=>setSearch("")}><X size={10} style={{color:"#6a6a7a"}}/></button>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={()=>setActiveCat("all")}
            className="text-[9px] px-2 py-1 rounded-md transition border"
            style={{ backgroundColor:activeCat==="all"?"rgba(255,255,255,0.05)":"transparent", borderColor:activeCat==="all"?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.04)", color:activeCat==="all"?"#e0e0f0":"#7a7a8a" }}>
            All
          </button>
          {CATEGORIES.map(cat=>{
            const count = communities.filter(c=>c.category===cat).length;
            if (count===0) return null;
            const col = CAT_COLORS[cat]||CAT_COLORS.Other;
            return (
              <button key={cat} onClick={()=>setActiveCat(activeCat===cat?"all":cat)}
                className="text-[9px] px-2 py-1 rounded-md transition border"
                style={{ backgroundColor:activeCat===cat?col.bg:"transparent", borderColor:activeCat===cat?col.border+"50":"rgba(255,255,255,0.04)", color:activeCat===cat?col.text:"#7a7a8a" }}>
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      <div data-control className="absolute top-3 right-3 z-20 flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border px-2 py-1" style={{ backgroundColor:"rgba(6,8,18,0.95)", borderColor:"rgba(255,255,255,0.06)" }}>
          <button onClick={()=>setZoom(z=>Math.min(3,z+0.15))} className="p-0.5 hover:opacity-80"><Plus size={12} style={{color:"#8a8a9a"}}/></button>
          <span className="text-[9px] w-7 text-center" style={{color:"#7a7a8a"}}>{Math.round(zoom*100)}%</span>
          <button onClick={()=>setZoom(z=>Math.max(0.25,z-0.15))} className="p-0.5 hover:opacity-80"><Minus size={12} style={{color:"#8a8a9a"}}/></button>
          <div className="w-px h-3" style={{backgroundColor:"rgba(255,255,255,0.06)"}}/>
          <button onClick={resetView} className="p-0.5 hover:opacity-80"><Maximize2 size={11} style={{color:"#8a8a9a"}}/></button>
        </div>
        <button onClick={()=>setShowMini(p=>!p)}
          className="p-1.5 rounded-lg border transition"
          style={{ backgroundColor:showMini?"rgba(255,255,255,0.05)":"transparent", borderColor:showMini?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.04)" }}>
          <MapIcon size={12} style={{color:showMini?"#e0e0f0":"#7a7a8a"}}/>
        </button>
      </div>

      <div data-control className="absolute bottom-3 left-3 z-20">
        <div className="flex items-center gap-3 rounded-lg border px-2.5 py-1.5" style={{ backgroundColor:"rgba(6,8,18,0.95)", borderColor:"rgba(255,255,255,0.06)" }}>
          <span className="text-[9px]" style={{ color:"#8a8a9a" }}>{communities.length} nodes</span>
          <span className="text-[9px]" style={{ color:"#7a7a8a" }}>{connections.length} connections</span>
          <span className="text-[9px]" style={{ color:"#7a7a8a" }}>{new Set(communities.map(c=>c.category)).size} regions</span>
        </div>
      </div>

      {/* Mini Map */}
      {showMini&&positionsReady&&Object.keys(nodePositions).length>0&&(
        <MiniMap positions={nodePositions} communities={communities} pan={pan} zoom={zoom} vpRef={vpRef}
          onNavigate={(x,y)=>setPan({x,y})}/>
      )}

      {/* Empty state */}
      {!loading && positionsReady && communities.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
              <MapIcon size={20} style={{ color:"#5a5a6a" }}/>
            </div>
            <h3 className="text-sm font-semibold" style={{ color:"#8a8a9a" }}>No communities yet</h3>
            <p className="text-[10px] mt-1" style={{ color:"#6a6a7a" }}>
              {canCreate ? "Click the + node to create the first ecosystem node" : "Check back later for new communities"}
            </p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading&&(
        <div className="absolute inset-0 flex items-center justify-center z-50" style={{ backgroundColor:"rgba(6,8,18,0.8)" }}>
          <div className="flex flex-col items-center gap-2.5">
            <div className="w-5 h-5 rounded-full border animate-spin" style={{ borderColor:"rgba(255,255,255,0.08)", borderTopColor:"rgba(255,255,255,0.3)" }}/>
            <span className="text-[10px]" style={{ color:"#8a8a9a" }}>Loading ecosystem map...</span>
          </div>
        </div>
      )}
    </div>
  );
}

Communities.propTypes = {};
export default Communities;
