// server.js
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import multer from "multer";
import streamifier from "streamifier";
import { v2 as cloudinary } from "cloudinary";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const API_PREFIX = "/api";

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ---------------- Cloudinary ----------------
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME || process.env.CLOUD_CLOUD_NAME || "dfqoetbhv",
  api_key: process.env.CLOUD_API_KEY || "376748484657273",
  api_secret: process.env.CLOUD_API_SECRET || "SR9dTAqBX9YCgRGfIXwk07Cza6o",
});

// ---------------- MongoDB ----------------
// put your connection string in .env as MONGO_URI
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://alimassri:alimassri9617@cluster06.q9vvhx0.mongodb.net/hortallaDB?retryWrites=true&w=majority&appName=Cluster06";

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });

// ---------------- Multer (memory) ----------------
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ---------------- Mongoose models ----------------
const noteSchema = new mongoose.Schema({
  text: { type: String, required: true },
  imageUrl: String,
  createdAt: { type: Date, default: Date.now },
});
const Note = mongoose.model("Note", noteSchema);

const calendarSchema = new mongoose.Schema({
  date: { type: String, required: true }, // YYYY-MM-DD
  event: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
const CalendarItem = mongoose.model("CalendarItem", calendarSchema);

// ---------------- Admin & JWT config ----------------
// You can override these via .env
const ADMIN_USER = process.env.ADMIN_USER || "issamkaram9617";
const ADMIN_PASS = process.env.ADMIN_PASS || "issamkaram9617";
const JWT_SECRET = process.env.JWT_SECRET || "replace_this_with_a_strong_secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Missing Authorization header" });
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return res.status(401).json({ message: "Invalid Authorization format" });
  const token = parts[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });
    req.admin = decoded;
    next();
  });
}

// ---------------- Routes ----------------
app.get("/", (req, res) => res.send("Hortalla API running"));

// Admin login
// Accepts either plain username/password or MD5-hashed values depending on client
app.post(`${API_PREFIX}/admin/login`, (req, res) => {
  try {
    const { username, password, md5 } = req.body || {};
    if (!username || !password) return res.status(400).json({ message: "username and password required" });

    // If client indicates md5=true then compare against md5(ADMIN_USER)/md5(ADMIN_PASS)
    if (md5) {
      const adminUserMd5 = crypto.createHash("md5").update(ADMIN_USER).digest("hex");
      const adminPassMd5 = crypto.createHash("md5").update(ADMIN_PASS).digest("hex");
      if (username === adminUserMd5 && password === adminPassMd5) {
        const token = generateToken({ user: ADMIN_USER });
        return res.json({ success: true, token, expiresIn: JWT_EXPIRES_IN });
      }
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    // default: plain compare (recommended to use HTTPS)
    if (username === ADMIN_USER && password === ADMIN_PASS) {
      const token = generateToken({ user: ADMIN_USER });
      return res.json({ success: true, token, expiresIn: JWT_EXPIRES_IN });
    }

    return res.status(401).json({ success: false, message: "Invalid credentials" });
  } catch (err) {
    console.error("admin/login error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// PUBLIC: Get notes
app.get(`${API_PREFIX}/notes`, async (req, res) => {
  try {
    const notes = await Note.find().sort({ createdAt: -1 }).lean();
    res.json(notes);
  } catch (err) {
    console.error("GET /notes error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PROTECTED: Create note (image upload -> cloudinary)
app.post(`${API_PREFIX}/notes`, authMiddleware, upload.single("image"), async (req, res) => {
  try {
    const text = req.body.text;
    if (!text) return res.status(400).json({ message: "text is required" });

    let imageUrl = "";
    if (req.file && req.file.buffer) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ folder: "hortalla" }, (error, result) => {
          if (error) reject(error);
          else resolve(result);
        });
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
      imageUrl = result.secure_url;
    }

    const note = await Note.create({ text, imageUrl: imageUrl || null });
    res.status(201).json(note);
  } catch (err) {
    console.error("POST /notes error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PROTECTED: Delete note
app.delete(`${API_PREFIX}/notes/:id`, authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    const note = await Note.findByIdAndDelete(id);
    if (!note) return res.status(404).json({ message: "Note not found" });
    // optionally delete Cloudinary resource if you stored public_id
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /notes error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUBLIC: Get calendar
app.get(`${API_PREFIX}/calendar`, async (req, res) => {
  try {
    const events = await CalendarItem.find().sort({ date: 1 }).lean();
    res.json(events);
  } catch (err) {
    console.error("GET /calendar error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PROTECTED: Create calendar event
app.post(`${API_PREFIX}/calendar`, authMiddleware, async (req, res) => {
  try {
    const { date, event } = req.body;
    if (!date || !event) return res.status(400).json({ message: "date and event required" });
    const ev = await CalendarItem.create({ date, event });
    res.status(201).json(ev);
  } catch (err) {
    console.error("POST /calendar error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PROTECTED: Delete calendar event
app.delete(`${API_PREFIX}/calendar/:id`, authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    const ev = await CalendarItem.findByIdAndDelete(id);
    if (!ev) return res.status(404).json({ message: "Event not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /calendar error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Start
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
