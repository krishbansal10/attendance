import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import { fileURLToPath } from "url";
import { dirname } from "path";
import moment from "moment-timezone";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const __dirname = dirname(fileURLToPath(import.meta.url));

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(express.json());

// Connect to MongoDB
mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB Atlas connected successfully!"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Define Student Schema
const studentSchema = new mongoose.Schema({
  name: String,
  roll_number: String,
  fingerprint_id: String,
});

const Student = mongoose.model("Student", studentSchema);

// Define Attendance Schema
const attendanceSchema = new mongoose.Schema({
  student_id: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
  timestamp: { type: Date, default: Date.now },
});

const Attendance = mongoose.model("Attendance", attendanceSchema);

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/attendance/:day?/:month?/:year?", async (req, res) => {
  try {
    let { day, month, year } = req.params;

    // If no date is provided, use today's date
    if (!day || !month || !year) {
      const today = moment().tz("Asia/Kolkata").format("DD/MM/YYYY");
      [day, month, year] = today.split("/");
      return res.redirect(`/attendance/${day}/${month}/${year}`);
    }

    const dateString = `${day}/${month}/${year}`; // Format: "31/03/2025"
    const dateMoment = moment.tz(dateString, "DD/MM/YYYY", "Asia/Kolkata");

    if (!dateMoment.isValid()) {
      return res.status(400).send("Invalid date format. Use dd/mm/yyyy");
    }

    const dayStart = dateMoment.startOf("day").toDate();
    const dayEnd = dateMoment.endOf("day").toDate();

    const logs = await Attendance.find({
      timestamp: { $gte: dayStart, $lte: dayEnd }
    }).populate("student_id");

    logs.sort((a, b) => (a.student_id?.roll_number || "").localeCompare(b.student_id?.roll_number || ""));

    res.render("attendance", { logs, date: dateString });
  } catch (err) {
    console.error("Error fetching attendance logs:", err);
    res.status(500).send("Error fetching logs");
  }
});

app.get("/students", async (req, res) => {
  try {
    const logs = await Student.find();
    logs.sort((a, b) => parseInt(a.roll_number.match(/\d+$/)) - parseInt(b.roll_number.match(/\d+$/)));
    res.render("students", { logs });
  } catch (err) {
    console.error("Error fetching attendance logs:", err);
    res.status(500).send("Error fetching logs");
  }
});

// API to Register a Student
app.post("/register", async (req, res) => {
  try {
    const { name, roll_number, fingerprint_id } = req.body;
    const student = new Student({ name, roll_number, fingerprint_id });
    await student.save();
    res.status(201).json({ message: "Student registered successfully" });
  } catch (err) {
    res.status(500).json({ error: "Error registering student" });
  }
});

// API to Log Attendance
app.post("/log-scan", async (req, res) => {
  try {
    const { fingerprint_id } = req.body;
    const student = await Student.findOne({ fingerprint_id });

    if (!student) {
      return res.status(404).json({ message: "Fingerprint not recognized" });
    }

    const istTime = moment().tz("Asia/Kolkata").toDate();
    const attendance = new Attendance({ 
      student_id: student._id,
      timestamp: istTime,
    });

    await attendance.save();
    res.json({ message: "Attendance logged", student });
  } catch (err) {
    res.status(500).json({ error: "Error logging attendance" });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
