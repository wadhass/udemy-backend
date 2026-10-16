const express = require("express");
const {
  getCurrentCourseProgress,
  markCurrentLectureAsViewed,
  resetCurrentCourseProgress,
} = require("../../controllers/student-controller/course-progress-controller");
const authenticate = require("../../middleware/auth-middleware");

const router = express.Router();

router.get("/get/:userId/:courseId", authenticate, getCurrentCourseProgress);
router.post("/mark-lecture-viewed", authenticate, markCurrentLectureAsViewed);
router.post("/reset-progress", authenticate, resetCurrentCourseProgress);
module.exports = router;
