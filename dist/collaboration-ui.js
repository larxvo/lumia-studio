import { createRelayInvite, encodeRelayInvite, decodeRelayInvite, relayChannel } from "./collaboration-relay.js";
import { SharedDocument, createChunkTransport, encodeSignal, decodeSignal, gatherICE } from "./collaboration-core.js";
import { embeddedDocument } from "./renderer.js";
import { clone, uid, validateDocument } from "./model.js";
const $ = (s) => document.querySelector(s), esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function createCollaboration(api) {
  const actor = uid();
  let pc = null, relay = null, transport = null, shared = null, sharedId = null, host = false, status = "Chưa kết nối", inbox = Promise.resolve(), opening = false;
  function statusText(message) {
    status = message;
    const el = $("#collab-status");
    if (el) el.textContent = message;
    const badge = $("#collab-live");
    if (badge) {
      badge.hidden = !sharedId;
      badge.textContent = shared ? "● Đang cộng tác" : "○ Đang kết nối";
    }
  }
  function disconnect() {
    transport?.close();
    transport = null;
    const oldPeer = pc, oldRelay = relay;
    pc = null;
    relay = null;
    oldPeer?.close();
    oldRelay?.close();
    shared = null;
    sharedId = null;
    opening = false;
    statusText("Đã ngắt kết nối. Tài liệu trên mỗi máy được giữ lại.");
  }
  function fail(error) {
    statusText(error.message);
    api.toast(error.message, true);
  }
  async function receive(packet) {
    if (packet.type === "welcome") {
      if (host || shared) throw new Error("Unexpected collaboration welcome.");
      const next = validateDocument(packet.document);
      await api.assets.hydrate(next);
      sharedId = next.id;
      shared = new SharedDocument(next, actor);
      if (packet.state) shared.merge(packet.state, next);
      api.openShared(next);
      statusText("Đã kết nối · 2 người đang chỉnh sửa.");
    } else if (packet.type === "patch") {
      if (!shared) throw new Error("Phiên cộng tác chưa sẵn sàng.");
      const local = api.findDocument(sharedId);
      if (!local) {
        disconnect();
        return;
      }
      const result = shared.merge(packet.state, local);
      if (result) {
        await api.assets.hydrate(result);
        api.applyShared(result, "Cộng tác · " + String(packet.label || "cập nhật").slice(0, 100));
      }
      statusText("Đã đồng bộ · " + (/* @__PURE__ */ new Date()).toLocaleTimeString());
    } else throw new Error("Invalid collaboration message.");
  }
  function attach(channel) {
    const boundPeer = pc || relay;
    transport = createChunkTransport(channel, (p) => {
      inbox = inbox.then(() => receive(p)).catch(fail);
    }, fail);
    channel.onopen = async () => {
      try {
        if (host) {
          const d = api.findDocument(sharedId);
          if (!d) throw new Error("Tài liệu chia sẻ đã đóng.");
          const embedded = await embeddedDocument(d, api.assets);
          shared = new SharedDocument(embedded, actor);
          await transport.send({ type: "welcome", document: embedded, state: shared.snapshot() });
          localCommitted(d, "Cập nhật trong khi kết nối");
          statusText("Đã kết nối · 2 người đang chỉnh sửa.");
        } else statusText("Đã kết nối · đang nhận tài liệu…");
      } catch (error) {
        fail(error);
      }
    };
    channel.onclose = () => {
      if ((pc || relay) === boundPeer) disconnect();
    };
    channel.onerror = () => {
      if ((pc || relay) === boundPeer) fail(new Error("Kết nối dữ liệu bị gián đoạn."));
    };
  }
  function connection() {
    if (typeof RTCPeerConnection === "undefined") throw new Error("Cộng tác cần trình duyệt hỗ trợ WebRTC.");
    const iceServers = [];
    if ($("#collab-stun")?.checked) iceServers.push({ urls: "stun:stun.l.google.com:19302" });
    const turn = $("#collab-turn")?.value.trim();
    if (turn) {
      if (!/^turns?:[^\s]+$/i.test(turn)) throw new Error("Địa chỉ TURN không hợp lệ.");
      iceServers.push({ urls: turn, username: $("#collab-user").value, credential: $("#collab-password").value });
    }
    pc = new RTCPeerConnection({ iceServers });
    pc.ondatachannel = (e) => attach(e.channel);
    pc.onconnectionstatechange = () => {
      if (pc?.connectionState === "failed") statusText("Không kết nối qua mạng này. Thử TURN của bạn hoặc cùng mạng nội bộ.");
    };
    return pc;
  }
  async function hostInvite() {
    if (opening) return;
    opening = true;
    try {
      if (pc || relay) disconnect();
      opening = true;
      host = true;
      sharedId = api.doc().id;
      statusText("Đang tạo mã mời…");
      if ($("#collab-transport").value === "relay") {
        const invite = createRelayInvite($("#collab-relay").value.trim());
        relay = await relayChannel(invite, true);
        attach(relay);
        $("#collab-invite").value = encodeRelayInvite(invite);
        statusText("Đang chờ người cùng sửa. Gửi mã mời; không cần mã trả lời với máy chủ.");
        return;
      }
      const p = connection();
      attach(p.createDataChannel("luma-document", { ordered: true }));
      await p.setLocalDescription(await p.createOffer());
      await gatherICE(p);
      if (pc !== p) return;
      $("#collab-invite").value = encodeSignal(p.localDescription);
      statusText("Gửi mã mời cho người cùng sửa, rồi dán mã trả lời của họ ở bước 3.");
    } catch (error) {
      fail(error);
    } finally {
      opening = false;
    }
  }
  async function acceptInvite() {
    if (opening) return;
    opening = true;
    try {
      const text = $("#collab-received-invite").value.trim();
      if (text.startsWith("LUMA5R.")) {
        const invite = decodeRelayInvite(text);
        if (pc || relay) disconnect();
        host = false;
        relay = await relayChannel(invite, false);
        attach(relay);
        statusText("Đang kết nối máy chủ và nhận tài liệu…");
        return;
      }
      const offer = decodeSignal(text, "offer");
      if (pc || relay) disconnect();
      opening = true;
      host = false;
      statusText("Đang tạo mã trả lời…");
      const p = connection();
      await p.setRemoteDescription(offer);
      await p.setLocalDescription(await p.createAnswer());
      await gatherICE(p);
      if (pc !== p) return;
      $("#collab-answer").value = encodeSignal(p.localDescription);
      statusText("Gửi mã trả lời này lại cho chủ phiên. Tài liệu hiện tại của bạn vẫn ở tab riêng.");
    } catch (error) {
      fail(error);
    } finally {
      opening = false;
    }
  }
  async function finishInvite() {
    try {
      if (relay) {
        statusText("Máy chủ không cần mã trả lời. Người được mời chỉ cần dán mã và bấm Nhận lời mời.");
        return;
      }
      if (!pc || !host) throw new Error("Tạo mã mời trước.");
      await pc.setRemoteDescription(decodeSignal($("#collab-received-answer").value, "answer"));
      statusText("Đang kết nối với người cùng sửa…");
    } catch (error) {
      fail(error);
    }
  }
  function open() {
    api.showModal("Đồng biên tập", "Chia sẻ tài liệu đang mở với một người", `<div class="advanced-intro"><span class="live-pill">LIVE · 2 NGƯỜI</span><p>Cùng sửa các layer, văn bản, màu và Smart Objects. Chọn layer và vùng chọn riêng trên mỗi máy. Ai có mã kết nối đều có quyền sửa.</p></div><div class="modal-grid"><label class="modal-field">Cách kết nối<select id="collab-transport"><option value="p2p">Trực tiếp · WebRTC</option><option value="relay">Máy chủ của tôi · mã hóa đầu cuối</option></select></label><label class="modal-field" id="collab-relay-field" hidden>Máy chủ chuyển tiếp<input id="collab-relay" value="${esc(location.protocol === "https:" ? "wss://your-server.example/luma-collab" : "ws://" + location.host + "/luma-collab")}" placeholder="wss://your-server.example/luma-collab"></label></div><p class="advanced-status" id="collab-status" role="status">${esc(status)}</p><div class="collab-columns"><section><h3>Tôi là chủ phiên</h3><p>1. Tạo mã và gửi cho người cùng sửa.</p><button class="button primary" id="collab-create">Tạo mã mời</button><label class="modal-field">Mã mời<textarea id="collab-invite" aria-label="Mã mời" readonly rows="3" placeholder="Mã mời xuất hiện ở đây"></textarea></label><button class="button" data-copy-signal="collab-invite">Sao chép mã mời</button><p>3. Dán mã trả lời họ gửi lại.</p><label class="modal-field">Mã trả lời nhận được<textarea id="collab-received-answer" aria-label="Mã trả lời nhận được" rows="3"></textarea></label><button class="button" id="collab-finish">Hoàn tất kết nối</button></section><section><h3>Tôi được mời</h3><p>2. Dán mã mời, tạo mã trả lời và gửi lại.</p><label class="modal-field">Mã mời nhận được<textarea id="collab-received-invite" aria-label="Mã mời nhận được" rows="3"></textarea></label><button class="button primary" id="collab-accept">Nhận lời mời</button><label class="modal-field">Mã trả lời<textarea id="collab-answer" aria-label="Mã trả lời" readonly rows="3" placeholder="Mã trả lời xuất hiện ở đây"></textarea></label><button class="button" data-copy-signal="collab-answer">Sao chép mã trả lời</button></section></div><details class="advanced-details"><summary>Mạng & cách xử lý thay đổi</summary><label class="check-row"><input type="checkbox" id="collab-stun" checked> Dùng STUN để tìm đường kết nối qua Internet</label><p>Máy chủ chuyển tiếp đi kèm mã nguồn: chạy npm start và dùng đường dẫn /luma-collab. Khi truy cập từ Luma công khai, quản trị máy chủ cần thêm origin Luma vào LUMA_ALLOWED_ORIGINS; dùng HTTPS/WSS khi đưa lên Internet. Mã hóa AES-GCM diễn ra trên trình duyệt, khóa nằm trong mã mời và không gửi lên máy chủ. Với WebRTC, một số mạng cần máy chủ TURN. Mã mời chỉ dùng cho phiên này. Kết nối dùng mã hóa của WebRTC; STUN nhận thông tin địa chỉ mạng. Không có lưu trữ đám mây hay lịch sử chung sau khi ngắt phiên.</p><div class="modal-grid"><label class="modal-field">TURN tùy chọn<input id="collab-turn" placeholder="turns:relay.example.com:443"></label><label class="modal-field">Tên đăng nhập<input id="collab-user" autocomplete="off"></label><label class="modal-field">Mật khẩu TURN<input id="collab-password" type="password" autocomplete="off"></label></div><p>Thay đổi khác thuộc tính được gộp. Nếu cùng sửa một thuộc tính, phiên bản có thứ tự mới hơn thắng. Undo có thể tạo thay đổi mới cho cả hai; tải .luma để giữ bản riêng. Giới hạn tài liệu chia sẻ: 32 MB.</p></details>`, [{ label: "Ngắt kết nối", run: disconnect }, { label: "Trở lại chỉnh sửa", primary: true, run: () => api.closeModal() }], () => {
      $("#collab-transport").onchange = (e) => $("#collab-relay-field").hidden = e.target.value !== "relay";
      $("#collab-create").onclick = hostInvite;
      $("#collab-accept").onclick = acceptInvite;
      $("#collab-finish").onclick = finishInvite;
      document.querySelectorAll("[data-copy-signal]").forEach((b) => b.onclick = async () => {
        const value = $("#" + b.dataset.copySignal).value;
        if (!value) return;
        try {
          await navigator.clipboard.writeText(value);
          api.toast("Đã sao chép mã.");
        } catch {
          api.toast("Chọn và sao chép mã trong ô phía trên.");
        }
      });
    });
  }
  function localCommitted(doc, label) {
    if (!shared || doc.id !== sharedId || !transport) return;
    try {
      const state = shared.local(doc);
      if (state.records.length) transport.send({ type: "patch", state, label }).catch(fail);
    } catch (error) {
      fail(error);
    }
  }
  return { open, disconnect, localCommitted, documentClosed(id) {
    if (sharedId === id) disconnect();
  }, isConnected: () => !!shared, sharedId: () => sharedId };
}
export {
  createCollaboration
};
