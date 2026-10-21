const Course = require("../../models/Course");
const mongoose = require("mongoose");
const Order = require("../../models/Order");
const StudentCourses = require("../../models/StudentCourses");
const User = require("../../models/User");

const editableCourseFields = [
  "title",
  "category",
  "level",
  "primaryLanguage",
  "subtitle",
  "description",
  "image",
  "welcomeMessage",
  "pricing",
  "objectives",
  "curriculum",
  "isPublised",
];

function pickEditableCourseFields(body) {
  return editableCourseFields.reduce((fields, field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      fields[field] = body[field];
    }
    return fields;
  }, {});
}

async function getDashboardData(req, res, next) {
  try {
    const [
      totalUsers,
      students,
      instructors,
      adminUsers,
      totalCourses,
      publishedCourses,
      enrollmentTotals,
      orderTotals,
      recentUsers,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "user" }),
      User.countDocuments({ role: "instructor" }),
      User.countDocuments({ role: "admin" }),
      Course.countDocuments(),
      Course.countDocuments({ isPublised: true }),
      Course.aggregate([
        {
          $group: {
            _id: null,
            totalEnrollments: {
              $sum: { $size: { $ifNull: ["$students", []] } },
            },
          },
        },
      ]),
      Order.aggregate([
        { $match: { paymentStatus: "paid" } },
        {
          $group: {
            _id: null,
            paidOrders: { $sum: 1 },
            revenue: {
              $sum: {
                $convert: {
                  input: "$coursePricing",
                  to: "double",
                  onError: 0,
                  onNull: 0,
                },
              },
            },
          },
        },
      ]),
      User.find()
        .select("userName userEmail role")
        .sort({ _id: -1 })
        .limit(8)
        .lean(),
    ]);

    const enrollmentStats = enrollmentTotals[0] || {};
    const orderStats = orderTotals[0] || {};

    return res.status(200).json({
      success: true,
      data: {
        stats: {
          totalUsers,
          students,
          instructors,
          adminUsers,
          totalCourses,
          publishedCourses,
          totalEnrollments: enrollmentStats.totalEnrollments || 0,
          paidOrders: orderStats.paidOrders || 0,
          revenue: orderStats.revenue || 0,
        },
        recentUsers,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function getCourses(req, res, next) {
  try {
    const page = Number.parseInt(req.query.page, 10) || 1;
    const limit = 25;
    if (page < 1) {
      return res.status(400).json({
        success: false,
        message: "Page must be a positive integer",
      });
    }

    const [courses, total] = await Promise.all([
      Course.find()
        .select("title category instructorName pricing isPublised date students")
        .sort({ date: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Course.countDocuments(),
    ]);

    return res.status(200).json({
      success: true,
      data: courses,
      pagination: {
        page,
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function getCourseById(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    return res.status(200).json({ success: true, data: course });
  } catch (error) {
    return next(error);
  }
}

async function createCourse(req, res, next) {
  try {
    const fields = pickEditableCourseFields(req.body || {});
    if (typeof fields.title !== "string" || !fields.title.trim()) {
      return res.status(400).json({
        success: false,
        message: "A course title is required",
      });
    }

    const course = await Course.create({
      ...fields,
      title: fields.title.trim(),
      instructorId: String(req.user._id),
      instructorName: req.user.userName,
      date: new Date(),
      students: [],
    });

    return res.status(201).json({
      success: true,
      message: "Course created successfully",
      data: course,
    });
  } catch (error) {
    return next(error);
  }
}

async function updateCourse(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const fields = pickEditableCourseFields(req.body || {});
    if (fields.title !== undefined) {
      if (typeof fields.title !== "string" || !fields.title.trim()) {
        return res.status(400).json({
          success: false,
          message: "Course title cannot be empty",
        });
      }
      fields.title = fields.title.trim();
    }

    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { $set: fields },
      { new: true, runValidators: true }
    );
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Course updated successfully",
      data: course,
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteCourse(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const courseId = String(req.params.id);
    const course = await Course.findById(courseId).select("students");
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const [hasOrders, hasStudentAccess] = await Promise.all([
      Order.exists({ courseId }),
      StudentCourses.exists({ "courses.courseId": courseId }),
    ]);

    if (course.students?.length > 0 || hasOrders || hasStudentAccess) {
      return res.status(409).json({
        success: false,
        message:
          "This course has purchases or enrollments and cannot be permanently deleted.",
      });
    }

    await course.deleteOne();
    return res.status(200).json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getDashboardData,
  getCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
};
