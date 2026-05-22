const express = require("express");
const { body } = require("express-validator");
const { createAdmin, getDashboard, getPendingTeachers, approveTeacher, rejectTeacher, getPendingStudents, approveStudent, rejectStudent, createAccountByAdmin, setupOrganisation, getOrganisationStatus } = require("../controllers/adminController");
const { adminOnly } = require("../middleware/admin.middleware");

const router = express.Router();

/**
 * POST /api/admin/create
 * Public route — protected by ADMIN_SECRET in the request body
 */
router.post(
  "/create",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email")
      .isEmail()
      .withMessage("Valid email is required")
      .normalizeEmail(),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
    body().custom((value) => {
      const providedSecret = value?.adminSecret || value?.secret;
      if (!providedSecret || !String(providedSecret).trim()) {
        throw new Error("Admin secret is required");
      }
      return true;
    }),
  ],
  createAdmin
);

/**
 * GET /api/admin/dashboard
 * Protected — requires valid JWT with role === "admin"
 */
router.get("/dashboard", adminOnly, getDashboard);

router.get("/pending-teachers", adminOnly, getPendingTeachers);

router.post("/approve-teacher/:id", adminOnly, approveTeacher);

router.post("/reject-teacher/:id", adminOnly, rejectTeacher);

router.get("/pending-students", adminOnly, getPendingStudents);

router.post("/approve-student/:id", adminOnly, approveStudent);

router.post("/reject-student/:id", adminOnly, rejectStudent);

router.post("/create-account", adminOnly, createAccountByAdmin);

router.post("/organisation-setup", adminOnly, setupOrganisation);

router.get("/organisation-status", adminOnly, getOrganisationStatus);

module.exports = router;
