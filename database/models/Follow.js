const mongoose = require("mongoose");

const followSchema = new mongoose.Schema(
  {
    follower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    following: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
      validate: {
        validator: function (value) {
          return !this.follower || !value || this.follower.toString() !== value.toString();
        },
        message: "Cannot follow yourself",
      },
    },
  },
  { timestamps: true, collection: "follows" }
);

followSchema.index({ follower: 1, following: 1 }, { unique: true });
followSchema.index({ following: 1, follower: 1 });

module.exports = mongoose.model("Follow", followSchema);
