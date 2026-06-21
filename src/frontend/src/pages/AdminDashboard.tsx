import { useEffect, useState } from "react";
import { Routes, Route, Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../utils/api";
import { UsersPage } from "./UsersPage";

export function AdminDashboard() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!localStorage.getItem("idToken")) {
      navigate("/admin/login");
    }
  }, []);

  function logout() {
    localStorage.removeItem("idToken");
    localStorage.removeItem("userEmail");
    navigate("/admin/login");
  }

  return (
    <div className="admin-container">
      <nav className="admin-nav">
        <Link to="/admin/dashboard">Dashboard</Link>
        <Link to="/admin/users">Users</Link>
        <button onClick={logout} style={{ marginLeft: "auto", background: "transparent", border: "1px solid #fff", color: "#fff", padding: "8px 16px", borderRadius: "4px", cursor: "pointer", width: "auto" }}>
          Logout
        </button>
      </nav>
      <Routes>
        <Route path="dashboard" element={<EventList />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="events/:eventId" element={<EventDetail />} />
        <Route path="events/:eventId/reports" element={<ReportsPage />} />
        <Route path="*" element={<EventList />} />
      </Routes>
    </div>
  );
}

function EventList() {
  const [events, setEvents] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", date: "", startTime: "", endTime: "", location: "", rewardThreshold: 3, timezone: "Asia/Kolkata" });
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);

  useEffect(() => { loadEvents(); }, []);

  async function loadEvents() {
    setListLoading(true);
    try {
      const data = await api("/admin/events");
      setEvents(data.events || []);
    } catch (err: any) {
      console.error("loadEvents failed:", err);
    }
    setListLoading(false);
  }

  function getTimezoneOffsetString() {
    const offset = new Date().getTimezoneOffset();
    const sign = offset <= 0 ? "+" : "-";
    const hrs = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
    const mins = String(Math.abs(offset) % 60).padStart(2, "0");
    return `${sign}${hrs}:${mins}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const offset = getTimezoneOffsetString();
    const payload = { ...form, startTime: form.startTime + offset, endTime: form.endTime + offset };
    try {
      if (editingEventId) {
        await api(`/admin/events/${editingEventId}`, { method: "PUT", body: JSON.stringify(payload) });
        setEditingEventId(null);
      } else {
        await api("/admin/events", { method: "POST", body: JSON.stringify(payload) });
      }
      setShowForm(false);
      resetForm();
      loadEvents();
    } catch { /* ignore */ }
    setLoading(false);
  }

  function resetForm() {
    setForm({ name: "", description: "", date: "", startTime: "", endTime: "", location: "", rewardThreshold: 3, timezone: "Asia/Kolkata" });
  }

  function editEvent(ev: any) {
    const toLocal = (ts: number) => {
      if (!ts) return "";
      const d = new Date(ts);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    };
    setForm({
      name: ev.name || "",
      description: ev.description || "",
      date: ev.date || "",
      startTime: ev.startTime ? toLocal(ev.startTime) : "",
      endTime: ev.endTime ? toLocal(ev.endTime) : "",
      location: ev.location || "",
      rewardThreshold: ev.rewardThreshold || 3,
      timezone: ev.timezone || "Asia/Kolkata",
    });
    setEditingEventId(ev.eventId);
    setShowForm(true);
  }

  async function deleteEvent(eventId: string) {
    if (!confirm("Delete this event? This cannot be undone.")) return;
    try {
      await api(`/admin/events/${eventId}`, { method: "DELETE" });
      loadEvents();
    } catch {}
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Events</h2>
        <button onClick={() => { setShowForm(!showForm); setEditingEventId(null); resetForm(); }} style={{ width: "auto", padding: "8px 16px" }}>
          {showForm ? "Cancel" : "+ Create Event"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ marginBottom: 24, padding: 16, background: "#f8fafc", borderRadius: 8 }}>
          <input placeholder="Event Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <textarea placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} style={{ width: "100%", padding: "12px 16px", border: "2px solid #e0e0e0", borderRadius: 8, fontSize: "1rem", marginBottom: 16, fontFamily: "inherit" }} />
          <input placeholder="Location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
          <label style={{ fontSize: "0.85rem", color: "#666" }}>Event Date</label>
          <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: "0.85rem", color: "#666" }}>Start Time</label>
              <input type="datetime-local" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} required />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: "0.85rem", color: "#666" }}>End Time</label>
              <input type="datetime-local" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} required />
            </div>
          </div>
          <select value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })} style={{ width: "100%", padding: "14px 16px", border: "2px solid #e0e0e0", borderRadius: 8, fontSize: "1.1rem", marginBottom: 16 }}>
            <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</option>
            <option value="Asia/Dubai">Asia/Dubai (GST, UTC+4)</option>
            <option value="Asia/Singapore">Asia/Singapore (SGT, UTC+8)</option>
            <option value="Europe/London">Europe/London (GMT/BST)</option>
            <option value="America/New_York">America/New_York (EST/EDT)</option>
            <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
            <option value="UTC">UTC</option>
          </select>
          <input type="number" placeholder="Reward Threshold (sessions)" value={form.rewardThreshold} onChange={e => setForm({ ...form, rewardThreshold: +e.target.value })} min={0} />
          <button type="submit" disabled={loading}>{loading ? "Saving..." : editingEventId ? "Update Event" : "Create Event"}</button>
        </form>
      )}

      {listLoading ? (
        <p>Loading events...</p>
      ) : events.length === 0 && !showForm ? (
        <p>No events yet. Create your first event.</p>
      ) : (
        <table>
          <thead>
            <tr><th>Name</th><th>Date</th><th>Location</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {events.map((ev) => (
              <tr key={ev.eventId}>
                <td>{ev.name}</td>
                <td>{ev.date}</td>
                <td>{ev.location}</td>
                <td><span className={`badge badge-${ev.status === "active" ? "success" : "pending"}`}>{ev.status}</span></td>
                <td style={{ display: "flex", gap: 4 }}>
                  <Link to={`/admin/events/${ev.eventId}`}><button style={{ width: "auto", padding: "4px 8px", fontSize: "0.8rem" }}>Manage</button></Link>
                  <button onClick={() => editEvent(ev)} style={{ width: "auto", padding: "4px 8px", fontSize: "0.8rem", background: "#2563eb" }}>Edit</button>
                  <button onClick={() => deleteEvent(ev.eventId)} style={{ width: "auto", padding: "4px 8px", fontSize: "0.8rem", background: "#dc2626" }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function EventDetail() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [tab, setTab] = useState<"attendees" | "sessions">("attendees");
  const [attendees, setAttendees] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [showAttForm, setShowAttForm] = useState(false);
  const [attJson, setAttJson] = useState("");
  const [showSessForm, setShowSessForm] = useState(false);
  const [sessForm, setSessForm] = useState({ name: "", date: "", startTime: "", endTime: "" });
  const [editingSessId, setEditingSessId] = useState<string | null>(null);
  const [qrData, setQrData] = useState<{ qrCode: string; url: string; shortUrl?: string; shortCode?: string } | null>(null);
  const [qrFullscreen, setQrFullscreen] = useState(false);

  useEffect(() => {
    loadEvent();
    loadAttendees();
    loadSessions();
    const interval = setInterval(loadAttendees, 5000);
    return () => clearInterval(interval);
  }, [eventId]);

  async function loadEvent() {
    try { const d = await api(`/admin/events/${eventId}`); setEvent(d); } catch {}
  }
  async function loadAttendees() {
    try { const d = await api(`/admin/events/${eventId}/attendees`); setAttendees(d.attendees || []); } catch {}
  }
  async function loadSessions() {
    try { const d = await api(`/admin/events/${eventId}/sessions`); setSessions(d.sessions || []); } catch {}
  }

  async function uploadAttendees(e: React.FormEvent) {
    e.preventDefault();
    try {
      const attendeesData = JSON.parse(attJson);
      await api(`/admin/events/${eventId}/attendees/upload`, { method: "POST", body: JSON.stringify({ attendees: attendeesData }) });
      setShowAttForm(false);
      setAttJson("");
      loadAttendees();
    } catch (err: any) { alert(err.message || "Invalid JSON"); }
  }

  async function createSession(e: React.FormEvent) {
    e.preventDefault();
    try {
      // Append local timezone offset so Lambda parses correctly
      const offset = getTimezoneOffsetString();
      const payload = {
        ...sessForm,
        startTime: sessForm.startTime + offset,
        endTime: sessForm.endTime + offset,
      };
      if (editingSessId) {
        await api(`/admin/events/${eventId}/sessions/${editingSessId}`, { method: "PUT", body: JSON.stringify(payload) });
        setEditingSessId(null);
      } else {
        await api(`/admin/events/${eventId}/sessions`, { method: "POST", body: JSON.stringify(payload) });
      }
      setShowSessForm(false);
      setSessForm({ name: "", date: "", startTime: "", endTime: "" });
      loadSessions();
    } catch {}
  }

  function getTimezoneOffsetString() {
    const offset = new Date().getTimezoneOffset();
    const sign = offset <= 0 ? "+" : "-";
    const hrs = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
    const mins = String(Math.abs(offset) % 60).padStart(2, "0");
    return `${sign}${hrs}:${mins}`;
  }

  function editSession(s: any) {
    // Convert timestamp to local datetime-local format (YYYY-MM-DDTHH:MM)
    const toLocal = (ts: number) => {
      const d = new Date(ts);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    };
    setSessForm({
      name: s.name,
      date: s.date,
      startTime: toLocal(s.startTime),
      endTime: toLocal(s.endTime),
    });
    setEditingSessId(s.sessionId);
    setShowSessForm(true);
  }

  async function deleteSession(sessionId: string) {
    if (!confirm("Delete this session? This cannot be undone.")) return;
    try {
      await api(`/admin/events/${eventId}/sessions/${sessionId}`, { method: "DELETE" });
      loadSessions();
    } catch {}
  }

  async function generateQr(sessionId?: string) {
    try {
      const path = sessionId ? `/admin/events/${eventId}/sessions/${sessionId}/qr` : `/admin/events/${eventId}/qr`;
      const d = await api(path);
      setQrData(d);
    } catch {}
  }

  async function updateStatus(status: string) {
    try {
      await api(`/admin/events/${eventId}`, { method: "PUT", body: JSON.stringify({ status }) });
      loadEvent();
    } catch {}
  }

  const filtered = search
    ? attendees.filter(a => a.name?.toLowerCase().includes(search.toLowerCase()) || a.sequenceNumber?.includes(search) || a.company?.toLowerCase().includes(search.toLowerCase()))
    : attendees;

  if (!event) return <div className="card"><p>Loading...</p></div>;

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0 }}>{event.name}</h2>
            <p style={{ color: "#666", margin: "4px 0" }}>{event.date} • {event.location}{event.timezone ? ` • ${event.timezone}` : ""}</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className={`badge badge-${event.status === "active" ? "success" : "pending"}`}>{event.status}</span>
            {event.status === "draft" && <button onClick={() => updateStatus("active")} style={{ width: "auto", padding: "6px 12px", fontSize: "0.9rem" }}>Activate</button>}
            {event.status === "active" && <button onClick={() => updateStatus("completed")} style={{ width: "auto", padding: "6px 12px", fontSize: "0.9rem", background: "#64748b" }}>Complete</button>}
            <button onClick={() => generateQr()} style={{ width: "auto", padding: "6px 12px", fontSize: "0.9rem", background: "#7c3aed" }}>Check-in QR</button>
            <button onClick={() => navigate(`/admin/events/${eventId}/reports`)} style={{ width: "auto", padding: "6px 12px", fontSize: "0.9rem", background: "#059669" }}>Reports</button>
          </div>
        </div>
      </div>

      {qrData && (
        <div className="card" style={{ marginBottom: 16, textAlign: "center" }}>
          <img
            src={qrData.qrCode}
            alt="QR Code"
            style={{ maxWidth: 300, cursor: "pointer" }}
            onClick={() => setQrFullscreen(true)}
            title="Click for fullscreen"
          />
          {qrData.shortUrl && (
            <p style={{ fontSize: "1rem", fontWeight: "bold", margin: "8px 0" }}>
              Short URL: <a href={qrData.shortUrl} target="_blank" rel="noopener">{qrData.shortCode}</a>
            </p>
          )}
          <p style={{ fontSize: "0.85rem", color: "#666", wordBreak: "break-all" }}>{qrData.url}</p>
          <button onClick={() => setQrData(null)} style={{ width: "auto", padding: "6px 12px", background: "#64748b" }}>Close</button>
        </div>
      )}

      {qrFullscreen && qrData && (
        <div
          onClick={() => setQrFullscreen(false)}
          onKeyDown={(e) => e.key === "Escape" && setQrFullscreen(false)}
          tabIndex={0}
          style={{ position: "fixed", inset: 0, background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 9999, cursor: "pointer" }}
        >
          <img src={qrData.qrCode} alt="QR Code" style={{ maxWidth: "90vw", maxHeight: "80vh" }} />
          {qrData.shortCode && <p style={{ fontSize: "2rem", fontWeight: "bold", marginTop: "16px" }}>{qrData.shortCode}</p>}
          <p style={{ fontSize: "1rem", color: "#666", marginTop: "8px" }}>Click anywhere or press Escape to close</p>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setTab("attendees")} style={{ width: "auto", padding: "8px 16px", background: tab === "attendees" ? "#2563eb" : "#94a3b8" }}>Attendees ({attendees.length})</button>
        <button onClick={() => setTab("sessions")} style={{ width: "auto", padding: "8px 16px", background: tab === "sessions" ? "#2563eb" : "#94a3b8" }}>Sessions ({sessions.length})</button>
      </div>

      {tab === "attendees" && (
        <div className="card">
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input placeholder="Search by name, seq#, or company" value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 0 }} />
            <button onClick={() => setShowAttForm(!showAttForm)} style={{ width: "auto", whiteSpace: "nowrap" }}>{showAttForm ? "Cancel" : "+ Add"}</button>
          </div>
          {showAttForm && (
            <form onSubmit={uploadAttendees} style={{ marginBottom: 16, padding: 12, background: "#f8fafc", borderRadius: 8 }}>
              <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: 8 }}>Paste JSON array: [{"{"}"sequenceNumber","name","email","designation","company"{"}"}]</p>
              <textarea value={attJson} onChange={e => setAttJson(e.target.value)} rows={4} style={{ width: "100%", padding: 8, border: "2px solid #e0e0e0", borderRadius: 8, fontFamily: "monospace", fontSize: "0.85rem" }} placeholder='[{"sequenceNumber":"0001","name":"John Doe","email":"john@example.com","designation":"Developer","company":"Acme"}]' required />
              <button type="submit" style={{ marginTop: 8 }}>Upload Attendees</button>
            </form>
          )}
          <table>
            <thead><tr><th>Seq#</th><th>Name</th><th>Email</th><th>Company</th><th>Status</th></tr></thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.sequenceNumber}>
                  <td>{a.sequenceNumber}</td>
                  <td>{a.name}</td>
                  <td>{a.email}</td>
                  <td>{a.company}</td>
                  <td><span className={`badge badge-${a.checkedIn ? "success" : "pending"}`}>{a.checkedIn ? "Checked In" : "Pending"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p style={{ textAlign: "center", color: "#666", marginTop: 16 }}>No attendees found</p>}
        </div>
      )}

      {tab === "sessions" && (
        <div className="card">
          <button onClick={() => { setShowSessForm(!showSessForm); setEditingSessId(null); setSessForm({ name: "", date: "", startTime: "", endTime: "" }); }} style={{ width: "auto", marginBottom: 16 }}>{showSessForm ? "Cancel" : "+ Add Session"}</button>
          {showSessForm && (
            <form onSubmit={createSession} style={{ marginBottom: 16, padding: 12, background: "#f8fafc", borderRadius: 8 }}>
              <input placeholder="Session Name" value={sessForm.name} onChange={e => setSessForm({ ...sessForm, name: e.target.value })} required />
              <input type="date" value={sessForm.date} onChange={e => setSessForm({ ...sessForm, date: e.target.value })} required />
              <div style={{ display: "flex", gap: 8 }}>
                <input type="datetime-local" placeholder="Start Time" value={sessForm.startTime} onChange={e => setSessForm({ ...sessForm, startTime: e.target.value })} required />
                <input type="datetime-local" placeholder="End Time" value={sessForm.endTime} onChange={e => setSessForm({ ...sessForm, endTime: e.target.value })} required />
              </div>
              <button type="submit" style={{ marginTop: 8 }}>{editingSessId ? "Update Session" : "Create Session"}</button>
            </form>
          )}
          <table>
            <thead><tr><th>Name</th><th>Date</th><th>Start</th><th>End</th><th>Actions</th></tr></thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.sessionId}>
                  <td>{s.name}</td>
                  <td>{s.date}</td>
                  <td>{new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: event?.timezone || undefined })}</td>
                  <td>{new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: event?.timezone || undefined })}</td>
                  <td style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => generateQr(s.sessionId)} style={{ width: "auto", padding: "4px 8px", fontSize: "0.8rem", background: "#7c3aed" }}>QR</button>
                    <button onClick={() => editSession(s)} style={{ width: "auto", padding: "4px 8px", fontSize: "0.8rem", background: "#2563eb" }}>Edit</button>
                    <button onClick={() => deleteSession(s.sessionId)} style={{ width: "auto", padding: "4px 8px", fontSize: "0.8rem", background: "#dc2626" }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sessions.length === 0 && <p style={{ textAlign: "center", color: "#666", marginTop: 16 }}>No sessions yet</p>}
        </div>
      )}
    </div>
  );
}

// --- Reports Page with exhaustive tables, per-column search, and pagination ---

const PAGE_SIZE = 10;

function ReportsPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"checkin" | "sessions" | "rewards">("checkin");
  const [checkinData, setCheckinData] = useState<any>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  const [rewardsData, setRewardsData] = useState<any>(null);

  useEffect(() => { loadCheckin(); }, [eventId]);

  async function loadCheckin() {
    try { const d = await api(`/admin/events/${eventId}/reports/checkin`); setCheckinData(d); } catch {}
  }
  async function loadSessions() {
    try { const d = await api(`/admin/events/${eventId}/reports/sessions`); setSessionData(d); } catch {}
  }
  async function loadRewards() {
    try { const d = await api(`/admin/events/${eventId}/reports/rewards`); setRewardsData(d); } catch {}
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Reports</h2>
          <button onClick={() => navigate(`/admin/events/${eventId}`)} style={{ width: "auto", padding: "6px 12px", background: "#64748b" }}>← Back</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => { setTab("checkin"); loadCheckin(); }} style={{ width: "auto", padding: "8px 16px", background: tab === "checkin" ? "#2563eb" : "#94a3b8" }}>Check-in Report</button>
        <button onClick={() => { setTab("sessions"); loadSessions(); }} style={{ width: "auto", padding: "8px 16px", background: tab === "sessions" ? "#2563eb" : "#94a3b8" }}>Session Report</button>
        <button onClick={() => { setTab("rewards"); loadRewards(); }} style={{ width: "auto", padding: "8px 16px", background: tab === "rewards" ? "#2563eb" : "#94a3b8" }}>Rewards Report</button>
      </div>

      {tab === "checkin" && checkinData && <CheckinReport data={checkinData} />}
      {tab === "sessions" && sessionData && <SessionReport data={sessionData} />}
      {tab === "rewards" && rewardsData && <RewardsReport data={rewardsData} />}
    </div>
  );
}

function CheckinReport({ data }: { data: any }) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [dateFilter, setDateFilter] = useState("");

  const attendees = (data.attendees || []) as any[];

  const filtered = attendees.filter(a => {
    if (filters.seq && !a.sequenceNumber?.includes(filters.seq)) return false;
    if (filters.name && !a.name?.toLowerCase().includes(filters.name.toLowerCase())) return false;
    if (filters.email && !a.email?.toLowerCase().includes(filters.email.toLowerCase())) return false;
    if (filters.company && !a.company?.toLowerCase().includes(filters.company.toLowerCase())) return false;
    if (filters.status) {
      const isCheckedIn = a.checkedIn ? "checked in" : "pending";
      if (!isCheckedIn.includes(filters.status.toLowerCase())) return false;
    }
    if (dateFilter && a.checkedInAt) {
      const checkinDate = new Date(a.checkedInAt).toISOString().split("T")[0];
      if (checkinDate !== dateFilter) return false;
    }
    if (dateFilter && !a.checkedInAt) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="card">
      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div><strong>Total:</strong> {data.total}</div>
        <div style={{ color: "#16a34a" }}><strong>Checked In:</strong> {data.checkedIn}</div>
        <div style={{ color: "#d97706" }}><strong>Pending:</strong> {data.pending}</div>
        <div style={{ marginLeft: "auto" }}>
          <label style={{ fontSize: "0.85rem", marginRight: 4 }}>Date:</label>
          <input type="date" value={dateFilter} onChange={e => { setDateFilter(e.target.value); setPage(0); }} style={{ width: "auto", padding: "4px 8px", marginBottom: 0 }} />
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Seq#<br/><input placeholder="Filter" value={filters.seq || ""} onChange={e => { setFilters({...filters, seq: e.target.value}); setPage(0); }} style={{ width: 60, padding: 4, fontSize: "0.75rem", marginBottom: 0 }} /></th>
              <th>Name<br/><input placeholder="Filter" value={filters.name || ""} onChange={e => { setFilters({...filters, name: e.target.value}); setPage(0); }} style={{ width: 100, padding: 4, fontSize: "0.75rem", marginBottom: 0 }} /></th>
              <th>Email<br/><input placeholder="Filter" value={filters.email || ""} onChange={e => { setFilters({...filters, email: e.target.value}); setPage(0); }} style={{ width: 120, padding: 4, fontSize: "0.75rem", marginBottom: 0 }} /></th>
              <th>Company<br/><input placeholder="Filter" value={filters.company || ""} onChange={e => { setFilters({...filters, company: e.target.value}); setPage(0); }} style={{ width: 100, padding: 4, fontSize: "0.75rem", marginBottom: 0 }} /></th>
              <th>Status<br/><input placeholder="Filter" value={filters.status || ""} onChange={e => { setFilters({...filters, status: e.target.value}); setPage(0); }} style={{ width: 80, padding: 4, fontSize: "0.75rem", marginBottom: 0 }} /></th>
              <th>Checked In At</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((a: any) => (
              <tr key={a.sequenceNumber}>
                <td>{a.sequenceNumber}</td>
                <td>{a.name}</td>
                <td>{a.email}</td>
                <td>{a.company}</td>
                <td><span className={`badge badge-${a.checkedIn ? "success" : "pending"}`}>{a.checkedIn ? "Checked In" : "Pending"}</span></td>
                <td>{a.checkedInAt ? new Date(a.checkedInAt).toLocaleString() : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} setPage={setPage} total={filtered.length} />
    </div>
  );
}

function SessionReport({ data }: { data: any }) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);

  const sessions = (data.sessions || []) as any[];

  const filtered = sessions.filter(s => {
    if (filters.name && !s.name?.toLowerCase().includes(filters.name.toLowerCase())) return false;
    if (filters.count && !String(s.attendanceCount).includes(filters.count)) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="card">
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Session Name<br/><input placeholder="Filter" value={filters.name || ""} onChange={e => { setFilters({...filters, name: e.target.value}); setPage(0); }} style={{ width: 150, padding: 4, fontSize: "0.75rem", marginBottom: 0 }} /></th>
              <th>Attendance Count<br/><input placeholder="Filter" value={filters.count || ""} onChange={e => { setFilters({...filters, count: e.target.value}); setPage(0); }} style={{ width: 60, padding: 4, fontSize: "0.75rem", marginBottom: 0 }} /></th>
            </tr>
          </thead>
          <tbody>
            {paged.map((s: any) => (
              <tr key={s.sessionId}>
                <td>{s.name}</td>
                <td><strong>{s.attendanceCount}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} setPage={setPage} total={filtered.length} />
    </div>
  );
}

function RewardsReport({ data }: { data: any }) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);

  const all = (data.all || []) as any[];

  const filtered = all.filter(r => {
    if (filters.seq && !r.sequenceNumber?.includes(filters.seq)) return false;
    if (filters.name && !r.name?.toLowerCase().includes(filters.name.toLowerCase())) return false;
    if (filters.company && !r.company?.toLowerCase().includes(filters.company.toLowerCase())) return false;
    if (filters.eligible) {
      const val = r.eligible ? "yes" : "no";
      if (!val.includes(filters.eligible.toLowerCase())) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const eligibleCount = all.filter((r: any) => r.eligible).length;

  return (
    <div className="card">
      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        <div><strong>Threshold:</strong> {data.threshold} sessions</div>
        <div style={{ color: "#16a34a" }}><strong>Eligible:</strong> {eligibleCount}</div>
        <div style={{ color: "#d97706" }}><strong>Not Eligible:</strong> {all.length - eligibleCount}</div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Seq#<br/><input placeholder="Filter" value={filters.seq || ""} onChange={e => { setFilters({...filters, seq: e.target.value}); setPage(0); }} style={{ width: 60, padding: 4, fontSize: "0.75rem", marginBottom: 0 }} /></th>
              <th>Name<br/><input placeholder="Filter" value={filters.name || ""} onChange={e => { setFilters({...filters, name: e.target.value}); setPage(0); }} style={{ width: 100, padding: 4, fontSize: "0.75rem", marginBottom: 0 }} /></th>
              <th>Company<br/><input placeholder="Filter" value={filters.company || ""} onChange={e => { setFilters({...filters, company: e.target.value}); setPage(0); }} style={{ width: 100, padding: 4, fontSize: "0.75rem", marginBottom: 0 }} /></th>
              <th>Sessions Attended</th>
              <th>Eligible<br/><input placeholder="yes/no" value={filters.eligible || ""} onChange={e => { setFilters({...filters, eligible: e.target.value}); setPage(0); }} style={{ width: 60, padding: 4, fontSize: "0.75rem", marginBottom: 0 }} /></th>
            </tr>
          </thead>
          <tbody>
            {paged.map((r: any) => (
              <tr key={r.sequenceNumber}>
                <td>{r.sequenceNumber}</td>
                <td>{r.name}</td>
                <td>{r.company}</td>
                <td><strong>{r.sessionsAttended}</strong></td>
                <td><span className={`badge badge-${r.eligible ? "success" : "pending"}`}>{r.eligible ? "Yes" : "No"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} setPage={setPage} total={filtered.length} />
    </div>
  );
}

function Pagination({ page, totalPages, setPage, total }: { page: number; totalPages: number; setPage: (p: number) => void; total: number }) {
  if (totalPages <= 1) return <p style={{ fontSize: "0.85rem", color: "#666", marginTop: 12 }}>Showing {total} record{total !== 1 ? "s" : ""}</p>;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
      <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} style={{ width: "auto", padding: "4px 12px", fontSize: "0.85rem" }}>← Prev</button>
      <span style={{ fontSize: "0.85rem", color: "#666" }}>Page {page + 1} of {totalPages} ({total} records)</span>
      <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} style={{ width: "auto", padding: "4px 12px", fontSize: "0.85rem" }}>Next →</button>
    </div>
  );
}
