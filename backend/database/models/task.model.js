const mongoose = require("mongoose");

const certificateIssueSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    userName: {
      type: String,
      default: null,
      trim: true,
    },
    code: {
      type: String,
      default: "",
      trim: true,
    },
    reason: {
      type: String,
      default: "",
      trim: true,
    },
    displayMessage: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false }
);

const certificateIssuanceSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: [
        "none",
        "success",
        "partial",
        "pending_retry",
        "already_issued",
        "not_eligible",
      ],
      default: "none",
    },
    message: {
      type: String,
      default: "",
      trim: true,
    },
    issuedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    skippedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    eligibleMemberCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    ineligibleMemberCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    retryableIssueCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    retryAvailable: {
      type: Boolean,
      default: false,
    },
    issues: {
      type: [certificateIssueSchema],
      default: [],
    },
    lastAttemptedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const taskSchema = new mongoose.Schema(
  {
    community_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: [true, "Community ID is required"],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator user ID is required"],
    },
    title: {
      type: String,
      required: [true, "Task title is required"],
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },
    completed_status: {
      type: Boolean,
      default: false,
    },
    completedBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        completedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    attachments: [
      {
        fileName: {
          type: String,
          required: true,
          trim: true,
        },
        fileUrl: {
          type: String,
          required: true,
          trim: true,
        },
        mimeType: {
          type: String,
          trim: true,
        },
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    certificateIssuance: {
      type: certificateIssuanceSchema,
      default: () => ({}),
    },
    files: [
      {
        fileName: {
          type: String,
          required: true,
          trim: true,
        },
        filePath: {
          type: String,
          required: true,
          trim: true,
        },
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
      },
    ],
    chatMessages: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        message: {
          type: String,
          required: true,
          trim: true,
          maxlength: 2000,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

taskSchema.index({ community_id: 1, completed_status: 1 });
taskSchema.index({ community_id: 1, createdAt: -1 });
taskSchema.index({ createdBy: 1 });
taskSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Task", taskSchema);
