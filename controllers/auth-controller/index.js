const User = require("../../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

const registerUser = async (req, res) => {
  const { userName, userEmail, password } = req.body || {};

  if (
    typeof userName !== "string" ||
    typeof userEmail !== "string" ||
    typeof password !== "string" ||
    !userName.trim() ||
    !userEmail.trim() ||
    !password
  ) {
    return res.status(400).json({
      success: false,
      message: "User name, email, and password are required",
    });
  }

  const cleanedUserName = userName.trim();
  const cleanedUserEmail = userEmail.trim().toLowerCase();

  if (await User.findOne({ userEmail: cleanedUserEmail })) {
    return res.status(409).json({
      success: false,
      code: "EMAIL_ALREADY_EXISTS",
      message: "An account with this email already exists. Sign in instead.",
    });
  }

  if (await User.findOne({ userName: cleanedUserName })) {
    return res.status(409).json({
      success: false,
      code: "USERNAME_ALREADY_EXISTS",
      message: "This username is already taken. Choose a different username.",
    });
  }

  const hashPassword = await bcrypt.hash(password, 10);
  const newUser = new User({
    userName: cleanedUserName,
    userEmail: cleanedUserEmail,
    role: "user",
    password: hashPassword,
  });

  await newUser.save();

  return res.status(201).json({
    success: true,
    message: "User registered successfully!",
  });
};

const loginUser = async (req, res) => {
  const { userEmail, password } = req.body || {};

  if (
    typeof userEmail !== "string" ||
    typeof password !== "string" ||
    !userEmail.trim() ||
    !password
  ) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required",
    });
  }

  const checkUser = await User.findOne({
    userEmail: userEmail.trim().toLowerCase(),
  });

  if (!checkUser || !(await bcrypt.compare(password, checkUser.password))) {
    return res.status(401).json({
      success: false,
      message: "Invalid credentials",
    });
  }

  const accessToken = jwt.sign(
    {
      _id: checkUser._id,
      userName: checkUser.userName,
      userEmail: checkUser.userEmail,
      role: checkUser.role,
    },
    JWT_SECRET,
    { expiresIn: "120m" }
  );

  res.status(200).json({
    success: true,
    message: "Logged in successfully",
    data: {
      accessToken,
      user: {
        _id: checkUser._id,
        userName: checkUser.userName,
        userEmail: checkUser.userEmail,
        role: checkUser.role,
      },
    },
  });
};

module.exports = { registerUser, loginUser };
