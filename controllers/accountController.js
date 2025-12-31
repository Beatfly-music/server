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
  secure: true,
  auth: {
    user: process.env.SMTP_USER,   // support
    pass: process.env.SMTP_PASS
  },
  authMethod: "LOGIN"
});

    
    // Construct a reset link – ensure CLIENT_URL is set in your .env (e.g., http://localhost:3000)
    const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
  from: '"BeatFly Support" <support@beatfly-music.xyz>',
  sender: 'support@beatfly-music.xyz',
  envelope: {
    from: 'support@beatfly-music.xyz',
    to: email
  },
  to: email,
  subject: "BeatFly – Reset Your Password",

  text: `
Hi ${user.username},

We received a request to reset your BeatFly password.

Reset your password using the link below (valid for 15 minutes):
${resetLink}

If you didn’t request this, you can safely ignore this email.

— BeatFly Support
  `.trim(),

html: `
<div style="margin:0; padding:0; background:#0b0b0f; color:#e5e7eb;
            font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">

  <div style="max-width:520px;
              margin:40px auto;
              background:#111118;
              border-radius:14px;
              padding:32px;
              box-shadow:0 20px 40px rgba(0,0,0,0.5);">

    <h1 style="margin:0 0 20px;
               font-size:24px;
               text-align:center;
               color:#E91E63;">
      BeatFly Music
    </h1>

    <p style="margin:0 0 16px;
              font-size:16px;
              line-height:1.6;
              color:#e5e7eb;">
      Hi <strong>${user.username}</strong>,
    </p>

    <p style="margin:0 0 20px;
              font-size:16px;
              line-height:1.6;
              color:#e5e7eb;">
      We received a request to reset your BeatFly password.
    </p>

    <p style="margin:0 0 28px;
              font-size:16px;
              line-height:1.6;
              color:#e5e7eb;">
      Click the button below to continue. This link will expire in
      <strong>15 minutes</strong>.
    </p>

    <div style="text-align:center; margin:32px 0;">
      <a href="${resetLink}"
         style="display:inline-block;
                padding:14px 28px;
                background:#E91E63;
                color:#ffffff;
                text-decoration:none;
                font-weight:600;
                border-radius:10px;">
        Reset Password
      </a>
    </div>

    <p style="font-size:14px;
              line-height:1.6;
              color:#c7c7d1;
              word-break:break-all;">
      Or visit:<br>
      <a href="${resetLink}"
         style="color:#E91E63; text-decoration:none;">
        ${resetLink}
      </a>
    </p>

    <p style="margin-top:24px;
              font-size:14px;
              line-height:1.6;
              color:#9ca3af;">
      If you didn’t request this, you can safely ignore this email.
    </p>

    <hr style="border:none;
               border-top:1px solid #1f1f2a;
               margin:32px 0;">

    <p style="margin:0;
              font-size:12px;
              text-align:center;
              color:#6b7280;">
      © ${new Date().getFullYear()} BeatFly Music<br>
      This is an automated message — please do not reply.
    </p>

  </div>
</div>
`
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
