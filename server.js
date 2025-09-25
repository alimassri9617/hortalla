// server.js
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import crypto from "crypto";

// ===== إعدادات =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

const app = express();
const PORT = 5000;
const API_PREFIX = "/api";

app.use(cors());
app.use(express.json());
app.use("/api/uploads", express.static(UPLOADS_DIR));

// ===== Multer =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + "-" + Math.random().toString(36).slice(2, 9) + ext);
  }
});
const upload = multer({ storage });

// ===== اتصال MongoDB =====
const MONGO_URI = "mongodb+srv://alimassri:alimassri9617@cluster06.q9vvhx0.mongodb.net/hortallaDB?retryWrites=true&w=majority&appName=Cluster06";
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// ===== موديلات =====
const noteSchema = new mongoose.Schema({
  text: String,
  imagePath: String,
  createdAt: { type: Date, default: Date.now }
});
const Note = mongoose.model("Note", noteSchema);

const calendarSchema = new mongoose.Schema({
  date: String,
  event: String,
  createdAt: { type: Date, default: Date.now }
});
const CalendarItem = mongoose.model("CalendarItem", calendarSchema);

// ===== بيانات الأدمن =====
const ADMIN_USERNAME_MD5 = crypto.createHash("md5").update("issamkaram").digest("hex");
const ADMIN_PASSWORD_MD5 = crypto.createHash("md5").update("issamkaram").digest("hex");

// ===== Routes =====
app.get("/", (req, res) => res.send("🌿 Hortalla API running"));

// Login
app.post(`${API_PREFIX}/admin/login`, (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME_MD5 && password === ADMIN_PASSWORD_MD5) {
    return res.json({ success: true });
  }
  return res.status(401).json({ success: false });
});

// Notes
app.get(`${API_PREFIX}/notes`, async (req, res) => {
  const notes = await Note.find().sort({ createdAt: -1 });
  res.json(notes);
});
app.post(`${API_PREFIX}/notes`, upload.single("image"), async (req, res) => {
  const { text } = req.body;
  const imagePath = req.file ? `/api/uploads/${req.file.filename}` : null;
  const note = new Note({ text, imagePath });
  await note.save();
  res.status(201).json(note);
});
app.delete(`${API_PREFIX}/notes/:id`, async (req, res) => {
  const note = await Note.findByIdAndDelete(req.params.id);
  if (note?.imagePath) {
    const filePath = path.join(UPLOADS_DIR, path.basename(note.imagePath));
    fs.unlink(filePath, () => {});
  }
  res.json({ success: true });
});

// Calendar
app.get(`${API_PREFIX}/calendar`, async (req, res) => {
  const events = await CalendarItem.find().sort({ date: 1 });
  res.json(events);
});
app.post(`${API_PREFIX}/calendar`, async (req, res) => {
  const { date, event } = req.body;
  const ev = new CalendarItem({ date, event });
  await ev.save();
  res.status(201).json(ev);
});
app.delete(`${API_PREFIX}/calendar/:id`, async (req, res) => {
  await CalendarItem.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
