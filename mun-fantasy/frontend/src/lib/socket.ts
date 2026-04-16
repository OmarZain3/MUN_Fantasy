import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "../store/authStore";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

let socket: Socket | null = null;
let socketToken: string | null = null;

export function getSocket(): Socket {
  const token = useAuthStore.getState().token;
  if (!token) {
    throw new Error("Socket requires an authenticated session");
  }

  if (socket && socketToken !== token) {
    socket.disconnect();
    socket = null;
    socketToken = null;
  }

  if (socket?.connected) return socket;
  if (socket && !socket.connected) {
    socket.auth = { token };
    socket.connect();
    socketToken = token;
    return socket;
  }

  socket = io(baseURL, {
    transports: ["websocket", "polling"],
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 8000,
    timeout: 20000,
  });

  socketToken = token;
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  socketToken = null;
}
