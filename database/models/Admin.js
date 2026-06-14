const mongoose = require("mongoose");
const { nanoid } = require("nanoid");

/**
 * @deprecated Legacy model from previous email-based registration system.
 * Despite the name "Admin", this stores pending teacher registrations
 * (role is always "teacher"). Superseded by the Teacher + AdminUser models.
 * Still used by adminController for listing/reviewing legacy pending teachers.
 * Do NOT use this for new features.
 */
const AdminSchema = new mongoose.Schema(
  {
    publicId: { type: String, unique: true },
    name: { type: String, required: true, trim: true },
    gmail: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["teacher"],
      default: "teacher",
    },
    collegeName: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    walletAddress: { type: String, default: null, trim: true },
    avatar: { type: String, default: null },
    approved: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "admin" }
);

AdminSchema.index({ createdAt: 1 });

AdminSchema.pre("save", async function () {
  if (!this.publicId) {
    const year = new Date().getFullYear();
    this.publicId = `TEACH-${year}-${nanoid(6).toUpperCase()}`;
  }
});

module.exports = mongoose.model("Admin", AdminSchema);
