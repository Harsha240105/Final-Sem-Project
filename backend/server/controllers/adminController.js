const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const User = require("../../database/models/User");

const JWT_SECRET = process.env.JWT_SECRET;
const AdminUser = require("../../database/models/AdminUser");
const Admin = require("../../database/models/Admin");
const Teacher = require("../../database/models/Teacher");
const Student = require("../../database/models/Student");
const Organisation = require("../../database/models/Organisation");
const {
  sendTeacherApprovedEmail,
  sendTeacherRejectedEmail,
  sendVerificationSuccessEmail,
} = require("../notifications/emailService");
const {
  sendTeacherApprovedSms,
  sendTeacherRejectedSms,
  sendVerificationSuccessSms,
} = require("../notifications/smsService");
const { createNotification } = require("./notificationController");
const {
  normalizeEmail,
  findAccountByEmail,
  syncLegacyUserRecord,
} = require("../utils/userSync");

/**
 * POST /api/admin/create
 * Create a new admin account (protected by ADMIN_SECRET)
 */
const createAdmin = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: "Validation failed", details: errors.array() });
    }

    const { name, email, password, secret, adminSecret } = req.body;
    const providedSecret = adminSecret || secret;

    // 1. Verify admin secret
    if (!providedSecret || providedSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // 2. Check if email already exists
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return res.status(400).json({ error: "Valid email is required" });
    }

    const existingUser = await findAccountByEmail(normalizedEmail);
    if (existingUser) {
      return res.status(409).json({ error: "Email already registered with another account" });
    }

    // 3. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Create admin user
    const adminUser = await AdminUser.create({
      name,
      gmail: normalizedEmail,
      password: hashedPassword,
      role: "admin",
      approved: true,
    });

    await syncLegacyUserRecord(adminUser);

    return res.status(201).json({
      message: "Admin account created successfully",
      data: {
        id: adminUser._id,
        name: adminUser.name,
        gmail: adminUser.gmail,
        role: adminUser.role,
        createdAt: adminUser.createdAt,
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/admin/dashboard
 * Protected admin-only route example
 */
const getDashboard = async (req, res, next) => {
  try {
    const totalStudents = await Student.countDocuments();
    const totalTeachers = await Teacher.countDocuments();
    const totalAdmins = await AdminUser.countDocuments();
    const pendingTeachers = await Admin.countDocuments();
    const totalUsers = totalStudents + totalTeachers + totalAdmins + pendingTeachers;

    return res.status(200).json({
      message: "Admin dashboard data",
      data: {
        admin: {
          id: req.user._id,
          name: req.user.name,
          gmail: req.user.gmail,
        },
        stats: {
          totalUsers,
          totalAdmins,
          totalStudents,
          totalTeachers,
          pendingTeachers,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/admin/pending-teachers
 * List all teachers pending admin approval
 */
const getPendingTeachers = async (req, res, next) => {
  try {
    // Teachers in User collection pending approval
    const pendingFromUser = await User.find(
      { role: "teacher", $or: [{ approved: false }, { verificationStatus: "pending_approval" }, { verificationStatus: "rejected" }] },
      "name displayName walletAddress did collegeName phone createdAt verificationStatus verificationSubmitted fullName employeeId collegeEmail collegeIdImage signatureImage countryCode registrationNumber"
    ).lean();

    // Teachers in Teacher collection not yet approved
    const pendingFromTeacher = await Teacher.find(
      { $or: [{ approvalStatus: "pending" }, { approvalStatus: "rejected" }, { approved: false }] },
      "name displayName walletAddress did collegeName phone createdAt approvalStatus verificationSubmitted fullName employeeId collegeEmail collegeIdImage signatureImage countryCode"
    ).lean();

    // Teachers in Admin (pending) collection
    const pendingFromAdmin = await Admin.find(
      {},
      "name gmail collegeName phone walletAddress createdAt"
    ).lean();

    const pending = [
      ...pendingFromUser.map(t => ({ ...t, source: "user" })),
      ...pendingFromTeacher.map(t => ({ ...t, source: "teacher" })),
      ...pendingFromAdmin.map(t => ({ ...t, source: "admin", gmail: t.gmail })),
    ];

    // Remove duplicates by walletAddress
    const seen = new Set();
    const unique = pending.filter(t => {
      const key = t.walletAddress || t._id.toString();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return res.json({ data: unique });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/admin/approve-teacher/:id
 * Approve a teacher by ID (from User, Teacher, or Admin collection)
 */
const approveTeacher = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    // Try User collection
    let teacher = await User.findById(id);
    if (teacher && teacher.role === "teacher") {
      teacher.approved = true;
      teacher.verificationStatus = "verified";
      teacher.onboardingCompleted = true;
      teacher.approvedAt = new Date();
      teacher.approvedBy = adminId;
      teacher.verificationSubmitted = true;
      await teacher.save();
      // Also update Teacher collection record
      await Teacher.findOneAndUpdate(
        { walletAddress: teacher.walletAddress },
        { $set: { approved: true, approvalStatus: "approved", approvedAt: new Date(), approvedBy: adminId } }
      );
      // Send notification
      if (teacher.collegeEmail) {
        await sendTeacherApprovedEmail(teacher.collegeEmail, teacher.fullName || teacher.name);
      } else if (teacher.phone) {
        await sendTeacherApprovedSms(teacher.phone, teacher.fullName || teacher.name);
      }
      await createNotification({
        userId: teacher._id,
        message: "Your teacher application has been approved! You can now access the platform.",
        type: "general",
        redirectUrl: "/",
      });
      return res.json({ message: "Teacher approved successfully", data: { id: teacher._id, name: teacher.name } });
    }

    // Try Teacher collection
    teacher = await Teacher.findById(id);
    if (teacher) {
      teacher.approvalStatus = "approved";
      teacher.approved = true;
      teacher.approvedAt = new Date();
      teacher.approvedBy = adminId;
      await teacher.save();
      // Also update User collection record
      await User.findOneAndUpdate(
        { walletAddress: teacher.walletAddress },
        { $set: { approved: true, verificationStatus: "verified", onboardingCompleted: true, verificationSubmitted: true, approvedAt: new Date(), approvedBy: adminId } }
      );
      // Send notification
      if (teacher.collegeEmail) {
        await sendTeacherApprovedEmail(teacher.collegeEmail, teacher.fullName || teacher.name);
      } else if (teacher.phone) {
        await sendTeacherApprovedSms(teacher.phone, teacher.fullName || teacher.name);
      }
      const userRecord = await User.findOne({ walletAddress: teacher.walletAddress });
      await createNotification({
        userId: userRecord?._id || teacher._id,
        message: "Your teacher application has been approved! You can now access the platform.",
        type: "general",
        redirectUrl: "/",
      });
      return res.json({ message: "Teacher approved successfully", data: { id: teacher._id, name: teacher.name } });
    }

    // Try Admin (pending) collection
    const pendingTeacher = await Admin.findById(id);
    if (pendingTeacher) {
      // Create in Teacher collection
      const newTeacher = await Teacher.create({
        name: pendingTeacher.name,
        gmail: pendingTeacher.gmail,
        password: pendingTeacher.password,
        role: "teacher",
        collegeName: pendingTeacher.collegeName || "",
        phone: pendingTeacher.phone || "",
        walletAddress: pendingTeacher.walletAddress || "",
        approvalStatus: "approved",
        approved: true,
        approvedAt: new Date(),
        approvedBy: adminId,
      });
      // Delete from pending
      await Admin.findByIdAndDelete(id);
      // Also update/create in User collection
      await User.findOneAndUpdate(
        { walletAddress: pendingTeacher.walletAddress },
        { $set: { role: "teacher", approved: true, verificationStatus: "verified", onboardingCompleted: true, verificationSubmitted: true, name: pendingTeacher.name, collegeName: pendingTeacher.collegeName } },
        { upsert: true }
      );
      // Send notification
      if (pendingTeacher.gmail) {
        await sendTeacherApprovedEmail(pendingTeacher.gmail, pendingTeacher.name);
      } else if (pendingTeacher.phone) {
        await sendTeacherApprovedSms(pendingTeacher.phone, pendingTeacher.name);
      }
      return res.json({ message: "Teacher approved successfully", data: { id: newTeacher._id, name: newTeacher.name } });
    }

    return res.status(404).json({ error: "Teacher not found" });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/admin/reject-teacher/:id
 * Reject and remove a teacher application
 */
const rejectTeacher = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Find teacher details
    let teacher = await User.findById(id);
    let teacherFromTeacherColl = null;
    if (!teacher || teacher.role !== "teacher") {
      teacherFromTeacherColl = await Teacher.findById(id);
    }

    const teacherName = teacher?.fullName || teacher?.name || teacherFromTeacherColl?.fullName || teacherFromTeacherColl?.name || "Teacher";
    const teacherEmail = teacher?.collegeEmail || teacher?.gmail || teacherFromTeacherColl?.collegeEmail || null;
    const teacherPhone = teacher?.phone || teacherFromTeacherColl?.phone || null;

    // Send rejection notification
    if (teacherEmail) {
      await sendTeacherRejectedEmail(teacherEmail, teacherName);
    } else if (teacherPhone) {
      await sendTeacherRejectedSms(teacherPhone, teacherName);
    }

    // Set rejected status instead of deleting — teacher can resubmit
    if (teacher && teacher.role === "teacher") {
      teacher.verificationStatus = "rejected";
      teacher.approved = false;
      await teacher.save();
      // Also update Teacher collection
      await Teacher.findOneAndUpdate(
        { walletAddress: teacher.walletAddress },
        { $set: { approvalStatus: "rejected", approved: false } }
      );
      await createNotification({
        userId: teacher._id,
        message: "Your teacher application has been rejected. You can resubmit.",
        type: "general",
        redirectUrl: "/verify-teacher",
      });
    } else if (teacherFromTeacherColl) {
      teacherFromTeacherColl.approvalStatus = "rejected";
      teacherFromTeacherColl.approved = false;
      await teacherFromTeacherColl.save();
      // Also update User collection
      await User.findOneAndUpdate(
        { walletAddress: teacherFromTeacherColl.walletAddress },
        { $set: { verificationStatus: "rejected", approved: false } }
      );
      const teacherUser = await User.findOne({ walletAddress: teacherFromTeacherColl.walletAddress });
      await createNotification({
        userId: teacherUser?._id || teacherFromTeacherColl._id,
        message: "Your teacher application has been rejected. You can resubmit.",
        type: "general",
        redirectUrl: "/verify-teacher",
      });
    }

    console.log(`[ADMIN] Teacher ${teacherName} (${id}) rejected by admin ${req.user._id}`);
    return res.json({ message: "Teacher application rejected. Teacher can resubmit." });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/admin/pending-students
 * List students with pending or rejected verification status
 */
const getPendingStudents = async (req, res, next) => {
  try {
    const students = await Student.find(
      { verificationStatus: { $in: ["pending", "rejected", "error"] } },
      "name fullName displayName walletAddress collegeName phone collegeEmail registrationNumber countryCode verificationStatus verificationError verificationSubmitted collegeIdImage signatureImage createdAt"
    ).lean();

    // Also fetch from User collection for students not in Student collection
    const userStudents = await User.find(
      { role: "student", verificationStatus: { $in: ["pending", "rejected", "error"] } },
      "name fullName displayName walletAddress collegeName phone collegeEmail registrationNumber countryCode verificationStatus verificationError verificationSubmitted collegeIdImage signatureImage createdAt"
    ).lean();

    const seen = new Set();
    const merged = [...students, ...userStudents].filter(s => {
      const key = s.walletAddress || s._id.toString();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return res.json({ data: merged });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/admin/approve-student/:id
 * Force-approve a student verification (bypass AI OCR)
 */
const approveStudent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    let student = await Student.findById(id);
    if (student) {
      student.verificationStatus = "verified";
      student.verificationError = null;
      student.verifiedAt = new Date();
      student.verifiedBy = adminId;
      await student.save();
      await User.findOneAndUpdate(
        { walletAddress: student.walletAddress },
        { $set: { verificationStatus: "verified", verificationError: null, onboardingCompleted: true } }
      );
      const emailTarget = student.collegeEmail || student.gmail || student.email;
      if (emailTarget) {
        await sendVerificationSuccessEmail(emailTarget, student.fullName || student.name, "student");
      } else if (student.phone) {
        await sendVerificationSuccessSms(student.phone, student.fullName || student.name, "student");
      }
      const userForStudent = await User.findOne({ walletAddress: student.walletAddress });
      await createNotification({
        userId: userForStudent?._id || student._id,
        message: "Your student verification has been approved!",
        type: "general",
        redirectUrl: "/",
      });
      return res.json({ message: "Student approved successfully", data: { id: student._id, name: student.name } });
    }

    student = await User.findOne({ _id: id, role: "student" });
    if (student) {
      student.verificationStatus = "verified";
      student.verificationError = null;
      student.onboardingCompleted = true;
      await student.save();
      await Student.findOneAndUpdate(
        { walletAddress: student.walletAddress },
        { $set: { verificationStatus: "verified", verificationError: null, verifiedAt: new Date(), verifiedBy: adminId } }
      );
      const emailTarget = student.collegeEmail || student.gmail || student.email;
      if (emailTarget) {
        await sendVerificationSuccessEmail(emailTarget, student.fullName || student.name, "student");
      } else if (student.phone) {
        await sendVerificationSuccessSms(student.phone, student.fullName || student.name, "student");
      }
      await createNotification({
        userId: student._id,
        message: "Your student verification has been approved!",
        type: "general",
        redirectUrl: "/",
      });
      return res.json({ message: "Student approved successfully", data: { id: student._id, name: student.name } });
    }

    return res.status(404).json({ error: "Student not found" });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/admin/reject-student/:id
 * Reject a student verification
 */
const rejectStudent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const reason = req.body?.reason || "Rejected by admin";

    let student = await Student.findById(id);
    if (student) {
      student.verificationStatus = "rejected";
      student.verificationError = reason;
      await student.save();
      await User.findOneAndUpdate(
        { walletAddress: student.walletAddress },
        { $set: { verificationStatus: "rejected", verificationError: reason } }
      );
      const studentUser = await User.findOne({ walletAddress: student.walletAddress });
      await createNotification({
        userId: studentUser?._id || student._id,
        message: `Student verification rejected: ${reason}`,
        type: "general",
        redirectUrl: "/verify-student",
      });
      return res.json({ message: "Student rejected. They can resubmit." });
    }

    student = await User.findOne({ _id: id, role: "student" });
    if (student) {
      student.verificationStatus = "rejected";
      student.verificationError = reason;
      await student.save();
      await Student.findOneAndUpdate(
        { walletAddress: student.walletAddress },
        { $set: { verificationStatus: "rejected", verificationError: reason } }
      );
      await createNotification({
        userId: student._id,
        message: `Student verification rejected: ${reason}`,
        type: "general",
        redirectUrl: "/verify-student",
      });
      return res.json({ message: "Student rejected. They can resubmit." });
    }

    return res.status(404).json({ error: "Student not found" });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/admin/create-account
 * Admin creates a user account (student, teacher, or admin) directly.
 * Teachers start with pending approval. Students/Admins get immediate access.
 */
const createAccountByAdmin = async (req, res, next) => {
  try {
    const { name, email, walletAddress, collegeName, phone, role } = req.body;
    const adminId = req.user._id;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Name is required" });
    }

    const validRoles = ["student", "teacher", "admin"];
    const normalizedRole = (role || "student").toString().trim().toLowerCase();
    if (!validRoles.includes(normalizedRole)) {
      return res.status(400).json({ error: "Invalid role. Must be student, teacher, or admin." });
    }

    const normalizedEmail = email ? normalizeEmail(email) : null;

    if (normalizedEmail) {
      const existing = await findAccountByEmail(normalizedEmail);
      if (existing) {
        return res.status(409).json({ error: "Email already registered" });
      }
    }

    if (normalizedRole === "teacher") {
      // Teacher: create in Teacher + User collections with pending approval
      const teacherRecord = await Teacher.create({
        name: name.trim(),
        displayName: name.trim(),
        gmail: normalizedEmail || "",
        role: "teacher",
        collegeName: collegeName || "",
        phone: phone || "",
        walletAddress: walletAddress ? walletAddress.trim().toLowerCase() : "",
        approvalStatus: "pending",
        approved: false,
      });

      await User.create({
        name: name.trim(),
        displayName: name.trim(),
        gmail: normalizedEmail || "",
        role: "teacher",
        collegeName: collegeName || "",
        phone: phone || "",
        walletAddress: walletAddress ? walletAddress.trim().toLowerCase() : "",
        approved: false,
        verificationStatus: "pending_approval",
        onboardingCompleted: false,
        verificationSubmitted: false,
      });

      return res.status(201).json({
        message: "Teacher account created and pending approval",
        data: { id: teacherRecord._id, name: teacherRecord.name, gmail: teacherRecord.gmail, role: "teacher", approvalStatus: "pending" },
      });
    }

    // Student or Admin: create in role-specific + User collections with immediate access
    if (normalizedRole === "student") {
      await Student.create({
        name: name.trim(),
        displayName: name.trim(),
        gmail: normalizedEmail || "",
        role: "student",
        collegeName: collegeName || "",
        phone: phone || "",
        walletAddress: walletAddress ? walletAddress.trim().toLowerCase() : "",
      });
    } else {
      await AdminUser.create({
        name: name.trim(),
        displayName: name.trim(),
        gmail: normalizedEmail || "",
        role: "admin",
        collegeName: collegeName || "",
        phone: phone || "",
        walletAddress: walletAddress ? walletAddress.trim().toLowerCase() : "",
        approved: true,
      });
    }

    const isAdmin = normalizedRole === "admin";
    const userRecord = await User.create({
      name: name.trim(),
      displayName: name.trim(),
      gmail: normalizedEmail || "",
      role: normalizedRole,
      collegeName: collegeName || "",
      phone: phone || "",
      walletAddress: walletAddress ? walletAddress.trim().toLowerCase() : "",
      approved: true,
      verificationStatus: isAdmin ? "pending" : "verified",
      onboardingCompleted: isAdmin ? false : true,
      verificationSubmitted: !isAdmin,
    });

    return res.status(201).json({
      message: `${normalizedRole === "student" ? "Student" : "Admin"} account created successfully`,
      data: { id: userRecord._id, name: userRecord.name, gmail: userRecord.gmail, role: normalizedRole, approvalStatus: "approved", onboardingCompleted: userRecord.onboardingCompleted },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/admin/organisation-setup
 * Save organisation details for the currently logged-in admin.
 * Creates or updates the Organisation record and marks onboarding as complete.
 */
const setupOrganisation = async (req, res, next) => {
  try {
    const { name, type, address, registrationNumber, phone, countryCode, email, website } = req.body;
    const adminId = req.user._id;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Organisation name is required" });
    }

    const orgData = {
      name: name.trim(),
      type: type || "",
      address: address || "",
      registrationNumber: registrationNumber || "",
      phone: phone || "",
      countryCode: countryCode || "",
      email: email || "",
      website: website || "",
      adminId,
    };

    const org = await Organisation.findOneAndUpdate(
      { adminId },
      { $set: orgData },
      { upsert: true, new: true }
    );

    // Mark admin onboarding as complete
    const updatedUser = await User.findOneAndUpdate(
      { _id: adminId, role: "admin" },
      { $set: { onboardingCompleted: true, verificationStatus: "verified", verificationSubmitted: true } },
      { new: true }
    );

    // Also update AdminUser record
    await AdminUser.findByIdAndUpdate(adminId, {
      $set: {
        organisationName: org.name,
        organisationType: org.type,
      },
    });

    // Generate new JWT with onboardingCompleted so OnboardingGuard won't redirect back
    const token = jwt.sign(
      {
        id: updatedUser._id.toString(),
        name: updatedUser.name,
        role: updatedUser.role,
        walletAddress: updatedUser.walletAddress,
        did: updatedUser.did,
        authMethod: updatedUser.authMethod || "wallet",
        verificationStatus: "verified",
        onboardingCompleted: true,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      message: "Organisation setup complete",
      token,
      data: { id: org._id, name: org.name, type: org.type },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/admin/organisation-status
 * Check if the current admin has completed organisation setup.
 */
const getOrganisationStatus = async (req, res, next) => {
  try {
    const adminId = req.user._id;

    const org = await Organisation.findOne({ adminId });
    const user = await User.findOne({ _id: adminId, role: "admin" });

    return res.json({
      data: {
        completed: Boolean(org) && Boolean(user?.onboardingCompleted),
        organisation: org || null,
        onboardingCompleted: Boolean(user?.onboardingCompleted),
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = { createAdmin, getDashboard, getPendingTeachers, approveTeacher, rejectTeacher, getPendingStudents, approveStudent, rejectStudent, createAccountByAdmin, setupOrganisation, getOrganisationStatus };
