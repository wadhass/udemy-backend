const express = require("express");
const {
  getDashboardData,
  getCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
} = require("../../controllers/admin-controller");
const adminMiddleware = require("../../middleware/admin-middleware");

const router = express.Router();

router.get("/dashboard", ...adminMiddleware, getDashboardData);
router.get("/courses", ...adminMiddleware, getCourses);
router.get("/courses/:id", ...adminMiddleware, getCourseById);
router.post("/courses", ...adminMiddleware, createCourse);
router.put("/courses/:id", ...adminMiddleware, updateCourse);
router.delete("/courses/:id", ...adminMiddleware, deleteCourse);

module.exports = router;
