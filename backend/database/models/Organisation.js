const mongoose = require("mongoose");

const OrganisationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["school", "college", "university", "other", ""],
      default: "",
    },
    address: { type: String, trim: true, default: "" },
    registrationNumber: { type: String, trim: true, default: "" },
    logo: { type: String, default: null },
    phone: { type: String, trim: true, default: "" },
    countryCode: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    website: { type: String, trim: true, default: "" },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminUser",
      required: true,
      unique: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminUser",
    },
  },
  { timestamps: true, collection: "organisations" }
);

OrganisationSchema.index({ email: 1 }, { sparse: true });

module.exports = mongoose.model("Organisation", OrganisationSchema);
