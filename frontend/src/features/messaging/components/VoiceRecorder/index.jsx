import { useState, useRef, useCallback, useEffect } from "react";

function VoiceRecorder({ onSend, onCancel }) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start();
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration(d => Math.min(d + 1, 300));
      }, 1000);
    } catch {
      // no mic access
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    clearInterval(timerRef.current);
    setRecording(false);
  }, []);

  const handleSend = useCallback(() => {
    if (!audioUrl || chunksRef.current.length === 0) return;
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    onSend?.(blob, duration);
    cleanup();
  }, [audioUrl, duration, onSend]);

  const cleanup = useCallback(() => {
    clearInterval(timerRef.current);
    setRecording(false);
    setDuration(0);
    setAudioUrl(null);
    setIsPlaying(false);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    streamRef.current?.getTracks().forEach(t => t.stop());
    onCancel?.();
  }, [audioUrl, onCancel]);

  const togglePlayback = useCallback(() => {
    if (!audioRef.current || !audioUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
      audioRef.current.onended = () => setIsPlaying(false);
    }
  }, [audioUrl, isPlaying]);

  const formatDur = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-2 px-2">
      {!audioUrl ? (
        <>
          {recording ? (
            <>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />
                <span className="text-xs text-red-400 font-mono">{formatDur(duration)}</span>
              </div>
              <button
                onClick={stopRecording}
                className="rounded-full bg-red-500/20 px-3 py-1 text-xs text-red-400 hover:bg-red-500/30 transition"
              >
                Stop
              </button>
              <button
                onClick={cleanup}
                className="text-xs text-gray-500 hover:text-gray-300 transition"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={startRecording}
              className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-xs text-gray-300 hover:bg-white/[0.08] transition active:scale-95"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3z" />
                <path d="M17 11a1 1 0 0 0-2 0 3 3 0 0 1-6 0 1 1 0 0 0-2 0 5 5 0 0 0 4 4.9V18H8a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2h-3v-2.1a5 5 0 0 0 4-4.9z" />
              </svg>
              Voice
            </button>
          )}
        </>
      ) : (
        <>
          <button
            onClick={togglePlayback}
            className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-xs text-gray-300 hover:bg-white/[0.08] transition"
          >
            <span>{isPlaying ? "⏸" : "▶️"}</span>
            <span className="font-mono">{formatDur(duration)}</span>
          </button>
          <button
            onClick={handleSend}
            className="rounded-lg bg-cyan-500/20 px-2.5 py-1.5 text-xs text-cyan-400 hover:bg-cyan-500/30 transition"
          >
            Send
          </button>
          <button
            onClick={cleanup}
            className="text-xs text-gray-500 hover:text-gray-300 transition"
          >
            ✕
          </button>
          <audio ref={audioRef} src={audioUrl} />
        </>
      )}
    </div>
  );
}

export default VoiceRecorder;
