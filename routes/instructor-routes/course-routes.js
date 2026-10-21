const express = require("express");
const {
  getAllCourses,
  getCourseDetailsByID,
} = require("../../controllers/instructor-controller/course-controller");
const instructorMiddleware = require("../../middleware/instructor-middleware");
const router = express.Router();

router.get("/get", ...instructorMiddleware, getAllCourses);
router.get("/get/details/:id", ...instructorMiddleware, getCourseDetailsByID);

module.exports = router;
