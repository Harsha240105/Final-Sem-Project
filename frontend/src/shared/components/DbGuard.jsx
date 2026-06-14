import { useState, useEffect, useRef } from "react";
import { API_SERVER_ORIGIN } from "../services/api";

const POLL_INTERVAL = 3000;
const MAX_POLL_TIME = 60000;

export default function DbGuard({ children }) {
  const [state, setState] = useState("checking");
  const [message, setMessage] = useState("Connecting to database...");
  const mountRef = useRef(true);

  useEffect(() => {
    mountRef.current = true;
    const startTime = Date.now();

    async function check() {
      while (mountRef.current) {
        try {
          const res = await fetch(`${API_SERVER_ORIGIN}/health`);
          const data = await res.json();
          if (data?.db?.connected) {
            if (mountRef.current) setState("connected");
            return;
          }
        } catch {
          // server not reachable yet
        }

        if (Date.now() - startTime > MAX_POLL_TIME) {
          if (mountRef.current) {
            setState("timeout");
            setMessage("Cannot connect to database. Please check that the backend server is running.");
          }
          return;
        }

        if (mountRef.current) {
          setMessage("Waiting for database connection...");
        }

        await new Promise((r) => setTimeout(r, POLL_INTERVAL));
      }
    }

    check();
    return () => { mountRef.current = false; };
  }, []);

  if (state === "connected") {
    return children;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        backgroundColor: "#060812",
        color: "#94a3b8",
        fontFamily: "system-ui, sans-serif",
        gap: "1rem",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      {state === "checking" || state === "polling" ? (
        <div
          style={{
            width: 40,
            height: 40,
            border: "2px solid rgba(6, 182, 212, 0.2)",
            borderTopColor: "#06b6d4",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
      ) : (
        <div style={{ fontSize: "3rem" }}>⚠</div>
      )}
      <p style={{ fontSize: "1.1rem", margin: 0 }}>{message}</p>
      {state === "timeout" && (
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: "1rem",
            padding: "0.6rem 1.5rem",
            backgroundColor: "rgba(6, 182, 212, 0.15)",
            border: "1px solid rgba(6, 182, 212, 0.3)",
            borderRadius: 8,
            color: "#06b6d4",
            cursor: "pointer",
            fontSize: "0.95rem",
          }}
        >
          Retry
        </button>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
