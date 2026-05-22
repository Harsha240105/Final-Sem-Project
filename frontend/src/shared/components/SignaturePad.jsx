import { useRef, useState } from "react";
import { motion } from "framer-motion";
import SignatureCanvas from "react-signature-canvas";

function SignaturePad({ onSave, existing }) {
  const sigRef = useRef(null);
  const [mode, setMode] = useState("draw");
  const [uploaded, setUploaded] = useState(null);
  const [preview, setPreview] = useState(existing || null);

  const handleClear = () => {
    if (sigRef.current) sigRef.current.clear();
  };

  const handleSaveDraw = () => {
    if (!sigRef.current || sigRef.current.isEmpty()) return;
    const dataUrl = sigRef.current.toDataURL("image/png");
    setPreview(dataUrl);
    onSave(dataUrl);
  };

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
      alert("Only PNG and JPG files are allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("File too large. Max 5MB");
      return;
    }
    setUploaded(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result;
      setPreview(dataUrl);
      onSave(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button type="button" onClick={() => setMode("draw")}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${mode === "draw" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "bg-white/[0.04] text-gray-400 border border-white/[0.08]"}`}>
          Draw Signature
        </button>
        <button type="button" onClick={() => setMode("upload")}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${mode === "upload" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "bg-white/[0.04] text-gray-400 border border-white/[0.08]"}`}>
          Upload Signature
        </button>
      </div>

      {mode === "draw" ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
            <SignatureCanvas
              ref={sigRef}
              penColor="white"
              canvasProps={{
                className: "w-full h-40",
                style: { backgroundColor: "rgba(255,255,255,0.03)" },
              }}
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleClear}
              className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/30 transition">
              Clear
            </button>
            <button type="button" onClick={handleSaveDraw}
              className="rounded-lg bg-cyan-500/20 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/30 transition">
              Save Signature
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="flex flex-col items-center justify-center h-32 rounded-xl border-2 border-dashed border-white/[0.12] bg-white/[0.02] cursor-pointer hover:border-cyan-500/40 transition">
            <div className="text-2xl mb-1">✍️</div>
            <p className="text-xs text-gray-400">Click to upload signature image</p>
            <p className="text-[10px] text-gray-600">PNG or JPG, max 5MB</p>
            <input type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleUpload} className="hidden" />
          </label>
          {uploaded && (
            <p className="text-xs text-gray-400">{uploaded.name}</p>
          )}
        </div>
      )}

      {preview && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Preview</p>
          <img src={preview} alt="Signature preview" className="max-h-16 object-contain" />
        </motion.div>
      )}
    </div>
  );
}

export default SignaturePad;
