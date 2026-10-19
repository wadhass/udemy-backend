const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const authRoutes = require("./routes/auth-routes/index");
const mediaRoutes = require("./routes/instructor-routes/media-routes");
const instructorCourseRoutes = require("./routes/instructor-routes/course-routes");
const studentViewCourseRoutes = require("./routes/student-routes/course-routes");
const studentViewOrderRoutes = require("./routes/student-routes/order-routes");
const { handleStripeWebhook } = require("./controllers/student-controller/order-controller");
const studentCoursesRoutes = require("./routes/student-routes/student-courses-routes");
const studentCourseProgressRoutes = require("./routes/student-routes/course-progress-routes");

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const allowedClientOrigins = new Set([
  process.env.CLIENT_URL || "http://localhost:5173",
  "https://udemy-full-stack-five.vercel.app",
  ...(process.env.CLIENT_ORIGINS || "").split(","),
]
  .map((origin) => origin.trim())
  .filter(Boolean));

if (!MONGO_URI) {
  throw new Error("MONGO_URI is missing. Configure it in the server environment.");
}

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is missing. Configure it in the server environment.");
}

app.use(
  cors({
    origin: [...allowedClientOrigins],
    methods: ["GET", "POST", "DELETE", "PUT"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Udemy backend API is running",
  });
});

app.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);
app.use(express.json());

//routes configuration
app.use("/auth", authRoutes);
app.use("/media", mediaRoutes);
app.use("/instructor/course", instructorCourseRoutes);
app.use("/student/course", studentViewCourseRoutes);
app.use("/student/order", studentViewOrderRoutes);
app.use("/student/courses-bought", studentCoursesRoutes);
app.use("/student/course-progress", studentCourseProgressRoutes);

app.use((err, req, res, next) => {
  console.log(err.stack);
  res.status(500).json({
    success: false,
    message: "Something went wrong",
  });
});

async function startServer() {
  await mongoose.connect(MONGO_URI);
  console.log("mongodb is connected");

  app.listen(PORT, () => {
    console.log(`Server is now running on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exitCode = 1;
});
