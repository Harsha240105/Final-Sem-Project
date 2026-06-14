const mongoose = require("mongoose");
const User = require("../../../database/models/User");
const Student = require("../../../database/models/Student");
const Teacher = require("../../../database/models/Teacher");
const Follow = require("../../../database/models/Follow");
const Conversation = require("../../../database/models/Conversation");
const { findUserByAnyId } = require("../utils/userSync");

const ALLOWED_DISCOVERY_ROLES = ["student", "teacher", "community_manager"];

function escapeRegex(rawValue = "") {
  return String(rawValue).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toIdString(value) {
  if (!value) return "";
  return value.toString();
}

function normalizePublicUser(userDoc, { relation = null, isFollowing = false, isFollower = false } = {}) {
  if (!userDoc) return null;
  return {
    id: toIdString(userDoc._id),
    publicId: userDoc.publicId || null,
    name: userDoc.name || "Student",
    role: userDoc.role || "student",
    collegeName: userDoc.collegeName || "",
    institutionType: userDoc.institutionType || "",
    institutionName: userDoc.institutionName || "",
    avatar: userDoc.avatar || null,
    walletAddress: userDoc.walletAddress || null,
    bio: userDoc.bio || null,
    online: userDoc.online || false,
    verified: userDoc.approved === true || userDoc.verificationStatus === "verified",
    relation,
    isFollowing,
    isFollower,
  };
}

function buildGraphPayload({ viewer, followingUsers, followerUsers }) {
  const viewerId = toIdString(viewer?._id);
  const followingById = new Map((followingUsers || []).map((user) => [toIdString(user._id), user]));
  const followerById = new Map((followerUsers || []).map((user) => [toIdString(user._id), user]));

  function enrichNode(userDoc, extra = {}) {
    return {
      id: toIdString(userDoc._id || userDoc.id),
      name: userDoc.name || "Student",
      role: userDoc.role || "student",
      collegeName: userDoc.collegeName || "",
      institutionType: userDoc.institutionType || "",
      institutionName: userDoc.institutionName || "",
      avatar: userDoc.avatar || null,
      walletAddress: userDoc.walletAddress || null,
      verified: userDoc.approved === true || userDoc.verificationStatus === "verified",
      nftCount: (userDoc.nftCertificates || []).filter((n) => n.status === "confirmed").length,
      communityCount: (userDoc.communities || []).length,
      ...extra,
    };
  }

  const nodeMap = new Map();
  nodeMap.set(viewerId, enrichNode(viewer, { relation: "self" }));

  const edges = [];
  followingById.forEach((followedUser, userId) => {
    const existing = nodeMap.get(userId);
    const isFollowerToo = followerById.has(userId);

    nodeMap.set(userId, enrichNode(followedUser, { relation: isFollowerToo ? "mutual" : "following" }));

    edges.push({
      source: viewerId,
      target: userId,
      relation: isFollowerToo ? "mutual" : "following",
    });

    if (existing && existing.relation === "follower") {
      nodeMap.set(userId, enrichNode(followedUser, { relation: "mutual" }));
    }
  });

  followerById.forEach((followerUser, userId) => {
    if (userId === viewerId) return;
    const existing = nodeMap.get(userId);

    if (existing) {
      if (existing.relation !== "mutual") {
        nodeMap.set(userId, { ...existing, relation: "mutual" });
        const existingEdge = edges.find(
          (edge) =>
            edge.source === viewerId &&
            edge.target === userId
        );
        if (existingEdge) {
          existingEdge.relation = "mutual";
        }
      }
      return;
    }

    nodeMap.set(userId, enrichNode(followerUser, { relation: "follower" }));
    edges.push({
      source: userId,
      target: viewerId,
      relation: "follower",
    });
  });

  return {
    centerUserId: viewerId,
    nodes: Array.from(nodeMap.values()),
    edges,
  };
}

async function getConnectionOverview(req, res) {
  try {
    const viewerId = req.user?.id;
    if (!viewerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (req.user?.role === "admin") {
      return res.status(403).json({ error: "Admin accounts do not support social following." });
    }

    const safeSearch = String(req.query.search || "").trim().slice(0, 80);
    const viewer = await findUserByAnyId(viewerId, "name role collegeName institutionType institutionName avatar walletAddress approved communities nftCertificates");
    if (!viewer) {
      return res.status(404).json({ error: "Current user not found" });
    }

    const [rawFollowingRecords, rawFollowerRecords] = await Promise.all([
      Follow.find({ follower: viewerId }).sort({ createdAt: -1 }).lean(),
      Follow.find({ following: viewerId }).sort({ createdAt: -1 }).lean(),
    ]);

    // Filter out self-follow records (old/buggy data where user followed themselves)
    const selfFollowingFiltered = rawFollowingRecords.filter(
      (r) => toIdString(r.following) !== viewerId
    );
    const selfFollowerFiltered = rawFollowerRecords.filter(
      (r) => toIdString(r.follower) !== viewerId
    );

    // Deduplicate by target user ID (keep only the most recent record per user)
    const dedupFollowing = new Map();
    selfFollowingFiltered.forEach((r) => dedupFollowing.set(toIdString(r.following), r));
    const followingRecords = [...dedupFollowing.values()];

    const dedupFollower = new Map();
    selfFollowerFiltered.forEach((r) => dedupFollower.set(toIdString(r.follower), r));
    const followerRecords = [...dedupFollower.values()];

    const followingIds = followingRecords.map((record) => toIdString(record.following));
    const followerIds = followerRecords.map((record) => toIdString(record.follower));
    const uniqueRelationIds = [...new Set([...followingIds, ...followerIds])];

    // First try User model (single query, fast)
    const userRelated = uniqueRelationIds.length
      ? await User.find({
          _id: { $in: uniqueRelationIds },
          role: { $in: ALLOWED_DISCOVERY_ROLES },
        })
          .select("publicId name role collegeName institutionType institutionName avatar approved walletAddress communities nftCertificates")
          .lean()
      : [];

    const relatedUsersById = new Map(userRelated.map((user) => [toIdString(user._id), user]));

    // Fallback: resolve any missing relation IDs from legacy models
    const missingIds = uniqueRelationIds.filter((id) => !relatedUsersById.has(id));
    if (missingIds.length > 0) {
      const legacyUsers = await Promise.all(
        missingIds.map((id) => findUserByAnyId(id, "publicId name role collegeName institutionType institutionName avatar approved walletAddress communities nftCertificates"))
      );
      for (const lu of legacyUsers) {
        if (lu && ALLOWED_DISCOVERY_ROLES.includes(lu.role)) {
          relatedUsersById.set(toIdString(lu._id), lu);
        }
      }
    }

    const following = followingRecords
      .map((record) => {
        const followedUser = relatedUsersById.get(toIdString(record.following));
        if (!followedUser) return null;
        return normalizePublicUser(followedUser, {
          relation: followerIds.includes(toIdString(record.following)) ? "mutual" : "following",
          isFollowing: true,
          isFollower: followerIds.includes(toIdString(record.following)),
        });
      })
      .filter(Boolean);

    const followers = followerRecords
      .map((record) => {
        const followerUser = relatedUsersById.get(toIdString(record.follower));
        if (!followerUser) return null;
        return normalizePublicUser(followerUser, {
          relation: followingIds.includes(toIdString(record.follower)) ? "mutual" : "follower",
          isFollowing: followingIds.includes(toIdString(record.follower)),
          isFollower: true,
        });
      })
      .filter(Boolean);

    const mutualCount = followers.filter((follower) => follower.isFollowing).length;

    const discoveryFilter = {
      _id: { $nin: [new mongoose.Types.ObjectId(viewerId), ...followingIds.map((id) => new mongoose.Types.ObjectId(id))] },
      role: { $in: ALLOWED_DISCOVERY_ROLES },
    };

    if (safeSearch) {
      const searchRegex = new RegExp(escapeRegex(safeSearch), "i");
      discoveryFilter.$or = [{ name: searchRegex }, { collegeName: searchRegex }];
    }

    const suggestionsRaw = await User.find(discoveryFilter)
      .select("publicId name role collegeName institutionType institutionName avatar")
      .sort({ updatedAt: -1 })
      .limit(30)
      .lean();

    const suggestions = suggestionsRaw.map((userDoc) =>
      normalizePublicUser(userDoc, {
        relation: "discover",
        isFollowing: false,
        isFollower: followerIds.includes(toIdString(userDoc._id)),
      })
    );

    const followingUsersForGraph = following
      .map((item) => relatedUsersById.get(item.id))
      .filter(Boolean);
    const followerUsersForGraph = followers
      .map((item) => relatedUsersById.get(item.id))
      .filter(Boolean);

    const graph = buildGraphPayload({
      viewer,
      followingUsers: followingUsersForGraph,
      followerUsers: followerUsersForGraph,
    });

    return res.json({
      stats: {
        followers: followers.length,
        following: following.length,
        mutual: mutualCount,
      },
      following,
      followers,
      suggestions,
      graph,
    });
  } catch (err) {
    console.error("getConnectionOverview error:", err);
    return res.status(500).json({ error: "Failed to load connection overview" });
  }
}

async function followUser(req, res) {
  try {
    const viewerId = req.user?.id;
    if (!viewerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { targetUserId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ error: "Invalid target user id" });
    }

    if (viewerId === targetUserId) {
      return res.status(400).json({ error: "You cannot follow your own account." });
    }

    const [viewer, target] = await Promise.all([
      findUserByAnyId(viewerId),
      findUserByAnyId(targetUserId),
    ]);

    if (!viewer) {
      return res.status(404).json({ error: "Current user not found" });
    }

    if (!ALLOWED_DISCOVERY_ROLES.includes(viewer.role)) {
      return res.status(403).json({ error: "Following is not available for your account type." });
    }

    if (!target || !ALLOWED_DISCOVERY_ROLES.includes(target.role)) {
      return res.status(404).json({ error: "User account not found" });
    }

    // Application-level duplicate check (catches missing/mismatched DB index)
    const existing = await Follow.findOne({
      follower: viewerId,
      following: targetUserId,
    }).lean();
    if (existing) {
      return res.status(200).json({ message: "Already following this student." });
    }

    let created;
    try {
      created = await Follow.create({
        follower: viewerId,
        following: targetUserId,
      });
    } catch (err) {
      if (err?.code === 11000) {
        return res.status(200).json({ message: "Already following this student." });
      }
      throw err;
    }

    // Update denormalized counters
    try {
      await Promise.all([
        User.findByIdAndUpdate(targetUserId, { $inc: { followerCount: 1 } }),
        User.findByIdAndUpdate(viewerId, { $inc: { followingCount: 1 } }),
      ]);
    } catch (countErr) {
      console.error("Follow count update error:", countErr);
    }

    // Legacy record updates (best-effort)
    try {
      await Promise.all([
        Student.findByIdAndUpdate(targetUserId, { $inc: { followerCount: 1 } }),
        Student.findByIdAndUpdate(viewerId, { $inc: { followingCount: 1 } }),
        Teacher.findByIdAndUpdate(targetUserId, { $inc: { followerCount: 1 } }),
        Teacher.findByIdAndUpdate(viewerId, { $inc: { followingCount: 1 } }),
      ]);
    } catch (legacyErr) {
      // Swallow - legacy records may not exist
    }

    // Auto-create conversation for DM
    try {
      const existingConv = await Conversation.findOne({
        participants: { $all: [viewerId, targetUserId] }
      });
      if (!existingConv) {
        await Conversation.create({
          participants: [viewerId, targetUserId],
        });
      }
    } catch (convErr) {
      console.error("Auto-create conversation error:", convErr);
    }

    // Real-time socket event
    try {
      const io = req.app.get("io");
      if (io) {
        const viewerName = viewer?.name || "Someone";
        const targetName = target?.name || "someone";
        io.to(viewerId).to(targetUserId).emit("followCreated", {
          followerId: viewerId,
          followingId: targetUserId,
          followerName: viewerName,
          followingName: targetName,
        });

        // Emit updated follower count
        const newFollowerCount = await Follow.countDocuments({ following: targetUserId });
        io.to(targetUserId).emit("followCountUpdate", {
          userId: targetUserId,
          followerCount: newFollowerCount,
        });
      }
    } catch (socketErr) {
      console.error("Socket follow event error:", socketErr);
    }

    return res.status(201).json({ message: "Followed successfully.", followId: created._id });
  } catch (err) {
    console.error("followUser error:", err);
    return res.status(500).json({ error: "Failed to follow student" });
  }
}

async function unfollowUser(req, res) {
  try {
    const viewerId = req.user?.id;
    if (!viewerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { targetUserId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ error: "Invalid target user id" });
    }

    if (viewerId === targetUserId) {
      return res.status(400).json({ error: "You cannot unfollow your own account." });
    }

    const viewer = await findUserByAnyId(viewerId, "role");
    if (!viewer) {
      return res.status(404).json({ error: "Current user not found" });
    }

    if (!ALLOWED_DISCOVERY_ROLES.includes(viewer.role)) {
      return res.status(403).json({ error: "Following is not available for your account type." });
    }

    const deletion = await Follow.deleteOne({
      follower: viewerId,
      following: targetUserId,
    });

    if (!deletion.deletedCount) {
      return res.status(200).json({ message: "Connection already removed." });
    }

    // Update denormalized counters
    try {
      await Promise.all([
        User.findByIdAndUpdate(targetUserId, { $inc: { followerCount: -1 } }),
        User.findByIdAndUpdate(viewerId, { $inc: { followingCount: -1 } }),
      ]);
    } catch (countErr) {
      console.error("Follow count decrement error:", countErr);
    }

    // Legacy record updates (best-effort)
    try {
      await Promise.all([
        Student.findByIdAndUpdate(targetUserId, { $inc: { followerCount: -1 } }),
        Student.findByIdAndUpdate(viewerId, { $inc: { followingCount: -1 } }),
        Teacher.findByIdAndUpdate(targetUserId, { $inc: { followerCount: -1 } }),
        Teacher.findByIdAndUpdate(viewerId, { $inc: { followingCount: -1 } }),
      ]);
    } catch (legacyErr) {
      // Swallow - legacy records may not exist
    }

    // Real-time socket event
    try {
      const io = req.app.get("io");
      if (io) {
        io.to(viewerId).to(targetUserId).emit("followRemoved", {
          followerId: viewerId,
          followingId: targetUserId,
        });

        // Emit updated follower count
        const newFollowerCount = await Follow.countDocuments({ following: targetUserId });
        io.to(targetUserId).emit("followCountUpdate", {
          userId: targetUserId,
          followerCount: newFollowerCount,
        });
      }
    } catch (socketErr) {
      console.error("Socket unfollow event error:", socketErr);
    }

    return res.status(200).json({ message: "Unfollowed successfully." });
  } catch (err) {
    console.error("unfollowUser error:", err);
    return res.status(500).json({ error: "Failed to unfollow student" });
  }
}

async function discoverUsers(req, res) {
  try {
    const viewerId = req.user?.id;
    if (!viewerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const safeSearch = String(req.query.search || "").trim().slice(0, 80);

    const searchFilter = {};
    if (safeSearch) {
      const searchRegex = new RegExp(escapeRegex(safeSearch), "i");
      searchFilter.$or = [
        { name: searchRegex },
        { collegeName: searchRegex },
        { institutionName: searchRegex },
        { role: searchRegex },
      ];
    }

    const projection = "publicId name role collegeName institutionType institutionName avatar bio online walletAddress communities nftCertificates verificationStatus approved";

    const [students, teachers, legacyUsers, allFollows] = await Promise.all([
      Student.find(searchFilter).select(projection).sort({ updatedAt: -1 }).limit(50).lean(),
      Teacher.find(searchFilter).select(projection).sort({ updatedAt: -1 }).limit(50).lean(),
      User.find({ ...searchFilter, role: { $in: ALLOWED_DISCOVERY_ROLES } }).select(projection).sort({ updatedAt: -1 }).limit(50).lean(),
      Follow.find({ follower: viewerId }).select("following").lean(),
    ]);

    const seenIds = new Set();
    const seenWallets = new Set();
    const allUsers = [...students, ...teachers, ...legacyUsers]
      .filter((u) => {
        const id = toIdString(u._id);
        const wallet = (u.walletAddress || "").toLowerCase().trim();
        if (id === viewerId || seenIds.has(id)) return false;
        if (wallet && seenWallets.has(wallet)) return false;
        seenIds.add(id);
        if (wallet) seenWallets.add(wallet);
        return true;
      })
      .slice(0, 50);

    const followingIds = new Set(allFollows.map((f) => toIdString(f.following)));

    const [followerCounts, followingCounts] = await Promise.all([
      Promise.all(allUsers.map((u) => Follow.countDocuments({ following: u._id }))),
      Promise.all(allUsers.map((u) => Follow.countDocuments({ follower: u._id }))),
    ]);

    const result = allUsers.map((userDoc, idx) => ({
      ...normalizePublicUser(userDoc, {
        relation: followingIds.has(toIdString(userDoc._id)) ? "following" : "discover",
        isFollowing: followingIds.has(toIdString(userDoc._id)),
      }),
      stats: {
        followers: followerCounts[idx] || 0,
        following: followingCounts[idx] || 0,
      },
      certificateCount: (userDoc.nftCertificates || []).filter((n) => n.status === "confirmed").length,
      nftCount: (userDoc.nftCertificates || []).filter((n) => n.status === "confirmed").length,
      communityCount: (userDoc.communities || []).length,
      walletConnected: Boolean(userDoc.walletAddress),
    }));

    return res.json({ users: result, total: result.length });
  } catch (err) {
    console.error("discoverUsers error:", err);
    return res.status(500).json({ error: "Failed to discover users" });
  }
}

module.exports = {
  getConnectionOverview,
  followUser,
  unfollowUser,
  getDashboardStats,
  getUserProfileWithFollowStatus,
  discoverUsers,
};

async function getDashboardStats(req, res) {
  try {
    const viewerId = req.user?.id;
    if (!viewerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const viewer = await findUserByAnyId(viewerId, "name role");
    if (!viewer) {
      return res.status(404).json({ error: "Current user not found" });
    }

    const [distinctFollowing, distinctFollowers] = await Promise.all([
      Follow.distinct("following", { follower: viewerId }),
      Follow.distinct("follower", { following: viewerId }),
    ]);
    const filteredFollowing = distinctFollowing.filter((id) => toIdString(id) !== viewerId);
    const filteredFollowers = distinctFollowers.filter((id) => toIdString(id) !== viewerId);
    const followingCount = filteredFollowing.length;
    const followerCount = filteredFollowers.length;

    const mutualCount = await Follow.aggregate([
      {
        $match: {
          follower: new mongoose.Types.ObjectId(viewerId),
          following: { $in: filteredFollowers.map((id) => new mongoose.Types.ObjectId(id)) },
        },
      },
      { $count: "count" },
    ]);

    const rawRecentFollowers = await Follow.find({ following: viewerId })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("follower", "name role avatar")
      .lean();
    const dedupRecentFollowers = new Map();
    rawRecentFollowers.forEach((f) => {
      if (f.follower && f.follower._id) {
        const key = toIdString(f.follower._id);
        if (!dedupRecentFollowers.has(key) && key !== viewerId) dedupRecentFollowers.set(key, f);
      }
    });
    const recentFollowers = [...dedupRecentFollowers.values()].slice(0, 5);

    const rawRecentFollowing = await Follow.find({ follower: viewerId })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("following", "name role avatar")
      .lean();
    const dedupRecentFollowing = new Map();
    rawRecentFollowing.forEach((f) => {
      if (f.following && f.following._id) {
        const key = toIdString(f.following._id);
        if (!dedupRecentFollowing.has(key) && key !== viewerId) dedupRecentFollowing.set(key, f);
      }
    });
    const recentFollowing = [...dedupRecentFollowing.values()].slice(0, 5);

    return res.json({
      stats: {
        followers: followerCount,
        following: followingCount,
        mutual: mutualCount.length > 0 ? mutualCount[0].count : 0,
      },
      recentFollowers: recentFollowers.map((f) => normalizePublicUser(f.follower, { isFollower: true })),
      recentFollowing: recentFollowing.map((f) => normalizePublicUser(f.following, { isFollowing: true })),
    });
  } catch (err) {
    console.error("getDashboardStats error:", err);
    return res.status(500).json({ error: "Failed to load dashboard stats" });
  }
}

async function getUserProfileWithFollowStatus(req, res) {
  try {
    const viewerId = req.user?.id;
    if (!viewerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    let targetUser = await User.findById(userId).select("publicId name role collegeName avatar communities nftCertificates");
    if (!targetUser) {
      targetUser = await findUserByAnyId(userId, "publicId name role collegeName avatar communities nftCertificates walletAddress");
    }
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const [isFollowing, isFollower, distinctProfileFollowers, distinctProfileFollowing] = await Promise.all([
      Follow.exists({ follower: viewerId, following: userId }),
      Follow.exists({ follower: userId, following: viewerId }),
      Follow.distinct("follower", { following: userId }),
      Follow.distinct("following", { follower: userId }),
    ]);

    const filteredProfileFollowers = distinctProfileFollowers.filter((id) => toIdString(id) !== userId);
    const filteredProfileFollowing = distinctProfileFollowing.filter((id) => toIdString(id) !== userId);
    const followerCount = filteredProfileFollowers.length;
    const followingCount = filteredProfileFollowing.length;

    return res.json({
      user: normalizePublicUser(targetUser, {
        isFollowing: Boolean(isFollowing),
        isFollower: Boolean(isFollower),
        relation: isFollowing && isFollower ? "mutual" : isFollowing ? "following" : isFollower ? "follower" : null,
      }),
      stats: {
        followers: followerCount,
        following: followingCount,
      },
      communities: targetUser.communities || [],
      nftCount: (targetUser.nftCertificates || []).filter((nft) => nft.status === "confirmed").length,
    });
  } catch (err) {
    console.error("getUserProfileWithFollowStatus error:", err);
    return res.status(500).json({ error: "Failed to load user profile" });
  }
}
