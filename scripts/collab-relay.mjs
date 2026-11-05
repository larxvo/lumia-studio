import { WebSocketServer, WebSocket } from "ws";
function attachCollabRelay(server, { origins = [] } = {}) {
  const rooms = /* @__PURE__ */ new Map(), wss = new WebSocketServer({ noServer: true, maxPayload: 65536, perMessageDeflate: false });
  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname !== "/luma-collab") {
      socket.destroy();
      return;
    }
    const origin = req.headers.origin, sameHost = (() => {
      try {
        return new URL(origin).host === req.headers.host;
      } catch {
        return false;
      }
    })();
    const room = url.searchParams.get("room"), role = url.searchParams.get("role");
    if (!origin || !sameHost && !origins.includes(origin) || !/^[a-f0-9]{32}$/.test(room || "") || !["host", "guest"].includes(role)) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }
    let r = rooms.get(room);
    if (role === "host" && r || role === "guest" && (!r || r.clients.size !== 1) || !r && rooms.size >= 100) {
      socket.write("HTTP/1.1 409 Conflict\r\n\r\n");
      socket.destroy();
      return;
    }
    if (!r) {
      r = { clients: /* @__PURE__ */ new Set(), created: Date.now(), window: Date.now(), bytes: 0 };
      rooms.set(room, r);
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      r.clients.add(ws);
      ws.role = role;
      const announce = () => {
        for (const client of r.clients) if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({ kind: "ready", peers: r.clients.size }));
      };
      announce();
      ws.on("message", (bytes, isBinary) => {
        if (isBinary) return ws.close(1003, "Text envelopes required");
        const now = Date.now();
        if (now - r.window > 1e4) {
          r.window = now;
          r.bytes = 0;
        }
        r.bytes += bytes.length;
        if (r.bytes > 64 * 1024 * 1024) return ws.close(1008, "Transfer rate exceeded");
        let p;
        try {
          p = JSON.parse(bytes);
        } catch {
          return ws.close(1008, "Invalid envelope");
        }
        if (p.kind !== "encrypted" || typeof p.n !== "string" || p.n.length !== 16 || typeof p.c !== "string" || p.c.length > 64e3) return ws.close(1008, "Invalid envelope");
        for (const peer of r.clients) if (peer !== ws && peer.readyState === WebSocket.OPEN) {
          if (peer.bufferedAmount > 16 * 1024 * 1024) return ws.close(1008, "Peer too slow");
          peer.send(bytes.toString());
        }
      });
      ws.on("error", () => {
      });
      ws.on("close", () => {
        r.clients.delete(ws);
        for (const peer of r.clients) peer.close(1e3, "Peer left");
        if (rooms.get(room) === r) rooms.delete(room);
      });
    });
  });
  const timer = setInterval(() => {
    for (const [id, r] of rooms) if (Date.now() - r.created > 4 * 60 * 60 * 1e3) {
      for (const ws of r.clients) ws.close(1e3, "Session expired");
      rooms.delete(id);
    }
  }, 6e4);
  timer.unref();
  return { wss, rooms, close() {
    clearInterval(timer);
    for (const r of rooms.values()) for (const ws of r.clients) ws.terminate();
    wss.close();
  } };
}
export {
  attachCollabRelay
};
