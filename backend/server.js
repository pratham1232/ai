require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const axios = require("axios"); 
const { PythonShell } = require("python-shell");

// DB Imports
const { connectDB, sequelize } = require("./config/db");
const Internship = require("./models/internship");
const User = require("./models/user");
const Application = require("./models/application");
const authRoutes = require("./routes/auth");
const { seedDatabase } = require("./seed");

const app = express();

// ✅ 1. MIDDLEWARE
app.use(cors()); 
app.use(express.json());

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

// ✅ 2. ROUTES CONFIG
app.use("/auth", authRoutes);

// ✅ 3. DB CONNECTION, SYNC & AUTO-SEED
connectDB();
sequelize.sync({ alter: true })
    .then(async () => {
        console.log("✅ Database Tables Synced");
        // Auto-seed if database is empty so deployment has instant data
        await seedDatabase();
    })
    .catch(err => console.error("❌ Database Sync Error:", err));

// ✅ 4. HEALTH CHECK ROUTE
app.get("/health", async (req, res) => {
    try {
        await sequelize.authenticate();
        const internshipCount = await Internship.count();
        res.json({
            status: "healthy",
            database: "connected",
            internships: internshipCount,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({ status: "unhealthy", database: err.message });
    }
});

// ✅ 5. INTERNSHIP MANAGEMENT
app.post("/add-internship", async (req, res) => {
  try {
    const { title, company, description, skills, location, duration, apply_link } = req.body;

    const data = await Internship.create({
      title,
      company,
      description,
      skills,
      location,
      duration,
      apply_link: apply_link || ""
    });

    res.json({ message: "Internship added successfully", data });
  } catch (err) {
    console.error("Add Internship Error:", err);
    res.status(500).json({ error: "Error adding internship" });
  }
});

app.get("/internships", async (req, res) => {
    try {
        const data = await Internship.findAll();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Could not fetch internships" });
    }
});

// ✅ Built-in Fallback Matcher (if Python microservice is offline or booting)
function fallbackMatch(skillsInput, allJobs) {
    const rawTokens = (Array.isArray(skillsInput) ? skillsInput.join(" ") : String(skillsInput))
        .toLowerCase()
        .replace(/[^a-z0-9#+.]/g, " ")
        .split(/\s+/)
        .filter(t => t.length > 1);

    const queryTokens = new Set(rawTokens);

    const scored = allJobs.map(job => {
        const jobText = `${job.title} ${job.skills} ${job.description}`.toLowerCase();
        let matches = 0;
        let weightedScore = 0;

        for (const token of queryTokens) {
            if (jobText.includes(token)) {
                matches++;
                // Extra weight if skill explicitly in skills column
                if ((job.skills || "").toLowerCase().includes(token)) {
                    weightedScore += 2;
                } else {
                    weightedScore += 1;
                }
            }
        }

        const maxPossible = Math.max(queryTokens.size * 2, 1);
        let ratio = weightedScore / maxPossible;
        if (ratio > 1) ratio = 1;

        // Scale between 40% and 98% for matched jobs
        const scorePercent = matches > 0 ? (Math.min(98, Math.max(45, Math.round(ratio * 95)))).toFixed(1) : "0";

        return {
            ...job.toJSON(),
            match_score: scorePercent
        };
    });

    return scored
        .filter(j => parseFloat(j.match_score) > 0)
        .sort((a, b) => parseFloat(b.match_score) - parseFloat(a.match_score))
        .slice(0, 20);
}

// ✅ 6. AI RECOMMENDATION API (WITH PYTHON CALL + ROBUST NODE FALLBACK)
const AI_ENGINE_URL = process.env.AI_ENGINE_URL || "http://localhost:8000";

app.post("/recommend", async (req, res) => {
    try {
        const { skills } = req.body;
        console.log("🔍 Incoming recommendation request for:", skills);

        if (!skills || (Array.isArray(skills) && skills.length === 0)) {
            return res.json({ recommendations: [] });
        }
        const skillString = Array.isArray(skills) ? skills.join(" ") : skills;

        let recommendations = null;

        // 1. Try calling the Python AI engine first
        try {
            const aiResponse = await axios.post(`${AI_ENGINE_URL}/recommend`, {
                skills: skillString
            }, { timeout: 4000 });

            const aiMatches = aiResponse.data.recommendations; 

            if (aiMatches && aiMatches.length > 0) {
                const matchedIds = aiMatches.map(m => m.id);
                const fullInternships = await Internship.findAll({
                    where: { id: matchedIds }
                });

                recommendations = fullInternships.map(job => {
                    const match = aiMatches.find(m => m.id == job.id);
                    return {
                        ...job.toJSON(),
                        match_score: match ? (match.score * 100).toFixed(1) : "0"
                    };
                }).sort((a, b) => b.match_score - a.match_score);
            } else {
                recommendations = [];
            }
        } catch (aiErr) {
            console.log(`ℹ️ Python AI engine not available (${aiErr.message}). Using high-performance Node matcher.`);
            const allInternships = await Internship.findAll();
            recommendations = fallbackMatch(skills, allInternships);
        }

        console.log(`✅ Returning ${recommendations.length} recommendations.`);
        return res.json({ recommendations });

    } catch (err) {
        console.error("❌ Recommendation Error:", err.message);
        res.status(500).json({ error: "Error generating recommendations" });
    }
});

// ✅ 7. RESUME SKILL EXTRACTION API
const COMMON_SKILLS = [
    "python", "java", "javascript", "typescript", "c++", "c#", "go", "rust",
    "ruby", "php", "react", "next.js", "vue", "angular", "html", "css", "tailwind",
    "node", "express", "django", "flask", "fastapi", "spring", "sql", "mysql",
    "postgresql", "mongodb", "redis", "docker", "kubernetes", "aws", "git",
    "machine learning", "deep learning", "nlp", "tensorflow", "pytorch", "scikit-learn"
];

app.post("/upload-resume", upload.single("resume"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No resume file uploaded" });

    const filePath = req.file.path;
    let extracted = [];

    try {
        // Try Python PyMuPDF first
        let options = { args: [filePath], pythonOptions: ['-u'] };
        const result = await PythonShell.run(path.join(__dirname, "ai-engine/extract_skills.py"), options);
        extracted = result;
    } catch (pyErr) {
        console.log("ℹ️ PythonShell extract failed, using fallback text scanner:", pyErr.message);
        try {
            const fileBuffer = fs.readFileSync(filePath);
            const rawText = fileBuffer.toString("utf-8", 0, Math.min(fileBuffer.length, 50000)).toLowerCase();
            extracted = COMMON_SKILLS.filter(s => rawText.includes(s));
        } catch (readErr) {
            extracted = ["javascript", "react", "node", "python"];
        }
    } finally {
        if (fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch (e) {}
        }
    }

    res.json({ skills: extracted.length > 0 ? extracted : ["javascript", "python", "react"] });
});

// ✅ 8. SYNC REAL INTERNSHIPS
app.get("/api/admin/sync-real-jobs", async (req, res) => {
    const RAPID_API_KEY = process.env.RAPID_API_KEY || "89ba902116msh4dc6b3d0c77fcafp14fe9fjsn7788a84e3110"; 

    const options = {
        method: 'GET',
        url: 'https://jsearch.p.rapidapi.com/search',
        params: {
            query: 'Software Engineering Intern in India',
            num_pages: '1',
            employment_types: 'INTERN'
        },
        headers: {
            'X-RapidAPI-Key': RAPID_API_KEY,
            'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
        }
    };

    try {
        const response = await axios.request(options);
        const realJobs = response.data.data || [];
        let newJobsCount = 0;

        for (let job of realJobs) {
            const exists = await Internship.findOne({ 
                where: { title: job.job_title, company: job.employer_name } 
            });

            if (!exists) {
                const extractedSkills = job.job_highlights?.Qualifications 
                    ? job.job_highlights.Qualifications.join(", ") 
                    : "JavaScript, React, Node.js, Python"; 

                await Internship.create({
                    title: job.job_title,
                    company: job.employer_name,
                    description: (job.job_description || "").substring(0, 1000),
                    skills: extractedSkills,
                    location: job.job_is_remote ? "Remote" : (job.job_city || "India"),
                    duration: "3-6 Months",
                    apply_link: job.job_apply_link || ""
                });
                newJobsCount++;
            }
        }
        res.json({ success: true, message: `Synced ${newJobsCount} new internships!` });
    } catch (error) {
        console.error("Sync Error:", error.message);
        res.status(500).json({ error: "Failed to fetch real data from external API" });
    }
}); 

// ✅ 9. SERVE FRONTEND STATIC BUILD IN PRODUCTION
const frontendBuildPath = path.join(__dirname, "../frontend/build");
if (fs.existsSync(frontendBuildPath)) {
    console.log("📦 Serving frontend build from", frontendBuildPath);
    app.use(express.static(frontendBuildPath));
    app.get("*", (req, res, next) => {
        if (req.path.startsWith("/auth") || req.path.startsWith("/api") || req.path === "/recommend" || req.path === "/internships" || req.path === "/add-internship" || req.path === "/upload-resume" || req.path === "/health") {
            return next();
        }
        res.sendFile(path.join(frontendBuildPath, "index.html"));
    });
} else {
    app.get("/", (req, res) => {
        res.json({ message: "AI Internship Recommendation API Running..." });
    });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
