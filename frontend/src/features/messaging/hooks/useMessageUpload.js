import { useState, useCallback, useRef } from "react";
import { uploadMessageFile } from "../../../shared/services/api";

export function useMessageUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const xhrRef = useRef(null);

  const upload = useCallback(async (file, receiver, text = "", replyTo = null) => {
    setUploading(true);
    setProgress(0);
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Not authenticated");
      const data = await uploadMessageFile(file, receiver, token, text, replyTo);
      setProgress(100);
      return data;
    } catch (err) {
      throw err;
    } finally {
      setUploading(false);
    }
  }, []);

  const cancel = useCallback(() => {
    xhrRef.current?.abort();
    setUploading(false);
    setProgress(0);
  }, []);

  return { upload, uploading, progress, cancel };
}
