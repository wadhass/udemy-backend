const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const mongoose = require("mongoose");
const Course = require("./models/Course");

const demoCourse = {
  instructorId: "demo-web-development",
  instructorName: "Web Development Demo",
  date: new Date(),
  title: "Web Development Fundamentals: HTML, CSS & JavaScript",
  category: "web-development",
  level: "beginner",
  primaryLanguage: "english",
  subtitle: "Start building for the web with three beginner-friendly lessons",
  description:
    "A sample course featuring public video lessons covering HTML, CSS, and JavaScript fundamentals.",
  image: "https://img.youtube.com/vi/UB1O30fR-EE/hqdefault.jpg",
  welcomeMessage: "Welcome! Start with HTML, then move on to CSS and JavaScript.",
  pricing: 0,
  objectives:
    "Understand HTML page structure, style pages with CSS, and begin writing JavaScript.",
  students: [],
  curriculum: [
    {
      title: "HTML Crash Course for Beginners",
      videoUrl: "https://www.youtube.com/watch?v=UB1O30fR-EE",
      public_id: "",
      freePreview: true,
    },
    {
      title: "CSS Crash Course for Beginners",
      videoUrl: "https://www.youtube.com/watch?v=yfoY53QXEnI",
      public_id: "",
      freePreview: true,
    },
    {
      title: "JavaScript Crash Course for Beginners",
      videoUrl: "https://www.youtube.com/watch?v=hdI2bqOjy3c",
      public_id: "",
      freePreview: true,
    },
  ],
  isPublised: true,
};

async function seedDemoCourse() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing. Add it to server/.env");
  }

  await mongoose.connect(process.env.MONGO_URI);
  const result = await Course.updateOne(
    { instructorId: demoCourse.instructorId, title: demoCourse.title },
    { $setOnInsert: demoCourse },
    { upsert: true }
  );

  console.log(
    result.upsertedCount
      ? "Sample web development course added."
      : "Sample web development course already exists."
  );
}

seedDemoCourse()
  .catch((error) => {
    console.error("Could not seed the sample course:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });