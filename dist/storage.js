let database;
async function db() {
  if (database) return database;
  database = await new Promise((resolve, reject) => {
    const r = indexedDB.open("luma-studio", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("documents", { keyPath: "id" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return database;
}
async function saveLocal(doc) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction("documents", "readwrite");
    tx.objectStore("documents").put({ id: doc.id, updatedAt: Date.now(), doc });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Autosave failed"));
  });
}
async function recentLocal() {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction("documents", "readonly"), r = tx.objectStore("documents").getAll();
    r.onsuccess = () => resolve(r.result.sort((a, b) => b.updatedAt - a.updatedAt));
    r.onerror = () => reject(r.error);
  });
}
function downloadBlob(blob, name) {
  const a = document.createElement("a"), url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 6e4);
}
export {
  downloadBlob,
  recentLocal,
  saveLocal
};
