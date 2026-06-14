const Community = require("../../../database/models/Community");
const User = require("../../../database/models/User");
const mongoose = require("mongoose");
const { getModelByRole, findUserByAnyId, syncLegacyUserRecord } = require("../utils/userSync");

const populateFields = [
  { path: "createdBy", select: "name" },
  { path: "members", select: "name avatar role" },
  { path: "comments.user", select: "name avatar" },
  { path: "communityMessages.sender", select: "name avatar" },
  { path: "collaborations.members", select: "name avatar" },
  { path: "collaborations.messages.sender", select: "name avatar" },
  { path: "collaborations.createdBy", select: "name avatar" },
];

const listPopulateFields = [
  { path: "createdBy", select: "name" },
  { path: "members", select: "name avatar role" },
];

function hasElevatedAccess(user) {
  return ["admin", "teacher"].includes(user?.role);
}

// ─── helper: can the user manage this community? ───
function canManageCommunity(user, community) {
  if (hasElevatedAccess(user)) return true;
  if (
    (user.role === "community_manager" || user.role === "teacher") &&
    user.managedCommunity &&
    user.managedCommunity.toString() === community._id.toString() &&
    community.members.some((m) => (m._id || m).toString() === user._id.toString())
  ) {
    return true;
  }
  return false;
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// ─── GET /api/communities ───
const getCommunities = async (req, res) => {
  try {
    const { search } = req.query;
    const filter = {};
    if (search) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [
        { name: regex },
        { description: regex },
        { tags: regex },
        { category: regex },
        { college_name: regex },
      ];
    }
    const communities = await Community.find(filter)
      .populate(listPopulateFields)
      .sort({ createdAt: -1 })
      .lean();
    res.json(communities);
  } catch (err) {
    console.error("getCommunities error:", err);
    res.status(500).json({ error: "Failed to fetch communities" });
  }
};

// ─── GET /api/communities/:id ───
const getCommunity = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid community ID" });
    const community = await Community.findById(req.params.id).populate(populateFields);
    if (!community) return res.status(404).json({ error: "Community not found" });
    res.json(community);
  } catch (err) {
    console.error("getCommunity error:", err);
    res.status(500).json({ error: "Failed to fetch community" });
  }
};

// ─── POST /api/communities (admin/teacher only) ───
const createCommunity = async (req, res) => {
  try {
    const { name, description, college_name, certificate_template_id, category, tags, type, privacy, communityType, rules, colorAccent, linkedSubjects } = req.body;
    if (!name?.trim() || !description?.trim()) {
      return res.status(400).json({ error: "Name and description are required" });
    }

    const data = {
      name: name.trim(),
      description: description.trim(),
      college_name: college_name?.trim() || "",
      certificate_template_id: certificate_template_id?.trim() || null,
      category: category || "Other",
      communityType: communityType || "",
      rules: rules || "",
      colorAccent: colorAccent || "",
      tags: Array.isArray(tags) ? tags.map(t => t.trim()).filter(Boolean) : [],
      linkedSubjects: Array.isArray(linkedSubjects) ? linkedSubjects.map(s => s.trim()).filter(Boolean) : [],
      type: type || "public",
      privacy: privacy || "open",
      createdBy: req.user._id || req.user.id,
      members: [req.user._id || req.user.id],
    };

    if (req.files?.image?.[0]) {
      data.image = `/uploads/communities/${req.files.image[0].filename}`;
    }
    if (req.files?.logo?.[0]) {
      data.logo = `/uploads/communities/${req.files.logo[0].filename}`;
    }
    if (req.files?.files?.length) {
      data.files = req.files.files.map((f) => `/uploads/communities/${f.filename}`);
    }

    const community = await Community.create(data);
    await community.populate(populateFields);

    res.status(201).json(community);
  } catch (err) {
    console.error("createCommunity error:", err);
    res.status(500).json({ error: "Failed to create community" });
  }
};

// ─── POST /api/communities/:id/join ───
const joinCommunity = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ error: "Community not found" });

    const userId = req.user.id;
    if (community.members.some((m) => m.toString() === userId)) {
      return res.status(400).json({ error: "Already a member" });
    }

    community.members.push(userId);
    await community.save();

    // Sync: add community to user.communities (prevent duplicates)
    await User.findByIdAndUpdate(userId, {
      $addToSet: { communities: community._id },
    });
    const primaryModel = getModelByRole(req.user?.role);
    if (primaryModel && primaryModel !== User) {
      const primaryUser = await primaryModel.findByIdAndUpdate(
        userId,
        { $addToSet: { communities: community._id } },
        { new: true }
      );
      if (primaryUser) {
        await syncLegacyUserRecord(primaryUser);
      }
    }

    await community.populate(populateFields);

    res.json(community);
  } catch (err) {
    console.error("joinCommunity error:", err);
    res.status(500).json({ error: "Failed to join community" });
  }
};

// ─── POST /api/communities/:id/leave ───
const leaveCommunity = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ error: "Community not found" });

    const userId = req.user.id;

    if (community.createdBy?.toString() === userId) {
      return res.status(400).json({
        message: "Admin cannot leave their own community",
      });
    }

    if (!community.members.some((m) => m.toString() === userId)) {
      return res.status(400).json({ error: "You are not a member of this community" });
    }

    community.members = community.members.filter((m) => m.toString() !== userId);
    await community.save();

    // Sync: remove community from user.communities
    await User.findByIdAndUpdate(userId, {
      $pull: { communities: community._id },
    });
    const primaryModel = getModelByRole(req.user?.role);
    if (primaryModel && primaryModel !== User) {
      const primaryUser = await primaryModel.findByIdAndUpdate(
        userId,
        { $pull: { communities: community._id } },
        { new: true }
      );
      if (primaryUser) {
        await syncLegacyUserRecord(primaryUser);
      }
    }

    await community.populate(populateFields);

    res.json(community);
  } catch (err) {
    console.error("leaveCommunity error:", err);
    res.status(500).json({ error: "Failed to leave community" });
  }
};

// ─── POST /api/communities/:id/comment ───
const addComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "Comment text is required" });

    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ error: "Community not found" });

    community.comments.push({ user: req.user.id, text: text.trim() });
    await community.save();
    await community.populate(populateFields);

    const io = req.app.get("io");
    if (io) {
      io.to(`community:${community._id}`).emit("community_comment", {
        communityId: community._id,
        comments: community.comments,
      });
    }

    res.status(201).json(community);
  } catch (err) {
    console.error("addComment error:", err);
    res.status(500).json({ error: "Failed to add comment" });
  }
};

// ─── DELETE /api/communities/:communityId/comments/:commentId ───
const deleteComment = async (req, res) => {
  try {
    const community = await Community.findById(req.params.communityId);
    if (!community) return res.status(404).json({ error: "Community not found" });

    const comment = community.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ error: "Comment not found" });

    const userId = req.user.id || req.user._id.toString();
    const isOwner = comment.user.toString() === userId;
    const canModerate = hasElevatedAccess(req.user);

    if (!isOwner && !canModerate) {
      return res.status(403).json({ error: "Not authorized to delete this comment" });
    }

    community.comments.pull({ _id: req.params.commentId });
    await community.save();
    await community.populate(populateFields);

    res.json(community);
  } catch (err) {
    console.error("deleteComment error:", err);
    res.status(500).json({ error: "Failed to delete comment" });
  }
};

// ─── POST /api/communities/:id/contribution (admin / manager) ───
const addContribution = async (req, res) => {
  try {
    const { title, description, completedProjects, achievements } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "Title is required" });

    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ error: "Community not found" });

    if (!canManageCommunity(req.user, community)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    community.contributions.push({
      title: title.trim(),
      description: description?.trim() || "",
      completedProjects: Number(completedProjects) || 0,
      achievements: Number(achievements) || 0,
    });
    await community.save();
    await community.populate(populateFields);

    res.json(community);
  } catch (err) {
    console.error("addContribution error:", err);
    res.status(500).json({ error: "Failed to add contribution" });
  }
};

// ─── DELETE /api/communities/:id (admin only) ───
const deleteCommunity = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ error: "Community not found" });

    if (req.user?.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Only admins can delete communities." });
    }

    await Community.findByIdAndDelete(req.params.id);
    res.json({ message: "Community deleted successfully", id: req.params.id });
  } catch (err) {
    console.error("deleteCommunity error:", err);
    res.status(500).json({ error: "Failed to delete community" });
  }
};

// ─── POST /api/communities/:id/upload (admin / manager) ───
const uploadFiles = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ error: "Community not found" });

    if (req.files?.files?.length) {
      const newFiles = req.files.files.map((f) => `/uploads/communities/${f.filename}`);
      community.files.push(...newFiles);
      await community.save();
      await community.populate(populateFields);
    }

    res.json(community);
  } catch (err) {
    console.error("uploadFiles error:", err);
    res.status(500).json({ error: "Failed to upload files" });
  }
};

// ─── GET /api/communities/map (returns communities with computed connections) ───
// ─── PUT /api/communities/:id (admin or community_manager of that community) ───
const updateCommunity = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ error: "Community not found" });

    if (!canManageCommunity(req.user, community)) {
      return res.status(403).json({ error: "Not authorized to update this community" });
    }

    const { name, description, college_name, certificate_template_id, category, tags, type, privacy, communityType, rules, colorAccent, linkedSubjects } = req.body;
    if (name !== undefined) community.name = name.trim();
    if (description !== undefined) community.description = description.trim();
    if (college_name !== undefined) community.college_name = college_name.trim();
    if (certificate_template_id !== undefined) community.certificate_template_id = certificate_template_id.trim() || null;
    if (category !== undefined) community.category = category;
    if (communityType !== undefined) community.communityType = communityType;
    if (rules !== undefined) community.rules = rules;
    if (colorAccent !== undefined) community.colorAccent = colorAccent;
    if (type !== undefined) community.type = type;
    if (privacy !== undefined) community.privacy = privacy;
    if (tags !== undefined) community.tags = Array.isArray(tags) ? tags.map(t => t.trim()).filter(Boolean) : [];
    if (linkedSubjects !== undefined) community.linkedSubjects = Array.isArray(linkedSubjects) ? linkedSubjects.map(s => s.trim()).filter(Boolean) : [];

    if (req.files?.image?.[0]) {
      community.image = `/uploads/communities/${req.files.image[0].filename}`;
    }
    if (req.files?.logo?.[0]) {
      community.logo = `/uploads/communities/${req.files.logo[0].filename}`;
    }

    await community.save();
    await community.populate(populateFields);

    res.json(community);
  } catch (err) {
    console.error("updateCommunity error:", err);
    res.status(500).json({ error: "Failed to update community" });
  }
};

// ─── DELETE /api/communities/:id/members/:memberId (admin only) ───
const removeMember = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ error: "Community not found" });

    const memberId = req.params.memberId;
    if (!community.members.some((m) => m.toString() === memberId)) {
      return res.status(400).json({ error: "User is not a member" });
    }

    community.members = community.members.filter((m) => m.toString() !== memberId);
    await community.save();

    await User.findByIdAndUpdate(memberId, { $pull: { communities: community._id } });
    const removedMember = await findUserByAnyId(memberId);
    if (removedMember && removedMember.collection?.name !== "users") {
      const model = removedMember.constructor;
      const updatedMember = await model.findByIdAndUpdate(
        memberId,
        { $pull: { communities: community._id } },
        { new: true }
      );
      if (updatedMember) {
        await syncLegacyUserRecord(updatedMember);
      }
    }

    await community.populate(populateFields);

    res.json(community);
  } catch (err) {
    console.error("removeMember error:", err);
    res.status(500).json({ error: "Failed to remove member" });
  }
};

// ─── POST /api/communities/:id/assign-manager (admin only) ───
const assignManager = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ error: "Community not found" });

    if (!community.members.some((m) => m.toString() === userId)) {
      return res.status(400).json({ error: "User is not a member of this community" });
    }

    const targetUser = await findUserByAnyId(userId);
    if (!targetUser) return res.status(404).json({ error: "User not found" });

    if (!["teacher", "community_manager"].includes(targetUser.role)) {
      return res.status(400).json({ error: "Only teacher accounts can be assigned as manager" });
    }

    targetUser.managedCommunity = community._id;
    await targetUser.save();
    await syncLegacyUserRecord(targetUser);

    res.json({ message: `${targetUser.name} is now a community manager`, user: { _id: targetUser._id, name: targetUser.name, role: targetUser.role } });
  } catch (err) {
    console.error("assignManager error:", err);
    res.status(500).json({ error: "Failed to assign manager" });
  }
};

// ═══ COLLABORATION ROUTES ═══════════════════════════════════

// ─── POST /api/communities/:id/collab/create ───
const createCollab = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ error: "Community not found" });

    const userId = req.user.id;
    if (!community.members.some((m) => m.toString() === userId)) {
      return res.status(403).json({ error: "You must be a community member" });
    }

    const { projectTitle, description } = req.body;
    if (!projectTitle?.trim()) return res.status(400).json({ error: "Project title is required" });

    community.collaborations.push({
      projectTitle: projectTitle.trim(),
      description: description?.trim() || "",
      createdBy: userId,
      members: [userId],
      messages: [],
    });

    await community.save();
    await community.populate(populateFields);

    res.status(201).json(community);
  } catch (err) {
    console.error("createCollab error:", err);
    res.status(500).json({ error: "Failed to create collaboration" });
  }
};

// ─── POST /api/communities/:id/collab/:collabId/join ───
const joinCollab = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ error: "Community not found" });

    const userId = req.user.id;
    if (!community.members.some((m) => m.toString() === userId)) {
      return res.status(403).json({ error: "You must be a community member" });
    }

    const collab = community.collaborations.id(req.params.collabId);
    if (!collab) return res.status(404).json({ error: "Collaboration not found" });

    if (collab.members.some((m) => m.toString() === userId)) {
      return res.status(400).json({ error: "Already a member of this collaboration" });
    }

    collab.members.push(userId);
    await community.save();
    await community.populate(populateFields);

    res.json(community);
  } catch (err) {
    console.error("joinCollab error:", err);
    res.status(500).json({ error: "Failed to join collaboration" });
  }
};

// ─── POST /api/communities/:id/collab/:collabId/message ───
const sendCollabMessage = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ error: "Community not found" });

    const userId = req.user.id;
    const collab = community.collaborations.id(req.params.collabId);
    if (!collab) return res.status(404).json({ error: "Collaboration not found" });

    // Only collab members can send messages
    if (!collab.members.some((m) => m.toString() === userId)) {
      return res.status(403).json({ error: "You must join this collaboration to send messages" });
    }

    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "Message text is required" });

    collab.messages.push({ sender: userId, text: text.trim() });
    await community.save();
    await community.populate(populateFields);

    const io = req.app.get("io");
    if (io) {
      io.to(`community:${community._id}`).emit("collab_message", {
        communityId: community._id,
        collabId: req.params.collabId,
        messages: collab.messages,
      });
    }

    res.status(201).json(community);
  } catch (err) {
    console.error("sendCollabMessage error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
};

// ─── GET /api/communities/:id/collab/:collabId/messages ───
const getCollabMessages = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id).populate(populateFields);
    if (!community) return res.status(404).json({ error: "Community not found" });

    const userId = req.user.id;
    if (!community.members.some((m) => (m._id || m).toString() === userId)) {
      return res.status(403).json({ error: "You must be a community member" });
    }

    const collab = community.collaborations.id(req.params.collabId);
    if (!collab) return res.status(404).json({ error: "Collaboration not found" });

    // Non-collab members cannot view messages
    if (!collab.members.some((m) => (m._id || m).toString() === userId)) {
      return res.status(403).json({ error: "You must join this collaboration to view messages" });
    }

    res.json(collab);
  } catch (err) {
    console.error("getCollabMessages error:", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
};

// ═══ COMMUNITY PUBLIC CHAT ══════════════════════════════════

// ─── POST /api/communities/:id/voice — Send voice message ───
const sendCommunityVoiceMessage = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ error: "Community not found" });

    const userId = req.user.id || req.user._id?.toString();
    if (!community.members.some((m) => m.toString() === userId)) {
      return res.status(403).json({ error: "You must be a community member to send messages" });
    }

    if (!req.file) return res.status(400).json({ error: "Audio file is required" });

    community.communityMessages.push({
      sender: userId,
      text: "",
      messageType: "voice",
      audioUrl: `/uploads/chat/${req.file.filename}`,
      audioDuration: req.body.duration ? Number(req.body.duration) : 0,
    });
    await community.save();
    await community.populate(populateFields);

    const io = req.app.get("io");
    if (io) {
      io.to(`community:${community._id}`).emit("community_message", {
        communityId: community._id,
        communityMessages: community.communityMessages,
      });
    }

    res.status(201).json(community);
  } catch (err) {
    console.error("sendCommunityVoiceMessage error:", err);
    res.status(500).json({ error: "Failed to send voice message" });
  }
};

// ─── POST /api/communities/:id/messages ───
const sendCommunityMessage = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ error: "Community not found" });

    const userId = req.user.id;
    if (!community.members.some((m) => m.toString() === userId)) {
      return res.status(403).json({ error: "You must be a community member to send messages" });
    }

    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "Message text is required" });

    community.communityMessages.push({ sender: userId, text: text.trim() });
    await community.save();
    await community.populate(populateFields);

    const io = req.app.get("io");
    if (io) {
      io.to(`community:${community._id}`).emit("community_message", {
        communityId: community._id,
        communityMessages: community.communityMessages,
      });
    }

    res.status(201).json(community);
  } catch (err) {
    console.error("sendCommunityMessage error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
};

// ─── DELETE /api/communities/:id/messages/:messageId ───
const deleteCommunityMessage = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ error: "Community not found" });

    const message = community.communityMessages.id(req.params.messageId);
    if (!message) return res.status(404).json({ error: "Message not found" });

    const userId = req.user.id || req.user._id.toString();
    const isOwner = message.sender.toString() === userId;
    const canModerate = hasElevatedAccess(req.user);

    if (!isOwner && !canModerate) {
      return res.status(403).json({ error: "Not authorized to delete this message" });
    }

    community.communityMessages.pull({ _id: req.params.messageId });
    await community.save();
    await community.populate(populateFields);

    res.json(community);
  } catch (err) {
    console.error("deleteCommunityMessage error:", err);
    res.status(500).json({ error: "Failed to delete message" });
  }
};

// ─── DELETE /api/communities/:id/collab/:collabId/message/:messageId ───
const deleteCollabMessage = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ error: "Community not found" });

    const collab = community.collaborations.id(req.params.collabId);
    if (!collab) return res.status(404).json({ error: "Collaboration not found" });

    const userId = req.user.id || req.user._id.toString();

    // Must be collab member
    if (!collab.members.some((m) => m.toString() === userId)) {
      return res.status(403).json({ error: "You must be a collaboration member" });
    }

    const message = collab.messages.id(req.params.messageId);
    if (!message) return res.status(404).json({ error: "Message not found" });

    const isOwner = message.sender.toString() === userId;
    const canModerate = hasElevatedAccess(req.user);

    if (!isOwner && !canModerate) {
      return res.status(403).json({ error: "Not authorized to delete this message" });
    }

    collab.messages.pull({ _id: req.params.messageId });
    await community.save();
    await community.populate(populateFields);

    res.json(community);
  } catch (err) {
    console.error("deleteCollabMessage error:", err);
    res.status(500).json({ error: "Failed to delete message" });
  }
};



// ─── Phase 4: Activity Log Helper ───
async function addActivityLog(communityId, actorId, action, description = "", target = "") {
  try {
    await Community.findByIdAndUpdate(communityId, {
      $push: {
        activityLog: {
          $each: [{ action, actor: actorId, description, target }],
          $slice: -200,
        },
      },
    });
  } catch (logErr) {
    console.error(`[Community] addActivityLog failed:`, logErr.message, logErr.stack);
  }
}

// ─── Phase 4: POST /api/communities/:id/complete-task ───
const completeCommunityTask = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ error: "Community not found" });
    if (community.status === "archived") return res.status(400).json({ error: "Community is archived" });
    if (!canManageCommunity(req.user, community)) return res.status(403).json({ error: "Not authorized" });
    community.completionType = "task_only";
    community.completedAt = new Date();
    community.completedBy = req.user._id || req.user.id;
    await community.save();
    await addActivityLog(community._id, req.user._id || req.user.id, "complete_task", "Completed tasks", "task");
    const io = req.app.get("io");
    if (io) io.to(`community:${community._id}`).emit("community_updated", { communityId: community._id, status: community.status, completionType: community.completionType });
    res.json({ message: "Tasks marked complete", community });
  } catch (err) {
    console.error("completeCommunityTask error:", err);
    res.status(500).json({ error: "Failed to complete tasks" });
  }
};

// ─── Phase 4: POST /api/communities/:id/archive ───
const archiveCommunity = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ error: "Community not found" });
    if (community.status === "archived") return res.status(400).json({ error: "Already archived" });
    if (!canManageCommunity(req.user, community)) return res.status(403).json({ error: "Not authorized" });
    community.status = "archived";
    community.completionType = "full";
    community.archivedAt = new Date();
    community.archivedBy = req.user._id || req.user.id;
    community.completedAt = new Date();
    community.completedBy = req.user._id || req.user.id;
    await community.save();
    await addActivityLog(community._id, req.user._id || req.user.id, "archive", "Community archived", "community");
    const io = req.app.get("io");
    if (io) io.to(`community:${community._id}`).emit("community_archived", { communityId: community._id });
    res.json({ message: "Community archived", community });
  } catch (err) {
    console.error("archiveCommunity error:", err);
    res.status(500).json({ error: "Failed to archive community" });
  }
};

// ─── Phase 4: POST /api/communities/:id/resources ───
const addResource = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ error: "Community not found" });
    if (community.status === "archived") return res.status(400).json({ error: "Community is archived" });
    if (!canManageCommunity(req.user, community) && !community.members.some(m => (m._id || m).toString() === (req.user._id || req.user.id).toString())) {
      return res.status(403).json({ error: "Not authorized" });
    }
    const { title, description, url, type } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "Title is required" });
    let resourceUrl = url || null;
    if (req.file) resourceUrl = `/uploads/communities/${req.file.filename}`;
    community.resources.push({
      title: title.trim(),
      description: description?.trim() || "",
      url: resourceUrl,
      type: type || "file",
      uploadedBy: req.user._id || req.user.id,
    });
    await community.save();
    await addActivityLog(community._id, req.user._id || req.user.id, "add_resource", `Added resource: ${title}`, "resource");
    res.json(community);
  } catch (err) {
    console.error("addResource error:", err);
    res.status(500).json({ error: "Failed to add resource" });
  }
};

// ─── Phase 4: DELETE /api/communities/:id/resources/:resourceId ───
const deleteResource = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ error: "Community not found" });
    if (!canManageCommunity(req.user, community)) return res.status(403).json({ error: "Not authorized" });
    community.resources.pull({ _id: req.params.resourceId });
    await community.save();
    res.json({ message: "Resource deleted" });
  } catch (err) {
    console.error("deleteResource error:", err);
    res.status(500).json({ error: "Failed to delete resource" });
  }
};

// ─── Phase 4: GET /api/communities/:id/timeline ───
const getTimeline = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id).select("activityLog").lean();
    if (!community) return res.status(404).json({ error: "Community not found" });
    const logs = (community.activityLog || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50);
    await Community.populate(logs, { path: "actor", select: "name avatar role" });
    res.json({ timeline: logs });
  } catch (err) {
    console.error("getTimeline error:", err);
    res.status(500).json({ error: "Failed to get timeline" });
  }
};

// ─── Phase 4: GET /api/communities/:id/stats ───
const getCommunityStats = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id)
      .select("members collaborations resources activityLog status completionType archivedAt createdAt")
      .lean();
    if (!community) return res.status(404).json({ error: "Community not found" });
    const Task = require("../../../database/models/task.model");
    const totalTasks = await Task.countDocuments({ community_id: req.params.id });
    const completedTasks = await Task.countDocuments({ community_id: req.params.id, completed_status: true });
    const Submission = require("../../../database/models/Submission");
    const totalSubmissions = await Submission.countDocuments({ community: req.params.id });
    const approvedSubmissions = await Submission.countDocuments({ community: req.params.id, status: "approved" });
    res.json({
      totalMembers: community.members?.length || 0,
      totalCollaborations: community.collaborations?.length || 0,
      totalResources: community.resources?.length || 0,
      totalTasks,
      completedTasks,
      totalSubmissions,
      approvedSubmissions,
      status: community.status,
      completionType: community.completionType,
      archivedAt: community.archivedAt,
    });
  } catch (err) {
    console.error("getCommunityStats error:", err);
    res.status(500).json({ error: "Failed to get stats" });
  }
};

module.exports = {
  getCommunities,
  getCommunity,
  createCommunity,
  joinCommunity,
  leaveCommunity,
  addComment,
  deleteComment,
  addContribution,
  deleteCommunity,
  uploadFiles,
  updateCommunity,
  removeMember,
  assignManager,
  createCollab,
  joinCollab,
  sendCollabMessage,
  getCollabMessages,
  sendCommunityMessage,
  sendCommunityVoiceMessage,
  deleteCommunityMessage,
  deleteCollabMessage,
  completeCommunityTask,
  archiveCommunity,
  addResource,
  deleteResource,
  getTimeline,
  getCommunityStats,
};
