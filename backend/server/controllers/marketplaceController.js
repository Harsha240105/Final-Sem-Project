const Marketplace = require("../../database/models/Marketplace");
const CollaborationRoom = require("../../database/models/CollaborationRoom");
const mongoose = require("mongoose");

const POST_TYPES = [
  "looking_for_dev", "looking_for_designer", "open_collaboration",
  "research_project", "community_recruitment",
];

const POPULATE_FIELDS = [
  { path: "createdBy", select: "name gmail avatar" },
  { path: "comments.author", select: "name gmail avatar" },
  { path: "collaborators.user", select: "name gmail avatar" },
  { path: "participants", select: "name gmail avatar" },
  { path: "showcase.contributorList", select: "name gmail avatar" },
  { path: "community", select: "name publicId" },
];

async function populatePost(post) {
  try {
    return await Marketplace.findById(post._id).populate(POPULATE_FIELDS).lean();
  } catch (e) {
    console.error("populatePost error:", e.message);
    return Marketplace.findById(post._id).lean();
  }
}

exports.createPost = async (req, res) => {
  try {
    const { title, description, goals, postType, requiredRoles, skills, community, tags } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "Title is required" });
    if (!description?.trim()) return res.status(400).json({ error: "Description is required" });

    const sanitizedType = POST_TYPES.includes(postType) ? postType : "open_collaboration";
    const parsedTags = Array.isArray(tags)
      ? tags.map(t => t.trim()).filter(Boolean)
      : typeof tags === "string" ? tags.split(",").map(t => t.trim()).filter(Boolean) : [];
    const parsedRequiredRoles = Array.isArray(requiredRoles) ? requiredRoles.filter(r => r.role?.trim()) : [];

    const post = await Marketplace.create({
      title: title.trim(), description: description.trim(),
      goals: goals?.trim() || "", postType: sanitizedType,
      requiredRoles: parsedRequiredRoles,
      skills: Array.isArray(skills) ? skills.filter(Boolean) : [],
      community: community || null, tags: parsedTags, createdBy: req.user.id,
    });
    const populated = await populatePost(post);
    res.status(201).json(populated);
  } catch (err) {
    console.error("Create post error:", err);
    res.status(500).json({ error: "Failed to create post" });
  }
};

exports.getPosts = async (req, res) => {
  try {
    const { search, status, postType, skill, my, community, limit: reqLimit } = req.query;
    const limit = Math.min(Number(reqLimit) || 60, 120);
    const filter = {};

    if (search) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [
        { title: regex },
        { description: regex },
        { skills: regex },
        { tags: regex },
      ];
    }
    if (postType && POST_TYPES.includes(postType)) {
      filter.postType = postType;
    }
    if (status && ["recruiting", "active", "reviewing", "completed", "archived"].includes(status)) {
      filter.status = status;
    }
    if (skill) filter.skills = { $in: [new RegExp(skill, "i")] };
    if (my === "true") filter.createdBy = req.user.id;
    if (community) filter.community = community;

    const posts = await Marketplace.find(filter)
      .sort({ createdAt: -1 }).limit(limit).lean();

    // Safe populate each field individually - handles missing refs gracefully
    async function safePopulate(docs, path) {
      try {
        await Marketplace.populate(docs, path);
      } catch (e) {
        console.error("Populate warning for " + JSON.stringify(path) + ":", e.message);
      }
    }
    for (const field of POPULATE_FIELDS) {
      await safePopulate(posts, field);
    }

    res.json(posts);
  } catch (err) {
    console.error("Get posts error:", err);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
};

exports.getPost = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid post ID" });
    const post = await Marketplace.findById(req.params.id).lean();
    if (!post) return res.status(404).json({ error: "Post not found" });
    try { await Marketplace.populate(post, POPULATE_FIELDS); } catch (e) { console.error("getPost populate:", e.message); }
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch post" });
  }
};

exports.updatePost = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid post ID" });
    const post = await Marketplace.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found" });
    if (post.createdBy.toString() !== req.user.id && !["admin", "teacher"].includes(req.user.role))
      return res.status(403).json({ error: "Only the creator or admin can update this post" });

    const allowed = ["title", "description", "goals", "postType", "requiredRoles", "skills", "community", "tags"];
    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        if (field === "title") post[field] = req.body[field].trim();
        else if (field === "community") post[field] = req.body[field] || null;
        else if (field === "postType" && POST_TYPES.includes(req.body[field])) post[field] = req.body[field];
        else if (field !== "postType") post[field] = req.body[field];
      }
    }
    await post.save();
    const updated = await populatePost(post);
    res.json(updated);
  } catch (err) {
    console.error("Update post error:", err);
    res.status(500).json({ error: "Failed to update post" });
  }
};

exports.deletePost = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid post ID" });
    const post = await Marketplace.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found" });
    if (post.createdBy.toString() !== req.user.id) return res.status(403).json({ error: "Only the creator can delete this post" });
    await CollaborationRoom.deleteMany({ postId: req.params.id });
    await Marketplace.findByIdAndDelete(req.params.id);
    res.json({ message: "Post deleted", id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete post" });
  }
};

exports.addComment = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid post ID" });
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "Comment text is required" });
    const post = await Marketplace.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found" });
    post.comments.push({ text: text.trim(), author: req.user.id });
    await post.save();
    const updated = await populatePost(post);
    res.status(201).json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to add comment" });
  }
};

exports.requestCollaboration = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid post ID" });
    const { role } = req.body;
    const post = await Marketplace.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found" });
    if (post.status === "completed" || post.status === "archived")
      return res.status(400).json({ error: "Cannot collaborate on a completed or archived project" });
    if (post.createdBy.toString() === req.user.id)
      return res.status(400).json({ error: "You cannot collaborate on your own post" });
    if (post.collaborators.some(c => c.user.toString() === req.user.id))
      return res.status(400).json({ error: "Already requested collaboration" });

    post.collaborators.push({ user: req.user.id, role: role?.trim() || "", status: "pending" });
    await post.save();
    const updated = await populatePost(post);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to request collaboration" });
  }
};

exports.updateCollaborationStatus = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid post ID" });
    const { collaboratorId, status } = req.body;
    if (!["accepted", "rejected"].includes(status)) return res.status(400).json({ error: "Status must be 'accepted' or 'rejected'" });

    const post = await Marketplace.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found" });
    if (post.createdBy.toString() !== req.user.id) return res.status(403).json({ error: "Only the creator can manage collaborators" });

    const collab = post.collaborators.id(collaboratorId);
    if (!collab) return res.status(404).json({ error: "Collaborator not found" });

    collab.status = status;
    if (status === "accepted" && !post.participants.some(p => p.toString() === collab.user.toString())) {
      post.participants.push(collab.user);
    }
    await post.save();

    const io = req.app.get("io");
    if (io) {
      io.to(String(collab.user)).emit("collab_status_updated", {
        postId: req.params.id, status,
      });
    }

    const updated = await populatePost(post);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update collaboration status" });
  }
};

exports.updateProjectStatus = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid post ID" });
    const { status } = req.body;
    const validStatuses = ["recruiting", "active", "reviewing", "completed", "archived"];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: `Invalid status` });

    const post = await Marketplace.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found" });
    if (post.createdBy.toString() !== req.user.id && !["admin", "teacher"].includes(req.user.role))
      return res.status(403).json({ error: "Only the creator or admin can update project status" });

    post.status = status;
    await post.save();
    const updated = await populatePost(post);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update project status" });
  }
};

exports.publishShowcase = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid post ID" });
    const { summary, media, certificateIds } = req.body;
    const post = await Marketplace.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found" });
    if (post.createdBy.toString() !== req.user.id) return res.status(403).json({ error: "Only the creator can publish showcase" });

    post.showcase = {
      summary: summary || "", media: Array.isArray(media) ? media : [],
      certificateIds: Array.isArray(certificateIds) ? certificateIds : [],
      contributorList: post.participants, publishedAt: new Date(),
    };
    post.status = "completed";
    await post.save();
    const updated = await populatePost(post);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to publish showcase" });
  }
};

exports.getMyPosts = async (req, res) => {
  try {
    let posts = await Marketplace.find({ createdBy: req.user.id })
      .sort({ createdAt: -1 }).lean();
    try { await Marketplace.populate(posts, POPULATE_FIELDS); } catch (e) { console.error("getMyPosts populate:", e.message); }
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch my posts" });
  }
};

exports.getMyCollaborations = async (req, res) => {
  try {
    let posts = await Marketplace.find({ "collaborators.user": req.user.id })
      .sort({ createdAt: -1 }).lean();
    try { await Marketplace.populate(posts, POPULATE_FIELDS); } catch (e) { console.error("getMyCollaborations populate:", e.message); }
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch collaborations" });
  }
};

// ── Collaboration Workspace ──

exports.createWorkspace = async (req, res) => {
  try {
    const post = await Marketplace.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found" });
    if (post.createdBy.toString() !== req.user.id) return res.status(403).json({ error: "Only the owner can create a workspace" });

    const existing = await CollaborationRoom.findOne({ postId: req.params.id });
    if (existing) return res.status(400).json({ error: "Workspace already exists for this post" });

    const { name } = req.body;
    const room = await CollaborationRoom.create({
      postId: req.params.id,
      name: name || `${post.title} Workspace`,
      createdBy: req.user.id,
      members: [req.user.id, ...post.participants],
      channels: [
        { name: "general", type: "text", messages: [] },
        { name: "files", type: "files", messages: [] },
      ],
    });
    const populated = await CollaborationRoom.findById(room._id)
      .populate("members channels.messages.author", "name avatar")
      .lean();
    res.status(201).json(populated);
  } catch (err) {
    console.error("Create workspace error:", err);
    res.status(500).json({ error: "Failed to create workspace" });
  }
};

exports.getWorkspace = async (req, res) => {
  try {
    const room = await CollaborationRoom.findOne({ postId: req.params.id })
      .populate("members channels.messages.author files.uploadedBy tasks.assignedTo tasks.createdBy", "name avatar")
      .lean();
    if (!room) return res.status(404).json({ error: "No workspace found for this post" });
    if (!room.members.some(m => m._id.toString() === req.user.id) && room.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(room);
  } catch (err) {
    console.error("Get workspace error:", err);
    res.status(500).json({ error: "Failed to fetch workspace" });
  }
};

exports.sendWorkspaceMessage = async (req, res) => {
  try {
    const { channelName } = req.params;
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "Message text is required" });

    const room = await CollaborationRoom.findOne({ postId: req.params.id });
    if (!room) return res.status(404).json({ error: "Workspace not found" });
    if (!room.members.some(m => m.toString() === req.user.id)) return res.status(403).json({ error: "Access denied" });

    const channel = room.channels.find(c => c.name === channelName);
    if (!channel) return res.status(404).json({ error: "Channel not found" });

    channel.messages.push({ text: text.trim(), author: req.user.id });
    room.updatedAt = new Date();
    await room.save();

    const populated = await CollaborationRoom.findById(room._id)
      .populate("members channels.messages.author", "name avatar").lean();
    res.status(201).json(populated);
  } catch (err) {
    console.error("Send workspace message error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
};

exports.addWorkspaceTask = async (req, res) => {
  try {
    const { title, description, assignedTo } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "Task title is required" });

    const room = await CollaborationRoom.findOne({ postId: req.params.id });
    if (!room) return res.status(404).json({ error: "Workspace not found" });
    if (!room.members.some(m => m.toString() === req.user.id)) return res.status(403).json({ error: "Access denied" });

    room.tasks.push({
      title: title.trim(), description: description || "",
      assignedTo: Array.isArray(assignedTo) ? assignedTo : [],
      createdBy: req.user.id,
    });
    room.updatedAt = new Date();
    await room.save();

    const populated = await CollaborationRoom.findById(room._id)
      .populate("tasks.assignedTo tasks.createdBy", "name avatar").lean();
    res.status(201).json(populated);
  } catch (err) {
    console.error("Add workspace task error:", err);
    res.status(500).json({ error: "Failed to add task" });
  }
};

exports.updateWorkspaceTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;
    if (!["todo", "in_progress", "done"].includes(status)) return res.status(400).json({ error: "Invalid status" });

    const room = await CollaborationRoom.findOne({ postId: req.params.id });
    if (!room) return res.status(404).json({ error: "Workspace not found" });

    const task = room.tasks.id(taskId);
    if (!task) return res.status(404).json({ error: "Task not found" });

    task.status = status;
    room.updatedAt = new Date();
    await room.save();
    res.json({ message: "Task updated", status });
  } catch (err) {
    console.error("Update workspace task error:", err);
    res.status(500).json({ error: "Failed to update task" });
  }
};

exports.inviteToWorkspace = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "User ID required" });

    const room = await CollaborationRoom.findOne({ postId: req.params.id });
    if (!room) return res.status(404).json({ error: "Workspace not found" });
    if (room.createdBy.toString() !== req.user.id) return res.status(403).json({ error: "Only the creator can invite" });
    if (room.members.some(m => m.toString() === userId)) return res.status(400).json({ error: "User is already a member" });

    room.members.push(userId);
    room.updatedAt = new Date();
    await room.save();

    const populated = await CollaborationRoom.findById(room._id)
      .populate("members", "name avatar").lean();
    res.json(populated);
  } catch (err) {
    console.error("Invite to workspace error:", err);
    res.status(500).json({ error: "Failed to invite user" });
  }
};
