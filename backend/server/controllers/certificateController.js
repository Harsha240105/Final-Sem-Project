const User = require("../../../database/models/User");
const Student = require("../../../database/models/Student");
const Teacher = require("../../../database/models/Teacher");
const Community = require("../../../database/models/Community");
const Certificate = require("../../../database/models/Certificate");
const NFTJobQueue = require("../../../database/models/NFTJobQueue");
const { findUserByRoleAndId, findUserByAnyId } = require("../utils/userSync");
const { verifyCertificateOnChain } = require("../../services/blockchain/nftService");
const { CONTRACT_ADDRESS } = require("../../services/blockchain/contractAddress");
const { uploadCertificateToIPFS } = require("../../services/blockchain/ipfsService");
const { generateCertificate } = require("../utils/certificateGenerator");
const { createNotification } = require("./notificationController");

function normalizeCertificates(nftCertificates = []) {
  return nftCertificates
    .slice()
    .sort(
      (left, right) =>
        new Date(right?.mintedAt || right?.issuedAt || 0) -
        new Date(left?.mintedAt || left?.issuedAt || 0)
    )
    .map((cert) => ({
      certificateId: cert.certificateId,
      communityName: cert.communityName,
      communityId: cert.communityId?._id || cert.communityId,
      collegeName: cert.communityId?.college_name,
      imageURI: cert.imageURI,
      metadataURI: cert.metadataURI,
      txHash: cert.transactionHash || cert.txHash,
      tokenId: cert.tokenId,
      issuedAt: cert.issuedAt,
      mintedAt: cert.mintedAt,
      status: cert.status,
      claimed: cert.claimed,
    }));
}

async function findCertificateOwner(certificateId) {
  const query = { "nftCertificates.certificateId": certificateId };
  const projection = "name walletAddress role nftCertificates";

  const [student, teacher, legacyUser] = await Promise.all([
    Student.findOne(query).select(projection).lean(),
    Teacher.findOne(query).select(projection).lean(),
    User.findOne(query).select(projection).lean(),
  ]);

  return student || teacher || legacyUser || null;
}

async function resolveUserForCertificateRead(reqUser, projection) {
  const roleAwareUser = await findUserByRoleAndId({
    role: reqUser?.role,
    userId: reqUser?.id,
    projection,
  });

  if (!roleAwareUser) {
    return null;
  }

  const hasRoleAwareCertificates =
    Array.isArray(roleAwareUser.nftCertificates) && roleAwareUser.nftCertificates.length > 0;

  if (hasRoleAwareCertificates) {
    return roleAwareUser;
  }

  const legacyUser = await User.findById(reqUser?.id).select(projection);
  if (legacyUser && Array.isArray(legacyUser.nftCertificates) && legacyUser.nftCertificates.length > 0) {
    return legacyUser;
  }

  return roleAwareUser;
}

async function getUserCertificates(req, res) {
  try {
    const userId = req.user.id;
    let userWallet = req.user?.walletAddress;

    // Resolve wallet from legacy models if not on the User model
    if (!userWallet) {
      try {
        const fullUser = await findUserByAnyId(userId, "walletAddress");
        if (fullUser?.walletAddress?.trim()) {
          userWallet = fullUser.walletAddress.trim().toLowerCase();
        }
      } catch (e) {
        // non-blocking
      }
    }

    console.log(`[getUserCertificates] userId=${userId} wallet=${userWallet || "none"}`);

    let certs = await Certificate.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    // Fallback: try by wallet if no certs found by userId
    if (certs.length === 0 && userWallet) {
      console.log(`[getUserCertificates] No certs by userId, trying wallet fallback: ${userWallet}`);
      const walletCerts = await Certificate.find({ walletAddress: userWallet })
        .sort({ createdAt: -1 })
        .lean();
      if (walletCerts.length > 0) {
        console.log(`[getUserCertificates] Found ${walletCerts.length} cert(s) by wallet fallback`);
        certs = walletCerts;
      }
    }



    const formatted = certs.map((cert) => ({
      _id: cert._id,
      certificateId: cert.certificateId,
      communityName: cert.communityName || "",
      communityId: cert.communityId,
      collegeName: cert.collegeName || "",
      imageURI: cert.imageURI,
      imageHTTPS: cert.imageHTTPS,
      metadataURI: cert.metadataURI,
      tokenURI: cert.tokenURI,
      tokenId: cert.tokenId,
      txHash: cert.txHash || cert.transactionHash,
      contractAddress: cert.contractAddress || CONTRACT_ADDRESS || "",
      issuedAt: cert.issuedAt,
      mintedAt: cert.mintedAt,
      status: cert.status,
      claimed: cert.claimed,
      walletClaimed: cert.walletClaimed,
      claimedAt: cert.claimedAt,
      createdAt: cert.createdAt,
    }));

    return res.json(formatted);
  } catch (err) {
    console.error(`[Get Certificates] Error for user=${req.user?.id}:`, err);
    res.status(500).json({ error: "Failed to fetch certificates" });
  }
}

async function getUserCertificatesArray(req, res) {
  try {
    const userId = req.user?.id;
    let userWallet = req.user?.walletAddress;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Resolve wallet from legacy models if not on the User model
    if (!userWallet) {
      try {
        const fullUser = await findUserByAnyId(userId, "walletAddress");
        if (fullUser?.walletAddress?.trim()) {
          userWallet = fullUser.walletAddress.trim().toLowerCase();
        }
      } catch (e) {
        // non-blocking
      }
    }

    console.log(`[getUserCertificatesArray] Fetching certificates for user=${userId} wallet=${userWallet || "none"}`);

    let certDocs = await Certificate.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    // FALLBACK: If no certs found by userId, try by wallet address.
    // This handles the case where User and Student/Teacher documents
    // have different _id values, causing a userId mismatch between
    // certificate storage (from community.members populate) and querying
    // (from JWT decoded.id).
    if (certDocs.length === 0 && userWallet) {
      console.log(`[getUserCertificatesArray] No certs by userId, trying wallet fallback: ${userWallet}`);
      const walletCerts = await Certificate.find({ walletAddress: userWallet })
        .sort({ createdAt: -1 })
        .lean();
      if (walletCerts.length > 0) {
        console.log(`[getUserCertificatesArray] Found ${walletCerts.length} cert(s) by wallet fallback`);
        certDocs = walletCerts;
      }
    }



    const certs = certDocs.map((cert) => ({
      _id: cert._id,
      certificateId: cert.certificateId,
      communityName: cert.communityName || (cert.communityId?.name || ""),
      communityId: cert.communityId?._id || cert.communityId,
      collegeName: cert.collegeName,
      imageURI: cert.imageURI,
      imageHTTPS: cert.imageHTTPS,
      metadataURI: cert.metadataURI,
      tokenURI: cert.tokenURI,
      tokenId: cert.tokenId,
      txHash: cert.txHash || cert.transactionHash,
      contractAddress: cert.contractAddress || CONTRACT_ADDRESS || "",
      issuedAt: cert.issuedAt,
      mintedAt: cert.mintedAt,
      status: cert.status,
      claimed: cert.claimed,
      walletClaimed: cert.walletClaimed,
      claimedAt: cert.claimedAt,
      createdAt: cert.createdAt,
    }));

    return res.json(certs);
  } catch (err) {
    console.error("[getUserCertificatesArray] ERROR:", err);
    return res.status(500).json({ error: "Failed to fetch certificates" });
  }
}

async function verifyCertificate(req, res) {
  try {
    const { certificateId } = req.params;

    if (!certificateId || certificateId.trim() === "") {
      return res.status(400).json({ error: "Certificate ID is required" });
    }
    const cert = await Certificate.findOne({ certificateId }).lean();
    if (!cert) {
      return res.status(404).json({ error: "Certificate not found" });
    }

    const user = await User.findById(cert.userId).select("name walletAddress").lean();
    const community = cert.communityId ? await Community.findById(cert.communityId).select("name college_name").lean() : null;

    const onChain = cert.tokenId
      ? await verifyCertificateOnChain({
          tokenId: cert.tokenId,
          expectedOwner: user?.walletAddress || null,
          expectedMetadataURI: cert.metadataURI || null,
        })
      : {
          exists: false,
          verified: false,
          reason: "Missing tokenId",
        };

    const certificateData = {
      certificateId: cert.certificateId,
      studentName: user?.name,
      communityName: cert.communityName || community?.name,
      collegeName: community?.college_name,
      tokenId: cert.tokenId,
      txHash: cert.txHash || cert.transactionHash,
      metadataURI: cert.metadataURI,
      imageURI: cert.imageURI,
      imageHTTPS: cert.imageHTTPS,
      issuedAt: cert.issuedAt,
      verified: Boolean(onChain.verified),
      walletAddress: user?.walletAddress || null,
      onChain,
      verificationUrl: `${process.env.FRONTEND_URL || "http://localhost:5173"}/verify/${certificateId}`,
    };

    res.json({
      success: true,
      certificate: certificateData,
    });
  } catch (err) {
    console.error("verifyCertificate error:", err);
    res.status(500).json({ error: "Failed to verify certificate" });
  }
}

async function saveCertificateAfterMint(req, res) {
  try {
    const {
      certificateId,
      communityId,
      communityName,
      collegeName,
      walletAddress,
      tokenId,
      txHash,
      tokenURI,
      imageURI,
      imageHTTPS,
      metadataURI,
      taskId,
    } = req.body;

    if (!certificateId || !tokenId || !txHash || !walletAddress) {
      return res.status(400).json({
        error: "Missing required fields: certificateId, tokenId, txHash, walletAddress",
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    console.log(`[Certificate Save] Attempt for user=${userId}, cert=${certificateId}, tokenId=${tokenId}`);

    const existingCert = await Certificate.findOne({ certificateId, userId }).lean();

    if (existingCert) {
      console.log(`[Certificate Save] Certificate ${certificateId} already exists for user ${userId}, skipping duplicate`);
      return res.json({ success: true, message: "Certificate already exists", certificate: existingCert });
    }

    const certDoc = {
      certificateId,
      userId,
      taskId,
      communityId,
      communityName,
      collegeName,
      walletAddress,
      tokenId,
      transactionHash: txHash,
      txHash,
      contractAddress: CONTRACT_ADDRESS || "",
      tokenURI: tokenURI || metadataURI,
      metadataURI: metadataURI || tokenURI,
      imageURI,
      imageHTTPS: imageHTTPS || "",
      issuedAt: new Date(),
      mintedAt: new Date(),
      status: "completed",
      claimed: true,
      walletClaimed: true,
      claimedAt: new Date(),
      blockNumber: null,
      gasUsed: null,
    };

    const created = await Certificate.create(certDoc);
    console.log(`[Certificate Save] Created Certificate document: ${certificateId} for user ${userId}`);

    res.status(201).json({
      success: true,
      message: "Certificate created",
      certificate: created,
    });
  } catch (err) {
    console.error(`[Certificate Save] ERROR: ${err.message}`, err);
    res.status(500).json({
      error: "Failed to save certificate",
      details: err.message,
      code: err.code || "unknown_error",
    });
  }
}

async function syncCertificateStatus(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const certs = await Certificate.find({ userId }).lean();
    console.log(`[SYNC] Checking ${certs.length} certificates for user ${userId}`);

    let updatedCount = 0;

    for (const cert of certs) {
      if (!cert.tokenId || cert.status === "completed") {
        continue;
      }

      try {
        const onChain = await verifyCertificateOnChain({
          tokenId: cert.tokenId,
          expectedOwner: cert.walletAddress || null,
          expectedMetadataURI: cert.metadataURI || null,
        });

        if (onChain.exists && onChain.verified) {
          await Certificate.findByIdAndUpdate(cert._id, {
            $set: {
              status: "completed",
              claimed: true,
              walletClaimed: true,
              claimedAt: cert.claimedAt || new Date(),
            },
          });
          updatedCount++;
          console.log(`[SYNC] Updated cert ${cert.certificateId} to completed`);
        }
      } catch (err) {
        console.log(`[SYNC] Could not verify cert ${cert.certificateId}: ${err.message}`);
      }
    }

    console.log(`[SYNC] Updated ${updatedCount} certificates to completed`);

    const updated = await Certificate.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    const formatted = updated.map((cert) => ({
      _id: cert._id,
      certificateId: cert.certificateId,
      communityName: cert.communityName || "",
      communityId: cert.communityId,
      collegeName: cert.collegeName || "",
      imageURI: cert.imageURI,
      imageHTTPS: cert.imageHTTPS,
      metadataURI: cert.metadataURI,
      tokenURI: cert.tokenURI,
      tokenId: cert.tokenId,
      txHash: cert.txHash || cert.transactionHash,
      contractAddress: cert.contractAddress || CONTRACT_ADDRESS || "",
      issuedAt: cert.issuedAt,
      mintedAt: cert.mintedAt,
      status: cert.status,
      claimed: cert.claimed,
      walletClaimed: cert.walletClaimed,
      claimedAt: cert.claimedAt,
      createdAt: cert.createdAt,
    }));

    res.json(formatted);
  } catch (err) {
    console.error(`[SYNC] Error:`, err);
    res.status(500).json({ error: "Failed to sync certificate status" });
  }
}

async function getMintProgress(req, res) {
  try {
    const userId = req.user.id;
    const jobs = await NFTJobQueue.find({ userId })
      .sort({ queuedAt: -1 })
      .limit(10)
      .lean();

    const active = jobs.filter(j => ["pending", "generating_metadata", "uploading_ipfs", "minting", "confirming", "retrying"].includes(j.status));
    const completed = jobs.filter(j => j.status === "completed");
    const failed = jobs.filter(j => j.status === "failed");

    res.json({
      active,
      completed,
      failed,
      totalJobs: jobs.length,
    });
  } catch (err) {
    console.error("[getMintProgress] Error:", err);
    res.status(500).json({ error: "Failed to fetch mint progress" });
  }
}

module.exports = {
  getUserCertificates,
  getUserCertificatesArray,
  verifyCertificate,
  saveCertificateAfterMint,
  syncCertificateStatus,
  async debugGetUserCertificatesRaw(req, res) {
    try {
      const userId = req.user?.id;
      const student = await Student.findById(userId).select("nftCertificates name role");
      const teacher = await Teacher.findById(userId).select("nftCertificates name role");
      const user = await User.findById(userId).select("nftCertificates name role");

      const userRecord = student || teacher || user;

      if (!userRecord) {
        return res.status(404).json({ error: "User not found in any model" });
      }

      const certs = userRecord.nftCertificates || [];


      res.json({
        debug: true,
        user: {
          id: userRecord._id,
          name: userRecord.name,
          model: userRecord.constructor.modelName,
          role: userRecord.role,
        },
        certificates: certs,
        count: certs.length,
        raw: {
          studentFound: !!student,
          teacherFound: !!teacher,
          userFound: !!user,
          nftCertificatesField: Array.isArray(userRecord.nftCertificates),
        },
      });
    } catch (err) {
      console.error(`[DEBUG] Error:`, err);
      res.status(500).json({ error: err.message, stack: err.stack });
    }
  },

  async debugCheckCertificateCollection(req, res) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const certDocs = await Certificate.find({ userId })
        .sort({ createdAt: -1 })
        .lean();

      const totalCount = await Certificate.countDocuments({ userId });
      const allCertsCount = await Certificate.countDocuments();
      const allUsersWithCerts = await Certificate.distinct("userId");

      res.json({
        debug: true,
        debugType: "certificate_collection_check",
        user: {
          id: userId,
          name: req.user?.name,
        },
        certificates: certDocs.map((c) => ({
          _id: c._id,
          certificateId: c.certificateId,
          tokenId: c.tokenId,
          status: c.status,
          claimed: c.claimed,
          communityName: c.communityName,
          txHash: c.txHash?.substring(0, 20) + "...",
          issuedAt: c.issuedAt,
          createdAt: c.createdAt,
        })),
        summary: {
          certificatesForThisUser: totalCount,
          certificatesReturned: certDocs.length,
          totalCertificatesInDatabase: allCertsCount,
          usersWithCertificates: allUsersWithCerts.length,
        },
        verification: {
          databaseConnected: true,
          collectionName: Certificate.collection.name,
          recordsMatch: totalCount === certDocs.length,
        },
      });
    } catch (err) {
      console.error(`[DEBUG CERT COLLECTION] Error:`, err);
      res.status(500).json({
        error: err.message,
        stack: err.stack,
        debug: true,
      });
    }
  },

  getMintProgress,

  refreshCertificateMetadata: async (req, res) => {
    try {
      const { certificateId } = req.params;
      const userId = req.user.id || req.user._id?.toString();

      const cert = await Certificate.findOne({ certificateId, userId }).lean();
      if (!cert) {
        return res.status(404).json({ error: "Certificate not found" });
      }

      const community = await Community.findById(cert.communityId).lean();
      if (!community) {
        return res.status(404).json({ error: "Community not found" });
      }

      const member = await findUserByAnyId(userId);
      if (!member) {
        return res.status(404).json({ error: "User not found" });
      }

      const certificatePath = await generateCertificate({
        studentName: member.name || cert.communityName,
        communityName: cert.communityName,
        collegeName: cert.collegeName || community.college_name || "Virtual Campus",
        certificateId: cert.certificateId,
      });

      const { metadataURI, imageURI, imageHTTPS, metadataHTTPS } = await uploadCertificateToIPFS({
        certificatePath,
        studentName: member.name || cert.communityName,
        communityName: cert.communityName,
        collegeName: cert.collegeName || community.college_name || "Virtual Campus",
        certificateId: cert.certificateId,
      });

      await Certificate.findByIdAndUpdate(cert._id, {
        $set: {
          metadataURI,
          metadataHTTPS,
          tokenURI: metadataURI,
          imageURI,
          imageHTTPS,
        },
      });

      res.json({
        success: true,
        message: "Metadata refreshed successfully. Refresh in MetaMask to see updated image.",
        metadataURI,
        metadataHTTPS,
        imageHTTPS,
      });
    } catch (err) {
      console.error("[REFRESH METADATA] Error:", err);
      res.status(500).json({ error: err.message });
    }
  },
};
