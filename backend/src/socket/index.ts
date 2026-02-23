import { Server } from "socket.io";
import http from "http";

type JoinPayload = { roomId: string; name?: string };

export function initSocket(server: http.Server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    // Join room
    socket.on("room:join", ({ roomId, name }: JoinPayload) => {
      socket.join(roomId);
      socket.to(roomId).emit("room:user-joined", {
        socketId: socket.id,
        name: name || "Guest",
      });
    });

    // Optional: leave room
    socket.on("room:leave", ({ roomId }: { roomId: string }) => {
      socket.leave(roomId);
      socket.to(roomId).emit("room:user-left", { socketId: socket.id });
    });

    // WebRTC signaling
    socket.on("webrtc:offer", ({ roomId, offer }) => {
      socket.to(roomId).emit("webrtc:offer", { offer, from: socket.id });
    });

    socket.on("webrtc:answer", ({ roomId, answer }) => {
      socket.to(roomId).emit("webrtc:answer", { answer, from: socket.id });
    });

    socket.on("webrtc:ice", ({ roomId, candidate }) => {
      socket.to(roomId).emit("webrtc:ice", { candidate, from: socket.id });
    });

    socket.on("disconnecting", () => {
      for (const roomId of socket.rooms) {
        if (roomId !== socket.id) {
          socket.to(roomId).emit("room:user-left", { socketId: socket.id });
        }
      }
    });
  });

  return io;
}