const express = require("express");
const {
  addNewCourse,
  getAllCourses,
  getCourseDetailsByID,
  updateCourseByID,
} = require("../../controllers/instructor-controller/course-controller");
const instructorMiddleware = require("../../middleware/instructor-middleware");
const router = express.Router();

router.post("/add", ...instructorMiddleware, addNewCourse);
router.get("/get", ...instructorMiddleware, getAllCourses);
router.get("/get/details/:id", ...instructorMiddleware, getCourseDetailsByID);
router.put("/update/:id", ...instructorMiddleware, updateCourseByID);

module.exports = router;
