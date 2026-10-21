const express = require("express");
const multer = require("multer");
const {
  uploadMediaToCloudinary,
  deleteMediaFromCloudinary,
} = require("../../helpers/cloudinary");
const authenticate = require("../../middleware/auth-middleware");

function requireInstructorOrAdmin(req, res, next) {
  if (!["instructor", "admin"].includes(req.user?.role)) {
    return res.status(403).json({
      success: false,
      message: "Instructor or admin access is required",
    });
  }

  next();
}

const router = express.Router();

const upload = multer({ dest: "uploads/" });

router.post("/upload", authenticate, requireInstructorOrAdmin, upload.single("file"), async (req, res) => {
  try {
    const result = await uploadMediaToCloudinary(req.file.path);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (e) {
    console.log(e);

    res.status(500).json({ success: false, message: "Error uploading file" });
  }
});

router.delete("/delete/:id", authenticate, requireInstructorOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Assest Id is required",
      });
    }

    await deleteMediaFromCloudinary(id);

    res.status(200).json({
      success: true,
      message: "Assest deleted successfully from cloudinary",
    });
  } catch (e) {
    console.log(e);

    res.status(500).json({ success: false, message: "Error deleting file" });
  }
});

router.post("/bulk-upload", authenticate, requireInstructorOrAdmin, upload.array("files", 10), async (req, res) => {
  try {
    const uploadPromises = req.files.map((fileItem) =>
      uploadMediaToCloudinary(fileItem.path)
    );

    const results = await Promise.all(uploadPromises);

    res.status(200).json({
      success: true,
      data: results,
    });
  } catch (event) {
    console.log(event);

    res
      .status(500)
      .json({ success: false, message: "Error in bulk uploading files" });
  }
});

module.exports = router;
