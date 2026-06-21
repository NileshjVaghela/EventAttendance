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

  useEffect(() => { loadCaptcha(); }, []);

  async function loadCaptcha() {
    try {
      const data = await api("/captcha");
      setCaptchaId(data.captchaId);
      setCaptchaQuestion(data.question);
      setCaptchaAnswer("");
    } catch {
      // Fallback: generate client-side if API fails
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

      navigate("/admin/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
      loadCaptcha();
    } finally {
      setLoading(false);
    }
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
