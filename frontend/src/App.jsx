
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, FolderKanban, CheckSquare, Users,
  FileText, LogOut, Search, Bell, Plus, Clock,
  CalendarDays, ArrowUpRight, Menu, X, ChevronRight,
  BriefcaseBusiness, CircleUserRound, AlertCircle,
  RefreshCw
} from "lucide-react";
import api from "./api";

const money = (value) => value || 0;

function App() {
  const [user, setUser] = useState(null);
  const [login, setLogin] = useState({ email: "", password: "Demo123!" });
  const [page, setPage] = useState("Dashboard");
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectTasks, setProjectTasks] = useState([]);
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [search, setSearch] = useState("");

  const role = user?.role;

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const requests = [
        api.get("/projects"),
        api.get("/tasks")
      ];

      if (role === "ADMIN") requests.push(api.get("/users"));

      const results = await Promise.all(requests);

      setProjects(results[0].data.projects || []);
      setTasks(results[1].data.tasks || []);

      if (role === "ADMIN") {
        setUsers(results[2].data.users || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const restore = async () => {
      const token = localStorage.getItem("novaworks_token");
      if (!token) return;

      try {
        const response = await api.get("/auth/me");
        setUser(response.data.user);
      } catch {
        localStorage.removeItem("novaworks_token");
      }
    };

    restore();
  }, []);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/login", login);
      localStorage.setItem("novaworks_token", response.data.token);
      setUser(response.data.user);
    } catch (err) {
      setError(err.response?.data?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("novaworks_token");
    setUser(null);
    setProjects([]);
    setTasks([]);
    setUsers([]);
    setPage("Dashboard");
  };

  const openProject = async (project) => {
    setSelectedProject(project);
    setPage("Project Details");
    setError("");

    try {
      const response = await api.get(`/projects/${project.id}`);
      setSelectedProject(response.data.project || response.data);
      setProjectTasks(response.data.tasks || []);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load project.");
    }
  };

  const submitTranscript = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await api.post("/transcripts/process", { transcript });
      setSuccess(response.data.message || "Transcript processed successfully.");
      setTranscript("");
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Transcript processing failed.");
    } finally {
      setLoading(false);
    }
  };

  const navigation = [
    { label: "Dashboard", icon: LayoutDashboard },
    { label: "Projects", icon: FolderKanban },
    { label: "Tasks", icon: CheckSquare },
    ...(role === "ADMIN" ? [{ label: "Team", icon: Users }] : []),
    ...(role === "ADMIN" ? [{ label: "Meeting Transcript", icon: FileText }] : [])
  ];

  const visibleProjects = useMemo(() =>
    projects.filter((p) =>
      `${p.name} ${p.client} ${p.manager_name}`
        .toLowerCase().includes(search.toLowerCase())
    ), [projects, search]);

  const visibleTasks = useMemo(() =>
    tasks.filter((t) =>
      `${t.title} ${t.description} ${t.assignee_name}`
        .toLowerCase().includes(search.toLowerCase())
    ), [tasks, search]);

  const stats = [
    { label: "Total Projects", value: projects.length, icon: BriefcaseBusiness },
    { label: "Total Tasks", value: tasks.length, icon: CheckSquare },
    { label: "Team Members", value: role === "ADMIN" ? users.length : "—", icon: Users },
    { label: "Upcoming Deadlines", value: tasks.filter(t => t.deadline && t.deadline >= new Date().toISOString().slice(0,10)).length, icon: CalendarDays }
  ];

  if (!user) {
    return (
      <div className="login-page">
        <div className="login-decoration"></div>
        <div className="login-card">
          <div className="brand-mark">N</div>
          <p className="eyebrow">NOVAWORKS TECHNOLOGIES</p>
          <h1>Welcome back.</h1>
          <p className="muted">Sign in to manage your projects and team.</p>

          {error && <div className="alert error">{error}</div>}

          <form onSubmit={handleLogin}>
            <label>Work email</label>
            <input
              type="email"
              placeholder="name@novaworks.example"
              value={login.email}
              onChange={e => setLogin({ ...login, email: e.target.value })}
              required
            />

            <label>Password</label>
            <input
              type="password"
              value={login.password}
              onChange={e => setLogin({ ...login, password: e.target.value })}
              required
            />

            <button className="primary-btn full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in to workspace"}
            </button>
          </form>

          <div className="login-footer">
            Secure workspace · NovaWorks Technologies
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "mobile-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-mark small">N</div>
          <div>
            <strong>NovaWorks</strong>
            <span>TECHNOLOGIES</span>
          </div>
          <button className="mobile-close" onClick={() => setMobileMenu(false)}><X /></button>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <nav>
          {navigation.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                className={`nav-item ${page === item.label ? "active" : ""}`}
                onClick={() => {
                  setPage(item.label);
                  setSelectedProject(null);
                  setMobileMenu(false);
                  setSearch("");
                  setError("");
                }}
              >
                <Icon size={19} />
                {item.label}
                {page === item.label && <span className="nav-indicator" />}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="user-mini">
            <div className="avatar">{user.name?.charAt(0)}</div>
            <div className="user-mini-info">
              <strong>{user.name}</strong>
              <span>{user.role}</span>
            </div>
            <button onClick={logout} title="Logout"><LogOut size={17} /></button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu" onClick={() => setMobileMenu(true)}><Menu /></button>
            <div>
              <div className="breadcrumb">Workspace <ChevronRight size={13} /> {page}</div>
              <h2>{page === "Project Details" ? selectedProject?.name : page}</h2>
            </div>
          </div>

          <div className="topbar-right">
            <div className="search-box">
              <Search size={17} />
              <input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="icon-button" title="Notifications"><Bell size={19} /></button>
            <div className="top-avatar">{user.name?.charAt(0)}</div>
          </div>
        </header>

        <div className="content">
          {error && <div className="alert error"><AlertCircle size={17} />{error}<button onClick={() => setError("")}>×</button></div>}
          {success && <div className="alert success">{success}<button onClick={() => setSuccess("")}>×</button></div>}

          {loading && <div className="loading-line"><RefreshCw size={16} /> Loading workspace...</div>}

          {page === "Dashboard" && (
            <>
              <section className="welcome-row">
                <div>
                  <p className="eyebrow">OVERVIEW</p>
                  <h1>Good to see you, {user.name?.split(" ")[0]}.</h1>
                  <p className="muted">Here's what's happening across your workspace.</p>
                </div>
                <button className="outline-btn" onClick={loadData}><RefreshCw size={16} /> Refresh data</button>
              </section>

              <section className="stats-grid">
                {stats.map((stat, i) => {
                  const Icon = stat.icon;
                  return (
                    <div className="stat-card" key={stat.label}>
                      <div className={`stat-icon icon-${i}`}><Icon size={20} /></div>
                      <p>{stat.label}</p>
                      <h2>{stat.value}</h2>
                      <span className="stat-caption">Workspace overview</span>
                    </div>
                  );
                })}
              </section>

              <section className="section-card">
                <div className="section-heading">
                  <div><h3>Recent Projects</h3><p>Projects available in your workspace</p></div>
                  <button className="text-btn" onClick={() => setPage("Projects")}>View all <ArrowUpRight size={15} /></button>
                </div>
                <ProjectTable projects={projects.slice(0,5)} onOpen={openProject} />
              </section>

              <section className="section-card">
                <div className="section-heading">
                  <div><h3>Upcoming Tasks</h3><p>Tasks visible to your account</p></div>
                  <button className="text-btn" onClick={() => setPage("Tasks")}>View all <ArrowUpRight size={15} /></button>
                </div>
                <TaskTable tasks={tasks.slice(0,5)} />
              </section>
            </>
          )}

          {page === "Projects" && (
            <section className="section-card">
              <div className="section-heading">
                <div><h3>Projects</h3><p>{visibleProjects.length} projects found</p></div>
                <span className="soft-tag">{role}</span>
              </div>
              <ProjectTable projects={visibleProjects} onOpen={openProject} />
            </section>
          )}

          {page === "Project Details" && selectedProject && (
            <>
              <button className="back-btn" onClick={() => setPage("Projects")}>← Back to projects</button>
              <section className="project-hero">
                <div>
                  <span className="soft-tag">PROJECT</span>
                  <h1>{selectedProject.name}</h1>
                  <p>{selectedProject.description || "No project description provided."}</p>
                </div>
                <div className="project-deadline">
                  <CalendarDays size={19} />
                  <div><span>Project deadline</span><strong>{selectedProject.deadline || "Not set"}</strong></div>
                </div>
              </section>
              <div className="stats-grid detail-stats">
                <div className="stat-card"><p>Client</p><h3>{selectedProject.client}</h3></div>
                <div className="stat-card"><p>Project Manager</p><h3>{selectedProject.manager_name}</h3></div>
                <div className="stat-card"><p>Visible Tasks</p><h3>{projectTasks.length}</h3></div>
              </div>
              <section className="section-card">
                <div className="section-heading"><div><h3>Project Tasks</h3><p>Tasks associated with this project</p></div></div>
                <TaskTable tasks={projectTasks} />
              </section>
            </>
          )}

          {page === "Tasks" && (
            <section className="section-card">
              <div className="section-heading"><div><h3>All Tasks</h3><p>{visibleTasks.length} tasks visible to your account</p></div></div>
              <TaskTable tasks={visibleTasks} />
            </section>
          )}

          {page === "Team" && role === "ADMIN" && (
            <section className="section-card">
              <div className="section-heading"><div><h3>Team directory</h3><p>{users.length} registered team members</p></div></div>
              <div className="team-grid">
                {users.filter(u => `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(search.toLowerCase())).map(person => (
                  <div className="team-card" key={person.id}>
                    <div className="team-avatar">{person.name?.charAt(0)}</div>
                    <div><h4>{person.name}</h4><p>{person.email}</p><span className="soft-tag">{person.role}</span></div>
                    <div className="team-specialization">{person.specialization}</div>
                    <small>{person.skills}</small>
                  </div>
                ))}
              </div>
            </section>
          )}

          {page === "Meeting Transcript" && role === "ADMIN" && (
            <section className="section-card transcript-card">
              <div className="section-heading"><div><h3>Meeting transcript</h3><p>Convert meeting discussions into structured projects and tasks.</p></div><FileText size={25} /></div>
              <form onSubmit={submitTranscript}>
                <label>Meeting transcript</label>
                <textarea rows="12" minLength="30" required value={transcript} onChange={e => setTranscript(e.target.value)} placeholder="Paste your complete meeting transcript here..." />
                <div className="transcript-footer">
                  <span>Minimum 30 characters. AI will validate employee assignments and deadlines.</span>
                  <button className="primary-btn" disabled={loading || transcript.trim().length < 30}>
                    <Plus size={17} /> {loading ? "Processing..." : "Process transcript"}
                  </button>
                </div>
              </form>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

function ProjectTable({ projects, onOpen }) {
  if (!projects.length) return <EmptyState text="No projects found." />;

  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>PROJECT</th><th>CLIENT</th><th>MANAGER</th><th>TASKS</th><th>DEADLINE</th><th></th></tr></thead>
        <tbody>
          {projects.map(p => (
            <tr key={p.id}>
              <td><strong>{p.name}</strong><small>Project #{p.id}</small></td>
              <td>{p.client}</td>
              <td>{p.manager_name}</td>
              <td><span className="count-tag">{p.task_count ?? "—"}</span></td>
              <td>{p.deadline}</td>
              <td><button className="row-action" onClick={() => onOpen(p)}><ChevronRight size={18} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskTable({ tasks }) {
  if (!tasks.length) return <EmptyState text="No tasks found." />;

  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>TASK</th><th>ASSIGNED TO</th><th>ESTIMATED HOURS</th><th>DEADLINE</th></tr></thead>
        <tbody>
          {tasks.map(t => (
            <tr key={t.id}>
              <td><strong>{t.title}</strong><small>{t.description}</small></td>
              <td>{t.assignee_name || "You"}</td>
              <td><span className="count-tag">{money(t.estimated_hours)}h</span></td>
              <td><span className="date-cell"><Clock size={14} />{t.deadline}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ text }) {
  return <div className="empty-state"><FolderKanban size={25} /><p>{text}</p></div>;
}

export default App;
