const mongoose = require("mongoose");
const Follow = require("../../../database/models/Follow");
const User = require("../../../database/models/User");
const Student = require("../../../database/models/Student");
const Teacher = require("../../../database/models/Teacher");
const { findUserByAnyId } = require("../utils/userSync");

const ALLOWED_DISCOVERY_ROLES = ["student", "teacher", "community_manager"];

function toIdString(value) {
  if (!value) return "";
  return value.toString();
}

function normalizePublicUser(userDoc, overrides = {}) {
  if (!userDoc) return null;
  return {
    id: toIdString(userDoc._id),
    publicId: userDoc.publicId || null,
    name: userDoc.name || "Unknown",
    role: userDoc.role || "student",
    collegeName: userDoc.collegeName || "",
    institutionType: userDoc.institutionType || "",
    institutionName: userDoc.institutionName || "",
    avatar: userDoc.avatar || null,
    walletAddress: userDoc.walletAddress || null,
    verified: userDoc.approved === true || userDoc.verificationStatus === "verified",
    nftCount: (userDoc.nftCertificates || []).filter((n) => n.status === "confirmed").length,
    communityCount: (userDoc.communities || []).length,
    ...overrides,
  };
}

async function expandNetwork(req, res) {
  try {
    const viewerId = req.user?.id;
    if (!viewerId) return res.status(401).json({ error: "Unauthorized" });

    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const [followerRecords, followingRecords] = await Promise.all([
      Follow.find({ following: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Follow.find({ follower: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const followerUserIds = followerRecords
      .map((r) => toIdString(r.follower))
      .filter((id) => id !== viewerId);
    const followingUserIds = followingRecords
      .map((r) => toIdString(r.following))
      .filter((id) => id !== viewerId);

    const allUserIds = [...new Set([...followerUserIds, ...followingUserIds])];

    const viewerFollowingMap = new Map();
    if (allUserIds.length > 0) {
      const viewerFollows = await Follow.find({
        follower: viewerId,
        following: { $in: allUserIds },
      })
        .select("following")
        .lean();
      viewerFollows.forEach((f) =>
        viewerFollowingMap.set(toIdString(f.following), true)
      );
    }

    const userDocs = await User.find({
      _id: { $in: allUserIds },
      role: { $in: ALLOWED_DISCOVERY_ROLES },
    })
      .select(
        "publicId name role collegeName institutionType institutionName avatar walletAddress communities nftCertificates"
      )
      .lean();

    const userMap = new Map(userDocs.map((u) => [toIdString(u._id), u]));
    const missingIds = allUserIds.filter((id) => !userMap.has(id));

    if (missingIds.length > 0) {
      const legacyResults = await Promise.all(
        missingIds.map((id) =>
          findUserByAnyId(
            id,
            "publicId name role collegeName institutionType institutionName avatar walletAddress approved communities nftCertificates"
          )
        )
      );
      for (const lu of legacyResults) {
        if (lu && ALLOWED_DISCOVERY_ROLES.includes(lu.role)) {
          userMap.set(toIdString(lu._id), lu);
        }
      }
    }

    const nodes = [];
    const addedIds = new Set();

    followerUserIds.forEach((id) => {
      if (addedIds.has(id)) return;
      const doc = userMap.get(id);
      if (!doc) return;
      addedIds.add(id);
      const nftCount = (doc.nftCertificates || []).filter(
        (n) => n.status === "confirmed"
      ).length;
      nodes.push({
        ...normalizePublicUser(doc, {
          relation: viewerFollowingMap.has(id) ? "mutual" : "follower",
          isFollowing: viewerFollowingMap.has(id),
          isFollower: true,
          stats: { followers: 0, following: 0 },
          nftCount,
          communityCount: (doc.communities || []).length,
          walletConnected: Boolean(doc.walletAddress),
        }),
      });
    });

    followingUserIds.forEach((id) => {
      if (addedIds.has(id)) return;
      const doc = userMap.get(id);
      if (!doc) return;
      addedIds.add(id);
      const nftCount = (doc.nftCertificates || []).filter(
        (n) => n.status === "confirmed"
      ).length;
      nodes.push({
        ...normalizePublicUser(doc, {
          relation: "following",
          isFollowing: true,
          isFollower: false,
          stats: { followers: 0, following: 0 },
          nftCount,
          communityCount: (doc.communities || []).length,
          walletConnected: Boolean(doc.walletAddress),
        }),
      });
    });

    const links = [];
    followerUserIds.forEach((id) => {
      if (id !== viewerId) {
        links.push({ source: id, target: userId });
      }
    });
    followingUserIds.forEach((id) => {
      if (id !== viewerId) {
        links.push({ source: userId, target: id });
      }
    });

    const [totalFollowers, totalFollowing] = await Promise.all([
      Follow.countDocuments({ following: userId }),
      Follow.countDocuments({ follower: userId }),
    ]);

    return res.json({
      nodes,
      edges: links,
      pagination: {
        page,
        limit,
        totalFollowers,
        totalFollowing,
        hasMore:
          skip + limit < Math.max(totalFollowers, totalFollowing),
      },
    });
  } catch (err) {
    console.error("expandNetwork error:", err);
    return res.status(500).json({ error: "Failed to expand network" });
  }
}

module.exports = { expandNetwork };
