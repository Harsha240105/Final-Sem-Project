const mongoose = require("mongoose");
const User = require("../../database/models/User");
const Student = require("../../database/models/Student");
const Teacher = require("../../database/models/Teacher");
const Follow = require("../../database/models/Follow");
const { findUserByAnyId } = require("../utils/userSync");

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
    verified: userDoc.approved === true || userDoc.verificationStatus === "verified",
    followerCount: userDoc.followerCount || 0,
    followingCount: userDoc.followingCount || 0,
    relation,
    isFollowing,
    isFollower,
  };
}

async function getUserPublicProfile(req, res) {
  try {
    const viewerId = req.user?.id;
    if (!viewerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const targetUser = await findUserByAnyId(
      userId,
      "publicId name role collegeName institutionType institutionName avatar banner bio displayName walletAddress followerCount followingCount verificationStatus createdAt communities nftCertificates"
    );
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const [isFollowing, isFollower, followerCount, followingCount] = await Promise.all([
      Follow.exists({ follower: viewerId, following: userId }),
      Follow.exists({ follower: userId, following: viewerId }),
      Follow.countDocuments({ following: userId }),
      Follow.countDocuments({ follower: userId }),
    ]);

    let mutualConnections = 0;
    try {
      const viewerFollowers = await Follow.distinct("follower", { following: viewerId });
      if (viewerFollowers.length > 0) {
        mutualConnections = await Follow.countDocuments({
          following: userId,
          follower: { $in: viewerFollowers },
        });
      }
    } catch (err) {
      // Gracefully handle if calculation fails
    }

    const nftCount = (targetUser.nftCertificates || []).filter((n) => n.status === "confirmed").length;
    const communityCount = (targetUser.communities || []).length;

    let communities = [];
    if (targetUser.communities && targetUser.communities.length > 0) {
      const Community = mongoose.model("Community");
      const communitiesToPopulate = targetUser.communities.slice(-5);
      communities = await Community.find({ _id: { $in: communitiesToPopulate } })
        .select("name image")
        .lean();
    }

    const recentCertificates = (targetUser.nftCertificates || [])
      .filter((n) => n.status === "confirmed")
      .slice(-5)
      .map((n) => n.communityName || n.certificateId);

    const user = {
      publicId: targetUser.publicId || null,
      name: targetUser.name || "Unknown",
      role: targetUser.role || "student",
      collegeName: targetUser.collegeName || "",
      institutionType: targetUser.institutionType || "",
      institutionName: targetUser.institutionName || "",
      avatar: targetUser.avatar || null,
      banner: targetUser.banner || null,
      bio: targetUser.bio || "",
      displayName: targetUser.displayName || "",
      walletAddress: targetUser.walletAddress || null,
      followerCount: targetUser.followerCount || 0,
      followingCount: targetUser.followingCount || 0,
      verificationStatus: targetUser.verificationStatus || "pending",
      createdAt: targetUser.createdAt || null,
      isFollowing: Boolean(isFollowing),
      isFollower: Boolean(isFollower),
      isMutual: Boolean(isFollowing && isFollower),
    };

    return res.json({
      user,
      stats: {
        followers: followerCount,
        following: followingCount,
        nftCount,
        communityCount,
        mutualConnections,
      },
      communities,
      recentCertificates,
    });
  } catch (err) {
    console.error("getUserPublicProfile error:", err);
    return res.status(500).json({ error: "Failed to load user profile" });
  }
}

async function getUserFollowers(req, res) {
  try {
    const viewerId = req.user?.id;
    if (!viewerId) return res.status(401).json({ error: "Unauthorized" });

    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      Follow.find({ following: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("follower", "publicId name role collegeName institutionType institutionName avatar walletAddress approved communities nftCertificates")
        .lean(),
      Follow.countDocuments({ following: userId }),
    ]);

    const viewerFollowing = await Follow.find({ follower: viewerId }).select("following").lean();
    const viewerFollowingSet = new Set(viewerFollowing.map((f) => toIdString(f.following)));

    const followers = records
      .filter((r) => r.follower && toIdString(r.follower._id) !== userId)
      .map((r) =>
        normalizePublicUser(r.follower, {
          isFollowing: viewerFollowingSet.has(toIdString(r.follower._id)),
          isFollower: true,
        })
      );

    return res.json({
      followers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("getUserFollowers error:", err);
    return res.status(500).json({ error: "Failed to load followers" });
  }
}

async function getUserFollowing(req, res) {
  try {
    const viewerId = req.user?.id;
    if (!viewerId) return res.status(401).json({ error: "Unauthorized" });

    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      Follow.find({ follower: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("following", "publicId name role collegeName institutionType institutionName avatar walletAddress approved communities nftCertificates")
        .lean(),
      Follow.countDocuments({ follower: userId }),
    ]);

    const viewerFollowing = await Follow.find({ follower: viewerId }).select("following").lean();
    const viewerFollowingSet = new Set(viewerFollowing.map((f) => toIdString(f.following)));

    const following = records
      .filter((r) => r.following && toIdString(r.following._id) !== userId)
      .map((r) =>
        normalizePublicUser(r.following, {
          isFollowing: true,
          isFollower: viewerFollowingSet.has(toIdString(r.following._id)),
          relation: viewerFollowingSet.has(toIdString(r.following._id)) ? "mutual" : "following",
        })
      );

    return res.json({
      following,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("getUserFollowing error:", err);
    return res.status(500).json({ error: "Failed to load following" });
  }
}

async function getUserMutuals(req, res) {
  try {
    const viewerId = req.user?.id;
    if (!viewerId) return res.status(401).json({ error: "Unauthorized" });

    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const viewerFollowers = await Follow.find({ following: viewerId }).select("follower").lean();
    const viewerFollowerIds = viewerFollowers.map((r) => r.follower);

    if (viewerFollowerIds.length === 0) {
      return res.json({ mutuals: [], pagination: { page, limit, total: 0, totalPages: 0 } });
    }

    const [records, total] = await Promise.all([
      Follow.find({
        follower: { $in: viewerFollowerIds },
        following: userId,
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("follower", "publicId name role collegeName institutionType institutionName avatar walletAddress approved communities nftCertificates")
        .lean(),
      Follow.countDocuments({
        follower: { $in: viewerFollowerIds },
        following: userId,
      }),
    ]);

    const mutuals = records
      .filter((r) => r.follower)
      .map((r) =>
        normalizePublicUser(r.follower, {
          isFollowing: true,
          isFollower: true,
          relation: "mutual",
        })
      );

    return res.json({
      mutuals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("getUserMutuals error:", err);
    return res.status(500).json({ error: "Failed to load mutual connections" });
  }
}

async function getLeaderboard(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const { role } = req.query;

    const matchStage = {
      role: { $in: ["student", "teacher", "community_manager"] },
    };
    if (role && ["student", "teacher", "community_manager"].includes(role)) {
      matchStage.role = role;
    }

    const [users, total] = await Promise.all([
      User.aggregate([
        { $match: matchStage },
        {
          $addFields: {
            followerCountNum: { $ifNull: ["$followerCount", 0] },
            followingCountNum: { $ifNull: ["$followingCount", 0] },
          },
        },
        { $sort: { followerCountNum: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            publicId: 1,
            name: 1,
            role: 1,
            collegeName: 1,
            institutionType: 1,
            institutionName: 1,
            avatar: 1,
            walletAddress: 1,
            followerCount: "$followerCountNum",
            followingCount: "$followingCountNum",
            communityCount: { $size: { $ifNull: ["$communities", []] } },
            nftCount: {
              $size: {
                $filter: {
                  input: { $ifNull: ["$nftCertificates", []] },
                  as: "nft",
                  cond: { $eq: ["$$nft.status", "confirmed"] },
                },
              },
            },
          },
        },
      ]),
      User.countDocuments(matchStage),
    ]);

    return res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("getLeaderboard error:", err);
    return res.status(500).json({ error: "Failed to load leaderboard" });
  }
}

module.exports = {
  getUserPublicProfile,
  getUserFollowers,
  getUserFollowing,
  getUserMutuals,
  getLeaderboard,
};
