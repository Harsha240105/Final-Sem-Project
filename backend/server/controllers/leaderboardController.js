const mongoose = require("mongoose");
const Task = require("../../database/models/task.model");
const User = require("../../database/models/User");
const Community = require("../../database/models/Community");
const { findUserByAnyId, syncLegacyUserRecord } = require("../utils/userSync");

/**
 * GET /api/communities/:communityId/leaderboard
 * Get leaderboard for a community based on completed tasks
 */
async function getCommunityLeaderboard(req, res) {
  try {
    const communityId = req.params.communityId || req.params.id;

    if (!mongoose.Types.ObjectId.isValid(communityId)) {
      return res.status(400).json({ error: "Invalid community ID" });
    }

    const community = await Community.findById(communityId)
      .select("name members")
      .lean();

    if (!community) {
      return res.status(404).json({ error: "Community not found" });
    }

    const memberIds = community.members || [];

    const tasks = await Task.find({
      community_id: communityId,
      completed_status: true,
    })
      .select("assignedTo")
      .lean();

    const taskCountMap = {};
    tasks.forEach((task) => {
      const userId = task.assignedTo.toString();
      taskCountMap[userId] = (taskCountMap[userId] || 0) + 1;
    });

    const users = await User.find({
      _id: { $in: memberIds },
    })
      .select("_id name avatar gmail")
      .lean();

    const usersById = new Map(users.map((u) => [u._id.toString(), u]));
    const missingMemberIds = memberIds.filter((id) => !usersById.has(id.toString()));

    for (const missingId of missingMemberIds) {
      const resolved = await findUserByAnyId(missingId);
      if (!resolved) continue;

      if (resolved.collection?.name !== "users") {
        await syncLegacyUserRecord(resolved);
      }

      usersById.set(resolved._id.toString(), {
        _id: resolved._id,
        name: resolved.name,
        avatar: resolved.avatar || null,
        gmail: resolved.gmail,
      });
    }

    const mergedUsers = Array.from(usersById.values());

    const leaderboard = mergedUsers
      .map((user) => ({
        userId: user._id,
        name: user.name,
        email: user.gmail,
        avatar: user.avatar,
        tasksCompleted: taskCountMap[user._id.toString()] || 0,
      }))
      .sort((a, b) => b.tasksCompleted - a.tasksCompleted);

    res.json({
      success: true,
      community: {
        id: community._id,
        name: community.name,
      },
      leaderboard,
      totalMembers: leaderboard.length,
    });
  } catch (err) {
    console.error("getCommunityLeaderboard error:", err);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
}

module.exports = {
  getCommunityLeaderboard,
};
