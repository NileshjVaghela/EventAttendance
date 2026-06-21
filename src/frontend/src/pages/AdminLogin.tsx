import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api";

export function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaId, setCaptchaId] = useState("");
  const [captchaQuestion, setCaptchaQuestion] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // MFA state
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaOtp, setMfaOtp] = useState("");

  useEffect(() => { loadCaptcha(); }, []);

  async function loadCaptcha() {
    try {
      const data = await api("/captcha");
      setCaptchaId(data.captchaId);
      setCaptchaQuestion(data.question);
      setCaptchaAnswer("");
    } catch {
      const a = Math.floor(Math.random() * 10) + 1;
      const b = Math.floor(Math.random() * 10) + 1;
      setCaptchaId("");
      setCaptchaQuestion(`${a} + ${b}`);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Server-side captcha validation
      if (captchaId) {
        await api("/captcha/verify", {
          method: "POST",
          body: JSON.stringify({ captchaId, answer: parseInt(captchaAnswer) }),
        });
      }

      // Cognito authentication
      const { CognitoUserPool, CognitoUser, AuthenticationDetails } = await import("amazon-cognito-identity-js");
      const poolData = {
        UserPoolId: import.meta.env.VITE_USER_POOL_ID || "",
        ClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID || "",
      };
      const userPool = new CognitoUserPool(poolData);
      const user = new CognitoUser({ Username: email, Pool: userPool });
      const authDetails = new AuthenticationDetails({ Username: email, Password: password });

      await new Promise<void>((resolve, reject) => {
        user.authenticateUser(authDetails, {
          onSuccess: (session) => {
            localStorage.setItem("idToken", session.getIdToken().getJwtToken());
            localStorage.setItem("userEmail", email);
            resolve();
          },
          onFailure: (err) => reject(err),
        });
      });

      // Check if MFA is required
      const mfaCheck = await api("/admin/staff/mfa", {
        method: "POST",
        body: JSON.stringify({ action: "check", email }),
      });

      if (mfaCheck.mfaRequired) {
        // Send MFA OTP
        await api("/admin/staff/mfa", {
          method: "POST",
          body: JSON.stringify({ action: "send", email }),
        });
        setMfaStep(true);
      } else {
        navigate("/admin/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Login failed");
      loadCaptcha();
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/admin/staff/mfa", {
        method: "POST",
        body: JSON.stringify({ action: "verify", email, otp: mfaOtp }),
      });
      navigate("/admin/dashboard");
    } catch (err: any) {
      setError(err.message || "MFA verification failed");
    } finally {
      setLoading(false);
    }
  }

  if (mfaStep) {
    return (
      <div className="container">
        <div className="card">
          <h1>MFA Verification</h1>
          <p className="subtitle">Enter the code sent to your email</p>
          {error && <div className="error">{error}</div>}
          <form onSubmit={handleMfaVerify}>
            <input
              type="text"
              inputMode="numeric"
              placeholder="6-digit code"
              value={mfaOtp}
              onChange={(e) => setMfaOtp(e.target.value)}
              maxLength={6}
              required
              autoFocus
            />
            <button type="submit" disabled={loading}>
              {loading ? "Verifying..." : "Verify"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <h1>Admin Login</h1>
        <p className="subtitle">Event Attendance System</p>
        {error && <div className="error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <div className="captcha">
            <span className="captcha-question">{captchaQuestion} = ?</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Answer"
              value={captchaAnswer}
              onChange={(e) => setCaptchaAnswer(e.target.value)}
              style={{ width: "80px", marginBottom: 0 }}
              required
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
