import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../utils/api";

export function ShortRedirect() {
  const { code } = useParams();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!code) return;
    (async () => {
      try {
        const data = await api(`/s/${code}`);
        if (data.targetUrl) {
          const url = new URL(data.targetUrl);
          window.location.href = url.pathname + url.search;
        } else {
          setError("Link not found");
        }
      } catch {
        setError("Link not found or expired");
      }
    })();
  }, [code]);

  if (error) return <div className="container"><div className="card"><h2>{error}</h2></div></div>;
  return <div className="container"><div className="card"><p>Redirecting...</p></div></div>;
}
