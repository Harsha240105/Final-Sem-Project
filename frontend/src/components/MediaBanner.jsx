import { useEffect, useRef, useState, useCallback } from "react";
import PropTypes from "prop-types";

function isVideoUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    const ext = u.pathname.split(".").pop()?.toLowerCase();
    if (["mp4", "webm", "ogg", "mov", "avi", "mkv"].includes(ext)) return true;
  } catch {}
  const lower = url.toLowerCase();
  return (
    lower.endsWith(".mp4") ||
    lower.endsWith(".webm") ||
    lower.endsWith(".ogg") ||
    lower.endsWith(".mov") ||
    lower.includes("video/") ||
    lower.includes("blob:")
  );
}

function MediaBanner({ src, className = "w-full h-full object-cover", ...rest }) {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);

  const tryPlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.play().catch(() => {
      setTimeout(() => tryPlay(), 300);
    });
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !isVideoUrl(src)) return;

    el.addEventListener("canplay", tryPlay, { once: true });
    el.addEventListener("loadeddata", tryPlay, { once: true });

    tryPlay();

    return () => {
      try { el.pause(); } catch {}
    };
  }, [src, tryPlay]);

  if (!src) return null;

  if (isVideoUrl(src)) {
    return (
      <video
        ref={videoRef}
        src={src}
        className={className}
        muted
        loop
        playsInline
        preload="auto"
        autoPlay
        onError={() => setError("video_error")}
        style={{ backgroundColor: "#060812" }}
        {...rest}
      />
    );
  }

  return <img src={src} alt="" className={className} loading="lazy" {...rest} />;
}

MediaBanner.propTypes = {
  src: PropTypes.string,
  className: PropTypes.string,
};

export { MediaBanner, isVideoUrl };
