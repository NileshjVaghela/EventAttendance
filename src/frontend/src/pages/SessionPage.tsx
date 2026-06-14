import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../utils/api";

export function SessionPage() {
  const [params] = useSearchParams();
  const eventId = params.get("event") || "";
  const sessionId = params.get("session") || "";
  const [sequenceNumber, setSequenceNumber] = useState("");
  const [result, setResult] = useState<{ message: string; sessionName?: string } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [cachedName, setCachedName] = useState("");

  useEffect(() => {
    if (!eventId || !sessionId) return;

    // Check if we have cached attendee info for this event
    const cachedEventId = localStorage.getItem("att_eventId");
    const cachedSeq = localStorage.getItem("att_seq");
    const name = localStorage.getItem("att_name") || "";

    if (cachedEventId === eventId && cachedSeq) {
      setCachedName(name);
      setSequenceNumber(cachedSeq);
      // Auto-submit attendance
      autoRecord(cachedSeq, name);
    }
  }, [eventId, sessionId]);

  async function autoRecord(seq: string, name: string) {
    setLoading(true);
    setAutoSubmitted(true);
    try {
      const res = await api("/session/attend", {
        method: "POST",
        body: JSON.stringify({ eventId, sessionId, sequenceNumber: seq }),
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message);
      setAutoSubmitted(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const res = await api("/session/attend", {
        method: "POST",
        body: JSON.stringify({ eventId, sessionId, sequenceNumber }),
      });
      setResult(res);
      // Cache for future sessions
      localStorage.setItem("att_eventId", eventId);
      localStorage.setItem("att_seq", sequenceNumber);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!eventId || !sessionId) {
    return (
      <div className="container">
        <div className="card">
          <h1>Session Attendance</h1>
          <p className="subtitle">Please scan the QR code displayed in the session room.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <h1>Session Attendance</h1>

        {loading && autoSubmitted && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <p className="subtitle">Recording attendance for <strong>{cachedName}</strong>...</p>
          </div>
        )}

        {error && <div className="error">{error}</div>}

        {result && (
          <div className="success" style={{ padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: 8 }}>✓</div>
            <div style={{ fontSize: "1.2rem", fontWeight: 600 }}>{result.message}</div>
            {cachedName && <div style={{ color: "#666", marginTop: 8 }}>{cachedName}</div>}
          </div>
        )}

        {!result && !loading && (
          <>
            <p className="subtitle">Enter your sequence number to mark attendance</p>
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{3,4}"
                maxLength={4}
                placeholder="Sequence Number (e.g. 0042)"
                value={sequenceNumber}
                onChange={(e) => setSequenceNumber(e.target.value)}
                autoFocus
                required
              />
              <button type="submit" disabled={loading}>
                {loading ? "Recording..." : "Mark Attendance"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
