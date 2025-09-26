// import express from "express";
// import mongoose from "mongoose";
// import cors from "cors";
// import multer from "multer";
// import { v2 as cloudinary } from "cloudinary";
// import streamifier from "streamifier";
// import dotenv from "dotenv";

// dotenv.config();

// const app = express();
// const PORT = process.env.PORT || 5000;
// const API_PREFIX = "/api";

// app.use(cors());
// app.use(express.json());

// // Cloudinary config
// cloudinary.config({
// cloud_name:"dfqoetbhv",
// api_key:"376748484657273",
// api_secret:"SR9dTAqBX9YCgRGfIXwk07Cza6o"

// });


// // MongoDB
// const MONGO_URI = "mongodb+srv://alimassri:alimassri9617@cluster06.q9vvhx0.mongodb.net/hortallaDB?retryWrites=true&w=majority&appName=Cluster06";
// mongoose.connect(MONGO_URI).then(() => console.log("✅ MongoDB connected")).catch(err => console.error(err));

// // Schemas
// const noteSchema = new mongoose.Schema({
//   text: String,
//   imageUrl: String,
//   createdAt: { type: Date, default: Date.now }
// });
// const Note = mongoose.model("Note", noteSchema);

// const calendarSchema = new mongoose.Schema({
//   date: String,
//   event: String,
//   createdAt: { type: Date, default: Date.now }
// });
// const CalendarItem = mongoose.model("CalendarItem", calendarSchema);

// // Multer
// const storage = multer.memoryStorage();
// const upload = multer({ storage });

// // Admin login
// import crypto from "crypto";
// const ADMIN_USERNAME_MD5 = crypto.createHash("md5").update("issamkaram9617").digest("hex");
// const ADMIN_PASSWORD_MD5 = crypto.createHash("md5").update("issamkaram9617").digest("hex");

// app.post(`${API_PREFIX}/admin/login`, (req, res) => {
//   const { username, password } = req.body;
//   if (username === ADMIN_USERNAME_MD5 && password === ADMIN_PASSWORD_MD5) {
//     return res.json({ success: true });
//   }
//   return res.status(401).json({ success: false, message: "Invalid credentials" });
// });

// // Notes
// app.get(`${API_PREFIX}/notes`, async (req, res) => {
//   const notes = await Note.find().sort({ createdAt: -1 });
//   res.json(notes);
// });

// app.post(`${API_PREFIX}/notes`, upload.single("image"), async (req, res) => {
//   try {
//     const text = req.body.text;
//     let imageUrl = "";

//     if (req.file) {
//       const result = await new Promise((resolve, reject) => {
//         const stream = cloudinary.uploader.upload_stream({ folder: "hortalla" }, (error, result) => {
//           if (result) resolve(result);
//           else reject(error);
//         });
//         streamifier.createReadStream(req.file.buffer).pipe(stream);
//       });
//       imageUrl = result.secure_url;
//     }

//     const note = new Note({ text, imageUrl });
//     await note.save();
//     res.status(201).json(note);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: err.message });
//   }
// });

// app.delete(`${API_PREFIX}/notes/:id`, async (req, res) => {
//   try {
//     const note = await Note.findByIdAndDelete(req.params.id);
//     if (!note) return res.status(404).json({ message: "Note not found" });
//     res.json({ success: true });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });

// // Calendar
// app.get(`${API_PREFIX}/calendar`, async (req, res) => {
//   const events = await CalendarItem.find().sort({ date: 1 });
//   res.json(events);
// });

// app.post(`${API_PREFIX}/calendar`, async (req, res) => {
//   const { date, event } = req.body;
//   const ev = new CalendarItem({ date, event });
//   await ev.save();
//   res.status(201).json(ev);
// });

// app.delete(`${API_PREFIX}/calendar/:id`, async (req, res) => {
//   await CalendarItem.findByIdAndDelete(req.params.id);
//   res.json({ success: true });
// });

// app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));



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

// Cloudinary config
cloudinary.config({
cloud_name:"dfqoetbhv",
api_key:"376748484657273",
api_secret:"SR9dTAqBX9YCgRGfIXwk07Cza6o"

});

// MongoDB connect
const MONGO_URI = "mongodb+srv://alimassri:alimassri9617@cluster06.q9vvhx0.mongodb.net/hortallaDB?retryWrites=true&w=majority&appName=Cluster06";

if (!MONGO_URI) {
  console.error("Missing MONGO_URI in .env");
  process.exit(1);
}
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });

// Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Models
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

// Admin credentials (from .env)
// store plain admin user/pass in .env (or hashed) — here we compare plain then create token
const ADMIN_USER = process.env.ADMIN_USER || "issamkaram9617";
const ADMIN_PASS = process.env.ADMIN_PASS || "issamkaram9617";
const JWT_SECRET = process.env.JWT_SECRET || "replace_this_with_a_strong_secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h"; // 1 hour

// Helpers
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
    req.admin = decoded; // { user: ADMIN_USER }
    next();
  });
}

// Routes

app.get("/", (req, res) => res.send("Hortalla API running"));

// Admin login
// Accepts { username, password } in JSON body (plain text). Returns { token } if ok.
// You can replace this with hashed password compare if needed.
app.post(`${API_PREFIX}/admin/login`, (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ message: "username and password required" });

  // OPTIONAL: support MD5 hashed submission: if client sends MD5 you can compare hashes.
  // Here we accept plain text compare (safer if using HTTPS). If you want MD5 from frontend,
  // you can compare crypto.createHash('md5').update(ADMIN_USER).digest('hex') etc.
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = generateToken({ user: ADMIN_USER });
    return res.json({ success: true, token, expiresIn: JWT_EXPIRES_IN });
  } else {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
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
    // We don't delete Cloudinary image here (could be implemented if you stored public_id)
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
