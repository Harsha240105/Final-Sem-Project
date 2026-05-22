const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api";

function authHeaders(token) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function enqueueMint(communityId, token, userId) {
  const body = userId ? { communityId, userId } : { communityId };
  const res = await fetch(`${API_BASE}/blockchain/enqueue`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to enqueue" }));
    throw new Error(err.error || err.message || "Failed to enqueue");
  }
  return res.json();
}

export async function getQueueStatus(token) {
  const res = await fetch(`${API_BASE}/blockchain/queue/user`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch queue status");
  return res.json();
}

export async function getJobStatus(jobId, token) {
  const res = await fetch(`${API_BASE}/blockchain/queue/${jobId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch job status");
  return res.json();
}

export async function retryMintJob(jobId, token) {
  const res = await fetch(`${API_BASE}/blockchain/retry`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ jobId }),
  });
  if (!res.ok) throw new Error("Failed to retry job");
  return res.json();
}

export async function getMintProgress(token) {
  const res = await fetch(`${API_BASE}/certificates/progress`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch mint progress");
  return res.json();
}

export async function verifyCertificateOnChain(certificateId) {
  const res = await fetch(`${API_BASE}/blockchain/verify/${certificateId}`);
  if (!res.ok) throw new Error("Failed to verify certificate");
  return res.json();
}
