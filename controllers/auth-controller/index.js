const User = require("../../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const JWT_SECRET = process.env.JWT_SECRET;

function createMailTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
  const port = Number(SMTP_PORT || 587);

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !Number.isInteger(port)) {
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASSWORD,
    },
  });
}

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

const requestPasswordReset = async (req, res) => {
  const { userEmail } = req.body || {};

  if (typeof userEmail !== "string" || !userEmail.trim()) {
    return res.status(400).json({
      success: false,
      message: "A valid email address is required",
    });
  }

  const transporter = createMailTransporter();
  if (!transporter || !process.env.SMTP_FROM) {
    return res.status(503).json({
      success: false,
      message: "Password reset is temporarily unavailable. Please try again later.",
    });
  }

  const user = await User.findOne({
    userEmail: userEmail.trim().toLowerCase(),
  });

  if (!user) {
    return res.status(200).json({
      success: true,
      message: "If an account exists for that email, a reset link has been sent.",
    });
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  user.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  const resetUrl = new URL("/reset-password", process.env.CLIENT_URL || "http://localhost:5173");
  resetUrl.searchParams.set("token", resetToken);

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: user.userEmail,
      subject: "Reset your LMS LEARN password",
      text: `Use this link to reset your password within one hour: ${resetUrl.toString()}`,
      html: `<p>Use this link to reset your password. It expires in one hour.</p><p><a href="${resetUrl.toString()}">Reset password</a></p>`,
    });
  } catch (error) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    throw error;
  }

  return res.status(200).json({
    success: true,
    message: "If an account exists for that email, a reset link has been sent.",
  });
};

const resetPassword = async (req, res) => {
  const { token, password } = req.body || {};

  if (typeof token !== "string" || !token || typeof password !== "string") {
    return res.status(400).json({
      success: false,
      message: "A valid reset token and new password are required",
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 8 characters long",
    });
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: new Date() },
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: "This reset link is invalid or has expired. Request a new one.",
    });
  }

  user.password = await bcrypt.hash(password, 10);
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  return res.status(200).json({
    success: true,
    message: "Your password has been reset. You can now sign in.",
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

module.exports = {
  registerUser,
  loginUser,
  requestPasswordReset,
  resetPassword,
};
