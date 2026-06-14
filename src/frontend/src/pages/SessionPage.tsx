import { useState } from "react";
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
        <p className="subtitle">Enter your sequence number to mark attendance</p>

        {error && <div className="error">{error}</div>}
        {result && <div className="success">{result.message}</div>}

        {!result && (
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
        )}
      </div>
    </div>
  );
}
