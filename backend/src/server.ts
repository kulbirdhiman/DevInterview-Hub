import http from "http";
import dotenv from "dotenv";
import app from "./app";
import { initSocket } from "./socket";

dotenv.config();

const PORT = Number(process.env.PORT || 5000);

const server = http.createServer(app);

// Socket.IO init
initSocket(server);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ API running: http://localhost:${PORT}`);
  console.log(`✅ Health:     http://localhost:${PORT}/api/health`);
});