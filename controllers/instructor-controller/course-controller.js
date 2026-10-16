const Course = require("../../models/Course");
const mongoose = require("mongoose");

const addNewCourse = async (req, res) => {
  try {
    const courseData = {
      ...req.body,
      instructorId: String(req.user._id),
      instructorName: req.user.userName,
    };
    const newlyCreatedCourse = new Course(courseData);
    const saveCourse = await newlyCreatedCourse.save();

    if (saveCourse) {
      res.status(201).json({
        success: true,
        message: "Course saved successfully",
        data: saveCourse,
      });
    }
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Some error occured!",
    });
  }
};

const getAllCourses = async (req, res) => {
  try {
    const coursesList = await Course.find({
      instructorId: String(req.user._id),
    });

    res.status(200).json({
      success: true,
      data: coursesList,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Some error occured!",
    });
  }
};

const getCourseDetailsByID = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({
        success: false,
        message: "Course not found!",
      });
    }

    const courseDetails = await Course.findOne({
      _id: id,
      instructorId: String(req.user._id),
    });

    if (!courseDetails) {
      return res.status(404).json({
        success: false,
        message: "Course not found!",
      });
    }

    res.status(200).json({
      success: true,
      data: courseDetails,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Some error occured!",
    });
  }
};

const updateCourseByID = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({
        success: false,
        message: "Course not found!",
      });
    }

    const {
      title,
      category,
      level,
      primaryLanguage,
      subtitle,
      description,
      image,
      welcomeMessage,
      pricing,
      objectives,
      curriculum,
      isPublised,
    } = req.body;

    const updatedCourse = await Course.findOneAndUpdate(
      { _id: id, instructorId: String(req.user._id) },
      {
        $set: {
          title,
          category,
          level,
          primaryLanguage,
          subtitle,
          description,
          image,
          welcomeMessage,
          pricing,
          objectives,
          curriculum,
          isPublised,
        },
      },
      { new: true, runValidators: true }
    );

    if (!updatedCourse) {
      return res.status(404).json({
        success: false,
        message: "Course not found!",
      });
    }

    res.status(200).json({
      success: true,
      message: "Course updated successfully",
      data: updatedCourse,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Some error occured!",
    });
  }
};

module.exports = {
  addNewCourse,
  getAllCourses,
  updateCourseByID,
  getCourseDetailsByID,
};
