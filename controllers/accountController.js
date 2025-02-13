// controllers/accountController.js
const pool = require('../utils/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer'); // NEW: Import Nodemailer
require('dotenv').config();

/**
 * Generate a unique random 10-digit number for the user ID.
 * This function checks the database to ensure the ID does not already exist.
 */
const generateUniqueId = async () => {
  let unique = false;
  let id;
  while (!unique) {
    // Generate a random 10-digit number
    id = Math.floor(100000 + Math.random() * 900000);
    const [rows] = await pool.query('SELECT id FROM users WHERE id = ?', [id]);
    if (rows.length === 0) {
      unique = true;
    }
  }
  return id;
};

exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: "Username, email, and password are required." });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate a unique random ID for the new user
    const uniqueId = await generateUniqueId();

    const [result] = await pool.query(
      'INSERT INTO users (username, email, password, id) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, uniqueId]
    );
    res.status(201).json({ message: "User registered successfully", userId: uniqueId });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: error.sqlMessage || "Internal server error" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(400).json({ error: "Invalid credentials." });
    }
    const user = users[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ error: "Invalid credentials." });
    }
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      process.env.JWT_SECRET
    );
    res.json({ token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const [users] = await pool.query(
      'SELECT id, username, email, created_at FROM users WHERE id = ?',
      [userId]
    );
    if (users.length === 0) return res.status(404).json({ error: "User not found" });
    res.json(users[0]);
  } catch (error) {
    console.error("Profile retrieval error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// NEW: Forgot Password endpoint with email sending
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });
    
    const [users] = await pool.query('SELECT id, username FROM users WHERE email = ?', [email]);
    if (users.length === 0) return res.status(404).json({ error: "User not found" });
    const user = users[0];
    
    // Generate a reset token (expires in 15 minutes)
    const resetToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '15m' });
    
    // Create a transporter using environment variables (configure these in your .env file)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    
    // Construct a reset link – ensure CLIENT_URL is set in your .env (e.g., http://localhost:3000)
    const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
    
    // Send email with the reset link
    const mailOptions = {
      from: `"BeatFly Support" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "BeatFly - Password Reset Request",
      text: `Hi ${user.username},\n\nYou requested a password reset. Click the link below to reset your password:\n\n${resetLink}\n\nIf you did not request this, please ignore this email.\n\nThanks,\nThe BeatFly Team`,
      html: `<p>Hi ${user.username},</p>
             <p>You requested a password reset. Click the link below to reset your password:</p>
             <p><a href="${resetLink}">${resetLink}</a></p>
             <p>If you did not request this, please ignore this email.</p>
             <p>Thanks,<br>The BeatFly Team</p>`
    };
    
    await transporter.sendMail(mailOptions);
    res.json({ message: "Password reset email sent successfully" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// NEW: Reset Password endpoint
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: "Token and new password are required" });
    
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, payload.id]);
    res.json({ message: "Password has been reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(400).json({ error: "Invalid or expired token" });
  }
};
