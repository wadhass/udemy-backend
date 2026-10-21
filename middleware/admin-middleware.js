const authenticate = require("./auth-middleware");

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access is required",
    });
  }

  next();
}

module.exports = [authenticate, requireAdmin];
