import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";

function AnimatedCounter({ value, duration = 600, className = "", prefix = "", suffix = "" }) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (typeof value !== "number") return;

    const startValue = display;
    const diff = value - startValue;
    if (diff === 0) return;

    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(startValue + diff * eased));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return (
    <span className={`number-pop ${className}`}>
      {prefix}{display}{suffix}
    </span>
  );
}

AnimatedCounter.propTypes = {
  value: PropTypes.number,
  duration: PropTypes.number,
  className: PropTypes.string,
  prefix: PropTypes.string,
  suffix: PropTypes.string,
};

export default AnimatedCounter;
