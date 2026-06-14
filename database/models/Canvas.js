const mongoose = require("mongoose");

const canvasNodeSchema = new mongoose.Schema({
  nodeId: { type: String, required: true },
  type: {
    type: String,
    enum: ["text_room", "voice_room", "file_room", "publishing_room", "workspace", "user", "cluster"],
    required: true,
  },
  label: { type: String, default: "" },
  position: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
  },
  size: {
    width: { type: Number, default: 220 },
    height: { type: Number, default: 160 },
  },
  parentId: { type: String, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  style: {
    color: { type: String, default: "" },
    icon: { type: String, default: "" },
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const canvasEdgeSchema = new mongoose.Schema({
  edgeId: { type: String, required: true },
  source: { type: String, required: true },
  target: { type: String, required: true },
  type: { type: String, enum: ["straight", "curved", "dashed"], default: "straight" },
  label: { type: String, default: "" },
  style: { type: mongoose.Schema.Types.Mixed, default: {} },
});

const canvasSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, default: "My Collaboration Canvas" },
  description: { type: String, default: "" },
  nodes: [canvasNodeSchema],
  edges: [canvasEdgeSchema],
  viewport: {
    zoom: { type: Number, default: 1 },
    panX: { type: Number, default: 0 },
    panY: { type: Number, default: 0 },
  },
  collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  isPublic: { type: Boolean, default: false },
  tags: [String],
  lastActivityAt: { type: Date, default: Date.now },
}, { timestamps: true });

canvasSchema.index({ owner: 1 });
canvasSchema.index({ collaborators: 1 });
canvasSchema.index({ "nodes.nodeId": 1 });

module.exports = mongoose.model("Canvas", canvasSchema);
