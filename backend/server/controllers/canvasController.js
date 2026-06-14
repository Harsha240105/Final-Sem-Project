const Canvas = require("../../../database/models/Canvas");

function parseAuthHeader(req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return null;
  try {
    const jwt = require("jsonwebtoken");
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

function canEdit(canvas, userId) {
  return (
    canvas.owner.toString() === userId ||
    canvas.collaborators.some((c) => c.toString() === userId)
  );
}

exports.getMyCanvases = async (req, res) => {
  try {
    const canvases = await Canvas.find({
      $or: [
        { owner: req.user.id },
        { collaborators: req.user.id },
      ],
    })
      .select("name description viewport tags lastActivityAt createdAt owner collaborators")
      .sort({ lastActivityAt: -1 })
      .lean();

    return res.json({ canvases });
  } catch (err) {
    console.error("[Canvas] getMyCanvases error:", err);
    return res.status(500).json({ error: "Failed to fetch canvases" });
  }
};

exports.getCanvas = async (req, res) => {
  try {
    const canvas = await Canvas.findById(req.params.id).populate(
      "nodes.createdBy collaborators",
      "name avatar role"
    );
    if (!canvas) return res.status(404).json({ error: "Canvas not found" });

    if (!canvas.isPublic && !canEdit(canvas, req.user.id)) {
      return res.status(403).json({ error: "Access denied" });
    }

    return res.json({ canvas });
  } catch (err) {
    console.error("[Canvas] getCanvas error:", err);
    return res.status(500).json({ error: "Failed to fetch canvas" });
  }
};

exports.createCanvas = async (req, res) => {
  try {
    const { name, description } = req.body;
    const canvas = await Canvas.create({
      owner: req.user.id,
      name: name || "My Collaboration Canvas",
      description: description || "",
    });
    return res.status(201).json({ canvas });
  } catch (err) {
    console.error("[Canvas] createCanvas error:", err);
    return res.status(500).json({ error: "Failed to create canvas" });
  }
};

exports.updateCanvas = async (req, res) => {
  try {
    const canvas = await Canvas.findById(req.params.id);
    if (!canvas) return res.status(404).json({ error: "Canvas not found" });
    if (!canEdit(canvas, req.user.id)) return res.status(403).json({ error: "Access denied" });

    const { name, description, viewport, isPublic, tags } = req.body;
    if (name !== undefined) canvas.name = name;
    if (description !== undefined) canvas.description = description;
    if (viewport !== undefined) canvas.viewport = viewport;
    if (isPublic !== undefined) canvas.isPublic = isPublic;
    if (tags !== undefined) canvas.tags = tags;
    canvas.lastActivityAt = new Date();
    await canvas.save();

    return res.json({ canvas });
  } catch (err) {
    console.error("[Canvas] updateCanvas error:", err);
    return res.status(500).json({ error: "Failed to update canvas" });
  }
};

exports.deleteCanvas = async (req, res) => {
  try {
    const canvas = await Canvas.findById(req.params.id);
    if (!canvas) return res.status(404).json({ error: "Canvas not found" });
    if (canvas.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Only owner can delete canvas" });
    }
    await Canvas.findByIdAndDelete(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    console.error("[Canvas] deleteCanvas error:", err);
    return res.status(500).json({ error: "Failed to delete canvas" });
  }
};

exports.addCollaborator = async (req, res) => {
  try {
    const { userId } = req.body;
    const canvas = await Canvas.findById(req.params.id);
    if (!canvas) return res.status(404).json({ error: "Canvas not found" });
    if (canvas.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Only owner can add collaborators" });
    }
    if (canvas.collaborators.some((c) => c.toString() === userId)) {
      return res.status(400).json({ error: "User is already a collaborator" });
    }
    canvas.collaborators.push(userId);
    canvas.lastActivityAt = new Date();
    await canvas.save();
    return res.json({ canvas });
  } catch (err) {
    console.error("[Canvas] addCollaborator error:", err);
    return res.status(500).json({ error: "Failed to add collaborator" });
  }
};

exports.removeCollaborator = async (req, res) => {
  try {
    const { userId } = req.body;
    const canvas = await Canvas.findById(req.params.id);
    if (!canvas) return res.status(404).json({ error: "Canvas not found" });
    if (canvas.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Only owner can remove collaborators" });
    }
    canvas.collaborators = canvas.collaborators.filter(
      (c) => c.toString() !== userId
    );
    canvas.lastActivityAt = new Date();
    await canvas.save();
    return res.json({ canvas });
  } catch (err) {
    console.error("[Canvas] removeCollaborator error:", err);
    return res.status(500).json({ error: "Failed to remove collaborator" });
  }
};

exports.addNode = async (req, res) => {
  try {
    const canvas = await Canvas.findById(req.params.id);
    if (!canvas) return res.status(404).json({ error: "Canvas not found" });
    if (!canEdit(canvas, req.user.id)) return res.status(403).json({ error: "Access denied" });

    const { nodeId, type, label, position, size, parentId, metadata, style } = req.body;
    const node = {
      nodeId: nodeId || `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: type || "text_room",
      label: label || "",
      position: position || { x: 0, y: 0 },
      size: size || { width: 220, height: 160 },
      parentId: parentId || null,
      metadata: metadata || {},
      style: style || {},
      createdBy: req.user.id,
    };
    canvas.nodes.push(node);
    canvas.lastActivityAt = new Date();
    await canvas.save();
    return res.status(201).json({ node: canvas.nodes[canvas.nodes.length - 1] });
  } catch (err) {
    console.error("[Canvas] addNode error:", err);
    return res.status(500).json({ error: "Failed to add node" });
  }
};

exports.updateNode = async (req, res) => {
  try {
    const canvas = await Canvas.findById(req.params.id);
    if (!canvas) return res.status(404).json({ error: "Canvas not found" });
    if (!canEdit(canvas, req.user.id)) return res.status(403).json({ error: "Access denied" });

    const node = canvas.nodes.id(req.params.nodeId);
    if (!node) return res.status(404).json({ error: "Node not found" });

    const { position, label, size, metadata, style, parentId } = req.body;
    if (position !== undefined) node.position = position;
    if (label !== undefined) node.label = label;
    if (size !== undefined) node.size = size;
    if (metadata !== undefined) node.metadata = metadata;
    if (style !== undefined) node.style = style;
    if (parentId !== undefined) node.parentId = parentId;
    node.updatedAt = new Date();
    canvas.lastActivityAt = new Date();
    await canvas.save();
    return res.json({ node });
  } catch (err) {
    console.error("[Canvas] updateNode error:", err);
    return res.status(500).json({ error: "Failed to update node" });
  }
};

exports.deleteNode = async (req, res) => {
  try {
    const canvas = await Canvas.findById(req.params.id);
    if (!canvas) return res.status(404).json({ error: "Canvas not found" });
    if (!canEdit(canvas, req.user.id)) return res.status(403).json({ error: "Access denied" });

    const nodeIndex = canvas.nodes.findIndex(
      (n) => n.nodeId === req.params.nodeId
    );
    if (nodeIndex === -1) return res.status(404).json({ error: "Node not found" });

    canvas.nodes.splice(nodeIndex, 1);
    canvas.edges = canvas.edges.filter(
      (e) => e.source !== req.params.nodeId && e.target !== req.params.nodeId
    );
    canvas.lastActivityAt = new Date();
    await canvas.save();
    return res.json({ success: true });
  } catch (err) {
    console.error("[Canvas] deleteNode error:", err);
    return res.status(500).json({ error: "Failed to delete node" });
  }
};

exports.addEdge = async (req, res) => {
  try {
    const canvas = await Canvas.findById(req.params.id);
    if (!canvas) return res.status(404).json({ error: "Canvas not found" });
    if (!canEdit(canvas, req.user.id)) return res.status(403).json({ error: "Access denied" });

    const { edgeId, source, target, type, label, style } = req.body;
    if (!source || !target) return res.status(400).json({ error: "Source and target required" });

    const edge = {
      edgeId: edgeId || `edge_${Date.now()}`,
      source,
      target,
      type: type || "straight",
      label: label || "",
      style: style || {},
    };
    canvas.edges.push(edge);
    canvas.lastActivityAt = new Date();
    await canvas.save();
    return res.status(201).json({ edge });
  } catch (err) {
    console.error("[Canvas] addEdge error:", err);
    return res.status(500).json({ error: "Failed to add edge" });
  }
};

exports.deleteEdge = async (req, res) => {
  try {
    const canvas = await Canvas.findById(req.params.id);
    if (!canvas) return res.status(404).json({ error: "Canvas not found" });
    if (!canEdit(canvas, req.user.id)) return res.status(403).json({ error: "Access denied" });

    canvas.edges = canvas.edges.filter((e) => e.edgeId !== req.params.edgeId);
    canvas.lastActivityAt = new Date();
    await canvas.save();
    return res.json({ success: true });
  } catch (err) {
    console.error("[Canvas] deleteEdge error:", err);
    return res.status(500).json({ error: "Failed to delete edge" });
  }
};
