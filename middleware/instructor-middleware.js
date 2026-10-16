const authenticate = require("./auth-middleware");

function requireInstructor(req, res, next) {
  if (req.user?.role !== "instructor") {
    return res.status(403).json({
      success: false,
      message: "Instructor access is required",
    });
  }

  next();
}

module.exports = [authenticate, requireInstructor];