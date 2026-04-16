import http from "node:http";
import { bootstrapIdentityAccounts } from "./bootstrap/identity-bootstrap.js";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { initSocket } from "./services/socket.service.js";

const app = createApp();
const server = http.createServer(app);

initSocket(server);

void bootstrapIdentityAccounts()
  .then(() => {
    server.listen(env.port, () => {
      // eslint-disable-next-line no-console
      console.log(`API listening on port ${env.port}`);
    });
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to bootstrap identity accounts:", err);
    process.exit(1);
  });
