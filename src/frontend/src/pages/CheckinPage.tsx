import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../utils/api";

export function CheckinPage() {
  const [params] = useSearchParams();
  const eventId = params.get("event") || "";
  const [step, setStep] = useState<"sequence" | "otp" | "verified">("sequence");
  const [sequenceNumber, setSequenceNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [attendee, setAttendee] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSequenceSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api("/checkin/verify-sequence", {
        method: "POST",
        body: JSON.stringify({ eventId, sequenceNumber }),
      });
      setMaskedEmail(res.email);
      setStep("otp");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api("/checkin/verify-otp", {
        method: "POST",
        body: JSON.stringify({ eventId, sequenceNumber, otp }),
      });
      setAttendee(res.attendee);
      setStep("verified");
      // Cache attendee info in localStorage for session auto-submit
      localStorage.setItem("att_eventId", eventId);
      localStorage.setItem("att_seq", res.attendee.sequenceNumber);
      localStorage.setItem("att_name", res.attendee.name);
      localStorage.setItem("att_company", res.attendee.company);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!eventId) {
    return (
      <div className="container">
        <div className="card">
          <h1>Event Check-in</h1>
          <p className="subtitle">Please scan the QR code at the registration desk.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <h1>Event Check-in</h1>

        {step === "sequence" && (
          <>
            <p className="subtitle">Enter your sequence number</p>
            {error && <div className="error">{error}</div>}
            <form onSubmit={handleSequenceSubmit}>
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
                {loading ? "Verifying..." : "Continue"}
              </button>
            </form>
          </>
        )}

        {step === "otp" && (
          <>
            <p className="subtitle">OTP sent to {maskedEmail}</p>
            {error && <div className="error">{error}</div>}
            <form onSubmit={handleOtpSubmit}>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                autoFocus
                required
              />
              <button type="submit" disabled={loading}>
                {loading ? "Verifying..." : "Verify"}
              </button>
            </form>
          </>
        )}

        {step === "verified" && attendee && (
          <div className="info-display">
            <div className="verified-badge">✓ Verified</div>
            <div className="name">{attendee.name}</div>
            <div className="designation">{attendee.designation}</div>
            <div className="company">{attendee.company}</div>
            <div className="seq">#{attendee.sequenceNumber}</div>
          </div>
        )}
      </div>
    </div>
  );
}
