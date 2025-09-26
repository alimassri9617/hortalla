import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const API_PREFIX = "/api";

app.use(cors());
app.use(express.json());

// Cloudinary config
cloudinary.config({
cloud_name:"dfqoetbhv",
api_key:"376748484657273",
api_secret:"SR9dTAqBX9YCgRGfIXwk07Cza6o"

});


// MongoDB
const MONGO_URI = "mongodb+srv://alimassri:alimassri9617@cluster06.q9vvhx0.mongodb.net/hortallaDB?retryWrites=true&w=majority&appName=Cluster06";
mongoose.connect(MONGO_URI).then(() => console.log("✅ MongoDB connected")).catch(err => console.error(err));

// Schemas
const noteSchema = new mongoose.Schema({
  text: String,
  imageUrl: String,
  createdAt: { type: Date, default: Date.now }
});
const Note = mongoose.model("Note", noteSchema);

const calendarSchema = new mongoose.Schema({
  date: String,
  event: String,
  createdAt: { type: Date, default: Date.now }
});
const CalendarItem = mongoose.model("CalendarItem", calendarSchema);

// Multer
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Admin login
import crypto from "crypto";
const ADMIN_USERNAME_MD5 = crypto.createHash("md5").update("issamkaram9617").digest("hex");
const ADMIN_PASSWORD_MD5 = crypto.createHash("md5").update("issamkaram9617").digest("hex");

app.post(`${API_PREFIX}/admin/login`, (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME_MD5 && password === ADMIN_PASSWORD_MD5) {
    return res.json({ success: true });
  }
  return res.status(401).json({ success: false, message: "Invalid credentials" });
});

// Notes
app.get(`${API_PREFIX}/notes`, async (req, res) => {
  const notes = await Note.find().sort({ createdAt: -1 });
  res.json(notes);
});

app.post(`${API_PREFIX}/notes`, upload.single("image"), async (req, res) => {
  try {
    const text = req.body.text;
    let imageUrl = "";

    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ folder: "hortalla" }, (error, result) => {
          if (result) resolve(result);
          else reject(error);
        });
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
      imageUrl = result.secure_url;
    }

    const note = new Note({ text, imageUrl });
    await note.save();
    res.status(201).json(note);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

app.delete(`${API_PREFIX}/notes/:id`, async (req, res) => {
  try {
    const note = await Note.findByIdAndDelete(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
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

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
