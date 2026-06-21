import { useEffect, useState } from "react";
import { api } from "../utils/api";

interface User {
  email: string;
  role: string;
  status: string;
  enabled: boolean;
  createdAt: string;
}

interface Event {
  eventId: string;
  name: string;
}

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("deskstaff");
  const [createdInfo, setCreatedInfo] = useState<{ email: string; tempPassword: string } | null>(null);
  const [assignModal, setAssignModal] = useState<string | null>(null); // email of user being assigned
  const [assignedEvents, setAssignedEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [usersRes, eventsRes] = await Promise.all([
        api("/admin/staff/users", { method: "POST", body: JSON.stringify({ action: "list" }) }),
        api("/admin/events"),
      ]);
      setUsers(usersRes.users);
      setEvents(eventsRes.events);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const result = await api("/admin/staff/users", {
        method: "POST",
        body: JSON.stringify({ action: "create", email: newEmail, role: newRole }),
      });
      setCreatedInfo({ email: result.email, tempPassword: result.tempPassword });
      setShowCreate(false);
      setNewEmail("");
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDelete(email: string) {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return;
    try {
      await api("/admin/staff/users", { method: "POST", body: JSON.stringify({ action: "delete", email }) });
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function openAssignModal(email: string) {
    setAssignModal(email);
    try {
      const res = await api(`/admin/staff/assignments?email=${encodeURIComponent(email)}`);
      setAssignedEvents(res.eventIds || []);
    } catch {
      setAssignedEvents([]);
    }
  }

  async function toggleEventAssignment(email: string, eventId: string, assigned: boolean) {
    try {
      if (assigned) {
        await api("/admin/staff/unassign", {
          method: "POST",
          body: JSON.stringify({ email, eventId }),
        });
      } else {
        await api("/admin/staff/assign", {
          method: "POST",
          body: JSON.stringify({ email, eventId }),
        });
      }
      // Refresh assignments
      const res = await api(`/admin/staff/assignments?email=${encodeURIComponent(email)}`);
      setAssignedEvents(res.eventIds || []);
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (loading) return <p>Loading users...</p>;

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ margin: 0 }}>User Management</h2>
        <button onClick={() => setShowCreate(true)} style={{ width: "auto", padding: "8px 16px" }}>+ Add User</button>
      </div>

      {error && <div className="error">{error}</div>}

      {createdInfo && (
        <div style={{ background: "#d1fae5", padding: "16px", borderRadius: "8px", marginBottom: "16px" }}>
          <strong>User created!</strong><br />
          Email: {createdInfo.email}<br />
          Temporary Password: <code>{createdInfo.tempPassword}</code><br />
          <small>Share this with the user. They'll be asked to set a new password on first login.</small>
          <button onClick={() => setCreatedInfo(null)} style={{ marginTop: "8px", width: "auto", padding: "4px 12px", fontSize: "0.8rem" }}>Dismiss</button>
        </div>
      )}

      {showCreate && (
        <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "8px", marginBottom: "16px", border: "1px solid #e2e8f0" }}>
          <h3 style={{ marginTop: 0 }}>Create User</h3>
          <form onSubmit={handleCreate}>
            <input
              type="email"
              placeholder="Email address"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)} style={{ padding: "8px", marginBottom: "12px", width: "100%" }}>
              <option value="admin">Admin</option>
              <option value="deskstaff">Desk Staff</option>
            </select>
            <div style={{ display: "flex", gap: "8px" }}>
              <button type="submit" style={{ width: "auto", padding: "8px 16px" }}>Create</button>
              <button type="button" onClick={() => setShowCreate(false)} style={{ width: "auto", padding: "8px 16px", background: "#64748b" }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
            <th style={{ padding: "8px" }}>Email</th>
            <th style={{ padding: "8px" }}>Role</th>
            <th style={{ padding: "8px" }}>Status</th>
            <th style={{ padding: "8px" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.email} style={{ borderBottom: "1px solid #e2e8f0" }}>
              <td style={{ padding: "8px" }}>{u.email}</td>
              <td style={{ padding: "8px" }}>
                <span style={{ background: u.role === "admin" ? "#dbeafe" : "#fef3c7", padding: "2px 8px", borderRadius: "4px", fontSize: "0.85rem" }}>
                  {u.role}
                </span>
              </td>
              <td style={{ padding: "8px", fontSize: "0.85rem" }}>{u.status}</td>
              <td style={{ padding: "8px" }}>
                {(u.role === "deskstaff" || u.role === "staff") && (
                  <button onClick={() => openAssignModal(u.email)} style={{ width: "auto", padding: "4px 10px", fontSize: "0.8rem", marginRight: "8px", background: "#059669" }}>
                    Assign Events
                  </button>
                )}
                <button onClick={() => handleDelete(u.email)} style={{ width: "auto", padding: "4px 10px", fontSize: "0.8rem", background: "#dc2626" }}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {assignModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", padding: "24px", borderRadius: "8px", width: "400px", maxHeight: "80vh", overflow: "auto" }}>
            <h3 style={{ marginTop: 0 }}>Assign Events to {assignModal}</h3>
            {events.length === 0 ? (
              <p>No events available.</p>
            ) : (
              <div>
                {events.map((ev) => {
                  const isAssigned = assignedEvents.includes(ev.eventId);
                  return (
                    <label key={ev.eventId} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
                      <input
                        type="checkbox"
                        checked={isAssigned}
                        onChange={() => toggleEventAssignment(assignModal, ev.eventId, isAssigned)}
                        style={{ width: "18px", height: "18px" }}
                      />
                      <span>{ev.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
            <button onClick={() => setAssignModal(null)} style={{ marginTop: "16px", width: "auto", padding: "8px 16px" }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
