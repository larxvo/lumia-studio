const MAX_BYTES = 104857600;
async function loadNeuralModel(kind, onProgress = () => {
}, fetcher = fetch) {
  if (!["colorization", "inpaint"].includes(kind)) throw new Error("Unknown neural model.");
  const base = new URL("./ai/", import.meta.url), res = await fetcher(new URL(kind + "-manifest.json", base));
  if (!res.ok) throw new Error("Không tải được thông tin mô hình AI.");
  const m = await res.json();
  if (!Array.isArray(m.parts) || !m.parts.length || m.parts.length > 8 || !Number.isSafeInteger(m.bytes) || m.bytes < 1 || m.bytes > MAX_BYTES) throw new Error("Invalid model manifest.");
  const result = new Uint8Array(m.bytes);
  let offset = 0;
  for (let i = 0; i < m.parts.length; i++) {
    const part = m.parts[i];
    if (part.file !== kind + ".part" + (i + 1) || !Number.isSafeInteger(part.bytes) || part.bytes < 1 || part.bytes > 16777216 || !/^[a-f0-9]{64}$/.test(part.sha256)) throw new Error("Invalid model part.");
    onProgress(`Đang tải ${kind === "inpaint" ? "LaMa" : "AI tô màu"} · ${Math.round(offset / m.bytes * 100)}%`);
    const response = await fetcher(new URL(part.file + "?v=" + part.sha256.slice(0, 16), base));
    if (!response.ok) throw new Error("Tải mô hình bị gián đoạn. Thử lại.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length !== part.bytes || offset + bytes.length > m.bytes) throw new Error("Incomplete AI model.");
    if (globalThis.crypto?.subtle) {
      const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((x) => x.toString(16).padStart(2, "0")).join("");
      if (hash !== part.sha256) throw new Error("AI model integrity check failed.");
    }
    result.set(bytes, offset);
    offset += bytes.length;
  }
  if (offset !== m.bytes) throw new Error("Incomplete AI model.");
  return result;
}
export {
  loadNeuralModel
};
