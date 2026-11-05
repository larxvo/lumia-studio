import { clone, validateDocument, uid } from "./model.js";
const META = ["name", "width", "height", "fonts", "smartObjects", "colorManagement", "guides"];
const newer = (a, b) => !b || a[0] > b[0] || a[0] === b[0] && a[1] > b[1];
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function fields(doc) {
  const out = /* @__PURE__ */ new Map();
  for (const key of META) out.set("m:" + key, doc[key]);
  out.set("m:order", doc.layers.map((l) => l.id));
  for (const l of doc.layers) {
    out.set("l:" + l.id + ":$exists", true);
    for (const [key, v] of Object.entries(l)) if (key !== "id") out.set("l:" + l.id + ":" + key, v);
  }
  return out;
}
class SharedDocument {
  constructor(doc, actor) {
    validateDocument(clone(doc));
    if (!/^[a-z0-9-]{1,80}$/i.test(actor)) throw new Error("Invalid collaborator ID.");
    this.actor = actor;
    this.counter = 0;
    this.template = clone(doc);
    this.records = new Map([...fields(doc)].map(([key, value]) => [key, { value: cloneValue(value), clock: [0, actor] }]));
    this.baseline = fields(doc);
  }
  snapshot() {
    return { version: 1, documentId: this.template.id, records: [...this.records].map(([key, r]) => ({ key, ...clone(r) })) };
  }
  local(doc) {
    const after = fields(doc), patch = [], clock = [++this.counter, this.actor];
    for (const [key, value] of after) if (!equal(value, this.baseline.get(key))) patch.push({ key, value: cloneValue(value), clock });
    for (const [key] of this.baseline) if (!after.has(key)) patch.push({ key, value: key.endsWith(":$exists") ? false : void 0, clock });
    for (const p of patch) this.records.set(p.key, p);
    this.baseline = after;
    return { version: 1, documentId: this.template.id, records: patch };
  }
  merge(packet, localDoc = null) {
    if (packet?.version !== 1 || packet.documentId !== this.template.id || !Array.isArray(packet.records) || packet.records.length > 2e4) throw new Error("Invalid collaboration update.");
    const next = new Map(this.records);
    let changed = false;
    for (const p of packet.records) {
      if (p?.key && /:(?:__proto__|prototype|constructor)$/.test(p.key)) throw new Error("Invalid collaboration property.");
      if (!p || typeof p.key !== "string" || p.key.length > 200 || !/^m:(name|width|height|fonts|smartObjects|colorManagement|guides|order)$|^l:[a-z0-9-]{1,100}:[A-Za-z_$][A-Za-z0-9_$]*$/i.test(p.key) || !Array.isArray(p.clock) || p.clock.length !== 2 || !Number.isSafeInteger(p.clock[0]) || p.clock[0] < 0 || p.clock[0] > 1e12 || typeof p.clock[1] !== "string" || !/^[a-z0-9-]{1,80}$/i.test(p.clock[1])) throw new Error("Invalid collaboration record.");
      this.counter = Math.max(this.counter, p.clock[0]);
      if (newer(p.clock, next.get(p.key)?.clock)) {
        next.set(p.key, clone(p));
        changed = true;
      }
    }
    if (!changed) return null;
    const result = this.materialize(next, localDoc);
    validateDocument(result);
    this.records = next;
    this.baseline = fields(result);
    return result;
  }
  materialize(records = this.records, localDoc = null) {
    const doc = clone(this.template), get = (key) => records.get(key)?.value;
    for (const key of META) {
      const v = get("m:" + key);
      if (v === void 0) delete doc[key];
      else doc[key] = clone(v);
    }
    const layers = /* @__PURE__ */ new Map();
    for (const [key, r] of records) {
      if (!key.startsWith("l:")) continue;
      const [, id, field] = key.split(":");
      if (get("l:" + id + ":$exists") !== true) continue;
      let l = layers.get(id);
      if (!l) {
        l = { id };
        layers.set(id, l);
      }
      if (field !== "$exists" && r.value !== void 0) l[field] = clone(r.value);
    }
    const order = get("m:order") || [];
    if (!Array.isArray(order) || order.length > 500 || order.some((x) => typeof x !== "string")) throw new Error("Invalid shared layer order.");
    const ids = [.../* @__PURE__ */ new Set([...order, ...[...layers.keys()].sort()])];
    doc.layers = ids.filter((id) => layers.has(id)).map((id) => layers.get(id));
    for (const l of doc.layers) {
      let p = l, seen = /* @__PURE__ */ new Set([l.id]);
      while (p.parentId) {
        const parent = layers.get(p.parentId);
        if (!parent || parent.type !== "group" || seen.has(parent.id)) {
          l.parentId = null;
          break;
        }
        seen.add(parent.id);
        p = parent;
      }
    }
    doc.activeId = localDoc?.activeId || doc.layers.at(-1)?.id || null;
    doc.selectedIds = (localDoc?.selectedIds || [doc.activeId]).filter((id) => layers.has(id));
    doc.selection = localDoc?.selection ? clone(localDoc.selection) : null;
    return doc;
  }
}
function cloneValue(v) {
  return v === void 0 ? void 0 : clone(v);
}
function createChunkTransport(channel, onPacket, onError = () => {
}) {
  const pending = /* @__PURE__ */ new Map();
  let serial = Promise.resolve(), closed = false;
  channel.bufferedAmountLowThreshold = 262144;
  async function drain() {
    if (channel.bufferedAmount < 1048576) return;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Kết nối quá chậm."));
      }, 15e3);
      const done = () => {
        cleanup();
        resolve();
      }, cleanup = () => {
        clearTimeout(timer);
        channel.removeEventListener("bufferedamountlow", done);
      };
      channel.addEventListener("bufferedamountlow", done, { once: true });
    });
  }
  function send(packet) {
    const text = JSON.stringify(packet);
    if (text.length > 32 * 1024 * 1024) return Promise.reject(new Error("Phiên cộng tác hỗ trợ tài liệu tối đa 32 MB."));
    serial = serial.catch(() => {
    }).then(async () => {
      const id = uid(), count = Math.ceil(text.length / 8192);
      for (let i = 0; i < count; i++) {
        if (closed || channel.readyState !== "open") throw new Error("Đã ngắt kết nối.");
        await drain();
        channel.send(JSON.stringify({ kind: "luma-chunk", id, index: i, count, text: text.slice(i * 8192, (i + 1) * 8192) }));
      }
    });
    return serial;
  }
  const receive = (event) => {
    try {
      if (typeof event.data !== "string" || event.data.length > 65536) throw new Error("Invalid peer message.");
      const p = JSON.parse(event.data);
      if (p.kind !== "luma-chunk" || typeof p.id !== "string" || p.id.length > 80 || !Number.isInteger(p.count) || p.count < 1 || p.count > 4096 || !Number.isInteger(p.index) || p.index < 0 || p.index >= p.count || typeof p.text !== "string" || p.text.length > 8192) throw new Error("Invalid peer packet.");
      for (const [id, item2] of pending) if (Date.now() - item2.time > 12e4) pending.delete(id);
      if (!pending.has(p.id)) {
        if (pending.size >= 2) throw new Error("Too many peer transfers.");
        pending.set(p.id, { parts: [], count: p.count, received: 0, time: Date.now() });
      }
      const item = pending.get(p.id);
      if (item.count !== p.count || item.parts[p.index] !== void 0) throw new Error("Invalid peer transfer sequence.");
      item.parts[p.index] = p.text;
      item.received++;
      if (item.received === item.count) {
        pending.delete(p.id);
        onPacket(JSON.parse(item.parts.join("")));
      }
    } catch (error) {
      onError(error);
    }
  };
  channel.addEventListener("message", receive);
  return { send, close() {
    closed = true;
    pending.clear();
    channel.removeEventListener("message", receive);
  } };
}
function encodeSignal(description) {
  return "LUMA5." + btoa(JSON.stringify({ type: description.type, sdp: description.sdp }));
}
function decodeSignal(text, expected) {
  if (typeof text !== "string" || text.length > 1e5 || !text.trim().startsWith("LUMA5.")) throw new Error("Mã kết nối không hợp lệ.");
  let p;
  try {
    p = JSON.parse(atob(text.trim().slice(6)));
  } catch {
    throw new Error("Mã kết nối bị cắt hoặc sai định dạng.");
  }
  if (p.type !== expected || typeof p.sdp !== "string" || p.sdp.length > 65e3 || !p.sdp.startsWith("v=0")) throw new Error("Mã kết nối sai bước.");
  return p;
}
async function gatherICE(pc) {
  if (pc.iceGatheringState === "complete") return;
  await new Promise((resolve, reject) => {
    const finish = () => {
      clearTimeout(timer);
      pc.removeEventListener("icegatheringstatechange", listener);
      resolve();
    }, listener = () => {
      if (pc.iceGatheringState === "complete") finish();
    }, timer = setTimeout(() => {
      finish();
    }, 12e3);
    pc.addEventListener("icegatheringstatechange", listener);
  });
}
export {
  SharedDocument,
  createChunkTransport,
  decodeSignal,
  encodeSignal,
  gatherICE
};
