import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/api\/?$/, "") || "http://localhost:5001";

let socket = null;
let token = null;

export function connectLiveEvents(authToken) {
  if (socket?.connected && token === authToken) return socket;
  token = authToken;
  if (socket) socket.disconnect();
  socket = io(SOCKET_URL, {
    auth: { token: authToken },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 2000,
  });
  socket.on("connect", () => console.log("[LiveEvents] Connected"));
  socket.on("disconnect", () => console.log("[LiveEvents] Disconnected"));
  socket.on("followCountUpdate", (data) => {
    window.dispatchEvent(new CustomEvent("live:followCountUpdate", { detail: data }));
  });
  socket.on("userOnline", (data) => {
    window.dispatchEvent(new CustomEvent("live:userOnline", { detail: data }));
  });
  socket.on("userOffline", (data) => {
    window.dispatchEvent(new CustomEvent("live:userOffline", { detail: data }));
  });
  socket.on("certificate:minted", (data) => {
    window.dispatchEvent(new CustomEvent("certificates-updated", { detail: data }));
  });
  return socket;
}

export function disconnectLiveEvents() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  token = null;
}

export function getSocket() {
  return socket;
}
