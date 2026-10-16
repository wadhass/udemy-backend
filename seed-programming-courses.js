const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const mongoose = require("mongoose");
const Course = require("./models/Course");

const courses = [
  {
    slug: "javascript",
    title: "JavaScript for Beginners: Build a Strong Foundation",
    category: "javascript",
    subtitle: "Learn modern JavaScript fundamentals and bring web pages to life",
    description:
      "Start writing JavaScript with a practical introduction to variables, functions, arrays, objects, and the DOM. Build a foundation for interactive websites and more advanced web development.",
    objectives:
      "Understand variables and data types, write functions and loops, work with arrays and objects, and use JavaScript to interact with a web page.",
    videoId: "hdI2bqOjy3c",
    image: "https://img.youtube.com/vi/hdI2bqOjy3c/hqdefault.jpg",
  },
  {
    slug: "python",
    title: "Python Programming: Beginner to Practical Projects",
    category: "python",
    subtitle: "Get started with Python syntax, data structures, and problem solving",
    description:
      "Learn Python from the ground up with an approachable introduction to core syntax, variables, conditions, loops, functions, and collections. Practice the building blocks used in automation, scripting, and data science.",
    objectives:
      "Write Python variables and expressions, use conditions and loops, create reusable functions, and organize data with lists and dictionaries.",
    videoId: "_uQrJ0TkZlc",
    image: "https://img.youtube.com/vi/_uQrJ0TkZlc/hqdefault.jpg",
  },
  {
    slug: "java",
    title: "Java Programming Fundamentals",
    category: "java",
    subtitle: "Learn object-oriented programming and write your first Java programs",
    description:
      "Build a solid Java foundation by learning program structure, variables, control flow, methods, classes, and object-oriented programming concepts.",
    objectives:
      "Create and run Java programs, use variables and control flow, write methods, and understand classes, objects, and core object-oriented concepts.",
    videoId: "eIrMbAQSU34",
    image: "https://img.youtube.com/vi/eIrMbAQSU34/hqdefault.jpg",
  },
  {
    slug: "cpp",
    title: "C++ Programming for Beginners",
    category: "cpp",
    subtitle: "Learn C++ syntax, functions, classes, and essential programming concepts",
    description:
      "Explore the foundations of C++ programming, from variables and loops to functions, arrays, and classes. Develop the skills to read and write clear, structured C++ programs.",
    objectives:
      "Use C++ types and operators, write conditional logic and loops, create functions, work with arrays, and understand introductory classes.",
    videoId: "vLnPwxZdW4Y",
    image: "https://img.youtube.com/vi/vLnPwxZdW4Y/hqdefault.jpg",
  },
  {
    slug: "csharp",
    title: "C# Programming: Your First Steps",
    category: "csharp",
    subtitle: "Understand C# fundamentals and object-oriented programming",
    description:
      "Learn the essential building blocks of C# including variables, expressions, control flow, methods, and classes. Practice writing maintainable programs with the .NET ecosystem.",
    objectives:
      "Write basic C# programs, use variables and control flow, define methods, and learn how classes and objects organize code.",
    videoId: "GhQdlIFylQ8",
    image: "https://img.youtube.com/vi/GhQdlIFylQ8/hqdefault.jpg",
  },
  {
    slug: "html",
    title: "HTML Essentials: Structure Your First Web Pages",
    category: "html",
    subtitle: "Create accessible, well-structured pages with semantic HTML",
    description:
      "Learn how HTML elements form the structure of the web. Create pages with headings, links, images, lists, forms, and semantic landmarks.",
    objectives:
      "Build an HTML document, choose semantic elements, add links and media, create forms, and structure content for accessibility.",
    videoId: "UB1O30fR-EE",
    image: "https://img.youtube.com/vi/UB1O30fR-EE/hqdefault.jpg",
  },
  {
    slug: "css",
    title: "CSS Fundamentals: Style Modern Websites",
    category: "css",
    subtitle: "Use selectors, layouts, and responsive styling to design the web",
    description:
      "Style web pages with CSS fundamentals including selectors, the box model, typography, colors, Flexbox, Grid, and responsive design techniques.",
    objectives:
      "Apply CSS selectors, control spacing with the box model, build layouts with Flexbox and Grid, and make pages responsive.",
    videoId: "yfoY53QXEnI",
    image: "https://img.youtube.com/vi/yfoY53QXEnI/hqdefault.jpg",
  },
  {
    slug: "tailwind-css",
    title: "Tailwind CSS: Build Interfaces with Utility Classes",
    category: "tailwind-css",
    subtitle: "Create responsive interfaces quickly with a utility-first workflow",
    description:
      "Learn Tailwind CSS by composing utility classes to style layouts, spacing, typography, colors, and responsive states directly in your markup.",
    objectives:
      "Use Tailwind utility classes, create responsive layouts, style common interface elements, and keep utility-based markup organized.",
    videoId: "dFgzHOX84xQ",
    image: "https://img.youtube.com/vi/dFgzHOX84xQ/hqdefault.jpg",
  },
  {
    slug: "nodejs",
    title: "Node.js Fundamentals: JavaScript on the Server",
    category: "nodejs",
    subtitle: "Build server-side applications and understand the Node.js runtime",
    description:
      "Take JavaScript beyond the browser with an introduction to Node.js, its module system, npm packages, file operations, and HTTP server fundamentals.",
    objectives:
      "Understand the Node.js runtime, use modules and npm, work with files, and create a basic HTTP server.",
    videoId: "f2EqECiTBL8",
    image: "https://img.youtube.com/vi/f2EqECiTBL8/hqdefault.jpg",
  },
  {
    slug: "express-js",
    title: "Express.js: Create Your First Web API",
    category: "express-js",
    subtitle: "Build routes and middleware for Node.js web applications",
    description:
      "Learn how Express.js simplifies backend development with routing, middleware, request handling, and the foundations of a REST API.",
    objectives:
      "Create an Express server, define routes, use middleware, handle requests and responses, and structure a simple REST API.",
    videoId: "L72fhGm1tfE",
    image: "https://img.youtube.com/vi/L72fhGm1tfE/hqdefault.jpg",
  },
];

const programmingCourses = courses.map((course) => ({
  instructorId: `demo-programming-${course.slug}`,
  instructorName: "Programming Courses",
  date: new Date(),
  title: course.title,
  category: course.category,
  level: "beginner",
  primaryLanguage: "english",
  subtitle: course.subtitle,
  description: course.description,
  image: course.image,
  welcomeMessage: `Welcome! Start learning ${course.category} with this beginner-friendly course.`,
  pricing: 0,
  objectives: course.objectives,
  students: [],
  curriculum: [
    {
      title: `Complete ${course.category} beginner course`,
      videoUrl: `https://www.youtube.com/watch?v=${course.videoId}`,
      public_id: "",
      freePreview: true,
    },
  ],
  isPublised: true,
}));

async function seedProgrammingCourses() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing. Add it to server/.env");
  }

  await mongoose.connect(process.env.MONGO_URI);
  const result = await Course.bulkWrite(
    programmingCourses.map((course) => ({
      updateOne: {
        filter: {
          instructorId: course.instructorId,
          title: course.title,
        },
        update: { $setOnInsert: course },
        upsert: true,
      },
    }))
  );

  console.log(
    `${result.upsertedCount} programming courses added; ${
      programmingCourses.length - result.upsertedCount
    } already existed.`
  );
}

seedProgrammingCourses()
  .catch((error) => {
    console.error("Could not seed programming courses:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
