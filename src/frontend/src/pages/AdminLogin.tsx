import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captcha, setCaptcha] = useState({ a: 0, b: 0 });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { generateCaptcha(); }, []);

  function generateCaptcha() {
    setCaptcha({ a: Math.floor(Math.random() * 10) + 1, b: Math.floor(Math.random() * 10) + 1 });
    setCaptchaAnswer("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Validate captcha
    if (parseInt(captchaAnswer) !== captcha.a + captcha.b) {
      setError("Incorrect captcha answer");
      generateCaptcha();
      return;
    }

    setLoading(true);
    try {
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
      generateCaptcha();
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
            <span className="captcha-question">{captcha.a} + {captcha.b} = ?</span>
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
