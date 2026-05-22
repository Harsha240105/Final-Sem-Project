import { useEffect, useCallback } from "react";
import { resolveAvatar } from "../../utils";

function MediaPreview({ url, type, onClose }) {
  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") onClose?.();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  if (!url) return null;

  const src = resolveAvatar(url);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 border border-white/[0.08] text-white hover:bg-gray-800 transition"
        >
          ✕
        </button>

        {type === "video" ? (
          <video
            src={src}
            controls
            autoPlay
            className="max-w-[90vw] max-h-[90vh] rounded-xl"
          />
        ) : type === "audio" ? (
          <div className="flex items-center justify-center min-h-[100px] bg-gray-900 rounded-xl px-8">
            <audio src={src} controls autoPlay className="min-w-[300px]" />
          </div>
        ) : (
          <img
            src={src}
            alt=""
            className="max-w-[90vw] max-h-[90vh] rounded-xl object-contain"
          />
        )}
      </div>
    </div>
  );
}

export default MediaPreview;
