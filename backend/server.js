const OpenAI = require("openai");

require("dotenv").config({
  path: __dirname + "/.env"
});

console.log(
  "Gemini API key loaded:",
  Boolean(process.env.GEMINI_API_KEY)
);

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const { GoogleGenAI } = require("@google/genai");
const { z } = require("zod");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

const databasePath = path.resolve(
  __dirname,
  process.env.DATABASE_PATH || "./src/database/novaworks.db"
);

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const db = new Database(databasePath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('ADMIN','MANAGER','AGENT')),
    specialization TEXT NOT NULL DEFAULT '',
    skills TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    client TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    manager_id INTEGER NOT NULL,
    deadline TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(manager_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    assignee_id INTEGER NOT NULL,
    estimated_hours REAL NOT NULL CHECK(estimated_hours > 0),
    deadline TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(assignee_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_projects_manager
    ON projects(manager_id);

  CREATE INDEX IF NOT EXISTS idx_tasks_project
    ON tasks(project_id);

  CREATE INDEX IF NOT EXISTS idx_tasks_assignee
    ON tasks(assignee_id);
`);

const employees = [
  {
    code: "ADMIN",
    name: "Admin",
    email: "admin@novaworks.example",
    role: "ADMIN",
    specialization: "Company Administration",
    skills: "Company overview, transcript creation"
  },
  {
    code: "PM01",
    name: "Ayesha Khan",
    email: "ayesha@novaworks.example",
    role: "MANAGER",
    specialization: "Web PM",
    skills: "Web projects, client coordination"
  },
  {
    code: "PM02",
    name: "Bilal Ahmed",
    email: "bilal@novaworks.example",
    role: "MANAGER",
    specialization: "Mobile PM",
    skills: "Mobile projects, delivery planning"
  },
  {
    code: "PM03",
    name: "Hina Malik",
    email: "hina@novaworks.example",
    role: "MANAGER",
    specialization: "AI PM",
    skills: "AI projects, requirement review"
  },
  {
    code: "DEV01",
    name: "Ali Raza",
    email: "ali@novaworks.example",
    role: "AGENT",
    specialization: "Full-Stack",
    skills: "React, frontend integration"
  },
  {
    code: "DEV02",
    name: "Hamza Shah",
    email: "hamza@novaworks.example",
    role: "AGENT",
    specialization: "Full-Stack",
    skills: "Node.js, databases, APIs"
  },
  {
    code: "DEV03",
    name: "Sara Noor",
    email: "sara@novaworks.example",
    role: "AGENT",
    specialization: "App Developer",
    skills: "Flutter, mobile UI"
  },
  {
    code: "DEV04",
    name: "Usman Tariq",
    email: "usman@novaworks.example",
    role: "AGENT",
    specialization: "App Developer",
    skills: "Flutter, integration, testing"
  },
  {
    code: "DEV05",
    name: "Zain Abbas",
    email: "zain@novaworks.example",
    role: "AGENT",
    specialization: "AI Developer",
    skills: "LLMs, extraction, prompts"
  },
  {
    code: "DEV06",
    name: "Maryam Asif",
    email: "maryam@novaworks.example",
    role: "AGENT",
    specialization: "AI Developer",
    skills: "Retrieval, document processing"
  }
];

async function seedUsers() {
  const passwordHash = await bcrypt.hash("Demo123!", 12);

  const insert = db.prepare(`
    INSERT INTO users
      (code, name, email, password_hash, role, specialization, skills)
    VALUES
      (@code, @name, @email, @password_hash, @role, @specialization, @skills)
    ON CONFLICT(email) DO UPDATE SET
      code = excluded.code,
      name = excluded.name,
      role = excluded.role,
      specialization = excluded.specialization,
      skills = excluded.skills
  `);

  const transaction = db.transaction(() => {
    for (const employee of employees) {
      insert.run({ ...employee, password_hash: passwordHash });
    }
  });

  transaction();
}

function seedDemoProjects() {
  const getUser = db.prepare("SELECT id FROM users WHERE code = ?");

  const insertProject = db.prepare(`
    INSERT INTO projects (name, client, description, manager_id, deadline)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertTask = db.prepare(`
    INSERT INTO tasks
      (project_id, title, description, assignee_id, estimated_hours, deadline)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const demoProjects = [
    {
      name: "UrbanCart Website",
      client: "UrbanCart Clothing",
      description: "Responsive product listing and product details website with a demonstration cart. No real checkout, payment processing, or inventory integration.",
      manager: "PM01",
      deadline: "2026-10-20",
      tasks: [
        ["Product catalog UI", "Build responsive product listing and details interfaces.", "DEV01", 12, "2026-10-12"],
        ["Demo cart UI", "Create a demonstration shopping cart without payment processing.", "DEV01", 8, "2026-10-15"],
        ["Product and cart APIs", "Develop backend APIs for product and cart functionality.", "DEV02", 14, "2026-10-14"],
        ["Website integration and testing", "Integrate website components and perform testing.", "DEV01", 6, "2026-10-19"]
      ]
    },
    {
      name: "QuickServe Mobile App",
      client: "QuickServe Services",
      description: "Flutter customer application with login, service booking, and booking status. No maps, driver tracking, or payments.",
      manager: "PM02",
      deadline: "2026-10-24",
      tasks: [
        ["Login and profile screens", "Build customer login and profile screens.", "DEV03", 8, "2026-10-12"],
        ["Service booking screens", "Develop the service selection and booking interfaces.", "DEV03", 12, "2026-10-17"],
        ["Booking and account APIs", "Develop APIs for booking and customer account management.", "DEV02", 16, "2026-10-16"],
        ["Mobile integration and testing", "Integrate mobile screens and test application functionality.", "DEV04", 10, "2026-10-22"]
      ]
    },
    {
      name: "HelpDeskPro AI Assistant",
      client: "HelpDeskPro Solutions",
      description: "Support assistant using supplied FAQ documents, abstaining from unsupported answers and saving unresolved questions for human review. No external email or ticket integration.",
      manager: "PM03",
      deadline: "2026-10-22",
      tasks: [
        ["FAQ document processing", "Process supplied FAQ documents for assistant knowledge.", "DEV06", 10, "2026-10-13"],
        ["Assistant answer generation", "Build answer generation based on supplied FAQ content.", "DEV05", 14, "2026-10-17"],
        ["Human escalation flow", "Save unresolved questions for human review.", "DEV05", 6, "2026-10-18"],
        ["Assistant evaluation and testing", "Evaluate assistant responses and test reliability.", "DEV06", 8, "2026-10-21"]
      ]
    }
  ];

  const seed = db.transaction(() => {
    for (const project of demoProjects) {
      const existing = db.prepare(
        "SELECT id FROM projects WHERE name = ? AND client = ?"
      ).get(project.name, project.client);

      if (existing) continue;

      const manager = getUser.get(project.manager);
      if (!manager) throw new Error(`Missing manager: ${project.manager}`);

      const result = insertProject.run(
        project.name,
        project.client,
        project.description,
        manager.id,
        project.deadline
      );

      for (const task of project.tasks) {
        const assignee = getUser.get(task[2]);
        if (!assignee) throw new Error(`Missing agent: ${task[2]}`);

        insertTask.run(
          result.lastInsertRowid,
          task[0],
          task[1],
          assignee.id,
          task[3],
          task[4]
        );
      }
    }
  });

  seed();
}

function createToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    code: user.code,
    name: user.name,
    email: user.email,
    role: user.role,
    specialization: user.specialization,
    skills: user.skills
  };
}

function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Authentication required." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = db.prepare(
      "SELECT id, code, name, email, role, specialization, skills FROM users WHERE id = ?"
    ).get(payload.id);

    if (!user) {
      return res.status(401).json({ message: "User no longer exists." });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Admin access required." });
  }
  next();
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function projectVisibility(user) {
  if (user.role === "ADMIN") {
    return { clause: "", params: [] };
  }

  if (user.role === "MANAGER") {
    return { clause: "WHERE p.manager_id = ?", params: [user.id] };
  }

  return {
    clause: `WHERE EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.project_id = p.id AND t.assignee_id = ?
    )`,
    params: [user.id]
  };
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "NovaWorks CRM API" });
});

// AUTH
app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = db.prepare("SELECT * FROM users WHERE email = ?")
      .get(email.trim().toLowerCase());

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: "Incorrect email or password." });
    }

    res.json({
      token: createToken(user),
      user: publicUser(user)
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", authenticate, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// TEAM DIRECTORY
app.get("/api/users", authenticate, (req, res) => {
  const users = db.prepare(`
    SELECT id, code, name, email, role, specialization, skills
    FROM users
    ORDER BY
      CASE role WHEN 'ADMIN' THEN 1 WHEN 'MANAGER' THEN 2 ELSE 3 END,
      name
  `).all();

  res.json({ users });
});

// PROJECT LIST
app.get("/api/projects", authenticate, (req, res) => {
  const visibility = projectVisibility(req.user);

  const projects = db.prepare(`
    SELECT
      p.*,
      u.name AS manager_name,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count
    FROM projects p
    JOIN users u ON u.id = p.manager_id
    ${visibility.clause}
    ORDER BY p.deadline ASC
  `).all(...visibility.params);

  res.json({ projects });
});

// PROJECT DETAIL
app.get("/api/projects/:id", authenticate, (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "Invalid project ID." });
  }

  const project = db.prepare(`
    SELECT p.*, u.name AS manager_name, u.email AS manager_email
    FROM projects p
    JOIN users u ON u.id = p.manager_id
    WHERE p.id = ?
  `).get(id);

  if (!project) {
    return res.status(404).json({ message: "Project not found." });
  }

  if (req.user.role === "MANAGER" && project.manager_id !== req.user.id) {
    return res.status(403).json({ message: "You cannot access this project." });
  }

  let tasks;

  if (req.user.role === "AGENT") {
    tasks = db.prepare(`
      SELECT t.*, u.name AS assignee_name, u.code AS assignee_code
      FROM tasks t
      JOIN users u ON u.id = t.assignee_id
      WHERE t.project_id = ? AND t.assignee_id = ?
      ORDER BY t.deadline ASC
    `).all(id, req.user.id);
  } else {
    tasks = db.prepare(`
      SELECT t.*, u.name AS assignee_name, u.code AS assignee_code
      FROM tasks t
      JOIN users u ON u.id = t.assignee_id
      WHERE t.project_id = ?
      ORDER BY t.deadline ASC
    `).all(id);
  }

  if (req.user.role === "AGENT" && tasks.length === 0) {
    return res.status(403).json({ message: "This project has no tasks assigned to you." });
  }

  res.json({ project, tasks });
});

// TASK LIST
app.get("/api/tasks", authenticate, (req, res) => {
  let tasks;

  if (req.user.role === "ADMIN") {
    tasks = db.prepare(`
      SELECT t.*, p.name AS project_name, u.name AS assignee_name,
             u.code AS assignee_code
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      JOIN users u ON u.id = t.assignee_id
      ORDER BY t.deadline ASC
    `).all();
  } else if (req.user.role === "MANAGER") {
    tasks = db.prepare(`
      SELECT t.*, p.name AS project_name, u.name AS assignee_name,
             u.code AS assignee_code
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      JOIN users u ON u.id = t.assignee_id
      WHERE p.manager_id = ?
      ORDER BY t.deadline ASC
    `).all(req.user.id);
  } else {
    tasks = db.prepare(`
      SELECT t.*, p.name AS project_name, u.name AS assignee_name,
             u.code AS assignee_code
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      JOIN users u ON u.id = t.assignee_id
      WHERE t.assignee_id = ?
      ORDER BY t.deadline ASC
    `).all(req.user.id);
  }

  res.json({ tasks });
});

// SINGLE TASK
app.get("/api/tasks/:id", authenticate, (req, res) => {
  const id = Number(req.params.id);

  const task = db.prepare(`
    SELECT t.*, p.name AS project_name, p.manager_id,
           u.name AS assignee_name, u.code AS assignee_code
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    JOIN users u ON u.id = t.assignee_id
    WHERE t.id = ?
  `).get(id);

  if (!task) return res.status(404).json({ message: "Task not found." });

  if (req.user.role === "MANAGER" && task.manager_id !== req.user.id) {
    return res.status(403).json({ message: "Access denied." });
  }

  if (req.user.role === "AGENT" && task.assignee_id !== req.user.id) {
    return res.status(403).json({ message: "Access denied." });
  }

  res.json({ task });
});

// AI TRANSCRIPT VALIDATION
const taskSchema = z.object({
  title: z.string().min(2),
  description: z.string().default(""),
  assigneeCode: z.string().min(1),
  estimatedHours: z.number().positive(),
  deadline: z.string()
});

const projectSchema = z.object({
  name: z.string().min(2),
  client: z.string().min(2),
  description: z.string().default(""),
  managerCode: z.string().min(1),
  deadline: z.string(),
  tasks: z.array(taskSchema).min(1)
});

const transcriptSchema = z.object({
  projects: z.array(projectSchema).min(1)
});

app.post("/api/transcripts/process", authenticate, adminOnly, async (req, res, next) => {
  try {
    const transcript = req.body?.transcript;

    if (typeof transcript !== "string" || transcript.trim().length < 30) {
      return res.status(400).json({
        message: "Please provide a meeting transcript containing at least 30 characters."
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        message: "Gemini API key is not configured. Add GEMINI_API_KEY to backend/.env."
      });
    }

    const directory = db.prepare(`
  SELECT id, code, name, role, specialization, skills
  FROM users ORDER BY code
`).all();

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `
You are the project extraction engine for NovaWorks Technologies.

Extract every project and every task explicitly agreed in the meeting transcript.
Do not invent employees, tasks, clients, deadlines, or estimates.
Ignore rejected proposals and out-of-scope ideas.
Use only employee codes from the supplied directory.
A managerCode must belong to a MANAGER.
An assigneeCode must belong to an AGENT.
Dates must be YYYY-MM-DD.
Estimated hours must be positive numbers.
Every task deadline must be on or before its project deadline.
Do not include passwords or personal information.

EMPLOYEE DIRECTORY:
${JSON.stringify(directory, null, 2)}

REQUIRED JSON FORMAT:
{
  "projects": [
    {
      "name": "Project name",
      "client": "Client name",
      "description": "Agreed scope",
      "managerCode": "PM01",
      "deadline": "2026-10-20",
      "tasks": [
        {
          "title": "Task title",
          "description": "Task description",
          "assigneeCode": "DEV01",
          "estimatedHours": 12,
          "deadline": "2026-10-12"
        }
      ]
    }
  ]
}

Return only valid JSON. No Markdown or commentary.

MEETING TRANSCRIPT:
${transcript}
`;

    const result = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    let raw = result.text;

    if (typeof raw === "function") raw = raw.call(result);

    if (typeof raw !== "string" || !raw.trim()) {
      throw new Error("Gemini returned an empty response.");
    }

    let parsedJson;

    try {
      parsedJson = JSON.parse(raw);
    } catch {
      throw new Error("Gemini returned invalid JSON. Please try the transcript again.");
    }

    const validation = transcriptSchema.safeParse(parsedJson);

    if (!validation.success) {
      return res.status(422).json({
        message: "AI extraction did not meet the required data format. Nothing was saved.",
        errors: validation.error.issues.map(issue => ({
          field: issue.path.join("."),
          message: issue.message
        })),
        extracted: parsedJson
      });
    }

    const data = validation.data;
    const employeeMap = new Map(directory.map(person => [person.code, person]));

    const errors = [];

    data.projects.forEach((project, projectIndex) => {
      if (!validDate(project.deadline)) {
        errors.push(`Project ${projectIndex + 1}: invalid deadline.`);
      }

      const manager = employeeMap.get(project.managerCode);

      if (!manager || manager.role !== "MANAGER") {
        errors.push(`Project ${projectIndex + 1}: ${project.managerCode} is not a valid manager.`);
      }

      project.tasks.forEach((task, taskIndex) => {
        if (!validDate(task.deadline)) {
          errors.push(`Project ${projectIndex + 1}, task ${taskIndex + 1}: invalid deadline.`);
        } else if (task.deadline > project.deadline) {
          errors.push(`Project ${projectIndex + 1}, task ${taskIndex + 1}: task deadline exceeds project deadline.`);
        }

        const assignee = employeeMap.get(task.assigneeCode);

        if (!assignee || assignee.role !== "AGENT") {
          errors.push(`Project ${projectIndex + 1}, task ${taskIndex + 1}: ${task.assigneeCode} is not a valid agent.`);
        }

        if (!Number.isFinite(task.estimatedHours) || task.estimatedHours <= 0) {
          errors.push(`Project ${projectIndex + 1}, task ${taskIndex + 1}: hours must be positive.`);
        }
      });
    });

    if (errors.length) {
      return res.status(422).json({
        message: "Transcript validation failed. Nothing was saved.",
        errors
      });
    }

    const insertProject = db.prepare(`
      INSERT INTO projects (name, client, description, manager_id, deadline)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertTask = db.prepare(`
      INSERT INTO tasks
        (project_id, title, description, assignee_id, estimated_hours, deadline)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const saveAll = db.transaction(() => {
      const savedProjects = [];

      for (const project of data.projects) {
        const manager = employeeMap.get(project.managerCode);

        const projectResult = insertProject.run(
          project.name,
          project.client,
          project.description,
          manager.id,
          project.deadline
        );

        const projectId = Number(projectResult.lastInsertRowid);
        const savedTasks = [];

        for (const task of project.tasks) {
          const assignee = employeeMap.get(task.assigneeCode);

          const taskResult = insertTask.run(
            projectId,
            task.title,
            task.description,
            assignee.id,
            task.estimatedHours,
            task.deadline
          );

          savedTasks.push({
            id: Number(taskResult.lastInsertRowid),
            title: task.title,
            assignee: assignee.name,
            estimatedHours: task.estimatedHours,
            deadline: task.deadline
          });
        }

        savedProjects.push({
          id: projectId,
          name: project.name,
          client: project.client,
          manager: manager.name,
          deadline: project.deadline,
          tasks: savedTasks
        });
      }

      return savedProjects;
    });

    const savedProjects = saveAll();

    res.status(201).json({
      message: "Transcript processed and saved successfully.",
      projectCount: savedProjects.length,
      taskCount: savedProjects.reduce((sum, project) => sum + project.tasks.length, 0),
      projects: savedProjects
    });
  } catch (error) {
    next(error);
  }
});

// NOT FOUND
app.use((req, res) => {
  res.status(404).json({ message: "API route not found." });
});

// ERROR HANDLER
app.use((error, req, res, next) => {
  console.error(error);

  res.status(500).json({
    message: "Internal server error.",
    ...(process.env.NODE_ENV !== "production" && { detail: error.message })
  });
});


async function startServer() {
  try {
    await seedUsers();
    seedDemoProjects();

    app.listen(PORT, () => {
      console.log("----------------------------------------");
      console.log("  NOVAWORKS TECHNOLOGIES CRM API");
      console.log("----------------------------------------");
      console.log(`  Server: http://localhost:${PORT}`);
      console.log(`  Health: http://localhost:${PORT}/api/health`);
      console.log("  Demo password: Demo123!");
      console.log("----------------------------------------");
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
}

startServer();

