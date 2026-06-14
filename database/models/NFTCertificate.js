const mongoose = require("mongoose");
const { nanoid } = require("nanoid");

const NFTCertificateSchema = new mongoose.Schema(
  {
    publicId: { type: String, unique: true },
    marketplaceItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Marketplace",
      required: true,
    },
    issuedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    type: {
      type: String,
      enum: ["Job", "Event", "Project"],
      default: "Project",
    },
  },
  { timestamps: true }
);

NFTCertificateSchema.pre("save", function (next) {
  if (!this.publicId) {
    this.publicId = `NFT-MKT-${nanoid(6).toUpperCase()}`;
  }
  next();
});

module.exports = mongoose.model("NFTCertificate", NFTCertificateSchema);
