const User = require("../../../database/models/User");
const Student = require("../../../database/models/Student");
const Teacher = require("../../../database/models/Teacher");
const AdminUser = require("../../../database/models/AdminUser");
const Admin = require("../../../database/models/Admin");

const ROLE_MODEL_MAP = {
  student: Student,
  teacher: Teacher,
  admin: AdminUser,
  community_manager: User,
};

function normalizeEmail(value) {
  if (!value || typeof value !== "string") {
    return "";
  }
  return value.trim().toLowerCase();
}

function getModelByRole(role) {
  return ROLE_MODEL_MAP[role] || User;
}

function toLegacyUserPayload(userDoc) {
  if (!userDoc) {
    return null;
  }

  const raw = typeof userDoc.toObject === "function" ? userDoc.toObject() : userDoc;
  const isApprovedTeacher = raw.role === "teacher" ? raw.approved !== false : true;

  return {
    publicId: raw.publicId || undefined,
    name: raw.name,
    gmail: normalizeEmail(raw.gmail),
    password: raw.password,
    role: raw.role || "student",
    collegeName: raw.collegeName || "",
    phone: raw.phone || "",
    approved: isApprovedTeacher,
    managedCommunity: raw.managedCommunity || null,
    walletAddress: raw.walletAddress || null,
    avatar: raw.avatar || null,
    communities: Array.isArray(raw.communities) ? raw.communities : [],
    completedTasks: Array.isArray(raw.completedTasks) ? raw.completedTasks : [],
    nftCertificates: Array.isArray(raw.nftCertificates) ? raw.nftCertificates : [],
  };
}

async function syncLegacyUserRecord(userDoc) {
  if (!userDoc?._id) {
    return null;
  }

  const payload = toLegacyUserPayload(userDoc);
  if (!payload) {
    return null;
  }

  // Try updating User by matching _id first
  let updated = await User.findByIdAndUpdate(
    userDoc._id,
    { $set: payload },
    { new: true }
  );

  // If no User found at that _id (cross-model mismatch: Student/Teacher _id != User _id),
  // try locating the existing User record by gmail or walletAddress
  if (!updated) {
    const lookupQuery = {};
    if (payload.gmail) {
      lookupQuery.gmail = payload.gmail;
    }
    if (payload.walletAddress) {
      lookupQuery.walletAddress = payload.walletAddress;
    }

    if (Object.keys(lookupQuery).length > 0) {
      const existingUser = await User.findOne({
        $or: Object.entries(lookupQuery).map(([key, val]) => ({ [key]: val })),
        _id: { $ne: userDoc._id },
      }).lean();

      if (existingUser) {
        updated = await User.findByIdAndUpdate(
          existingUser._id,
          { $set: payload },
          { new: true }
        );
      }
    }
  }

  // If still no match, upsert at the original _id (creates new User record)
  if (!updated) {
    updated = await User.findByIdAndUpdate(
      userDoc._id,
      {
        $set: payload,
        $setOnInsert: { _id: userDoc._id },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  return updated;
}

async function removeLegacyUserRecord(userId) {
  if (!userId) {
    return;
  }
  await User.findByIdAndDelete(userId);
}

function buildQueryById(model, userId, projection) {
  const query = model.findById(userId);
  if (projection) {
    query.select(projection);
  }
  return query;
}

async function findUserByRoleAndId({ role, userId, projection = null }) {
  if (!userId) {
    return null;
  }

  const primaryModel = getModelByRole(role);
  if (primaryModel) {
    const fromPrimary = await buildQueryById(primaryModel, userId, projection);
    if (fromPrimary) {
      return fromPrimary;
    }
  }

  if (primaryModel !== User) {
    const fallbackLegacy = await buildQueryById(User, userId, projection);
    if (fallbackLegacy) {
      return fallbackLegacy;
    }
  }

  return null;
}

async function findUserByAnyId(userId, projection = null) {
  if (!userId) {
    return null;
  }

  const orderedModels = [Student, Teacher, AdminUser, User, Admin];
  for (const model of orderedModels) {
    const found = await buildQueryById(model, userId, projection);
    if (found) {
      return found;
    }
  }

  return null;
}

/**
 * Resolve a user's wallet address across all models.
 * Strategy:
 * 1. Try by _id across all models — returns wallet if found at same _id.
 * 2. If no wallet found, try to find ANY gmail for this user across models
 *    (handles SIWE dual-ID where User model has empty gmail but Student has gmail).
 * 3. Fallback: search by resolved gmail across all models.
 * Returns the wallet address as a string, or null if not found.
 */
async function resolveWalletAcrossModels(userId, gmail = null) {
  if (!userId && !gmail) {
    return null;
  }

  // 1. Try by _id across all models (fast path: wallet on same _id)
  if (userId) {
    const models = [Student, Teacher, AdminUser, User, Admin];
    for (const model of models) {
      const doc = await model.findById(userId).select("walletAddress gmail").lean().catch(() => null);
      if (doc?.walletAddress?.trim()) {
        return doc.walletAddress.trim().toLowerCase();
      }
    }
  }

  // 2. If provided gmail is empty, try to extract gmail from any model by _id
  let resolvedGmail = gmail;
  if (!resolvedGmail && userId) {
    const models = [Student, Teacher, User, AdminUser, Admin];
    for (const model of models) {
      const doc = await model.findById(userId).select("gmail").lean().catch(() => null);
      if (doc?.gmail?.trim()) {
        resolvedGmail = doc.gmail.trim();
        break;
      }
    }
  }

  // 3. Fallback: search by gmail across all models (handles SIWE dual-ID case)
  if (resolvedGmail) {
    const normalizedGmail = normalizeEmail(resolvedGmail);
    if (normalizedGmail) {
      const models = [Student, Teacher, User, AdminUser, Admin];
      for (const model of models) {
        const doc = await model
          .findOne({ gmail: normalizedGmail })
          .select("walletAddress")
          .lean()
          .catch(() => null);
        if (doc?.walletAddress?.trim()) {
          // If found by gmail but on a different _id, sync to the requester's User record
          if (userId) {
            await User.findByIdAndUpdate(userId, { walletAddress: doc.walletAddress.trim().toLowerCase() }).catch(() => {});
          }
          return doc.walletAddress.trim().toLowerCase();
        }
      }
    }
  }

  return null;
}

async function findAccountByEmail(gmail) {
  const normalizedGmail = normalizeEmail(gmail);
  if (!normalizedGmail) {
    return null;
  }

  const [student, teacher, adminUser, pendingTeacher, legacyUser] = await Promise.all([
    Student.findOne({ gmail: normalizedGmail }),
    Teacher.findOne({ gmail: normalizedGmail }),
    AdminUser.findOne({ gmail: normalizedGmail }),
    Admin.findOne({ gmail: normalizedGmail }),
    User.findOne({ gmail: normalizedGmail }),
  ]);

  if (student) return { source: "student", user: student };
  if (teacher) return { source: "teacher", user: teacher };
  if (adminUser) return { source: "admin_user", user: adminUser };
  if (pendingTeacher) return { source: "pending_teacher", user: pendingTeacher };
  if (legacyUser) return { source: "legacy_user", user: legacyUser };

  return null;
}

module.exports = {
  getModelByRole,
  normalizeEmail,
  syncLegacyUserRecord,
  removeLegacyUserRecord,
  findUserByRoleAndId,
  findUserByAnyId,
  findAccountByEmail,
  resolveWalletAcrossModels,
};
