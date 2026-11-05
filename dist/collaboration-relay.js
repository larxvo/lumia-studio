const b64 = (b) => btoa(String.fromCharCode(...b)), unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
function relayEndpoint(text) {
  const u = new URL(text);
  if (!["ws:", "wss:"].includes(u.protocol) || u.username || u.password || u.search || u.hash) throw new Error("Địa chỉ máy chủ phải bắt đầu bằng ws:// hoặc wss://.");
  return u.href;
}
function createRelayInvite(endpoint) {
  return { endpoint: relayEndpoint(endpoint), room: [...crypto.getRandomValues(new Uint8Array(16))].map((n) => n.toString(16).padStart(2, "0")).join(""), key: b64(crypto.getRandomValues(new Uint8Array(32))) };
}
function encodeRelayInvite(invite) {
  return "LUMA5R." + btoa(JSON.stringify(invite));
}
function decodeRelayInvite(text) {
  let p;
  try {
    p = JSON.parse(atob(text.trim().slice(7)));
  } catch {
    throw new Error("Mã mời máy chủ không hợp lệ.");
  }
  if (!text.startsWith("LUMA5R.") || !/^[a-f0-9]{32}$/.test(p.room) || typeof p.key !== "string" || unb64(p.key).length !== 32) throw new Error("Mã mời máy chủ không hợp lệ.");
  p.endpoint = relayEndpoint(p.endpoint);
  return p;
}
async function relayChannel(invite, host, { WebSocketClass = WebSocket } = {}) {
  if (!globalThis.crypto?.subtle) throw new Error("Mã hóa cộng tác cần mở Luma qua HTTPS hoặc localhost. Với máy chủ tự host, bật HTTPS khi truy cập từ máy khác.");
  const key = await crypto.subtle.importKey("raw", unb64(invite.key), "AES-GCM", false, ["encrypt", "decrypt"]), url = new URL(invite.endpoint);
  url.searchParams.set("room", invite.room);
  url.searchParams.set("role", host ? "host" : "guest");
  const socket = new WebSocketClass(url.href), channel = new EventTarget();
  let opened = false, closed = false, queue = Promise.resolve(), inbox = Promise.resolve(), queued = 0;
  Object.defineProperties(channel, { readyState: { get: () => closed ? "closed" : opened ? "open" : "connecting" }, bufferedAmount: { get: () => queued + socket.bufferedAmount } });
  channel.bufferedAmountLowThreshold = 262144;
  const failure = () => {
    channel.onerror?.();
    channel.close();
  };
  channel.send = (text) => {
    queued += text.length;
    queue = queue.then(async () => {
      const nonce = crypto.getRandomValues(new Uint8Array(12)), cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, new TextEncoder().encode(text)));
      if (closed) throw new Error("Disconnected");
      socket.send(JSON.stringify({ kind: "encrypted", n: b64(nonce), c: b64(cipher) }));
      queued -= text.length;
    }).catch(failure);
  };
  channel.close = () => {
    if (closed) return;
    closed = true;
    clearInterval(timer);
    socket.close();
    channel.onclose?.();
  };
  socket.onmessage = (event) => {
    inbox = inbox.then(async () => {
      if (typeof event.data !== "string" || event.data.length > 65536) throw new Error("Invalid encrypted relay message.");
      const p = JSON.parse(event.data);
      if (p.kind === "ready") {
        if (p.peers === 2 && !opened) {
          opened = true;
          channel.onopen?.();
        }
        return;
      }
      if (p.kind !== "encrypted" || typeof p.n !== "string" || p.n.length !== 16 || typeof p.c !== "string" || p.c.length > 64e3) throw new Error("Invalid encrypted envelope.");
      const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(p.n) }, key, unb64(p.c));
      channel.dispatchEvent(new MessageEvent("message", { data: new TextDecoder().decode(plain) }));
    }).catch(failure);
  };
  socket.onerror = failure;
  socket.onclose = () => channel.close();
  const timer = setInterval(() => {
    if (channel.bufferedAmount < channel.bufferedAmountLowThreshold) channel.dispatchEvent(new Event("bufferedamountlow"));
  }, 200);
  return channel;
}
export {
  createRelayInvite,
  decodeRelayInvite,
  encodeRelayInvite,
  relayChannel,
  relayEndpoint
};
