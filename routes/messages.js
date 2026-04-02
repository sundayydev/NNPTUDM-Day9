let express = require("express");
let router = express.Router();
let { checkLogin } = require("../utils/authHandler");
let messageModel = require("../schemas/messages");
let { uploadImage } = require("../utils/uploadHandler");

/**
 * GET /
 * Lấy tin nhắn cuối cùng của mỗi cuộc hội thoại
 * mà user hiện tại đã nhắn hoặc nhận
 */
router.get("/", checkLogin, async function (req, res, next) {
  try {
    let currentUserId = req.user._id;

    let messages = await messageModel
      .find({
        $or: [{ from: currentUserId }, { to: currentUserId }],
      })
      .populate("from", "username avatarUrl")
      .populate("to", "username avatarUrl")
      .sort({ createdAt: -1 });

    // Lấy tin nhắn cuối cùng của mỗi cuộc hội thoại (theo partner)
    let conversationMap = new Map();

    for (const msg of messages) {
      let partnerId =
        msg.from._id.toString() === currentUserId.toString()
          ? msg.to._id.toString()
          : msg.from._id.toString();

      if (!conversationMap.has(partnerId)) {
        conversationMap.set(partnerId, msg);
      }
    }

    let result = Array.from(conversationMap.values());
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

/**
 * POST /
 * Gửi tin nhắn đến userID
 * Body (multipart/form-data hoặc JSON):
 *   - to: userID nhận tin nhắn
 *   - text: nội dung (nếu type là text)
 *   - file: file đính kèm (nếu có, type tự động là "file")
 */
router.post(
  "/",
  checkLogin,
  uploadImage.single("file"),
  async function (req, res, next) {
    try {
      let currentUserId = req.user._id;
      let { to, text } = req.body;

      let type = "text";
      let content = text;

      if (req.file) {
        type = "file";
        content = req.file.path;
      }

      let newMessage = new messageModel({
        from: currentUserId,
        to: to,
        type: type,
        text: content,
      });

      await newMessage.save();
      await newMessage.populate("from", "username avatarUrl");
      await newMessage.populate("to", "username avatarUrl");

      res.status(201).send(newMessage);
    } catch (error) {
      res.status(500).send({ message: error.message });
    }
  }
);

/**
 * GET /:userID
 * Lấy toàn bộ tin nhắn giữa user hiện tại và userID
 * (from: me -> to: userID) HOẶC (from: userID -> to: me)
 */
router.get("/:userID", checkLogin, async function (req, res, next) {
  try {
    let currentUserId = req.user._id;
    let otherUserId = req.params.userID;

    let messages = await messageModel
      .find({
        $or: [
          { from: currentUserId, to: otherUserId },
          { from: otherUserId, to: currentUserId },
        ],
      })
      .populate("from", "username avatarUrl")
      .populate("to", "username avatarUrl")
      .sort({ createdAt: 1 });

    res.send(messages);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

module.exports = router;
