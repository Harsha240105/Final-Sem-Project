import { useEffect, useState } from "react";

const ORBS = [
  { className: "cyber-orb cyber-orb--cyan", style: { width: 500, height: 500, top: "5%", left: "-5%" } },
  { className: "cyber-orb cyber-orb--purple", style: { width: 400, height: 400, bottom: "-10%", right: "-5%" } },
  { className: "cyber-orb cyber-orb--pink", style: { width: 350, height: 350, top: "40%", left: "30%" } },
  { className: "cyber-orb cyber-orb--green", style: { width: 300, height: 300, top: "70%", left: "60%" } },
];

function AnimatedBackground({ variant = "orbs", density = "normal" }) {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (variant === "cyber") {
    return (
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 15% 20%, rgba(0, 245, 255, 0.04), transparent 50%),
              radial-gradient(circle at 85% 15%, rgba(123, 97, 255, 0.05), transparent 45%),
              radial-gradient(circle at 50% 85%, rgba(255, 79, 216, 0.03), transparent 40%)
            `,
          }}
        />
      </div>
    );
  }

  if (variant === "none" || reduced) return null;

  const orbCount = density === "light" ? 2 : ORBS.length;
  const shownOrbs = ORBS.slice(0, orbCount);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {shownOrbs.map((orb, i) => (
        <div key={i} className={orb.className} style={orb.style} />
      ))}
    </div>
  );
}

export default AnimatedBackground;
