const mongoose = require("mongoose");

const SubmissionSchema = new mongoose.Schema({
  community: { type: mongoose.Schema.Types.ObjectId, ref: "Community", required: true },
  task: { type: mongoose.Schema.Types.ObjectId, ref: "Task", required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  files: [{
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    mimeType: { type: String, default: "" },
    size: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now },
  }],
  links: [{ type: String, trim: true }],
  notes: { type: String, trim: true, maxlength: 2000, default: "" },
  status: {
    type: String,
    enum: ["draft", "submitted", "reviewed", "approved", "rejected"],
    default: "submitted",
  },
  feedback: {
    text: { type: String, trim: true, maxlength: 2000, default: "" },
    givenBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    givenAt: { type: Date, default: null },
  },
  version: { type: Number, default: 1 },
  previousVersions: [{
    files: [{
      fileName: String, fileUrl: String, mimeType: String, size: Number, uploadedAt: { type: Date, default: Date.now },
    }],
    links: [String],
    notes: String,
    submittedAt: { type: Date, default: Date.now },
  }],
  isFinal: { type: Boolean, default: false },
}, { timestamps: true });

SubmissionSchema.index({ community: 1, task: 1, student: 1 });
SubmissionSchema.index({ task: 1, status: 1 });

module.exports = mongoose.model("Submission", SubmissionSchema);
