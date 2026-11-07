import {createPlatformStudio} from './platform-studio.js';
import {createDocumentTools} from './document-tools.js';
import {openTypeStudio} from './type-studio.js';
import {canEdit,assertCanEdit,lockState} from './layer-policy.js';
import {editText,advancedText,scaleText} from './text-engine.js';
import {transformDocumentData} from './document-data.js';
import {createDesktopUI} from './desktop-ui.js';
import {createCursorTheme} from './cursor-theme.js';
import {openLayerStyles} from './layer-styles.js';
import {switchLevelChannel,levelSettings} from './tone-controls.js';
import {hasLayerEffects} from './layer-effects.js';
import {readOriginalImage} from './image-io.js';
import {withPrintMetadata,printSize} from './print-metadata.js';
import {searchActions} from './workspace-navigation.js';
import { createPhotoLab } from "./photo-lab.js";
import { createAdvancedStudio } from "./advanced-ui.js";
import { createProStudio } from "./pro-ui.js";
import { ancestors, children, subtree, selected, roots, bounds, refreshGroups, selectLayer, moveObjects, reorderObject, effectiveVisible, effectiveLocked } from "./pro-model.js";
import { createWorkspace } from "./workspace.js";
import { VERSION, BLENDS, MAX_PIXELS, clamp, uid, clone, defaults, createLayer, createDocument, validateDocument, History, hitLayer, localPoint, moveLayer as moveSingleLayer, cropDocument, histogram, floodSelection } from "./model.js";
import { Assets, canvas, renderDocument, renderLayer, maskCanvas, thumbnail, embeddedDocument } from "./renderer.js";
import { icon, icons } from "./icons.js";
import { saveLocal, recentLocal, downloadBlob } from "./storage.js";
const $ = (s, root = document) => root.querySelector(s), $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const titleCase = (s) => s.replace(/(^|[-/ ])\w/g, (x) => x.toUpperCase()).replaceAll("-", " ");
const assets = new Assets(), sessions = [];
const tools = [["move", "Move", "V"],["node","Direct Selection","A"], ["select", "Rectangular selection", "M"], ["ellipse", "Elliptical selection", "Shift M"], ["lasso", "Lasso selection", "L"], ["wand", "Magic wand", "W"], ["crop", "Crop", "C"], ["brush", "Brush", "B"], ["eraser", "Eraser", "E"], ["clone", "Clone stamp", "S"], ["heal", "Healing blend", "J"], ["dodge", "Dodge", "O"], ["burn", "Burn", "Shift O"], ["pen", "Bezier pen", "P"], ["text", "Text", "T"], ["shape", "Shape", "U"], ["gradient", "Gradient shape", "G"], ["eyedropper", "Eyedropper", "I"], ["hand", "Hand", "H"], ["zoom", "Zoom", "Z"]];
const adjustments = [["curves", "Curves", "curves"], ["levels", "Levels", "levels"], ["brightness", "Brightness", "sun"], ["exposure", "Exposure", "exposure"], ["vibrance", "Vibrance", "vibrance"], ["hue", "Hue / Saturation", "hue"], ["monochrome", "Black & white", "adjust"], ["temperature", "Temperature", "temperature"], ["invert", "Invert", "adjust"], ["grain", "Film grain", "grain"], ["blur", "Blur", "blur"], ["colorbalance", "Color balance", "sliders"], ["shadows", "Shadows / Highlights", "sun"], ["posterize", "Posterize", "levels"], ["threshold", "Threshold", "adjust"], ["channelmixer", "Channel mixer", "hue"]];
let documentTools=null;
let desktop=null,selectionFeather=0,selectionAntiAlias=true;
let workspace = null, photoLab = null, pro = null, advanced = null, layerQuery = "", layerKind = "all", selectionMode = "replace", wandTolerance = 32;
let current = null, tool = "move", autoSelect = true, showTransform = true, maskMode = false, brushSize = 40, brushOpacity = 100, shapeType = "rect", foreground = "#eef4f3", background = "#152a27", space = false, grid = false, activePanel = "properties", layerTab = "layers", gesture = null, hover = null, frame = 0, composite = null, renderScale = 1, stats = null, saveTimers = /* @__PURE__ */ new Map(), menuOpen = false, modalCancel = null, editingText = null, curveDragging = null;
const doc = () => current?.doc, layer = () => doc()?.layers.find((l) => l.id === doc().activeId);
function moveLayer(target, dx, dy) {
  if (target.type === "group") moveObjects(doc(), [target], dx, dy);
  else moveSingleLayer(target, dx, dy);
}
function toast(message, error = false, action = null) {
  const t = document.createElement("div");
  t.className = "toast" + (error ? " error" : "");
  t.innerHTML = icon(error ? "alert" : "check") + `<span>${esc(message)}</span>`;
  if (action) {
    const b = document.createElement("button");
    b.textContent = action.label;
    b.onclick = () => {
      action.run();
      t.remove();
    };
    t.append(b);
  }
  $("#toasts").append(t);
  setTimeout(() => t.remove(), action ? 11e3 : 4200);
}
function busy(label) {
  $("#autosave-label").innerHTML = `<i></i>${esc(label)}`;
}
function commit(label) {
  if (!current) return;
  current.history.push(doc(), label);
  advanced?.collaboration.localCommitted(doc(),label);
  renderUI();
  scheduleSave(current);
  requestRender();
}
function scheduleSave(session) {
  clearTimeout(saveTimers.get(session.doc.id));
  busy("Unsaved");
  saveTimers.set(session.doc.id, setTimeout(async () => {
    if (gesture && current === session) {
      scheduleSave(session);
      return;
    }
    try {
      await saveLocal(session.doc);
      if (current === session) busy("Saved on device");
    } catch {
      if (current === session) busy("Save unavailable");
      toast("Autosave unavailable. Save a .luma project to keep your work.", true);
    }
  }, 850));
}
function setDocument(next, label = "Document opened") {
  documentTools?.cancel();
  advanced?.cancel();
  photoLab?.cancel();
  pro?.cancel();
  finishText();
  const existing = sessions.find((s) => s.doc.id === next.id);
  if (existing) {
    current = existing;
  } else {
    current = { doc: next, history: new History(next, label), zoom: 1, panX: 0, panY: 0, fitted: false };
    sessions.push(current);
  }
  maskMode = false;
  renderUI();
  fit();
  requestRender();
  scheduleSave(current);
}
async function restore(index) {
  documentTools?.cancel();
  advanced?.cancel();
  photoLab?.cancel();
  pro?.cancel();
  const session = current;
  const next = session.history.go(index);
  await assets.hydrate(next);
  if (current !== session) return;
  session.doc = next;
  advanced?.collaboration.localCommitted(next,'Undo / Redo');
  maskMode = false;
  renderUI();
  requestRender();
  scheduleSave(session);
}
async function undo() {
  if (current.history.index > 0) await restore(current.history.index - 1);
}
async function redo() {
  if (current.history.index < current.history.entries.length - 1) await restore(current.history.index + 1);
}
function makeDemo() {
  const d = createDocument(1800, 1242, "The Great Wave");
  const base = createLayer("image", { name: "The Great Wave", source: "assets/wave.jpg", width: 1800, height: 1242, locked: true });
  const card = createLayer("shape", { name: "Caption card", shape: "rect", x: 110, y: 916, width: 762, height: 213, color: "#142c3a", radius: 22, opacity: 0.9 });
  card.effects.shadow = true;
  card.effects.shadowBlur = 32;
  card.effects.shadowY = 14;
  const heading = createLayer("text", { name: "The Great Wave — title", text: "The Great Wave", x: 151, y: 943, width: 695, height: 94, font: "Inter", fontSize: 72, fontWeight: 700, lineHeight: 1.14, color: "#f5f3e7", align: "left" });
  const credit = createLayer("text", { name: "Artist & provenance", text: "Katsushika Hokusai  ·  c. 1831  ·  Public domain", x: 154, y: 1041, width: 674, height: 38, font: "Inter", fontSize: 24, fontWeight: 400, lineHeight: 1.2, color: "#d8e0db", align: "left" });
  const vib = createLayer("adjustment", { name: "Vibrance", adjustment: "vibrance", params: { vibrance: 12, saturation: 2 }, width: d.width, height: d.height });
  const cur = createLayer("adjustment", { name: "Curves", adjustment: "curves", params: { channel: "rgb", points: [[0, 0], [62, 49], [181, 196], [255, 255]] }, width: d.width, height: d.height });
  d.layers = [base, card, heading, credit, vib, cur];
  d.activeId = cur.id;
  return d;
}
function renderTools() {
  const root = $("#tools");
  root.innerHTML = tools.map(([name, label, key], i) => `${i === 6 || i === 12 ? '<div class="tool-separator"></div>' : ""}<button class="tool-button ${name === tool ? "active" : ""}" data-tool="${name}" title="${label} (${key})" aria-label="${label}" aria-pressed="${name === tool}">${icon(name)}</button>`).join("");
}
function setTool(next) {
  if(next!==tool){documentTools?.cancel();pro?.cancel();}
  finishText();
  tool = next;
  maskMode = ["brush","eraser","move"].includes(next) ? maskMode : false;
  renderTools();
  renderContext();
  renderOverlay();
  const mode = next === "hand" ? "hand-active" : ["brush", "eraser"].includes(next) ? "paint-active" : ["select", "ellipse", "lasso", "crop", "wand", "shape", "gradient"].includes(next) ? "crop-active" : "";
  $("#stage").classList.remove("hand-active", "paint-active", "crop-active");
  if (mode) $("#stage").classList.add(mode);
  $("#status-hint").textContent = `${tools.find((t) => t[0] === tool)?.[1] || tool} · ${tools.find((t) => t[0] === tool)?.[2] || ""}`;
}
function renderContext() {
  const name = tools.find((t) => t[0] === tool)?.[1] || tool;
  let controls = "";
  if (tool === "move") controls = `<label><input id="auto-select" type="checkbox" ${autoSelect ? "checked" : ""}> Auto-select</label><select id="auto-mode" aria-label="Auto select mode"><option>Layer</option></select><label class="check-secondary"><input id="show-transform" type="checkbox" ${showTransform ? "checked" : ""}> Transform controls</label>`;
  else if (tool === "brush" || tool === "eraser") controls = `<label>Size <input id="brush-size" type="number" min="1" max="600" value="${brushSize}"> px</label><label>Opacity <input id="brush-opacity" type="number" min="1" max="100" value="${brushOpacity}"> %</label><button class="button ${maskMode ? "primary" : ""}" data-action="mask-mode">${maskMode ? "Painting mask" : "Paint mask"}</button><span class="context-extra">${tool === "eraser" ? "Hide" : "Reveal"} with pressure-sensitive strokes</span>`;
  else if (["select", "ellipse", "lasso", "wand"].includes(tool)) controls = `<span class="context-extra">${tool === "wand" ? "Click a connected color region" : "Drag to select an area"}</span><button class="button" data-action="add-mask">Make mask</button><button class="button" data-action="invert-selection">Invert</button><button class="button" data-action="deselect">Deselect</button>`;
  else if (tool === "crop") controls = `<span class="context-extra">Drag a crop area</span><button class="button" data-action="apply-crop">Apply crop</button><button class="button" data-action="deselect">Cancel</button>`;
  else if (tool === "text") controls = `<span class="context-extra">Click to add type · Double-click text to edit</span><button class="button" data-action="add-text">Add text layer</button>`;
  else if (tool === "shape" || tool === "gradient") controls = `<select id="shape-type" aria-label="Shape type">${["rect", "ellipse", "triangle", "star", "line"].map((s) => `<option value="${s}" ${s === shapeType ? "selected" : ""}>${titleCase(s)}</option>`).join("")}</select><span class="context-extra">Drag to draw · Shift for equal sides</span>`;
  else if (tool === "hand") controls = '<span class="context-extra">Drag to pan · Hold Space with any tool</span><button class="button" data-action="fit">Fit canvas</button>';
  else if (tool === "zoom") controls = '<span class="context-extra">Click to zoom in · Alt-click to zoom out</span><button class="button" data-action="zoom-100">100%</button><button class="button" data-action="fit">Fit canvas</button>';
  else controls = '<span class="context-extra">Click the canvas to sample a color</span>';
  controls = pro?.context(tool) ?? controls;
  if(tool==="node")controls=`<span>Điểm neo & tay nắm · Alt tách hai phía</span><button class="button" data-action="path-points">Thông số điểm</button>`;
  if(tool==="move"&&layer()?.mask)controls+=`<button class="context-target" data-action="target-layer">Nội dung</button><button class="context-target" data-action="target-mask">Mask ${layer().mask.linked===false?"độc lập":"liên kết"}</button>`;
  if (["select", "ellipse", "lasso", "wand"].includes(tool)) controls = `<select id="selection-mode" aria-label="Selection mode">${[["replace", "New selection"], ["add", "Add to selection"], ["subtract", "Subtract"], ["intersect", "Intersect"]].map(([v, n]) => `<option value="${v}" ${selectionMode === v ? "selected" : ""}>${n}</option>`).join("")}</select>${tool === "wand" ? `<label>Tolerance <input id="wand-tolerance" type="number" min="0" max="255" value="${wandTolerance}"></label>` : ""}` + `<label>Feather <input id="selection-feather" type="number" min="0" max="100" value="${selectionFeather}"> px</label><label><input id="selection-antialias" type="checkbox" ${selectionAntiAlias?"checked":""}> Anti-alias</label><button class="button" data-action="select-mask">Select &amp; Mask</button>` + controls;
  $("#tool-context").innerHTML = `<span class="context-name">${icon(tool)} ${esc(name)}</span>${controls}`;
  $("#selection-feather")?.addEventListener("change",e=>selectionFeather=clamp(Number(e.target.value)||0,0,100));
  $("#selection-antialias")?.addEventListener("change",e=>selectionAntiAlias=e.target.checked);
  $("#auto-select")?.addEventListener("change", (e) => autoSelect = e.target.checked);
  $("#show-transform")?.addEventListener("change", (e) => {
    showTransform = e.target.checked;
    renderOverlay();
  });
  $("#brush-size")?.addEventListener("change", (e) => {
    brushSize = clamp(Number(e.target.value) || 1, 1, 600);
    e.target.value = brushSize;
  });
  $("#brush-opacity")?.addEventListener("change", (e) => {
    brushOpacity = clamp(Number(e.target.value) || 1, 1, 100);
    e.target.value = brushOpacity;
  });
  $("#selection-mode")?.addEventListener("change", (e) => selectionMode = e.target.value);
  $("#wand-tolerance")?.addEventListener("change", (e) => wandTolerance = clamp(Number(e.target.value) || 0, 0, 255));
  pro?.bindContext();
  $("#shape-type")?.addEventListener("change", (e) => shapeType = e.target.value);
}
function renderTabs() {
  if (!current) return;
  $("#document-tabs").innerHTML = sessions.map((s) => `<div class="document-tab ${s === current ? "active" : ""}" role="tab" tabindex="0" aria-selected="${s === current}" data-document="${s.doc.id}">${icon("image")}<span>${esc(s.doc.name)}${s.localCopy ? " · bản riêng" : ""} <small>· ${s.doc.width} × ${s.doc.height}</small></span><button class="tab-close" data-close-document="${s.doc.id}" aria-label="Close ${esc(s.doc.name)}">${icon("x")}</button></div>`).join("");
}
function renderUI() {
  documentTools?.update();
  if (!current) return;
  refreshGroups(doc());
  renderTabs();
  renderProperties();
  renderLayers();
  renderHistory();
  desktop?.refresh();
  workspace?.update();
  advanced?.update();
  $("#status-size").textContent = `${doc().width.toLocaleString()} × ${doc().height.toLocaleString()} px`;
  $("#status-layer-count").textContent = `${doc().layers.length} layers`;
  $("#layer-count").textContent = doc().layers.length;
  $("#nav-size").textContent = `${doc().width} × ${doc().height} px`;
  $("#blend-mode").value = layer()?.blend || "normal";
  $("#layer-opacity").value = Math.round((layer()?.opacity ?? 1) * 100);
  $('[data-action="undo"]').disabled = current.history.index === 0;
  $('[data-action="redo"]').disabled = current.history.index === current.history.entries.length - 1;
}
function renderLayers() {
  const d = doc();
  if (!d) return;
  const list = $("#layer-list"), scrollTop = list.dataset.layerDocument === d.id ? list.scrollTop : 0;
  list.dataset.layerDocument = d.id;
  const selection = selected(d), selectedSet = new Set(selection.map((l) => l.id)), query = layerQuery.toLowerCase(), matches = (l) => (!query || l.name.toLowerCase().includes(query)) && (layerKind === "all" || l.type === layerKind), allowed = new Set(d.layers.filter(matches).flatMap((l) => [l.id, ...ancestors(d, l).map((a) => a.id)]));
  const ordered = [];
  function walk(parent = null, depth = 0) {
    for (const l of [...children(d, parent)].reverse()) {
      if ((query || layerKind !== "all") && !allowed.has(l.id)) continue;
      ordered.push({ l, depth });
      if (l.type === "group" && (!l.collapsed || query || layerKind !== "all")) walk(l.id, depth + 1);
    }
  }
  walk();
  $("#selection-count").textContent = selection.length > 1 ? selection.length + " selected" : "Shift / Ctrl-click to select";
  $("#layer-list").innerHTML = ordered.length ? ordered.map(({ l, depth }) => `<div class="layer-row ${selectedSet.has(l.id) ? "selected" : ""} ${!effectiveVisible(d, l) ? "ancestor-hidden" : ""}" style="--depth:${depth}" data-layer="${l.id}" draggable="true" role="button" tabindex="0" aria-label="${esc(l.name)}" aria-pressed="${selectedSet.has(l.id)}"><button class="eye-button ${!l.visible ? "is-hidden" : ""}" data-visibility="${l.id}" title="${l.visible ? "Hide" : "Show"} layer" aria-label="${l.visible ? "Hide" : "Show"} ${esc(l.name)}">${icon(l.visible ? "eye" : "eye-off")}</button>${l.type === "group" ? `<button class="group-toggle" data-group-toggle="${l.id}" title="${l.collapsed ? "Expand" : "Collapse"} group" aria-label="${l.collapsed ? "Expand" : "Collapse"} ${esc(l.name)}">${icon(l.collapsed ? "chevron-right" : "chevron-down")}</button>` : ""}<div class="layer-thumb" data-thumb="${l.id}">${l.type === "group" ? icon("folder") : l.type === "adjustment" ? icon(adjustments.find((a) => a[0] === l.adjustment)?.[2] || "adjust") : l.type === "text" ? '<span class="type-thumb">T</span>' : ""}</div>${l.mask ? `<button class="mask-thumb ${l.id === d.activeId && maskMode ? "active" : ""}" data-edit-mask="${l.id}" title="Edit mask" aria-label="Edit layer mask"></button>` : ""}<div class="layer-name"><strong>${l.clipToBelow ? "↳ " : ""}${esc(l.name)}</strong><small>${l.type === "group" ? children(d, l.id).length + " items" : l.type === "adjustment" ? esc(adjustments.find((a) => a[0] === l.adjustment)?.[1] || l.adjustment) : l.type === "text" ? "Live type" : l.type === "shape" ? "Vector shape" : l.smartObjectId ? "Smart Object" : l.locked ? "Background" : "Pixel layer"}</small></div><span class="layer-meta">${effectiveLocked(d, l) ? icon("lock") : ""}${l.filters?.length ? '<span class="filter-dot" title="Live filters">●</span>' : ""}${hasLayerEffects(l) ? '<span class="fx-symbol">fx</span>' : ""}</span></div>`).join("") : '<p class="empty-layers">No matching layers.</p>';
  for (const l of d.layers) {
    if (!["adjustment", "text", "group"].includes(l.type)) {
      const p = $(`[data-thumb="${l.id}"]`);
      if (p) try {
        p.append(thumbnail(d, l, assets));
      } catch {
      }
    }
    if (l.mask) {
      const p = $(`[data-edit-mask="${l.id}"]`);
      if (p) {
        const c = canvas(28, 32), x = c.getContext("2d");
        x.fillStyle = "#111";
        x.fillRect(0, 0, 28, 32);
        const s = Math.min(28 / d.width, 32 / d.height);
        x.drawImage(maskCanvas(d, l.mask, s, assets), (28 - d.width * s) / 2, (32 - d.height * s) / 2);
        p.append(c);
      }
    }
  }
  desktop?.decorateLayers();
  list.scrollTop = scrollTop;
}
function renderHistory() {
  if (!current) return;
  $("#history-list").innerHTML = current.history.entries.map((e, i) => `<button class="history-row ${i === current.history.index ? "current" : i > current.history.index ? "future" : ""}" data-history="${i}">${icon(i === 0 ? "folder-open" : "history")}<span>${esc(e.label)}</span><small>${new Date(e.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></button>`).join("");
}
const rangeControl = (label, key, value, min, max, step = 1, unit = "") => `<div class="control"><label>${esc(label)}<span class="value-input"><input type="number" data-property="${key}" min="${min}" max="${max}" step="${step}" value="${Number(value).toFixed(step < 1 ? 2 : 0)}" aria-label="${esc(label)}"><span>${unit}</span></span></label><input type="range" data-property="${key}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${esc(label)} slider"></div>`;
const numberField = (label, key, value, unit = "px") => `<label class="number-field"><span>${label}</span><input type="number" data-property="${key}" value="${Math.round(value)}" aria-label="${label}"><small>${unit}</small></label>`;
function renderProperties() {
  const root = $("#properties"), l = layer();
  $$("[data-panel]").forEach((b) => {
    b.classList.toggle("active", b.dataset.panel === activePanel);
    b.setAttribute("aria-selected", b.dataset.panel === activePanel);
  });
  if (activePanel === "studio" || selected(doc()).length > 1) {
    pro?.renderPanel(root);
    return;
  }
  if (activePanel === "adjustments") {
    root.innerHTML = `<div class="property-title">${icon("adjust")}Adjustments <span class="badge">LIVE LAYERS</span></div><p class="panel-description">Shape the light, keep your original. Every adjustment stays editable.</p><div class="adjustment-grid">${adjustments.map(([id, name, i]) => `<button data-adjustment="${id}" title="Add ${esc(name)} adjustment layer">${icon(i)}${esc(name)}</button>`).join("")}</div><div class="property-small-heading">CURATED LOOKS</div><div class="look-grid">${[["soft", "Soft film", "saturate(.75) contrast(.93)"], ["warm", "Golden hour", "sepia(.25) saturate(1.2)"], ["mono", "Monochrome", "grayscale(1) contrast(1.15)"]].map(([id, name, filter]) => `<button data-look="${id}"><img class="look-preview" src="assets/wave.jpg" alt="${name} look preview" style="filter:${filter}">${name}</button>`).join("")}</div>`;
    return;
  }
  if (l?.type === "group") {
    root.innerHTML = `<div class="property-title">${icon("folder")}${esc(l.name)}<span class="badge">GROUP</span></div><p class="panel-description">${subtree(doc(), l.id).length - 1} layers · opacity and masks affect the whole group.</p><div class="studio-button-grid"><button class="button" data-action="transform">Transform group</button><button class="button" data-action="ungroup">Ungroup</button><button class="button" data-action="rasterize">Rasterize</button><button class="button" data-action="studio">Align / distribute</button></div>${pro?.extras(l) || ""}${l.mask ? `<div class="mask-panel"><h4>Group mask</h4>${rangeControl("Feather", "mask.feather", l.mask.feather || 0, 0, 100, 1, "px")}${rangeControl("Density", "mask.density", l.mask.density??100, 0, 100, 1, "%")}<label class="check-row"><input type="checkbox" data-property="mask.disabled" ${l.mask.disabled?"checked":""}> Tạm tắt mask</label><div class="mask-actions"><button data-action="mask-mode">Paint mask</button><button data-action="invert-mask">Invert</button><button data-action="remove-mask">Remove</button></div></div>` : ""}`;
    if(l?.type==="text"){root.insertAdjacentHTML("beforeend",`<button class="button type-open" data-action="type-studio">Type Studio · định dạng từng đoạn</button><div class="property-small-heading">PARAGRAPH & METRICS</div><div class="control-grid">${[["startIndent","Lề trái",0],["endIndent","Lề phải",0],["firstLineIndent","Dòng đầu",0],["spaceBefore","Trước đoạn",0],["spaceAfter","Sau đoạn",0],["baselineShift","Baseline",0],["horizontalScale","Ngang %",100],["verticalScale","Dọc %",100],["kerning","Kerning",0]].map(([k,n,v])=>numberField(n,k,l[k]??v,k.includes("Scale")?"%":"px")).join("")}</div><label>Canh đoạn<select data-property="align">${["left","center","right","justify"].map(v=>`<option ${v===l.align?"selected":""}>${v}</option>`).join("")}</select></label>`);}
  bindProperties(root);
    return;
  }
  if (!l) {
    root.innerHTML = `<div class="property-title">${icon("image")}Your canvas <span class="badge">READY</span></div><p class="panel-description">Add an image, type, a shape or a paint layer to begin.</p><button class="button primary" data-action="place">${icon("image")}Place image</button><div class="property-divider"></div><div class="control-grid">${numberField("W", "doc.width", doc()?.width || 1800)}${numberField("H", "doc.height", doc()?.height || 1200)}</div>`;
    if(l?.type==="text"){root.insertAdjacentHTML("beforeend",`<button class="button type-open" data-action="type-studio">Type Studio · định dạng từng đoạn</button><div class="property-small-heading">PARAGRAPH & METRICS</div><div class="control-grid">${[["startIndent","Lề trái",0],["endIndent","Lề phải",0],["firstLineIndent","Dòng đầu",0],["spaceBefore","Trước đoạn",0],["spaceAfter","Sau đoạn",0],["baselineShift","Baseline",0],["horizontalScale","Ngang %",100],["verticalScale","Dọc %",100],["kerning","Kerning",0]].map(([k,n,v])=>numberField(n,k,l[k]??v,k.includes("Scale")?"%":"px")).join("")}</div><label>Canh đoạn<select data-property="align">${["left","center","right","justify"].map(v=>`<option ${v===l.align?"selected":""}>${v}</option>`).join("")}</select></label>`);}
  bindProperties(root);
    return;
  }
  let html = `<div class="property-title">${icon(l.type === "adjustment" ? adjustments.find((a) => a[0] === l.adjustment)?.[2] || "adjust" : l.type === "text" ? "text" : l.type === "shape" ? "shape" : "image")}${l.type === "adjustment" ? esc(adjustments.find((a) => a[0] === l.adjustment)?.[1] || l.adjustment) : l.type === "text" ? "Type layer" : l.type === "shape" ? "Shape layer" : l.smartObjectId ? "Smart Object" : "Pixel layer"}<span class="badge">${l.type === "adjustment" ? "NON-DESTRUCTIVE" : l.locked ? "LOCKED" : "EDITABLE"}</span></div>`;
  if (l.type === "adjustment") {
    const p = l.params;
    if (l.adjustment === "curves") html += `<div class="property-row"><span>Channel</span><select data-property="params.channel" aria-label="Curves channel">${["rgb", "red", "green", "blue"].map((c) => `<option value="${c}" ${c === p.channel ? "selected" : ""}>${c === "rgb" ? "RGB" : titleCase(c)}</option>`).join("")}</select><select id="curve-preset" aria-label="Curve preset"><option value="">Custom</option><option value="linear">Linear</option><option value="contrast">Contrast</option><option value="matte">Matte</option><option value="bright">Lift</option></select></div><div class="curve-wrap"><canvas id="curve" width="500" height="320" aria-label="Interactive curves. Click to add a point and drag to change tone." tabindex="0"></canvas></div><div class="curve-coordinates"><span>Input <strong id="curve-input">—</strong></span><span>Output <strong id="curve-output">—</strong></span></div><p class="curve-hint">${icon("info")}Click to add · Drag to adjust · Double-click to remove</p>`;
    else if (l.adjustment === "levels") html += `<div class="property-row"><label>Channel <select data-property="params.channel" aria-label="Levels channel">${["rgb","red","green","blue"].map(c=>`<option value="${c}" ${c===(p.channel||'rgb')?'selected':''}>${c==='rgb'?'RGB':titleCase(c)}</option>`).join('')}</select></label><button class="button" data-action="auto-levels">Auto</button></div><canvas class="histogram" id="histogram" width="500" height="150" aria-label="Image histogram"></canvas><div class="tone-section-label">INPUT LEVELS</div>${rangeControl("Black point", "params.black", p.black, 0, 254, 1)}${rangeControl("Midtones", "params.gamma", p.gamma, .1, 4, .01)}${rangeControl("White point", "params.white", p.white, 1, 255, 1)}<div class="output-level-strip"></div><div class="tone-section-label">OUTPUT LEVELS</div>${rangeControl("Output black", "params.outputBlack", p.outputBlack??0, 0, 255)}${rangeControl("Output white", "params.outputWhite", p.outputWhite??255, 0, 255)}`;
    else if (l.adjustment === "brightness") html += rangeControl("Brightness", "params.brightness", p.brightness, -100, 100) + rangeControl("Contrast", "params.contrast", p.contrast, -100, 100);
    else if (l.adjustment === "exposure") html += rangeControl("Exposure", "params.exposure", p.exposure, -5, 5, 0.1, "EV");
    else if (l.adjustment === "vibrance") html += rangeControl("Vibrance", "params.vibrance", p.vibrance, -100, 100, 1, "%") + rangeControl("Saturation", "params.saturation", p.saturation, -100, 100, 1, "%");
    else if (l.adjustment === "hue") html += rangeControl("Hue", "params.hue", p.hue, -180, 180, 1, "°") + rangeControl("Saturation", "params.saturation", p.saturation, -100, 100, 1, "%") + rangeControl("Lightness", "params.lightness", p.lightness, -100, 100, 1, "%") + `<label class="check-row"><input type="checkbox" data-property="params.colorize" ${p.colorize?"checked":""}> Colorize · Tô một tông màu</label>`;
    else if (l.adjustment === "temperature") html += rangeControl("Warmth", "params.temperature", p.temperature, -100, 100) + rangeControl("Tint", "params.tint", p.tint, -100, 100);
    else if (l.adjustment === "blur") html += rangeControl("Radius", "params.radius", p.radius, 0, 80, 1, "px");
    else if (l.adjustment === "colorbalance") html += rangeControl("Cyan / Red", "params.red", p.red, -100, 100) + rangeControl("Magenta / Green", "params.green", p.green, -100, 100) + rangeControl("Yellow / Blue", "params.blue", p.blue, -100, 100);
    else if (l.adjustment === "shadows") html += rangeControl("Lift shadows", "params.shadows", p.shadows, -100, 100) + rangeControl("Recover highlights", "params.highlights", p.highlights, -100, 100);
    else if (l.adjustment === "posterize") html += rangeControl("Levels", "params.levels", p.levels, 2, 32);
    else if (l.adjustment === "threshold") html += rangeControl("Threshold", "params.level", p.level, 0, 255);
    else if (l.adjustment === "channelmixer") html += [["rr", "Red ← Red"], ["rg", "Red ← Green"], ["rb", "Red ← Blue"], ["gr", "Green ← Red"], ["gg", "Green ← Green"], ["gb", "Green ← Blue"], ["br", "Blue ← Red"], ["bg", "Blue ← Green"], ["bb", "Blue ← Blue"]].map(([key, name]) => rangeControl(name, "params." + key, p[key], -200, 200, 1, "%")).join("");
    else html += rangeControl(l.adjustment === "grain" ? "Amount" : "Intensity", "params.amount", p.amount, 0, 100, 1, "%");
    html += `<label class="check-row"><input type="checkbox" data-property="clipToBelow" ${l.clipToBelow?"checked":""}> Clip to layer below</label><label class="check-row"><input type="checkbox" data-property="visible" ${l.visible ? "checked" : ""}> Adjustment visible</label><button class="button reset" data-action="reset-adjustment">${icon("reset")} Reset to defaults</button>`;
  } else {
    html += `<details class="transform-details" ${l.type === "text" ? "" : "open"}><summary>TRANSFORM & ALIGN</summary><label class="aspect-control"><input type="checkbox" data-property="aspectLocked" ${l.aspectLocked?"checked":""}> ${icon("clip")} Khóa tỉ lệ W / H</label><div class="control-grid">${numberField("X", "x", l.x)}${numberField("Y", "y", l.y)}${numberField("W", "width", l.width)}${numberField("H", "height", l.height)}</div><div class="control-grid">${numberField("↻", "rotation", l.rotation, "°")}<button class="button" data-action="center-layer">Center layer</button></div>`;
    html += `<div class="align-layer-grid">${[["left", "Left"], ["center-x", "Center X"], ["right", "Right"], ["top", "Top"], ["center-y", "Center Y"], ["bottom", "Bottom"]].map(([id, name]) => `<button data-layer-align="${id}" title="Align to canvas ${name}">${name}</button>`).join("")}</div><div class="property-transform-actions"><button data-action="flip-x">Flip horizontal</button><button data-action="flip-y">Flip vertical</button></div></details>`;
    if (l.type === "text") html += `<div class="property-divider"></div><div class="property-small-heading">CHARACTER</div><textarea class="text-content" data-property="text" aria-label="Text content">${esc(l.text)}</textarea><div class="font-row"><select data-property="font" aria-label="Font family">${["Inter", "Arial", "Georgia", "Courier New", "Verdana", "Trebuchet MS", "Times New Roman", ...(doc().fonts || []).map((f) => f.family)].map((f) => `<option ${f === l.font ? "selected" : ""}>${esc(doc().fonts?.find((font) => font.family === f)?.name || f)}</option>`).join("")}</select><select data-property="fontWeight" aria-label="Font weight">${[[400, "Regular"], [500, "Medium"], [600, "Semibold"], [700, "Bold"], [800, "Extra bold"]].map(([w, n]) => `<option value="${w}" ${w === l.fontWeight ? "selected" : ""}>${n}</option>`).join("")}</select></div><div class="control-grid">${numberField("Size", "fontSize", l.fontSize, "px")}<label class="number-field"><span>Leading</span><input type="number" data-property="lineHeight" min=".8" max="3" step=".1" value="${l.lineHeight || 1.2}" aria-label="Line height"></label></div><div class="align-controls">${["left", "center", "right"].map((a) => `<button class="${a === l.align ? "active" : ""}" data-align="${a}" title="Align ${a}" aria-label="Align ${a}">${icon("align-" + a)}</button>`).join("")}</div><div class="property-row fill-row"><span>Color</span><input type="color" data-property="color" value="${esc(l.color)}" aria-label="Text color"><code>${esc(l.color.toUpperCase())}</code><label><input type="checkbox" data-property="italic" ${l.italic ? "checked" : ""}> Italic</label></div>`;
    if (l.type === "shape") html += `<div class="property-divider"></div><div class="property-row"><span>Shape</span><select data-property="shape" aria-label="Shape">${["rect", "ellipse", "triangle", "star", "line"].map((s) => `<option value="${s}" ${s === l.shape ? "selected" : ""}>${titleCase(s)}</option>`).join("")}</select></div><div class="fill-row"><span>Fill</span><input type="color" data-property="color" value="${esc(l.color)}" aria-label="Shape fill"><code>${esc(l.color.toUpperCase())}</code><label><input type="checkbox" data-property="gradient" ${l.gradient ? "checked" : ""}> Gradient</label></div>${l.gradient ? `<div class="fill-row" style="margin-top:10px"><span>End color</span><input type="color" data-property="color2" value="${esc(l.color2 || "#235b66")}" aria-label="Gradient end color"></div>` : ""}${l.shape === "rect" ? rangeControl("Corner radius", "radius", l.radius || 0, 0, 120, 1, "px") : ""}`;
    html += `<label class="check-row"><input type="checkbox" data-property="locked" ${l.locked ? "checked" : ""}> Lock layer <button data-action="styles">Layer styles ${icon("chevron-right")}</button></label>`;
  }
  if(l.smartObjectId)html+=advanced?.extras(l)||'';
  else if(['image','paint'].includes(l.type)){
    html+=`<button class="button photo-recipe-button" data-action="photo-tools">${icon('sliders')} Chỉnh ảnh · chọn công cụ ${icon('chevron-right')}</button>`;
    const edits=[['artRecipe','art-studio','Art & Pattern'],['sceneRecipe','scene-studio','Preset & Mùa'],['photoRecipe','retouch-lab','Retouch · preset & thông số'],['cutoutRecipe','cutout-studio','Tách nền · viền & mask'],['removalRecipe','remove-studio','Xóa vật thể · vùng & nền'],['paperRecipe','paper-studio','tài liệu · giấy, chữ & dấu'],['productRecipe','product-studio','Retouch sản phẩm · màu & ánh sáng'],['landscapeRecipe','landscape-studio','Phong cảnh HDR'],['colorRecipe',l.colorRecipe?.mode==='beverage'?'beverage-studio':'wardrobe-color',l.colorRecipe?.mode==='beverage'?'đồ uống':'màu trang phục']];
    for(const [key,id,title]of edits)if(l[key])html+=`<button class="button photo-recipe-button" data-action="${id}">${icon('sliders')}Sửa lại ${title}</button>`;
  }
  if (l.type !== "adjustment") html += pro?.extras(l) || "";
  if (l.mask) html += `<div class="mask-panel"><h4>${icon("mask")} Layer mask</h4>${rangeControl("Feather", "mask.feather", l.mask.feather || 0, 0, 100, 1, "px")}${rangeControl("Density", "mask.density", l.mask.density??100, 0, 100, 1, "%")}<label class="check-row"><input type="checkbox" data-property="mask.disabled" ${l.mask.disabled?"checked":""}> Tạm tắt mask</label><div class="mask-actions"><button class="${maskMode ? "active" : ""}" data-action="mask-mode">Paint mask</button><button data-action="invert-mask">Invert</button><button data-action="remove-mask">Remove</button></div></div>`;
  root.innerHTML = html;
  if(l?.type==="text"){root.insertAdjacentHTML("beforeend",`<button class="button type-open" data-action="type-studio">Type Studio · định dạng từng đoạn</button><div class="property-small-heading">PARAGRAPH & METRICS</div><div class="control-grid">${[["startIndent","Lề trái",0],["endIndent","Lề phải",0],["firstLineIndent","Dòng đầu",0],["spaceBefore","Trước đoạn",0],["spaceAfter","Sau đoạn",0],["baselineShift","Baseline",0],["horizontalScale","Ngang %",100],["verticalScale","Dọc %",100],["kerning","Kerning",0]].map(([k,n,v])=>numberField(n,k,l[k]??v,k.includes("Scale")?"%":"px")).join("")}</div><label>Canh đoạn<select data-property="align">${["left","center","right","justify"].map(v=>`<option ${v===l.align?"selected":""}>${v}</option>`).join("")}</select></label>`);}
  bindProperties(root);
  if (l.adjustment === "curves") bindCurve();
  if (l.adjustment === "levels") drawHistogram();
}
function readPath(o, path) {
  return path.split(".").reduce((v, k) => v?.[k], o);
}
function writePath(o, path, value) {
  const keys = path.split("."), last = keys.pop();
  let v = o;
  for (const k of keys) v = v[k] || (v[k] = {});
  v[last] = value;
}
function bindProperties(root) {
  $$("[data-property]", root).forEach((input) => {
    input.oninput = () => {
      if (!current) return;
      let l = layer(), key = input.dataset.property, value = input.type === "checkbox" ? input.checked : input.type === "range" || input.type === "number" ? Number(input.value) : input.value;
      if (key === "fontWeight") value = Number(value);
      if ((input.type === "range" || input.type === "number" || key === "fontWeight") && !Number.isFinite(value)) return;
      if (key === "width" || key === "height") {
        value = Math.max(1,value);
        if (l && value * (key === "width" ? l.height : l.width) > MAX_PIXELS) {
          toast("Kích thước layer không hợp lệ.", true);
          renderProperties();
          return;
        }
      }
      if (key === "fontSize") value = clamp(value, 1, 2048);
      if(["startIndent","endIndent","firstLineIndent"].includes(key))value=clamp(value,-10000,10000);
      if(["spaceBefore","spaceAfter"].includes(key))value=clamp(value,0,10000);
      if(["horizontalScale","verticalScale"].includes(key))value=clamp(value,10,500);
      if(key==="baselineShift")value=clamp(value,-2048,2048);
      if(key==="kerning")value=clamp(value,-100,500);
      if (key === "tracking") value = clamp(value, -20, 200);
      if (key === "gradientAngle") value = clamp(value, -360, 360);
      if (key === "lineHeight") value = clamp(value, 0.8, 3);
      if (key === "params.black") value = clamp(value, 0, (l.params.white || 255) - 1);
      if (key === "params.white") value = clamp(value, (l.params.black || 0) + 1, 255);
      if (key === "params.gamma") value = clamp(value, 0.1, 4);
      if (key.startsWith("doc.")) {
        const k = key.slice(4);
        try {
          const w = k === "width" ? value : doc().width, h = k === "height" ? value : doc().height;
          if (w * h > MAX_PIXELS || w < 1 || h < 1) return;
          doc()[k] = Math.round(value);
        } catch {
          return;
        }
      } else if (l) {
        const op=["x","y","width","height","rotation"].includes(key)?"geometry":key.startsWith("mask.")?"mask":l.type==="text"||l.type==="shape"?"pixels":"appearance";
        if(!["locked","visible"].includes(key)&&!canEdit(doc(),l,op)){
          toast("Unlock the layer to edit it.", true);
          renderProperties();
          return;
        }
        if (key === "params.channel" && l.adjustment==="curves") {
          const bank = l.params.channels || (l.params.channels = {});
          bank[l.params.channel] = clone(l.params.points);
          l.params.points = clone(bank[value] || [[0, 0], [255, 255]]);
        }
        if(key==="params.channel"&&l.adjustment==="levels")switchLevelChannel(l.params,value);
        if(l.mask&&["x","y"].includes(key)){const delta=value-l[key];moveLayer(l,key==="x"?delta:0,key==="y"?delta:0);}
        if(["width","height"].includes(key)){const ratio=value/l[key],nw=key==="width"?value:l.width*(l.aspectLocked?ratio:1),nh=key==="height"?value:l.height*(l.aspectLocked?ratio:1);if(l.mask){const sx=nw/l.width,sy=nh/l.height,a=(l.rotation||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),m=[c*c*sx+s*s*sy,c*s*(sx-sy),c*s*(sx-sy),s*s*sx+c*c*sy],ox=l.x+l.width/2,oy=l.y+l.height/2;pro.remapMasks([l],[...m,l.x+nw/2-m[0]*ox-m[2]*oy,l.y+nh/2-m[1]*ox-m[3]*oy]);}l.width=nw;l.height=nh;for(const k of ["width","height"]){const field=root.querySelector(`[data-property="${k}"]`);if(field&&field!==input)field.value=Math.round(l[k]);}}
        if(key==="rotation"&&l.mask){const a=(value-l.rotation)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),cx=l.x+l.width/2,cy=l.y+l.height/2;pro.remapMasks([l],[c,s,-s,c,cx-c*cx+s*cy,cy-s*cx-c*cy]);}
        if(key==="params.colorize"&&value===true&&l.params.saturation===0)l.params.saturation=25;
        if(key==="text")editText(l,value);else writePath(l,key,value);
      }
      $$(`[data-property="${key}"]`, root).forEach((other) => {
        if (other !== input) {
          if (other.type === "checkbox") other.checked = value;
          else other.value = value;
        }
      });
      requestRender();
    };
    input.onchange = () => {
      commit(`Change ${input.dataset.property.replace("params.", "").replaceAll(".", " ")}`);
    };
  });
}
function drawHistogram() {
  const c = $("#histogram");
  if (!c || !stats) return;
  const sourceStats=composite&&layer()?.adjustment==="levels"?histogram(composite.getContext("2d").getImageData(0,0,composite.width,composite.height).data,layer().params.channel||"luminance"):stats;
  const x = c.getContext("2d"), w = c.width, h = c.height;
  x.clearRect(0, 0, w, h);
  const max = Math.max(...sourceStats.bins) || 1;
  x.fillStyle = "#8aa59b";
  x.beginPath();
  x.moveTo(0, h);
  sourceStats.bins.forEach((v, i) => x.lineTo(i / 255 * w, h - Math.sqrt(v / max) * (h - 9)));
  x.lineTo(w, h);
  x.closePath();
  x.fill();
}
function drawCurve() {
  const c = $("#curve"), l = layer();
  if (!c || l?.adjustment !== "curves") return;
  const x = c.getContext("2d"), w = c.width, h = c.height, p = l.params.points;
  x.clearRect(0, 0, w, h);
  x.strokeStyle = "#39474c";
  x.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const X = i * w / 4, Y = i * h / 4;
    x.beginPath();
    x.moveTo(X, 0);
    x.lineTo(X, h);
    x.moveTo(0, Y);
    x.lineTo(w, Y);
    x.stroke();
  }
  if (stats) {
    const max = Math.max(...stats.bins) || 1;
    x.fillStyle = "#7b8d8527";
    x.beginPath();
    x.moveTo(0, h);
    stats.bins.forEach((v, i) => x.lineTo(i / 255 * w, h - Math.sqrt(v / max) * (h - 14)));
    x.lineTo(w, h);
    x.fill();
  }
  x.strokeStyle = "#788d8540";
  x.beginPath();
  x.moveTo(0, h);
  x.lineTo(w, 0);
  x.stroke();
  x.strokeStyle = { rgb: "#c4ebd6", red: "#efa498", green: "#a5dfb7", blue: "#a0c4ea" }[l.params.channel] || "#c4ebd6";
  x.lineWidth = 2.8;
  x.beginPath();
  p.forEach((q, i) => i ? x.lineTo(q[0] / 255 * w, (1 - q[1] / 255) * h) : x.moveTo(q[0] / 255 * w, (1 - q[1] / 255) * h));
  x.stroke();
  p.forEach((q) => {
    x.fillStyle = "#192523";
    x.strokeStyle = "#c3e4ce";
    x.lineWidth = 2;
    x.fillRect(q[0] / 255 * w - 4, (1 - q[1] / 255) * h - 4, 8, 8);
    x.strokeRect(q[0] / 255 * w - 4, (1 - q[1] / 255) * h - 4, 8, 8);
  });
}
function bindCurve() {
  const c = $("#curve");
  if (!c) return;
  const point = (e) => {
    const r = c.getBoundingClientRect();
    return [Math.round(clamp((e.clientX - r.left) / r.width * 255)), Math.round(clamp((1 - (e.clientY - r.top) / r.height) * 255))];
  };
  c.onpointerdown = (e) => {
    e.preventDefault();
    const l = layer(), p = point(e);
    let index = l.params.points.findIndex((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 13);
    if (index < 0) {
      if (l.params.points.length >= 12) {
        toast("Curves support up to 12 control points.");
        return;
      }
      l.params.points.push(p);
      l.params.points.sort((a, b) => a[0] - b[0]);
      index = l.params.points.indexOf(p);
    }
    curveDragging = l.params.points[index];
    c.setPointerCapture(e.pointerId);
    requestRender();
  };
  c.onpointermove = (e) => {
    const p = point(e);
    if ($("#curve-input")) {
      $("#curve-input").textContent = p[0];
      $("#curve-output").textContent = p[1];
    }
    if (curveDragging) {
      const pts = layer().params.points, i = pts.indexOf(curveDragging);
      curveDragging[0] = i === 0 ? 0 : i === pts.length - 1 ? 255 : clamp(p[0], pts[i - 1][0] + 1, pts[i + 1][0] - 1);
      curveDragging[1] = p[1];
      requestRender();
    }
  };
  c.onpointerup = () => {
    if (curveDragging) {
      curveDragging = null;
      commit("Edit curves");
    }
  };
  c.onpointercancel = () => {
    curveDragging = null;
    renderProperties();
  };
  c.ondblclick = (e) => {
    const p = point(e), l = layer(), i = l.params.points.findIndex((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 14);
    if (i > 0 && i < l.params.points.length - 1) {
      l.params.points.splice(i, 1);
      commit("Remove curve point");
    }
  };
  $("#curve-preset").onchange = (e) => {
    const pts = { linear: [[0, 0], [255, 255]], contrast: [[0, 0], [64, 42], [192, 216], [255, 255]], matte: [[0, 25], [64, 69], [192, 187], [255, 242]], bright: [[0, 0], [80, 108], [190, 215], [255, 255]] }[e.target.value];
    if (pts) {
      layer().params.points = pts;
      commit("Curve preset");
    }
  };
  drawCurve();
}
function fit() {
  if (!current) return;
  const s = $("#stage");
  current.zoom = clamp(Math.min((s.clientWidth - 95) / doc().width, (s.clientHeight - 90) / doc().height), 0.025, 2);
  current.panX = 21 + (s.clientWidth - 21 - doc().width * current.zoom) / 2;
  current.panY = 21 + (s.clientHeight - 21 - doc().height * current.zoom) / 2;
  current.fitted = true;
  positionBoard();
}
function positionBoard() {
  if (!current) return;
  const b = $("#artboard");
  b.style.width = doc().width + "px";
  b.style.height = doc().height + "px";
  b.style.transform = `translate(${current.panX}px,${current.panY}px) scale(${current.zoom})`;
  $("#zoom-label").textContent = (current.zoom * 100).toFixed(current.zoom < 0.1 ? 1 : 0) + "%";
  $("#nav-zoom").textContent = $("#zoom-label").textContent;
  drawRulers();
  renderOverlay();
}
function zoom(factor, anchor = null) {
  if (!current) return;
  const s = $("#stage"), a = anchor || { x: s.clientWidth / 2, y: s.clientHeight / 2 }, old = current.zoom, next = clamp(old * factor, 0.025, 6);
  current.panX = a.x - (a.x - current.panX) * next / old;
  current.panY = a.y - (a.y - current.panY) * next / old;
  current.zoom = next;
  current.fitted = false;
  positionBoard();
}
function requestRender() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    try {
      render();
    } catch (e) {
      console.error(e);
      toast("Cannot render this operation: " + e.message, true);
    }
  });
}
function render() {
  if (!current) return;
  renderScale = Math.min(1, 1600 / Math.max(doc().width, doc().height));
  composite = renderDocument(pro?.previewDocument(doc()) || doc(), assets, { scale: renderScale });
  const c = $("#image-canvas");
  c.width = composite.width;
  c.height = composite.height;
  c.getContext("2d").drawImage(composite, 0, 0);
  advanced?.proofCanvas(c,composite);
  if (pro && pro.view() !== "composite") {
    const x = c.getContext("2d"), data = x.getImageData(0, 0, c.width, c.height), channel = { red: 0, green: 1, blue: 2, alpha: 3 }[pro.view()];
    for (let i = 0; i < data.data.length; i += 4) {
      const value = data.data[i + channel];
      data.data[i] = data.data[i + 1] = data.data[i + 2] = value;
      if (channel === 3) data.data[i + 3] = 255;
    }
    x.putImageData(data, 0, 0);
  }
  stats = histogram(composite.getContext("2d").getImageData(0, 0, composite.width, composite.height).data);
  drawCurve();
  drawHistogram();
  desktop?.onRendered(composite);
  documentTools?.preview(c);
  const n = $("#navigator"), nx = n.getContext("2d");
  n.width = 206;
  n.height = 130;
  nx.clearRect(0, 0, 206, 130);
  const s = Math.min(206 / composite.width, 130 / composite.height);
  nx.drawImage(composite, (206 - composite.width * s) / 2, (130 - composite.height * s) / 2, composite.width * s, composite.height * s);
  positionBoard();
}
function drawRulers() {
  if (!current) return;
  const stage = $("#stage"), z = current.zoom, step = 10 ** Math.ceil(Math.log10(80 / z)), dpr = Math.min(devicePixelRatio || 1, 2);
  for (const axis of ["top", "left"]) {
    const c = $("#ruler-" + axis), horizontal = axis === "top", length = horizontal ? stage.clientWidth - 21 : stage.clientHeight - 21;
    c.width = Math.max(1, length * dpr);
    c.height = 21 * dpr;
    if (!horizontal) {
      c.width = 21 * dpr;
      c.height = Math.max(1, length * dpr);
    }
    const x = c.getContext("2d");
    x.scale(dpr, dpr);
    x.strokeStyle = "#4c555f";
    x.fillStyle = "#8894a0";
    x.font = "8px Inter, sans-serif";
    const offset = (horizontal ? current.panX : current.panY) - 21, start = Math.floor(-offset / (step * z));
    for (let i = start; i < (length - offset) / (step * z) + 1; i++) {
      const p = offset + i * step * z;
      x.beginPath();
      if (horizontal) {
        x.moveTo(p, 14);
        x.lineTo(p, 21);
        x.fillText(String(i * step), p + 4, 10);
      } else {
        x.moveTo(14, p);
        x.lineTo(21, p);
        x.save();
        x.translate(8, p + 4);
        x.rotate(-Math.PI / 2);
        x.fillText(String(i * step), 0, 0);
        x.restore();
      }
      x.stroke();
      for (let j = 1; j < 5; j++) {
        const q = p + j * step * z / 5;
        x.beginPath();
        horizontal ? (x.moveTo(q, 18), x.lineTo(q, 21)) : (x.moveTo(18, q), x.lineTo(21, q));
        x.stroke();
      }
    }
  }
}
function outlineSelection(ctx, s) {
  ctx.beginPath();
  if (s.type === "ellipse") ctx.ellipse(s.x + s.width / 2, s.y + s.height / 2, Math.abs(s.width / 2), Math.abs(s.height / 2), 0, 0, Math.PI * 2);
  else if (s.type === "polygon") {
    s.points.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p));
    ctx.closePath();
  } else if (s.type === "paint") ctx.rect(0, 0, doc().width, doc().height);
  else ctx.rect(s.x, s.y, s.width, s.height);
  ctx.stroke();
}
function renderOverlay() {
  if (!current) return;
  const c = $("#overlay"), s = Math.min(1, 1800 / Math.max(doc().width, doc().height));
  c.width = Math.round(doc().width * s);
  c.height = Math.round(doc().height * s);
  const x = c.getContext("2d");
  x.scale(s, s);
  const l = layer(), z = current.zoom;
  if (grid) {
    x.strokeStyle = "#80d7bc30";
    x.lineWidth = 1 / z;
    const step = 100;
    for (let i = step; i < doc().width; i += step) {
      x.beginPath();
      x.moveTo(i, 0);
      x.lineTo(i, doc().height);
      x.stroke();
    }
    for (let i = step; i < doc().height; i += step) {
      x.beginPath();
      x.moveTo(0, i);
      x.lineTo(doc().width, i);
      x.stroke();
    }
  }
  if (l && l.type !== "adjustment" && tool === "move" && showTransform && canEdit(doc(),l,"geometry") && !editingText) {
    x.save();
    x.translate(l.x + l.width / 2, l.y + l.height / 2);
    x.rotate(l.rotation * Math.PI / 180);
    x.strokeStyle = "#a2e1c1";
    x.lineWidth = 1 / z;
    x.strokeRect(-l.width / 2, -l.height / 2, l.width, l.height);
    for (const [a, b] of [[-l.width / 2, -l.height / 2], [l.width / 2, -l.height / 2], [l.width / 2, l.height / 2], [-l.width / 2, l.height / 2]]) {
      x.fillStyle = "#e1f4e8";
      x.fillRect(a - 3 / z, b - 3 / z, 6 / z, 6 / z);
      x.strokeStyle = "#608a77";
      x.strokeRect(a - 3 / z, b - 3 / z, 6 / z, 6 / z);
    }
    x.restore();
  }
  const selection = doc().selection;
  if (selection) {
    if (tool === "crop" && selection.type === "rect") {
      x.fillStyle = "#0008";
      x.beginPath();
      x.rect(0, 0, doc().width, doc().height);
      x.rect(selection.x, selection.y, selection.width, selection.height);
      x.fill("evenodd");
    }
    x.lineWidth = 1.5 / z;
    x.strokeStyle = "#102b23";
    x.setLineDash([]);
    outlineSelection(x, selection);
    x.strokeStyle = "#e6f4ef";
    x.setLineDash([5 / z, 5 / z]);
    outlineSelection(x, selection);
    x.setLineDash([]);
  }
  if (maskMode && l?.mask && l.mask.type !== "paint") {
    x.strokeStyle = "#a5e3bb";
    x.setLineDash([6 / z, 4 / z]);
    x.lineWidth = 1 / z;
    outlineSelection(x, l.mask);
    x.setLineDash([]);
  }
  if (hover && ["brush", "eraser"].includes(tool)) {
    x.beginPath();
    x.arc(hover.x, hover.y, brushSize / 2, 0, Math.PI * 2);
    x.strokeStyle = "#fff";
    x.lineWidth = 1 / z;
    x.stroke();
    x.beginPath();
    x.arc(hover.x, hover.y, Math.max(0, brushSize / 2 - 1 / z), 0, Math.PI * 2);
    x.strokeStyle = "#222";
    x.stroke();
  }
  pro?.drawOverlay(x, z);
  documentTools?.overlay(x,z);
}
function pointOnCanvas(e) {
  const r = $("#stage").getBoundingClientRect();
  return { x: (e.clientX - r.left - current.panX) / current.zoom, y: (e.clientY - r.top - current.panY) / current.zoom };
}
function stagePoint(e) {
  const r = $("#stage").getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
function normalizedRect(a, b, square = false) {
  let dx = b.x - a.x, dy = b.y - a.y;
  if (square) {
    const size = Math.max(Math.abs(dx), Math.abs(dy));
    dx = Math.sign(dx || 1) * size;
    dy = Math.sign(dy || 1) * size;
  }
  return { x: Math.min(a.x, a.x + dx), y: Math.min(a.y, a.y + dy), width: Math.abs(dx), height: Math.abs(dy) };
}
function addLayer(l, label = `Add ${l.type} layer`) {
  if (doc().layers.length >= 150) {
    toast("This project has reached 150 layers.", true);
    return;
  }
  const i = doc().layers.findIndex((a) => a.id === doc().activeId);
  const active = layer();
  if (l.parentId === void 0) l.parentId = active?.type === "group" && !effectiveLocked(doc(), active) ? active.id : active?.parentId || null;
  doc().layers.splice(i < 0 ? doc().layers.length : i + 1, 0, l);
  doc().activeId = l.id;
  doc().selectedIds = [l.id];
  activePanel = "properties";
  maskMode = false;
  commit(label);
  return l;
}
function addText(x = doc().width * 0.12, y = doc().height * 0.2) {
  const l = createLayer("text", { name: "New text", text: "Your story starts here.", x, y, width: Math.min(900, doc().width * 0.75), height: 160, font: "Inter", fontSize: Math.max(24, Math.round(doc().width / 28)), fontWeight: 600, lineHeight: 1.2, color: foreground, align: "left" });
  addLayer(l, "Add text");
  setTool("text");
  return l;
}
function addShape(rect = null, gradient = false) {
  const r = rect || { x: doc().width * 0.25, y: doc().height * 0.3, width: doc().width * 0.5, height: doc().height * 0.3 };
  const l = createLayer("shape", { name: gradient ? "Gradient" : titleCase(shapeType), shape: shapeType, color: foreground, color2: background, gradient, radius: shapeType === "rect" ? 12 : 0, x: r.x, y: r.y, width: r.width, height: r.height });
  addLayer(l, "Add " + (gradient ? "gradient" : "shape"));
  return l;
}
function addPaint() {
  const c = canvas(doc().width, doc().height), source = c.toDataURL();
  assets.set(source, c);
  return addLayer(createLayer("paint", { name: "Paint layer", source, width: doc().width, height: doc().height }), "New paint layer");
}
function addAdjustment(type) {
  const a = adjustments.find((a2) => a2[0] === type);
  if (!a) return;
  const l = createLayer("adjustment", { name: a[1], adjustment: type, params: defaults(type), width: doc().width, height: doc().height });
  if (doc().selection) l.mask = clone(doc().selection);
  addLayer(l, "Add " + a[1]);
}
async function applyLook(name) {
  if (name === "soft") {
    const l = createLayer("adjustment", { name: "Soft film", adjustment: "curves", params: { channel: "rgb", points: [[0, 20], [64, 61], [192, 195], [255, 246]] }, width: doc().width, height: doc().height });
    addLayer(l, "Apply soft film");
  } else if (name === "warm") {
    const l = createLayer("adjustment", { name: "Golden hour", adjustment: "temperature", params: { temperature: 24, tint: -5 }, width: doc().width, height: doc().height });
    addLayer(l, "Apply golden hour");
  } else addAdjustment("monochrome");
}
function duplicateLayer() {
  if (pro) return pro.duplicate();
  const l = layer();
  if (!l) return;
  const c = clone(l);
  c.id = uid();
  c.name = l.name + " copy";
  c.locked = false;
  if (c.type !== "adjustment") moveLayer(c, 22, 22);
  addLayer(c, "Duplicate " + l.name);
}
function removeLayer() {
  if (pro) return pro.remove();
  const l = layer();
  if (!l) return;
  if (effectiveLocked(doc(), l)) {
    toast("Unlock the layer before deleting it.", true);
    return;
  }
  const i = doc().layers.indexOf(l);
  doc().layers.splice(i, 1);
  doc().activeId = doc().layers[Math.min(i, doc().layers.length - 1)]?.id || null;
  maskMode = false;
  commit("Delete " + l.name);
}
function addMask() {
  const l = layer();
  if (!l) {
    toast("Select a layer first.");
    return;
  }
  if (effectiveLocked(doc(), l)) {
    toast("Unlock the layer before adding a mask.", true);
    return;
  }
  l.mask = doc().selection ? clone(doc().selection) : { type: "rect", x: 0, y: 0, width: doc().width, height: doc().height, feather: 0, invert: false };
  doc().selection = null;
  maskMode = true;
  commit("Add layer mask");
  toast("Mask added. Use Brush to reveal or Eraser to hide.");
}
function toggleMaskMode() {
  if (!layer()) return;
  if (!layer().mask) {
    addMask();
  } else maskMode = !maskMode;
  setTool("brush");
  renderProperties();
  renderLayers();
  renderContext();
}
function invertSelection() {
  if (!doc().selection) {
    toast("Draw a selection first.");
    return;
  }
  doc().selection.invert = !doc().selection.invert;
  commit("Invert selection");
  toast(doc().selection.invert ? "Selection inverted. Make a mask to apply it." : "Selection restored.");
}
function moveStack(direction) {
  if (pro) {
    const target = layer();
    if (!target) return;
    const list = children(doc(), target.parentId || null), index = list.indexOf(target), next = list[index + direction];
    if (next && reorderObject(doc(), target.id, next.id, { above: direction > 0 })) commit("Reorder layer");
    return;
  }
  const l = layer();
  if (!l) return;
  const i = doc().layers.indexOf(l), to = clamp(i + direction, 0, doc().layers.length - 1);
  if (i !== to) {
    doc().layers.splice(i, 1);
    doc().layers.splice(to, 0, l);
    commit("Reorder layer");
  }
}
function applyCrop() {
  const s = doc().selection;
  if (!s || s.type !== "rect" || s.width < 2 || s.height < 2) {
    toast("Drag a rectangular crop area first.");
    return;
  }
  cropDocument(doc(), s);
  commit("Crop document");
  fit();
  setTool("move");
}
function flatten() {
  const c = renderDocument(doc(), assets), source = c.toDataURL();
  assets.set(source, c);
  const l = createLayer("image", { name: "Flattened image", source, width: doc().width, height: doc().height });
  doc().layers = [l];
  doc().activeId = l.id;
  doc().selectedIds = [l.id];
  commit("Flatten visible layers");
}
async function paintStart(e, p) {
  let l = layer();
  if (l?.smartObjectId && !maskMode) { toast('Smart Object: dùng Sửa nội dung hoặc Rasterize trước khi tô pixel.',true); return false; }
  if(l&&!canEdit(doc(),l,maskMode?"mask":tool==="eraser"?"erase":"pixels")){
    toast("Unlock the layer before painting.", true);
    return false;
  }
  if (maskMode) {
    if (!l?.mask) {
      addMask();
      l = layer();
    }
    const c = maskCanvas(doc(), {...l.mask,density:100}, 1, assets);
    gesture.paint = c;
    gesture.layer = l;
    gesture.oldMask = clone(l.mask);
    gesture.oldSource = null;
    l.mask = { type: "paint", source: `working-mask-${l.id}`, x: 0, y: 0, width: doc().width, height: doc().height, feather: 0, invert: false,linked:gesture.oldMask.linked!==false,disabled:!!gesture.oldMask.disabled,density:gesture.oldMask.density??100 };
    assets.set(l.mask.source, c);
  } else {
    if (!l || !["paint", "image"].includes(l.type) || tool === "brush" && l.type !== "paint" && !lockState(doc(),l).transparency) {
      if (tool === "eraser" && l) {
        toast("Use Eraser on a pixel layer or a mask.", true);
        return false;
      }
      l = addPaint();
      if (!l) return false;
    }
    const c = canvas(l.width, l.height), image = assets.get(l.source);
    if (image) c.getContext("2d").drawImage(image, 0, 0, l.width, l.height);
    gesture.paint = c;
    gesture.layer = l;
    gesture.oldSource = l.source;
    l.source = `working-paint-${l.id}`;
    assets.set(l.source, c);
  }
  gesture.mask = maskMode;
  gesture.last = p;
  paintSegment(e, p, p);
  return true;
}
function paintSegment(e, a, b) {
  if (!gesture?.paint) return;
  const l = gesture.layer, c = gesture.paint, x = c.getContext("2d");
  let A = a, B = b;
  if (!gesture.mask) {
    A = localPoint(l, a.x, a.y);
    B = localPoint(l, b.x, b.y);
    if (l.flipX) {
      A.x = l.width - A.x;
      B.x = l.width - B.x;
    }
    if (l.flipY) {
      A.y = l.height - A.y;
      B.y = l.height - B.y;
    }
  }
  const pressure = e.pointerType === "pen" ? Math.max(0.15, e.pressure || 0.5) : 1;
  x.save();
  x.globalAlpha = brushOpacity / 100;
  x.globalCompositeOperation = tool === "eraser" ? "destination-out" : !gesture.mask&&lockState(doc(),l).transparency?"source-atop":"source-over";
  x.strokeStyle = gesture.mask ? "#ffffff" : foreground;
  x.fillStyle = x.strokeStyle;
  x.lineWidth = Math.max(1, brushSize * pressure);
  x.lineCap = "round";
  x.lineJoin = "round";
  if (!gesture.mask && doc().selection) {
    const clipped = maskCanvas(doc(), doc().selection, 1, assets);
    const stroke = canvas(c.width, c.height), cx = stroke.getContext("2d");
    cx.globalAlpha = brushOpacity / 100;
    cx.strokeStyle = foreground;
    cx.fillStyle = foreground;
    cx.lineWidth = x.lineWidth;
    cx.lineCap = "round";
    cx.beginPath();
    cx.moveTo(A.x, A.y);
    cx.lineTo(B.x, B.y);
    cx.stroke();
    cx.beginPath();
    cx.arc(B.x, B.y, x.lineWidth / 2, 0, Math.PI * 2);
    cx.fill();
    cx.globalCompositeOperation = "destination-in";
    cx.save();
    cx.translate(l.width / 2, l.height / 2);
    cx.scale(l.flipX ? -1 : 1, l.flipY ? -1 : 1);
    cx.rotate(-(l.rotation || 0) * Math.PI / 180);
    cx.translate(-l.x - l.width / 2, -l.y - l.height / 2);
    cx.drawImage(clipped, 0, 0);
    cx.restore();
    x.globalAlpha = 1;
    x.drawImage(stroke, 0, 0);
  } else {
    x.beginPath();
    x.moveTo(A.x, A.y);
    x.lineTo(B.x, B.y);
    x.stroke();
    if (Math.hypot(A.x - B.x, A.y - B.y) < 0.1) {
      x.beginPath();
      x.arc(B.x, B.y, x.lineWidth / 2, 0, Math.PI * 2);
      x.fill();
    }
  }
  x.restore();
  requestRender();
}
function paintEnd() {
  const g = gesture;
  if (!g?.paint) return;
  const source = g.paint.toDataURL("image/png");
  assets.set(source, g.paint);
  if (g.mask) {
    assets.map.delete(g.layer.mask.source);
    g.layer.mask.source = source;
  } else {
    assets.map.delete(g.layer.source);
    g.layer.source = source;
    delete g.layer.photoRecipe;
    delete g.layer.removalRecipe;
    delete g.layer.productRecipe;
    delete g.layer.cutoutRecipe; delete g.layer.paperRecipe; delete g.layer.colorRecipe; delete g.layer.landscapeRecipe; delete g.layer.sceneRecipe; delete g.layer.artRecipe;
  }
  commit(g.mask ? "Paint mask" : tool === "eraser" ? "Erase" : "Brush stroke");
}
function cancelGesture() {
  if (pro?.cancel()) return;
  if (!gesture) return;
  const g = gesture;
  if (g.paint) {
    if (g.mask) {
      assets.map.delete(g.layer.mask.source);
      g.layer.mask = g.oldMask;
    } else {
      assets.map.delete(g.layer.source);
      g.layer.source = g.oldSource;
    }
  } else if (g.originals) for (const original of g.originals) {
    const target = doc().layers.find((x) => x.id === original.id);
    if (target) Object.assign(target, original);
  }
  else if (g.original && g.layer) Object.assign(g.layer, g.original);
  else if (g.kind === "selection") doc().selection = g.oldSelection;
  gesture = null;
  $("#stage").classList.remove("dragging");
  renderUI();
  requestRender();
}
$("#stage").addEventListener("pointerdown", (e) => {
  if (!current || e.target.closest(".zoom-controls,.ruler,.ruler-corner,#canvas-text")) return;
  if (editingText) {
    finishText();
    return;
  }
  if (e.button === 2) return;
  e.preventDefault();
  closeMenu();
  const p = pointOnCanvas(e), sp = stagePoint(e);
  gesture = { start: p, startScreen: sp, last: p, pointerId: e.pointerId };
  $("#stage").setPointerCapture(e.pointerId);
  if (space || tool === "hand" || e.button === 1) {
    gesture.kind = "pan";
    gesture.panX = current.panX;
    gesture.panY = current.panY;
    current.fitted = false;
    $("#stage").classList.add("dragging");
    return;
  }
  if (p.x < 0 || p.y < 0 || p.x > doc().width || p.y > doc().height) {
    gesture = null;
    return;
  }
  if(documentTools?.pointerDown(e,p)){gesture=null;return;}
  if (pro?.pointerDown(e, p)) {
    gesture = null;
    return;
  }
  if (tool === "move") {
    let l = layer();
    if(maskMode&&l?.mask&&l.mask.linked===false){if(!canEdit(doc(),l,"mask-geometry")){gesture=null;return;}gesture.kind="maskmove";gesture.layer=l;gesture.original=clone(l);return;}
    if (l && canEdit(doc(),l,"geometry") && showTransform && l.type !== "adjustment") {
      const q = localPoint(l, p.x, p.y), corners = [[0, 0], [l.width, 0], [l.width, l.height], [0, l.height]], i = corners.findIndex((c) => Math.hypot(q.x - c[0], q.y - c[1]) * current.zoom < 9);
      if (i >= 0) {
        if (l.type === "group" || selected(doc()).length > 1) {
          gesture = null;
          runAction("transform");
          return;
        }
        gesture.kind = "resize";
        gesture.corner = i;
        gesture.layer = l;
        gesture.original = clone(l);
        return;
      }
    }
    if (autoSelect) {
      const hit = hitLayer(doc(), p.x, p.y);
      if (hit) {
        const keep = roots(doc()).some((root) => subtree(doc(), root.id).some((x) => x.id === hit.id));
        if (!keep) selectLayer(doc(), hit.id, { toggle: e.ctrlKey || e.metaKey, range: false });
        doc().activeId = keep ? doc().activeId : hit.id;
        l = layer();
        maskMode = false;
        renderUI();
      }
    }
    if (!l || !canEdit(doc(),l,"geometry") || l.type === "adjustment") {
      gesture = null;
      return;
    }
    try{assertCanEdit(doc(),roots(doc()),"geometry",{descendants:true});}catch(e){gesture=null;toast(e.message,true);return;}
    gesture.kind = "move";
    gesture.layer = l;
    gesture.original = clone(l);
    gesture.rootIds = roots(doc()).map((x) => x.id);
    gesture.originals = roots(doc()).flatMap((x) => subtree(doc(), x.id)).map((x) => clone(x));
  } else if (["select", "ellipse", "lasso", "crop"].includes(tool)) {
    gesture.kind = "selection";
    gesture.oldSelection = clone(doc().selection);
    gesture.selectionMode = tool === "crop" ? "replace" : selectionMode;
    doc().selection = tool === "lasso" ? { type: "polygon", points: [[p.x, p.y]], feather: 0, invert: false } : { type: tool === "ellipse" ? "ellipse" : "rect", x: p.x, y: p.y, width: 0, height: 0, feather: 0, invert: false };
    renderOverlay();
  } else if (["brush", "eraser"].includes(tool)) {
    gesture.kind = "paint";
    paintStart(e, p).then((ok) => {
      if (!ok) gesture = null;
    });
  } else if (tool === "text") {
    const hit = hitLayer(doc(), p.x, p.y);
    if (hit?.type === "text") {
      doc().activeId = hit.id;
      renderUI();
      startText(hit);
    } else {
      const l = addText(p.x, p.y);
      if (l) startText(l);
    }
    gesture = null;
  } else if (tool === "shape" || tool === "gradient") {
    gesture.kind = "shape";
    gesture.oldSelection = clone(doc().selection);
    doc().selection = { type: "rect", x: p.x, y: p.y, width: 0, height: 0, feather: 0, invert: false };
    renderOverlay();
  } else if (tool === "eyedropper") {
    sampleColor(p);
    gesture = null;
  } else if (tool === "wand") {
    magicSelect(p);
    gesture = null;
  } else if (tool === "zoom") {
    zoom(e.altKey ? 0.8 : 1.25, sp);
    gesture = null;
  }
});
$("#stage").addEventListener("pointermove", (e) => {
  if (!current) return;
  const p = pointOnCanvas(e);
  if(documentTools?.pointerMove(e,p))return;
  if (pro?.pointerMove(e, p)) return;
  hover = p;
  const g = gesture;
  if (!g) {
    renderOverlay();
    return;
  }
  if (g.pointerId !== e.pointerId) return;
  const sp = stagePoint(e);
  if (g.kind === "pan") {
    current.panX = g.panX + sp.x - g.startScreen.x;
    current.panY = g.panY + sp.y - g.startScreen.y;
    positionBoard();
    return;
  }
  if (g.kind === "move") {
    let dx = p.x - g.start.x, dy = p.y - g.start.y;
    if (e.shiftKey) {
      if (Math.abs(dx) > Math.abs(dy)) dy = 0;
      else dx = 0;
    }
    for (const original of g.originals || [g.original]) {
      const target = doc().layers.find((x) => x.id === original.id);
      if (target) Object.assign(target, clone(original));
    }
    const list = (g.rootIds || [g.layer.id]).map((id) => doc().layers.find((x) => x.id === id));
    const snapped = pro?.snapMove(list, dx, dy, e.shiftKey) || { dx, dy };
    moveObjects(doc(), list, snapped.dx, snapped.dy);
    requestRender();
  } else if(g.kind==="maskmove"){const m=clone(g.original.mask),dx=p.x-g.start.x,dy=p.y-g.start.y;m.x=(m.x||0)+dx;m.y=(m.y||0)+dy;if(m.points)m.points=m.points.map(([x,y])=>[x+dx,y+dy]);g.layer.mask=m;requestRender();
  } else if (g.kind === "resize") {
    const o = g.original, q = localPoint(o, p.x, p.y), i = g.corner;
    let left = i === 0 || i === 3 ? Math.min(q.x, o.width - 12) : 0, right = i === 1 || i === 2 ? Math.max(q.x, 12) : o.width, top = i < 2 ? Math.min(q.y, o.height - 12) : 0, bottom = i >= 2 ? Math.max(q.y, 12) : o.height;
    let w = Math.max(12,right-left), h = Math.max(12,bottom-top);
    if (e.shiftKey) {
      h = w * o.height / o.width;
      if (i < 2) top = bottom - h;
      else bottom = top + h;
    }
    const f = 1;
    w *= f;
    h *= f;
    const dx = (left + right) / 2 - o.width / 2, dy = (top + bottom) / 2 - o.height / 2, a = o.rotation * Math.PI / 180, cx = o.x + o.width / 2 + dx * Math.cos(a) - dy * Math.sin(a), cy = o.y + o.height / 2 + dx * Math.sin(a) + dy * Math.cos(a);
    Object.assign(g.layer, { x: cx - w / 2, y: cy - h / 2, width: w, height: h });
    requestRender();
  } else if (g.kind === "selection" || g.kind === "shape") {
    const q = { x: clamp(p.x, 0, doc().width), y: clamp(p.y, 0, doc().height) };
    if (doc().selection.type === "polygon") {
      if (Math.hypot(q.x - g.last.x, q.y - g.last.y) > 3 / current.zoom) {
        doc().selection.points.push([q.x, q.y]);
        g.last = q;
      }
    } else Object.assign(doc().selection, normalizedRect(g.start, q, e.shiftKey));
    renderOverlay();
  } else if (g.kind === "paint") {
    const events = e.getCoalescedEvents?.() || [e];
    for (const event of events) {
      const q = pointOnCanvas(event);
      paintSegment(event, g.last, q);
      g.last = q;
    }
  }
});
$("#stage").addEventListener("pointerup", (e) => {
  if(documentTools?.pointerUp())return;
  if (pro?.pointerUp()) return;
  const g = gesture;
  if (!g || g.pointerId !== e.pointerId) return;
  try {
    if (g.kind === "resize" && g.original.mask) {
      const o = g.original, n = g.layer, a = (o.rotation || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), sx = n.width / o.width, sy = n.height / o.height, A = c * c * sx + s * s * sy, B = c * s * (sx - sy), D = s * s * sx + c * c * sy, ox = o.x + o.width / 2, oy = o.y + o.height / 2, nx = n.x + n.width / 2, ny = n.y + n.height / 2;
      pro?.remapMasks([n], [A, B, B, D, nx - A * ox - B * oy, ny - B * ox - D * oy]);
    }
    if (g.kind === "move" || g.kind === "resize" || g.kind === "maskmove") commit(g.kind === "move" ? "Move layer" : "Transform layer");
    else if (g.kind === "paint") paintEnd();
    else if (g.kind === "shape") {
      const r = clone(doc().selection);
      doc().selection = g.oldSelection;
      if (r.width > 3 && r.height > 3) {
        addShape(r, tool === "gradient");
        setTool("move");
      }
    } else if (g.kind === "selection") {
      const s = doc().selection;
      if (s.type === "polygon" && s.points.length < 3 || s.type !== "polygon" && (s.width < 2 || s.height < 2)) doc().selection = null;
      if (doc().selection) combineSelection(doc().selection, g.oldSelection, g.selectionMode || "replace");
      renderOverlay();
      if (tool !== "crop") commit("Set selection");
    }
  } finally {
    gesture = null;
    pro?.clearSnap();
    $("#stage").classList.remove("dragging");
  }
});
$("#stage").addEventListener("pointercancel", cancelGesture);
$("#stage").addEventListener("pointerleave", () => {
  if (!gesture) {
    hover = null;
    renderOverlay();
  }
});
$("#stage").addEventListener("wheel", (e) => {
  if (!current) return;
  e.preventDefault();
  if (e.ctrlKey || e.metaKey || e.altKey) zoom(Math.exp(-e.deltaY * 2e-3), stagePoint(e));
  else {
    current.panX -= e.deltaX;
    current.panY -= e.deltaY;
    current.fitted = false;
    positionBoard();
  }
}, { passive: false });
$("#stage").addEventListener("dblclick", (e) => {
  if (tool !== "move") return;
  const p = pointOnCanvas(e), hit = hitLayer(doc(), p.x, p.y);
  if (hit?.type === "text") {
    doc().activeId = hit.id;
    renderUI();
    startText(hit);
  }
});
function sampleColor(p) {
  if (!composite) return;
  const pixel = composite.getContext("2d").getImageData(clamp(Math.round(p.x * renderScale), 0, composite.width - 1), clamp(Math.round(p.y * renderScale), 0, composite.height - 1), 1, 1).data;
  foreground = "#" + [...pixel.slice(0, 3)].map((v) => v.toString(16).padStart(2, "0")).join("");
  $("#foreground").value = foreground;
  desktop?.colorChanged();
  toast("Sampled " + foreground.toUpperCase());
}
function combineSelection(next, previous, mode) {
  next.feather=selectionFeather;next.antiAlias=selectionAntiAlias;
  if (!previous || mode === "replace") {
    doc().selection = next;
    return;
  }
  const c = maskCanvas(doc(), previous, 1, assets), x = c.getContext("2d");
  x.globalCompositeOperation = { add: "source-over", subtract: "destination-out", intersect: "destination-in" }[mode] || "source-over";
  x.drawImage(maskCanvas(doc(), next, 1, assets), 0, 0);
  const source = c.toDataURL();
  assets.set(source, c);
  doc().selection = { type: "paint", source, x: 0, y: 0, width: doc().width, height: doc().height, feather: 0, invert: false };
}
function magicSelect(p) {
  if (!composite) return;
  const x = composite.getContext("2d"), data = x.getImageData(0, 0, composite.width, composite.height), alpha = floodSelection(data.data, composite.width, composite.height, p.x * renderScale, p.y * renderScale, wandTolerance), small = canvas(composite.width, composite.height);
  data.data.set(alpha);
  small.getContext("2d").putImageData(data, 0, 0);
  const full = canvas(doc().width, doc().height);
  full.getContext("2d").drawImage(small, 0, 0, full.width, full.height);
  const source = full.toDataURL();
  assets.set(source, full);
  combineSelection({ type: "paint", source, x: 0, y: 0, width: doc().width, height: doc().height, feather: 0, invert: false }, doc().selection, selectionMode);
  commit("Magic wand selection");
  renderOverlay();
  toast("Connected color selected. Choose Make mask to apply.");
}
function startText(l) {
  if (effectiveLocked(doc(), l)) {
    toast("Unlock the text layer to edit it.", true);
    return;
  }
  finishText();
  if(advancedText(l)){runAction("type-studio");return;}
  editingText = { id: l.id, original: l.text };
  const el = $("#canvas-text");
  el.hidden = false;
  el.textContent = l.text;
  Object.assign(el.style, { left: l.x + "px", top: l.y + "px", width: l.width + "px", fontFamily: l.font, fontSize: l.fontSize + "px", fontWeight: l.fontWeight, color: l.color, lineHeight: l.lineHeight || 1.2, textAlign: l.align || "left", fontStyle: l.italic ? "italic" : "normal", letterSpacing: (l.tracking || 0) + "px", textDecoration: l.underline ? "underline" : "none", transform: `rotate(${l.rotation}deg)` });
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  renderOverlay();
}
function finishText(cancel = false) {
  if (!editingText) return;
  const l = doc()?.layers.find((l2) => l2.id === editingText.id), el = $("#canvas-text"), value = el.innerText.replace(/\n$/, "");
  if (l) l.text = cancel ? editingText.original : value.slice(0, 1e4);
  const changed = l && l.text !== editingText.original;
  editingText = null;
  el.hidden = true;
  if (changed) commit("Edit text");
  else requestRender();
}
$("#canvas-text").addEventListener("input", () => {
  const l = layer();
  if (l) {
    l.text = $("#canvas-text").innerText.slice(0, 1e4);
    requestRender();
  }
});
$("#canvas-text").addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    e.preventDefault();
    finishText(true);
  } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    finishText();
  }
});
$("#canvas-text").addEventListener("blur", () => {
  setTimeout(() => finishText(), 0);
});
function showModal(title, subtitle, body, footer = [], setup = null, cancel = null) {
  finishText();
  if (gesture) cancelGesture();
  closeMenu();
  const dialog = $("#modal");
  if (dialog.open) {
    modalCancel?.();
    dialog.close();
  }
  modalCancel = cancel;
  $("#modal-content").innerHTML = `<div class="modal-head"><span class="modal-symbol">${icon("sliders")}</span><div><h2>${esc(title)}</h2><small>${esc(subtitle)}</small></div><button class="icon-button" data-modal-close aria-label="Close dialog">${icon("x")}</button></div><div class="modal-body">${body}</div><div class="modal-foot">${footer.map((f, i) => `<button class="button ${f.primary ? "primary" : ""}" data-modal-button="${i}">${f.icon ? icon(f.icon) : ""}${esc(f.label)}</button>`).join("")}</div>`;
  $("#modal-content [data-modal-close]").onclick = () => closeModal(true);
  $$("[data-modal-button]").forEach((b) => b.onclick = () => footer[Number(b.dataset.modalButton)].run());
  dialog.showModal();
  if (setup) setup();
}
function closeModal(cancel = false) {
  if (cancel && modalCancel) modalCancel();
  modalCancel = null;
  $("#modal").close();
}
$("#modal").addEventListener("cancel", (e) => {
  e.preventDefault();
  closeModal(true);
});
$("#modal").addEventListener("click", (e) => {
  if (e.target === $("#modal")) {
    const r = e.target.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeModal(true);
  }
});
function newDocumentModal() {
  showModal("A fresh canvas", "Create something that feels like you.", `<div class="modal-field"><label for="new-name">Document name</label><input id="new-name" value="Untitled"></div><div class="preset-buttons">${[[1800, 1200, "Landscape"], [1080, 1080, "Square"], [1080, 1920, "Story / Reel"], [1920, 1080, "Full HD"]].map(([w, h, n]) => `<button data-preset="${w},${h}">${n}</button>`).join("")}</div><div class="modal-grid"><div class="modal-field"><label for="new-width">Width (px)</label><input type="number" id="new-width" value="1800" min="1" ></div><div class="modal-field"><label for="new-height">Height (px)</label><input type="number" id="new-height" value="1200" min="1" ></div></div><div class="modal-field"><label for="new-bg">Background</label><select id="new-bg"><option value="transparent">Transparent</option><option value="#ffffff">White</option><option value="#172c29">Deep forest</option><option value="#f3efe5">Warm paper</option></select><p>RGB · 8-bit · sRGB. Giữ kích thước theo khả năng máy và trình duyệt.</p></div>`, [{ label: "Cancel", run: () => closeModal(true) }, { label: "Create canvas", primary: true, icon: "plus", run: () => {
    try {
      const d = createDocument(Number($("#new-width").value), Number($("#new-height").value), $("#new-name").value.trim().slice(0, 100) || "Untitled");
      const bg = $("#new-bg").value;
      if (bg !== "transparent") {
        const l = createLayer("shape", { name: "Background", shape: "rect", color: bg, width: d.width, height: d.height, locked: true, radius: 0 });
        d.layers.push(l);
        d.activeId = l.id;
      }
      closeModal();
      setDocument(d, "Create canvas");
      setTool("move");
    } catch (e) {
      toast(e.message, true);
    }
  } }], () => {
    $$("[data-preset]").forEach((b) => b.onclick = () => {
      const [w, h] = b.dataset.preset.split(",");
      $("#new-width").value = w;
      $("#new-height").value = h;
    });
    $("#new-name").focus();
  });
}
async function readImageFile(file){return readOriginalImage(file,assets,{createCanvas:canvas});}

async function openFiles(files, place = false) {
  const opened=[];
  busy("Opening…");
  for (const file of files) {
    try {
      if (/\.luma$/i.test(file.name)) {
        const d = validateDocument(JSON.parse(await file.text()));
        d.id = uid();
        await assets.hydrate(d);
        setDocument(d, "Open project");
        toast("Editable project opened.");
      } else if (/\.(pptx|svg)$/i.test(file.name)) {
        await advanced.importer.load(file);
      } else if (/\.ps[db]$/i.test(file.name)) {
        const adapter = await import("./vendor/psd.js"), psdBytes = await file.arrayBuffer(), result = await adapter.importPsd(psdBytes, file.name, assets);
        setDocument(result.doc, "Open PSD");
        if (result.stats) {
          const st = result.stats;
          showModal(result.mode === "merged" ? "PSD opened as merged preview" : "Your PSD is ready to edit", `${st.pixels} pixel · ${st.text} text · ${st.adjustments} adjustment layers`, `<div class="psd-report"><p><strong>${esc(file.name)}</strong> · ${result.doc.width} × ${result.doc.height} px</p><ul>${result.warnings.map((w) => `<li>${esc(w)}</li>`).join("") || "<li>Supported pixel layers, blending and opacity have been preserved.</li>"}</ul><p>Save a .luma project to preserve your edits. This build supports RGB / 8-bit PSD, độ phân giải theo khả năng máy.</p></div>`, [...result.mode === "editable" ? [{ label: "Open merged copy", run: async () => {
            const merged = await adapter.importPsd(psdBytes, file.name + " — merged", assets, { mergedOnly: true });
            closeModal();
            setDocument(merged.doc, "PSD merged preview");
          } }] : [], { label: "Start editing", primary: true, run: () => closeModal() }]);
        } else if (result.warnings.length) toast(result.warnings.join(" "));
        else toast("Layered PSD opened.");
      } else if (/^image\//.test(file.type) || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)) {
        const image = await readImageFile(file), name = file.name.replace(/\.[^.]+$/, "");
        if (place && current) {
          const s = Math.min(1, doc().width * 0.88 / image.width, doc().height * 0.88 / image.height), l = createLayer("image", { name, source: image.source, width: image.width * s, height: image.height * s, x: (doc().width - image.width * s) / 2, y: (doc().height - image.height * s) / 2 });
          addLayer(l, "Place " + name);
          setTool("move");
        } else {
          const d = createDocument(image.width, image.height, name), l = createLayer("image", { name: "Background", source: image.source, width: image.width, height: image.height, locked: true });
          d.layers = [l];
          d.activeId = l.id;
          setDocument(d, "Open image");
        }
      } else throw new Error("Open PNG, JPEG, WebP, GIF, BMP, RGB/8 PSD or .luma files.");
      opened.push(doc());
    } catch (e) {
      console.error(e);
      toast(file.name + ": " + e.message, true);
    }
  }
  busy("Ready");
  return opened;
}
$("#file-input").onchange = async (e) => {
  await openFiles([...e.target.files]);
  e.target.value = "";
};
$("#place-input").onchange = async (e) => {
  await openFiles([...e.target.files], true);
  e.target.value = "";
};
let dragDepth = 0;
document.addEventListener("dragenter", (e) => {
  if (e.dataTransfer.types.includes("Files")) {
    e.preventDefault();
    dragDepth++;
    $("#drop-overlay").hidden = false;
  }
});
document.addEventListener("dragleave", (e) => {
  if (e.dataTransfer?.types.includes("Files")) {
    dragDepth--;
    if (dragDepth <= 0) $("#drop-overlay").hidden = true;
  }
});
document.addEventListener("dragover", (e) => {
  if (e.dataTransfer.types.includes("Files")) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }
});
document.addEventListener("drop", (e) => {
  if (e.dataTransfer.files.length) {
    e.preventDefault();
    dragDepth = 0;
    $("#drop-overlay").hidden = true;
    openFiles([...e.dataTransfer.files], e.shiftKey);
  }
});
async function saveProject() {
  finishText();
  if (gesture) cancelGesture();
  busy("Saving project…");
  try {
    const d = await embeddedDocument(doc(), assets);
    validateDocument(d);
    const name = doc().name.replace(/[<>:"/\\|?*]/g, "-") || "Untitled";
    downloadBlob(new Blob([JSON.stringify(d)], { type: "application/json" }), name + ".luma");
    await saveLocal(doc());
    busy("Saved on device");
    toast("Project saved with editable layers, masks and adjustments.");
  } catch (e) {
    toast("Project could not be saved: " + e.message, true);
    busy("Save failed");
  }
}
function exportModal() {
  const d = doc();
  showModal("Export your work", "A finished image, ready to go.", `<img class="export-preview" id="export-preview" alt="Export preview"><div class="modal-grid"><div class="modal-field"><label for="export-format">Format</label><select id="export-format"><option value="png">PNG · lossless</option><option value="jpeg">JPEG · smaller file</option><option value="webp">WebP · modern web</option><option value="psd">PSD · layered document</option><option value="psb">PSB · layered document</option></select></div><div class="modal-field"><label for="export-scale">Scale</label><select id="export-scale"><option value="1">100% · original size</option><option value=".5">50%</option><option value=".25">25%</option><option value="2">200%</option></select></div></div><div class="modal-field"><label for="export-name">Filename</label><input id="export-name" value="${esc(d.name)}"></div><div id="export-quality-wrap" class="modal-field" hidden><label for="export-quality">Quality <span id="quality-value">100%</span></label><input type="range" id="export-quality" min="10" max="100" value="100"></div><div class="modal-field"><label for="export-background">Background</label><select id="export-background"><option value="transparent">Transparent</option><option value="#ffffff">White</option><option value="#152a27">Deep forest</option></select><p id="export-dimensions">${d.width} × ${d.height} px · RGB / 8-bit</p></div><div class="modal-field"><label for="export-dpi">Độ phân giải in (DPI)</label><input id="export-dpi" type="number" min="1" max="2400" value="300"><p id="export-print-size">${printSize(d.width,d.height,300)}</p><p>DPI xác định kích thước in; số pixel được giữ. Xuất CMYK / ICC qua Nâng cao → Màu in.</p></div><label class="check-row" id="psd-editable-wrap" hidden><input type="checkbox" id="psd-editable" checked> Keep supported text and adjustments editable</label><div class="export-note" id="export-note" hidden></div>`, [{ label: "Cancel", run: () => closeModal(true) }, { label: "Export file", icon: "download", primary: true, run: async () => {
    const type = $("#export-format").value, scale = Number($("#export-scale").value), name = $("#export-name").value.replace(/[<>:"/\\|?*]/g, "-").trim() || "Untitled", quality = Number($("#export-quality").value) / 100, bg = $("#export-background").value;
    try {
      if (d.width * d.height * scale * scale > MAX_PIXELS) throw new Error("Kích thước xuất không hợp lệ.");
      const btn = $('[data-modal-button="1"]');
      btn.disabled = true;
      btn.textContent = "Rendering…";
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 10)));
      if (["psd", "psb"].includes(type)) {
        const adapter = await import("./vendor/psd.js");
        downloadBlob(new Blob([adapter.exportPsd(d, assets, { editable: $("#psd-editable").checked, psb: type === "psb", dpi:Number($("#export-dpi").value) })], { type: "image/vnd.adobe.photoshop" }), name + "." + type);
      } else {
        const c = renderDocument(d, assets, { scale, background: bg === "transparent" ? type === "jpeg" ? "#ffffff" : null : bg });
        const mime = "image/" + type, blob = await new Promise((resolve) => c.toBlob(resolve, mime, quality));
        if (!blob) throw new Error("This browser could not encode the image.");
        if (blob.type !== mime) throw new Error("This browser does not support " + type.toUpperCase() + " export. Use PNG.");
        downloadBlob(await withPrintMetadata(blob,Number($("#export-dpi").value)), name + "." + (type === "jpeg" ? "jpg" : type));
      }
      closeModal();
      toast("Exported " + name + "." + (type === "jpeg" ? "jpg" : type));
    } catch (e) {
      toast(e.message, true);
      const btn = $('[data-modal-button="1"]');
      btn.disabled = false;
      btn.innerHTML = icon("download") + "Export file";
    }
  } }], () => {
    if (composite) $("#export-preview").src = composite.toDataURL();
    const update = () => {
      const type = $("#export-format").value, psd = ["psd", "psb"].includes(type);
      $("#export-quality-wrap").hidden = !["jpeg", "webp"].includes(type);
      $("#export-scale").disabled = psd;
      $("#export-background").disabled = psd;
      if (psd) $("#export-scale").value = "1";
      const s = Number($("#export-scale").value);
      $("#export-dpi").disabled=type==="webp";
      $("#export-print-size").textContent=type==="webp"?"WebP dùng cho màn hình; xuất PNG/JPEG/PSD nếu cần DPI in.":printSize(Math.round(d.width*s),Math.round(d.height*s),Number($("#export-dpi").value)||300);
      $("#export-dimensions").textContent = `${Math.round(d.width * s)} × ${Math.round(d.height * s)} px · RGB / 8-bit`;
      $("#export-note").hidden = !psd;
      $("#psd-editable-wrap").hidden = !psd;
      if (psd) {
        const eligible = ["brightness", "exposure", "vibrance", "invert", "levels", "curves", "hue", "posterize", "threshold"];
        const baked = d.layers.some((l) => l.visible && l.type === "adjustment" && (!$("#psd-editable").checked || !eligible.includes(l.adjustment) || l.mask));
        $("#export-note").textContent = baked ? "PSD includes the finished composite plus hidden source pixel layers because some adjustments cannot be exported live. Save .luma for full editability." : $("#psd-editable").checked ? "Simple unrotated text and supported adjustments stay editable. Shapes, effects and masked text are rasterized. Supported embedded Smart Objects remain placed objects; preserve .luma for Luma filters and all original structure. Font layout and color may differ in Photoshop. Save .luma for full fidelity." : "PSD keeps pixel layers, opacity and blending. Text and shapes are rasterized. Save .luma to keep everything editable.";
      }
    };
    $("#export-dpi").oninput=update;
    $("#export-format").onchange = update;
    $("#psd-editable").onchange = update;
    $("#export-scale").onchange = update;
    $("#export-quality").oninput = (e) => $("#quality-value").textContent = e.target.value + "%";
  });
}
function resizeModal(canvasOnly = false) {
  const d = doc();
  showModal(canvasOnly ? "Canvas size" : "Image size", canvasOnly ? "Change the canvas without rescaling layers." : "Rescale the document and all its layers.", `<div class="modal-grid"><div class="modal-field"><label for="resize-w">Width (px)</label><input type="number" id="resize-w" value="${d.width}" min="1" ></div><div class="modal-field"><label for="resize-h">Height (px)</label><input type="number" id="resize-h" value="${d.height}" min="1" ></div></div><label class="check-row"><input type="checkbox" id="resize-ratio" checked> Keep aspect ratio</label><p>Original: ${d.width} × ${d.height} px. Giữ kích thước theo khả năng máy và trình duyệt.</p>`, [{ label: "Cancel", run: () => closeModal(true) }, { label: "Apply", primary: true, run: () => {
    try {
      const w = Math.round(Number($("#resize-w").value)), h = Math.round(Number($("#resize-h").value));
      createDocument(w, h);
      if (!canvasOnly) {
        const sx = w / d.width, sy = h / d.height;
        transformDocumentData(d,[sx,0,0,sy,0,0]);
        const ac=(d.alphaChannels||[]).map(c=>({mask:c.mask}));pro.remapMasks(ac,[sx,0,0,sy,0,0],{forceDocument:true,width:w,height:h});(d.alphaChannels||[]).forEach((c,i)=>c.mask=ac[i].mask);
        for (const l of d.layers) {
          l.x *= sx;
          l.y *= sy;
          l.width *= sx;
          l.height *= sy;
          if (l.type === "text") scaleText(l,sx,sy);
          if (l.type === "shape") l.radius = (l.radius || 0) * Math.min(sx, sy);
          if (l.mask) {
            if (l.mask.points) l.mask.points = l.mask.points.map((p) => [p[0] * sx, p[1] * sy]);
            l.mask.x = (l.mask.x || 0) * sx;
            l.mask.y = (l.mask.y || 0) * sy;
            l.mask.width = (l.mask.width || d.width) * sx;
            l.mask.height = (l.mask.height || d.height) * sy;
            l.mask.feather = (l.mask.feather || 0) * Math.min(sx, sy);
          }
        }
      }
      d.width = w;
      d.height = h;
      d.selection = null;
      closeModal();
      commit(canvasOnly ? "Canvas size" : "Image size");
      fit();
    } catch (e) {
      toast(e.message, true);
    }
  } }], () => {
    const ratio = d.width / d.height;
    $("#resize-w").oninput = (e) => {
      if ($("#resize-ratio").checked) $("#resize-h").value = Math.round(Number(e.target.value) / ratio);
    };
    $("#resize-h").oninput = (e) => {
      if ($("#resize-ratio").checked) $("#resize-w").value = Math.round(Number(e.target.value) * ratio);
    };
  });
}
function rotateDocument() {
  const d = doc(), oldW = d.width, oldH = d.height;
  transformDocumentData(d,[0,1,-1,0,oldH,0]);
  const ac=(d.alphaChannels||[]).map(c=>({mask:c.mask}));pro.remapMasks(ac,[0,1,-1,0,oldH,0],{forceDocument:true,width:oldH,height:oldW});(d.alphaChannels||[]).forEach((c,i)=>c.mask=ac[i].mask);
  for (const l of d.layers) {
    if (l.mask) {
      const m = maskCanvas(d, {...l.mask,density:100}, 1, assets), c = canvas(oldH, oldW), x = c.getContext("2d");
      x.translate(oldH, 0);
      x.rotate(Math.PI / 2);
      x.drawImage(m, 0, 0);
      const source = c.toDataURL();
      assets.set(source, c);
      l.mask = { type: "paint", source, x: 0, y: 0, width: oldH, height: oldW, feather: 0, invert: false,disabled:!!l.mask.disabled,density:l.mask.density??100 };
    }
    const cx = l.x + l.width / 2, cy = l.y + l.height / 2;
    l.x = oldH - cy - l.width / 2;
    l.y = cx - l.height / 2;
    l.rotation += 90;
  }
  d.width = oldH;
  d.height = oldW;
  d.selection = null;
  commit("Rotate canvas 90°");
  fit();
}
function renameLayer() {
  const l = layer();
  if (!l) return;
  showModal("Rename layer", "A clear stack makes editing easier.", `<div class="modal-field"><label for="rename-input">Layer name</label><input id="rename-input" value="${esc(l.name)}" maxlength="200"></div>`, [{ label: "Cancel", run: () => closeModal(true) }, { label: "Rename", primary: true, run: () => {
    l.name = $("#rename-input").value.trim() || "Layer";
    closeModal();
    commit("Rename layer");
  } }], () => {
    $("#rename-input").focus();
    $("#rename-input").select();
  });
}
function renameDocument() {
  const d = doc();
  showModal("Rename project", "Give your work a name.", `<div class="modal-field"><label for="rename-input">Project name</label><input id="rename-input" value="${esc(d.name)}" maxlength="100"></div>`, [{ label: "Cancel", run: () => closeModal(true) }, { label: "Rename", primary: true, run: () => {
    d.name = $("#rename-input").value.trim() || "Untitled";
    closeModal();
    commit("Rename project");
  } }]);
}
function stylesModal(initial='shadow') {return openLayerStyles({doc,layer,assets,toast,showModal,closeModal,commit,renderUI,requestRender,renderNow:render},initial);}
async function recentModal() {
  try {
    const recent = await recentLocal();
    showModal("Recent projects", "Saved on this device, in this browser.", recent.length ? `<div class="command-list">${recent.map((r, i) => `<button data-recent="${i}">${icon("image")}<span>${esc(r.doc.name)}<small style="display:block;color:#849aa5;margin-top:3px">${r.doc.width} × ${r.doc.height} · ${new Date(r.updatedAt).toLocaleString()}</small></span>${icon("chevron-right")}</button>`).join("")}</div>` : "<p>No local projects yet. Your work will appear here after autosave.</p>", [{ label: "Close", run: () => closeModal() }], () => {
      $$("[data-recent]").forEach((b) => b.onclick = async () => {
        try {
          const d = validateDocument(clone(recent[Number(b.dataset.recent)].doc));
          await assets.hydrate(d);
          closeModal();
          setDocument(d, "Restore local project");
        } catch (e) {
          toast(e.message, true);
        }
      });
    });
  } catch {
    toast("Local history is unavailable in this browser.", true);
  }
}
function helpModal() {
  showModal("Luma Studio", "9.1.0 · Photo & Design · Miễn phí sử dụng", `<div class="creator-about">Được tạo bởi <strong>Larx Vo</strong> · <a href="https://vovinhlac.com" target="_blank" rel="noopener noreferrer">vovinhlac.com</a></div><p>Mở ảnh hoặc PSD, chọn lớp, dùng preset để bắt đầu nhanh rồi chỉnh lại thông số. Lưu <strong>.luma</strong> để giữ nguồn, mask và toàn bộ thiết lập Luma.</p><div class="help-columns"><div><h3>Tìm đúng nơi</h3><ul><li><strong>Chỉnh ảnh:</strong> chân dung, tách nền, xóa vật thể, màu, ánh sáng và phục hồi.</li><li><strong>Thiết kế:</strong> mẫu, thành phần và chữ.</li><li><strong>AI / Nâng cao:</strong> tạo sinh, Smart Objects, màu in và cộng tác.</li><li><strong>Cửa sổ:</strong> bố trí, panel, histogram, kênh và đường vector.</li></ul></div><div><h3>Phím tắt</h3><p>Ctrl K · Tìm công cụ<br>Ctrl Z / Ctrl Shift Z · Undo / Redo<br>Ctrl S · Lưu dự án<br>Ctrl Shift S · Xuất ảnh<br>Ctrl 0 / Ctrl 1 · Vừa màn hình / 100%<br>Space · Kéo ảnh · Tab · Ẩn/hiện dock</p></div></div><p>PNG/JPEG xuất theo kích thước gốc và DPI bạn chọn; màu in CMYK TIFF nằm ở Nâng cao → CMYK / ICC. Giới hạn thực tế phụ thuộc bộ nhớ, canvas và định dạng.</p><details class="help-limits"><summary>Định dạng và khả năng hiện tại</summary><p>Engine làm việc RGB 8-bit sRGB. PSD phức tạp có Smart Filters/warp/hiệu ứng chưa hỗ trợ sẽ mở composite; không bảo đảm mọi layer còn sửa được. Các hiệu ứng Canvas không hoàn toàn giống Photoshop. Kênh alpha lưu/tô riêng; Work Path và đường lưu có Direct Selection. Typography có định dạng từng đoạn. Smart Filters tương thích có thông báo riêng. Có bộ cài Windows x64. Canva Connect mở bản gốc trong Canva và chuyển trang PNG qua Luma sau khi cấu hình tài khoản; chưa có sửa cây layer Canva offline. RAW/HEIC chưa có. Chất lượng sinh ảnh chưa được kiểm chứng bằng GPU vật lý; AI dự đoán phần ảnh đã mất.</p></details><a class="help-guide-link" href="assets/desktop-guide.vi.md" target="_blank" rel="noopener">Hướng dẫn Luma9.0 · tính năng và phạm vi tương thích →</a>`, [{label:"Windows / Canva / PSD",run:()=>{closeModal();actions["platform-status"]();}},{label:"Source code",icon:"copy",run:()=>actions.source()},{label:"Thử tính năng 8.0",run:()=>{closeModal();actions["core-sample"]();}},{label:"Bắt đầu chỉnh sửa",primary:true,run:()=>closeModal()}]);
}
const actionItems = [
  ["templates", "Design templates", "grid", ""],
  ["ai", "On-device AI Studio", "sparkles", ""],
  ["flip-x", "Flip layer horizontally", "swap", ""],
  ["flip-y", "Flip layer vertically", "swap", ""],
  ["new", "New document", "plus", "Ctrl N"],
  ["open", "Open image or project", "folder-open", "Ctrl O"],
  ["recent", "Recent projects", "history", ""],
  ["place", "Place image as layer", "image", ""],
  ["save", "Save editable project", "save", "Ctrl S"],
  ["export", "Export image / PSD", "download", "Ctrl Shift S"],
  ["undo", "Undo", "undo", "Ctrl Z"],
  ["redo", "Redo", "redo", "Ctrl Shift Z"],
  ["duplicate", "Duplicate layer", "copy", "Ctrl J"],
  ["rename-layer", "Rename layer", "text", ""],
  ["image-size", "Image size", "image", ""],
  ["canvas-size", "Canvas size", "ruler", ""],
  ["rotate", "Rotate canvas 90°", "reset", ""],
  ["flatten", "Flatten visible layers", "adjust", ""],
  ["add-paint", "New paint layer", "brush", ""],
  ["add-text", "New text layer", "text", ""],
  ["add-shape", "New shape layer", "shape", ""],
  ["adjustments", "Add adjustment", "adjust", ""],
  ["add-mask", "Add layer mask", "mask", ""],
  ["styles", "Layer styles", "sparkles", ""],
  ["lock", "Lock / unlock layer", "lock", ""],
  ["up", "Bring layer forward", "chevron-right", ""],
  ["down", "Send layer backward", "chevron-down", ""],
  ["delete", "Delete layer", "trash", "Delete"],
  ["select-all", "Select entire canvas", "select", "Ctrl A"],
  ["deselect", "Deselect", "x", "Ctrl D"],
  ["invert-selection", "Invert selection", "adjust", "Ctrl Shift I"],
  ["fit", "Fit canvas", "maximize", "Ctrl 0"],
  ["zoom-100", "Actual size (100%)", "zoom", "Ctrl 1"],
  ["grid", "Show / hide grid", "grid", ""],
  ["toggle-dock", "Show / hide panels", "panel", "Tab"],
  ["rename-document", "Rename project", "text", ""],
  ["help", "Shortcuts & help", "help", ""],
  ["source", "Download full source", "copy", ""],
  ["sample", "Open sample artwork", "image", ""]
];
const menuItems = { File: ["new", "open", "recent", "place", "-", "save", "export", "-", "rename-document"], Edit: ["undo", "redo", "-", "duplicate", "rename-layer"], Image: ["image-size", "canvas-size", "rotate", "-", "flatten"], Layer: ["add-paint", "add-text", "add-shape", "adjustments", "-", "duplicate", "add-mask", "styles", "lock", "-", "up", "down", "delete"], Select: ["select-all", "deselect", "invert-selection", "-", "add-mask"], View: ["templates", "ai", "-", "fit", "zoom-100", "-", "grid", "toggle-dock"] };
function flipActiveLayer(axis) {
  const list = roots(doc()).filter((l) => l.type !== "adjustment" && !effectiveLocked(doc(), l));
  if (!list.length) return;
  assertCanEdit(doc(),list,"geometry",{descendants:true});
  const box = bounds(list), cx = box.x + box.width / 2, cy = box.y + box.height / 2, objects = list.flatMap((l) => subtree(doc(), l.id));
  pro?.remapMasks(objects, axis === "x" ? [-1, 0, 0, 1, 2 * cx, 0] : [1, 0, 0, -1, 0, 2 * cy]);
  for (const target of objects) {
    if (["group", "adjustment"].includes(target.type)) continue;
    const x = target.x + target.width / 2, y = target.y + target.height / 2;
    target.x = (axis === "x" ? 2 * cx - x : x) - target.width / 2;
    target.y = (axis === "y" ? 2 * cy - y : y) - target.height / 2;
    target.rotation = -(target.rotation || 0);
    const key = axis === "x" ? "flipX" : "flipY";
    target[key] = !target[key];
  }
  refreshGroups(doc());
  commit(axis === "x" ? "Flip selection horizontally" : "Flip selection vertically");
}
const actions = {
  templates: () => workspace.open("templates"),
  ai: () => workspace.open("ai-tools"),
  "flip-x": () => flipActiveLayer("x"),
  "flip-y": () => flipActiveLayer("y"),
  new: newDocumentModal,
  open: () => $("#file-input").click(),
  place: () => $("#place-input").click(),
  recent: recentModal,
  save: saveProject,
  export: exportModal,
  undo,
  redo,
  duplicate: duplicateLayer,
  delete: removeLayer,
  "add-text": () => addText(),
  "add-shape": () => addShape(),
  "add-paint": addPaint,
  "add-mask": addMask,
  "mask-mode": toggleMaskMode,
  styles: stylesModal,
  help: helpModal,
  about: helpModal,
  adjustments: () => {
    activePanel = "adjustments";
    $("#app").classList.remove("dock-collapsed");
    renderProperties();
  },
  "reset-adjustment": () => {
    if (layer()?.type === "adjustment") {
      layer().params = defaults(layer().adjustment);
      commit("Reset adjustment");
    }
  },
  "auto-levels": () => {
    const l = layer();
    if (l?.adjustment !== "levels" || !stats) return;
    const sample=histogram(composite.getContext("2d").getImageData(0,0,composite.width,composite.height).data,l.params.channel||"luminance"),total = sample.count, target = total * 5e-3;
    let lo = 0, hi = 255, n = 0;
    for (let i = 0; i < 256; i++) {
      n += sample.bins[i];
      if (n >= target) {
        lo = i;
        break;
      }
    }
    n = 0;
    for (let i = 255; i >= 0; i--) {
      n += sample.bins[i];
      if (n >= target) {
        hi = i;
        break;
      }
    }
    Object.assign(l.params,{black:Math.min(254,lo),white:Math.max(Math.min(254,lo)+1,hi),gamma:1});
    commit("Auto levels");
  },
  "invert-mask": () => {
    if (layer()?.mask) {
      layer().mask.invert = !layer().mask.invert;
      commit("Invert mask");
    }
  },
  "remove-mask": () => {
    if (layer()?.mask) {
      layer().mask = null;
      maskMode = false;
      commit("Remove mask");
      renderContext();
    }
  },
  "invert-selection": invertSelection,
  "apply-crop": applyCrop,
  deselect: () => {
    doc().selection = null;
    commit("Deselect");
  },
  "select-all": () => {
    doc().selection = { type: "rect", x: 0, y: 0, width: doc().width, height: doc().height, feather: 0, invert: false };
    commit("Select all");
  },
  "image-size": () => resizeModal(false),
  "canvas-size": () => resizeModal(true),
  rotate: rotateDocument,
  flatten,
  lock: () => {
    const l = layer();
    if (l) {
      l.locked = !l.locked;
      commit(l.locked ? "Lock layer" : "Unlock layer");
    }
  },
  "rename-layer": renameLayer,
  "rename-document": renameDocument,
  settings: () => resizeModal(true),
  "center-layer": () => {
    const l = layer();
    if (l && canEdit(doc(),l,"geometry") && l.type !== "adjustment") {
      moveLayer(l, (doc().width - l.width) / 2 - l.x, (doc().height - l.height) / 2 - l.y);
      commit("Center layer");
    }
  },
  up: () => moveStack(1),
  down: () => moveStack(-1),
  fit,
  "zoom-in": () => zoom(1.2),
  "zoom-out": () => zoom(1 / 1.2),
  "zoom-100": () => zoom(1 / current.zoom),
  grid: () => {
    grid = !grid;
    renderOverlay();
  },
  "toggle-dock": () => {
    $("#app").classList.toggle("dock-collapsed");
    setTimeout(() => {
      if (current.fitted) fit();
      else positionBoard();
    }, 0);
  },
  "swap-color": () => {
    const old = foreground;
    foreground = background;
    background = old;
    $("#foreground").value = foreground;
  },
  "add-menu": () => {
    const b = $('[data-action="add-menu"]'), r = b.getBoundingClientRect();
    openMenu(["add-paint", "add-text", "add-shape", "adjustments", "place"], r.right - 230, r.bottom + 4);
  },
  source: async () => {
    if(window.lumaDesktop){window.open("https://github.com/larxvo/lumia-studio/releases/latest","_blank","noopener");return;}
    toast("Preparing the complete source archive…");
    const {loadSourceArchive}=await import("./source-download.js");
    let result;
    try { result=await loadSourceArchive(text=>busy(text)); } finally { busy("Ready"); }
    const {blob,filename}=result;
    downloadBlob(blob,filename);
    toast("Source archive ready.");
  },
  commands: commandsModal,
  sample: async () => {
    const d = makeDemo();
    await assets.hydrate(d);
    setDocument(d, "Open sample");
  }
};
async function runAction(name) {
  if (!actions[name]) return;
  closeMenu();
  try {
    if (gesture) cancelGesture();
    documentTools?.cancel();
    await actions[name]();
    workspace?.remember(name);
  } catch (e) {
    console.error(e);
    toast(e.message, true);
  }
}
function openMenu(ids, x, y) {
  const root = $("#menu-popover");
  root.setAttribute("role","menu");
  root.innerHTML = ids.map((id) => {
    if (id === "-") return '<div class="menu-separator"></div>';
    const item = actionItems.find((a) => a[0] === id);
    const l=layer(),requiresLayer=["styles","filters","delete","add-mask","rename-layer","up","down","transform","lock"].includes(id),disabled=id==="undo"?(!current||current.history.index===0):id==="redo"?(!current||current.history.index>=current.history.entries.length-1):requiresLayer?(!l||id!=="lock"&&effectiveLocked(doc(),l)||["styles","filters"].includes(id)&&l.type==="adjustment"):false;
    return item ? `<button role="menuitem" ${disabled?'disabled title="Chọn lớp phù hợp và mở khóa để sử dụng"':''} data-action="${id}">${icon(item[2])}${item[1]}<kbd>${item[3]}</kbd></button>` : "";
  }).join("");
  root.hidden = false;
  root.style.left = clamp(x, 8, window.innerWidth - 245) + "px";
  root.style.top = clamp(y, 5, window.innerHeight - root.offsetHeight - 8) + "px";
  menuOpen = true;
  $$("[data-menu]").forEach(b=>{b.setAttribute("aria-haspopup","menu");b.setAttribute("aria-expanded",String(b.dataset.menu===root.dataset.menu));});
}
function closeMenu() {
  $("#menu-popover").hidden = true;
  menuOpen = false;
  $$(".menus [data-menu]").forEach(b=>b.setAttribute("aria-expanded","false"));
}
function commandsModal() {
  showModal("Tìm công cụ", "Gõ tiếng Việt có dấu, không dấu hoặc tên công cụ tiếng Anh.", `<input class="command-search" id="command-search" placeholder="Ví dụ: gọn mặt, xóa người, màu áo…" aria-label="Search commands"><div class="command-list" id="command-list"></div>`, [], () => {
    const renderList = (query) => {
      const items = searchActions(actionItems,query);
      $("#command-list").innerHTML = items.map((a) => `<button data-command-action="${a[0]}">${icon(a[2])}${a[1]}<kbd>${a[3]}</kbd></button>`).join("") || "<p>No matching action.</p>";
      $$("[data-command-action]").forEach((b) => b.onclick = () => {
        closeModal();
        runAction(b.dataset.commandAction);
      });
    };
    renderList("");
    $("#command-search").oninput = (e) => renderList(e.target.value);
    $("#command-search").onkeydown = (e) => {
      if (e.key === "Enter") $("#command-list button")?.click();
      else if(e.key==="Escape"){e.preventDefault();closeModal(true);}
      else if (e.key === "ArrowDown") {
        e.preventDefault();
        $("#command-list button")?.focus();
      }
    };
    $("#command-search").focus();
  });
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b?.dataset.layerAlign) {
    runAction("align-" + b.dataset.layerAlign);
    return;
  }
  if (b?.dataset.action) {
    runAction(b.dataset.action);
    return;
  }
  if (b?.dataset.menu) {
    const r = b.getBoundingClientRect();
    if (menuOpen && $("#menu-popover").dataset.menu === b.dataset.menu) {
      closeMenu();
      return;
    }
    $("#menu-popover").dataset.menu = b.dataset.menu;
    openMenu(menuItems[b.dataset.menu], r.left, r.bottom + 5);
    return;
  }
  if (b?.dataset.tool) {
    setTool(b.dataset.tool);
    return;
  }
  if (b?.dataset.panel) {
    activePanel = b.dataset.panel;
    renderProperties();
    return;
  }
  if (b?.dataset.layerTab) {
    layerTab = b.dataset.layerTab;
    $$("[data-layer-tab]").forEach((v) => v.classList.toggle("active", v.dataset.layerTab === layerTab));
    $("#layers-panel").hidden = layerTab !== "layers";
    $("#history-list").hidden = layerTab !== "history";
    renderHistory();
    return;
  }
  if (b?.dataset.adjustment) {
    addAdjustment(b.dataset.adjustment);
    return;
  }
  if (b?.dataset.look) {
    applyLook(b.dataset.look);
    return;
  }
  if (b?.dataset.groupToggle) {
    const g = doc().layers.find((x) => x.id === b.dataset.groupToggle);
    g.collapsed = !g.collapsed;
    renderLayers();
    return;
  }
  if (b?.dataset.visibility) {
    const l = doc().layers.find((l2) => l2.id === b.dataset.visibility);
    l.visible = !l.visible;
    commit((l.visible ? "Show " : "Hide ") + l.name);
    return;
  }
  if (b?.dataset.editMask) {
    doc().activeId = b.dataset.editMask;
    maskMode = true;
    setTool("brush");
    renderUI();
    renderContext();
    return;
  }
  if (b?.dataset.history !== void 0) {
    restore(Number(b.dataset.history));
    return;
  }
  if (b?.dataset.align) {
    const l = layer();
    if (l && canEdit(doc(),l,"geometry")) {
      l.align = b.dataset.align;
      commit("Text alignment");
    }
    return;
  }
  if (b?.dataset.closeDocument) {
    closeDocument(b.dataset.closeDocument);
    return;
  }
  const row = e.target.closest("[data-layer]");
  if (row) {
    finishText();
    documentTools?.exitAlpha();documentTools?.clearPath();
    selectLayer(doc(), row.dataset.layer, { toggle: e.ctrlKey || e.metaKey, range: e.shiftKey });
    activePanel = "properties";
    maskMode = false;
    renderUI();
    renderOverlay();
    return;
  }
  const tab = e.target.closest("[data-document]");
  if (tab) {
    switchDocument(tab.dataset.document);
    return;
  }
  if (menuOpen && !e.target.closest("#menu-popover")) closeMenu();
});
$("#layer-list").addEventListener("dblclick", (e) => {
  const row = e.target.closest("[data-layer]");
  if (row) {
    doc().activeId = row.dataset.layer;
    renameLayer();
  }
});
$("#document-tabs").addEventListener("dblclick", (e) => {
  if (e.target.closest("[data-document]") && !e.target.closest("button")) renameDocument();
});
document.addEventListener("contextmenu", (e) => {
  const row = e.target.closest("[data-layer]");
  if (row) {
    e.preventDefault();
    doc().activeId = row.dataset.layer;
    renderUI();
    openMenu(["group", "ungroup", "clip", "transform", "filters", "-", "rename-layer", "duplicate", "add-mask", "styles", "lock", "-", "up", "down", "delete"], e.clientX, e.clientY);
  } else if (e.target.closest("#stage")) {
    e.preventDefault();
    openMenu(["fit", "zoom-100", "place", "add-text", "add-shape"], e.clientX, e.clientY);
  }
});
let draggedLayer = null;
$("#layer-list").addEventListener("dragstart", (e) => {
  const row = e.target.closest("[data-layer]");
  if (row) {
    draggedLayer = row.dataset.layer;
    e.dataTransfer.setData("text/plain", draggedLayer);
    e.dataTransfer.effectAllowed = "move";
  }
});
$("#layer-list").addEventListener("dragover", (e) => {
  if (draggedLayer && e.target.closest("[data-layer]")) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }
});
$("#layer-list").addEventListener("drop", (e) => {
  const row = e.target.closest("[data-layer]");
  if (!row || !draggedLayer) return;
  e.preventDefault();
  if (row.dataset.layer !== draggedLayer) {
    const target = doc().layers.find((x) => x.id === row.dataset.layer), dragged = doc().layers.find((x) => x.id === draggedLayer), above = e.clientY < row.getBoundingClientRect().top + row.offsetHeight / 2;
    try {
      reorderObject(doc(), dragged.id, target.id, { above, inside: target.type === "group" && !e.altKey });
      doc().activeId = dragged.id;
      doc().selectedIds = [dragged.id];
    } catch (error) {
      toast(error.message, true);
      draggedLayer = null;
      return;
    }
    commit("Reorder layer");
  }
  draggedLayer = null;
});
$("#layer-list").addEventListener("dragend", () => draggedLayer = null);
$("#blend-mode").innerHTML = BLENDS.map((v) => `<option value="${v}">${titleCase(v)}</option>`).join("");
$("#blend-mode").onchange = (e) => {
  const l = layer();
  if (l && canEdit(doc(),l,"geometry")) {
    for (const target of selected(doc())) if (!effectiveLocked(doc(), target)) target.blend = e.target.value === "pass-through" && target.type !== "group" ? "normal" : e.target.value;
    commit("Change blend mode");
  }
};
$("#layer-opacity").oninput = (e) => {
  const l = layer();
  if (l && canEdit(doc(),l,"geometry")) {
    for (const target of selected(doc())) if (!effectiveLocked(doc(), target)) target.opacity = clamp(Number(e.target.value) || 0, 0, 100) / 100;
    requestRender();
  }
};
$("#layer-opacity").onchange = () => commit("Layer opacity");
$("#foreground").oninput = (e) => {foreground = e.target.value;desktop?.colorChanged();};
$("#navigator").onclick = (e) => {
  if (!current || !composite) return;
  const r = e.target.getBoundingClientRect(), s = Math.min(r.width / doc().width, r.height / doc().height), left = (r.width - doc().width * s) / 2, top = (r.height - doc().height * s) / 2, x = (e.clientX - r.left - left) / s, y = (e.clientY - r.top - top) / s;
  current.panX = $("#stage").clientWidth / 2 - x * current.zoom;
  current.panY = $("#stage").clientHeight / 2 - y * current.zoom;
  current.fitted = false;
  positionBoard();
};
function switchDocument(id) {
  documentTools?.cancel();
  advanced?.cancel();
  photoLab?.cancel();
  pro?.cancel();
  finishText();
  if (gesture) cancelGesture();
  const next = sessions.find((s) => s.doc.id === id);
  if (!next) return;
  current = next;
  maskMode = false;
  renderUI();
  if (!current.fitted) positionBoard();
  requestRender();
}
async function closeDocument(id) {
  advanced?.collaboration.documentClosed(id);
  finishText();
  if (gesture) cancelGesture();
  const i = sessions.findIndex((s2) => s2.doc.id === id);
  if (i < 0) return;
  const s = sessions[i];
  try {
    await saveLocal(s.doc);
  } catch {
    toast("Save a .luma file before closing; local save is unavailable.", true);
    return;
  }
  clearTimeout(saveTimers.get(id));
  sessions.splice(i, 1);
  if (!sessions.length) {
    const d = createDocument();
    setDocument(d, "New canvas");
  } else if (current === s) {
    current = sessions[Math.max(0, i - 1)];
    renderUI();
    requestRender();
  } else renderTabs();
  assets.prune(sessions.map((s2) => s2.doc));
}
document.addEventListener("keydown", (e) => {
  const typing = e.target.closest("input,textarea,select,[contenteditable=true]"), command = e.ctrlKey || e.metaKey, key = e.key.toLowerCase();
  if(command&&key==="k"&&!$("#modal").open){e.preventDefault();runAction("commands");return;}
  if (command && key === "s" && !$("#modal").open) {
    e.preventDefault();
    finishText();
    runAction(e.shiftKey ? "export" : "save");
    return;
  }
  if(menuOpen&&["arrowdown","arrowup","home","end","escape"].includes(key)){e.preventDefault();const buttons=$$("#menu-popover button:not(:disabled)"),index=buttons.indexOf(document.activeElement);if(key==="escape"){closeMenu();return;}const next=key==="home"?0:key==="end"?buttons.length-1:key==="arrowdown"?(index+1)%buttons.length:index<0?buttons.length-1:(index-1+buttons.length)%buttons.length;buttons[next]?.focus();return;}
  if (typing) return;
  if ($("#modal").open) {
    if (key === "escape") closeModal(true);
    return;
  }
  if (!current) return;
  if (pro?.key(e)) return;
  if (key === "escape") {
    e.preventDefault();
    if(documentTools?.cancel())return;
    if (gesture) cancelGesture();
    else {
      closeMenu();
      doc().selection = null;
      maskMode = false;
      renderProperties();
      renderContext();
      renderOverlay();
    }
    return;
  }
  if (command) {
    if (key === "g") {
      e.preventDefault();
      runAction(e.altKey ? "clip" : e.shiftKey ? "ungroup" : "group");
      return;
    }
    if (key === "e") {
      e.preventDefault();
      runAction(e.shiftKey ? "flatten" : "merge-selected");
      return;
    }
    if (key === "t") {
      e.preventDefault();
      runAction("transform");
      return;
    }
    const map = { o: "open", s: e.shiftKey ? "export" : "save", z: e.shiftKey ? "redo" : "undo", y: "redo", j: "duplicate", a: "select-all", d: "deselect", k: "commands", n: "new", "0": "fit", "1": "zoom-100" };
    if (key === "i" && e.shiftKey) {
      e.preventDefault();
      runAction("invert-selection");
      return;
    }
    if (map[key]) {
      e.preventDefault();
      runAction(map[key]);
      return;
    }
  }
  if (e.code === "Space") {
    e.preventDefault();
    space = true;
    $("#stage").classList.add("hand-active");
    return;
  }
  if (key === "tab") {
    e.preventDefault();
    runAction("toggle-dock");
    return;
  }
  if (key === "delete" || key === "backspace") {
    e.preventDefault();
    runAction("delete");
    return;
  }
  if (key === "[" || key === "]") {
    brushSize = clamp(brushSize + (key === "[" ? -5 : 5), 1, 600);
    renderContext();
    renderOverlay();
    return;
  }
  if (key === "x") {
    runAction("swap-color");
    return;
  }
  if (key === "q") {
    toggleMaskMode();
    return;
  }
  if (["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)) {
    const l = layer();
    if (l && canEdit(doc(),l,"geometry") && l.type !== "adjustment") {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      moveObjects(doc(), roots(doc()).filter((x) => !effectiveLocked(doc(), x)), key === "arrowleft" ? -step : key === "arrowright" ? step : 0, key === "arrowup" ? -step : key === "arrowdown" ? step : 0);
      commit("Nudge layer");
    }
    return;
  }
  if (key === "+" || key === "=") {
    zoom(1.2);
    return;
  }
  if (key === "-") {
    zoom(1 / 1.2);
    return;
  }
  const t = tools.find(([name, label, k]) => k.toLowerCase() === key);
  if (key === "o" && e.shiftKey) setTool("burn");
  else if (key === "m" && e.shiftKey) setTool("ellipse");
  else if (t) setTool(t[0]);
});
document.addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    space = false;
    if (tool !== "hand") $("#stage").classList.remove("hand-active");
  }
});
window.addEventListener("blur", () => {
  space = false;
  if (gesture) cancelGesture();
});
document.addEventListener("paste", (e) => {
  if (e.target.closest("input,textarea,[contenteditable=true]")) return;
  const files = [...e.clipboardData?.files || []];
  if (files.length) {
    e.preventDefault();
    openFiles(files, true);
  }
});
document.addEventListener("keydown", (e) => {
  const row = e.target.closest("[data-layer],[data-document]");
  if (row && ["Enter", " "].includes(e.key)) {
    e.preventDefault();
    row.click();
  }
});
new ResizeObserver(() => {
  if (!current) return;
  if (current.fitted) fit();
  else positionBoard();
}).observe($("#stage"));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && current && !gesture) saveLocal(doc()).catch(() => {
  });
});
let tipTimer;
document.addEventListener("pointerover", (e) => {
  const el = e.target.closest("[title]");
  if (!el) return;
  clearTimeout(tipTimer);
  tipTimer = setTimeout(() => {
    const text = el.title;
    if (!text) return;
    const r = el.getBoundingClientRect(), tip = $("#tooltip");
    tip.textContent = text;
    tip.hidden = false;
    tip.style.left = clamp(r.right + 7, 6, window.innerWidth - tip.offsetWidth - 8) + "px";
    tip.style.top = clamp(r.top + (r.height - tip.offsetHeight) / 2, 6, window.innerHeight - tip.offsetHeight - 8) + "px";
  }, 600);
});
document.addEventListener("pointerout", () => {
  clearTimeout(tipTimer);
  $("#tooltip").hidden = true;
});
async function bootstrap() {
  icons();
  renderTools();
  renderContext();
  if (window.innerWidth <= 580) $("#app").classList.add("dock-collapsed");
  busy("Opening sample…");
  try {
    await document.fonts.ready;
    let d = null;
    try {
      const recent = await recentLocal();
      if (recent.length) {
        d = validateDocument(clone(recent[0].doc));
        await assets.hydrate(d);
      }
    } catch {
      d = null;
    }
    if (!d) {
      d = makeDemo();
      await assets.hydrate(d);
    }
    setDocument(d, "Document opened");
    render();
    busy("Ready");
  } catch (e) {
    console.error(e);
    toast("Sample could not load. Create a canvas or open your image.", true);
    setDocument(createDocument(), "New canvas");
  }
}
pro = createProStudio({ doc, layer, assets, commit, addLayer, setTool, showModal, closeModal, requestRender, renderUI, toast, runAction, foreground: () => foreground, tool: () => tool, zoom: () => current?.zoom || 1, overlay: renderOverlay, openStudio: () => {
  activePanel = "studio";
  $("#app").classList.remove("dock-collapsed");
  renderProperties();
} });
async function openPhotoSample(aged = false, openLab = true) {
  const image = await assets.load("assets/portrait-demo.jpg"), c = canvas(image.width, image.height), x = c.getContext("2d");
  x.drawImage(image, 0, 0);
  if (aged) {
    const p = x.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < p.data.length; i += 4) {
      const L = p.data[i] * 0.2126 + p.data[i + 1] * 0.7152 + p.data[i + 2] * 0.0722, v = 48 + L * 0.64;
      p.data[i] = v + 13;
      p.data[i + 1] = v + 4;
      p.data[i + 2] = v - 8;
    }
    x.putImageData(p, 0, 0);
    x.strokeStyle = "#e7dcc7";
    x.lineWidth = 2;
    for (const f of [0.2, 0.73]) {
      x.beginPath();
      x.moveTo(c.width * f, 0);
      x.lineTo(c.width * f + c.width * 0.016, c.height);
      x.stroke();
    }
  }
  const source = c.toDataURL();
  assets.set(source, c);
  const d = createDocument(c.width, c.height, aged ? "Ảnh cũ mô phỏng · demo" : "Portrait sample"), l = createLayer("image", { name: aged ? "Ảnh bạc màu + xước mô phỏng" : "Portrait sample · Pete Souza / public domain", source, width: c.width, height: c.height, locked: true });
  d.layers = [l];
  d.activeId = l.id;
  setDocument(d, "Open retouch sample");
  if (openLab) await photoLab.open(aged ? "restore" : "skin");
}
photoLab = createPhotoLab({ doc, layer, assets, commit, showModal, closeModal, toast, openSample: () => openPhotoSample(false), openRestoreSample: () => openPhotoSample(true), openGenerative: mode => advanced.generative.open(mode) });
function commitDocument(id,label) {
  const s=sessions.find(s=>s.doc.id===id);if(!s)return;
  s.history.push(s.doc,label);advanced?.collaboration.localCommitted(s.doc,label);scheduleSave(s);
  if(s===current){renderUI();requestRender();}
}
function applyShared(next,label) {
  const s=sessions.find(s=>s.doc.id===next.id);if(!s)return;
  if(s===current){if(gesture)cancelGesture();if(photoLab?.current()||advanced?.generative.current()||advanced?.cutout.current()||advanced?.removal.current()||advanced?.product.current()||advanced?.paper.current()||advanced?.colorEditor.current()||advanced?.landscape.current()||advanced?.scene.current()||advanced?.art.current())closeModal(true);photoLab?.cancel();advanced?.cancel();}
  s.doc=next;s.history.push(next,label);scheduleSave(s);
  if(s===current){renderUI();requestRender();}
}
function openSharedDocument(next) {
  validateDocument(next);
  finishText();
  if(gesture)cancelGesture();
  const existing=sessions.find(s=>s.doc.id===next.id);
  if(existing){
    const previousId=existing.doc.id,copyId=uid();
    clearTimeout(saveTimers.get(previousId));saveTimers.delete(previousId);
    existing.doc.id=copyId;existing.localCopy=true;
    for(const entry of existing.history.entries){const snapshot=JSON.parse(entry.snapshot);snapshot.id=copyId;entry.snapshot=JSON.stringify(snapshot);}
    advanced?.rebaseDocumentIdentity(previousId,copyId);
    scheduleSave(existing);
  }
  setDocument(next,'Nhận tài liệu cộng tác');
}
advanced=createAdvancedStudio({selectLayer:id=>{doc().activeId=id;doc().selectedIds=[id];renderUI();requestRender();},doc,layer,assets,commit,commitDocument,showModal,closeModal,toast,setDocument,readImageFile,runAction,foreground:()=>foreground,findDocument:id=>sessions.find(s=>s.doc.id===id)?.doc,openShared:openSharedDocument,applyShared});
Object.assign(actions,advanced.actions);actionItems.push(...advanced.actionItems);
menuItems.Layer.unshift('smart-convert','smart-edit','smart-replace','smart-independent','-');
menuItems.Image.push('-','color-studio');
menuItems.File.push('-','design-import','collaborate');
for(const [id,mode,title]of [['color-sample','garment','Mẫu đồ họa · Đổi màu vest'],['beverage-sample','beverage','Mẫu đồ họa · Đồ uống']]){actions[id]=async()=>{const {makeColorDemo}=await import('./color-demo.js'),demo=makeColorDemo(mode),c=demo.canvas,source=c.toDataURL(),d=createDocument(c.width,c.height,title);assets.set(source,c);const l=createLayer('image',{name:title+' · nguồn',source,width:c.width,height:c.height});d.layers=[l];d.activeId=l.id;d.selectedIds=[l.id];setDocument(d,title);advanced.colorEditor.open(mode,demo.mask);};actionItems.push([id,title,'image','']);}
actions['art-sample']=async()=>{const im=await assets.load('assets/art-crab.png'),c=canvas(im.width,im.height);c.getContext('2d').drawImage(im,0,0);const source=c.toDataURL(),d=createDocument(c.width,c.height,'Cua mẫu · AI-generated');assets.set(source,c);const l=createLayer('image',{name:'Cua mẫu do AI tạo · nguồn',source,width:c.width,height:c.height});d.layers=[l];d.activeId=l.id;d.selectedIds=[l.id];setDocument(d,'Mở mẫu Art');advanced.art.open('dots');};
actionItems.push(['art-sample','Ảnh mẫu · Photo → Art & Pattern','sparkles','']);
actions['scene-sample']=async()=>{const im=await assets.load('assets/scene-demo.png'),c=canvas(im.width,im.height);c.getContext('2d').drawImage(im,0,0);const source=c.toDataURL(),d=createDocument(c.width,c.height,'Cảnh mẫu · AI-generated');assets.set(source,c);const l=createLayer('image',{name:'Cảnh mẫu do AI tạo · nguồn',source,width:c.width,height:c.height});d.layers=[l];d.activeId=l.id;d.selectedIds=[l.id];setDocument(d,'Mở cảnh mẫu');advanced.scene.open('auto');};
actionItems.push(['scene-sample','Ảnh mẫu · Preset, chuyển mùa & ngày đêm','image','']);
actions["landscape-sample"]=async()=>{const {makeLandscapeDemo}=await import('./landscape-demo.js'),c=makeLandscapeDemo(),source=c.toDataURL(),d=createDocument(c.width,c.height,'Mẫu đồ họa · Phong cảnh');assets.set(source,c);const l=createLayer('image',{name:'Mẫu đồ họa · Phong cảnh · nguồn',source,width:c.width,height:c.height});d.layers=[l];d.activeId=l.id;d.selectedIds=[l.id];setDocument(d,'Mẫu phong cảnh');advanced.landscape.open();};
actionItems.push(['landscape-sample','Mẫu đồ họa · Phong cảnh HDR','image','']);
actions["paper-sample"] = async () => { const {makePaperDemo}=await import('./paper-demo.js'), c=makePaperDemo(), source=c.toDataURL(), d=createDocument(c.width,c.height,'Trang thử · Làm sạch tài liệu'); assets.set(source,c); const l=createLayer('image',{name:'Trang thử · nguồn',source,width:c.width,height:c.height}); d.layers=[l]; d.activeId=l.id; d.selectedIds=[l.id]; setDocument(d,'Trang thử tài liệu'); advanced.paper.open(); };
actionItems.push(['paper-sample','Ảnh mẫu · Làm sạch tài liệu','image','']);
actions["cutout-sample"] = async () => { await openPhotoSample(false, false); advanced.cutout.open("portrait"); };
actions["retouch-sample"] = () => openPhotoSample(false);
actions["restore-sample"] = () => openPhotoSample(true);
actionItems.push(["cutout-sample", "Ảnh mẫu · Tách nền & tóc", "mask", ""], ["retouch-sample", "Ảnh mẫu · Retouch chân dung", "image", ""], ["restore-sample", "Ảnh mẫu · Phục hồi ảnh cũ mô phỏng", "history", ""]);
Object.assign(actions, photoLab.actions);
actionItems.push(...photoLab.actionItems);
Object.assign(actions, pro.actions);
actionItems.push(...pro.actionItems);
actions['photo-tools']=()=>workspace.open('photo');actions['ai-tools']=()=>workspace.open('ai-tools');actions['advanced-tools']=()=>workspace.open('advanced');actions['workspace-files']=()=>workspace.open('uploads');
actionItems.push(['photo-tools','Chỉnh ảnh · tất cả công cụ','sliders',''],['ai-tools','AI · tạo sinh và phục hồi','sparkles',''],['advanced-tools','Nâng cao · layer, màu in & cộng tác','layers',''],['workspace-files','Tệp · ảnh, PSD và dự án','folder-open','']);
menuItems.Filter=['photo-tools','filters','compare','-','ai-tools'];
menuItems.Type = ["add-text", "type-studio", "import-font", "styles"];
menuItems.File.splice(6, 0, "export-svg", "export-pack");
menuItems.Layer.unshift("group", "ungroup", "clip", "merge-selected", "rasterize", "transform", "-");
menuItems.Select.push("-", "cutout-studio", "cutout-object", "cutout-hair", "refine-selection");
menuItems.View=["photo-tools","templates","workspace-files","ai-tools","advanced-tools","-","fit","zoom-100","grid","toggle-dock","-","guides","snap","view-channels","compare"];
$("#layer-search").oninput = (e) => {
  layerQuery = e.target.value;
  renderLayers();
};
$("#layer-kind").onchange = (e) => {
  layerKind = e.target.value;
  renderLayers();
};
documentTools=createDocumentTools({doc,layer,assets,commit,addLayer,renderUI,requestRender,toast,setTool,showModal,closeModal,foreground:()=>foreground,tool:()=>tool,zoom:()=>current?.zoom||1,brushSize:()=>brushSize,brushOpacity:()=>brushOpacity,setChannel:v=>pro.setView(v),refreshPanels:renderUI,overlay:renderOverlay});
Object.assign(actions,documentTools.actions);actionItems.push(...documentTools.actionItems);
actions["type-studio"]=()=>openTypeStudio({doc,layer,commit,showModal,closeModal,toast,requestRender,renderUI});actionItems.push(["type-studio","Type Studio · định dạng chữ theo vùng","text",""]);
actions['core-sample']=async()=>{const{coreDemo}=await import('./core-demo.js');setDocument(coreDemo(),'Mẫu Luma8');setTool('move');fit();};actionItems.push(['core-sample','Mẫu Luma8 · Layer, alpha, path & chữ','layers','']);
actions["target-layer"]=()=>{maskMode=false;renderContext();};actions["target-mask"]=()=>{if(!layer()?.mask)throw Error("Lớp chưa có mask.");setTool("move");maskMode=true;renderContext();};
desktop=createDesktopUI({doc,layer,assets,documentTools,foreground:()=>foreground,setForeground:value=>{foreground=value;$("#foreground").value=value;},commit,addLayer,renderUI,renderLayers,renderHistory,requestRender,runAction,setTool,toast,canvasPoint:pointOnCanvas,selected:()=>selected(doc()),channel:()=>pro.view(),setChannel:v=>pro.setView(v),selectLayer:id=>{documentTools.exitAlpha();documentTools.clearPath();selectLayer(doc(),id);activePanel='properties';maskMode=false;renderUI();requestRender();},openStyles:stylesModal,openFilters:id=>pro.openFilters(id),onLayout:()=>{if(current){positionBoard();requestRender();}}});
Object.assign(actions,desktop.actions);actionItems.push(...desktop.actionItems);
const cursorTheme=createCursorTheme({showModal,closeModal,toast});
Object.assign(actions,cursorTheme.actions);actionItems.push(...cursorTheme.actionItems);
menuItems.Edit.push('-','cursor-preferences');
actions['select-mask']=pro.actions['refine-selection'];actionItems.push(['select-mask','Select & Mask · tinh chỉnh vùng chọn','mask','']);
menuItems.View=['fit','zoom-100','-','grid','guides','snap','-','view-channels','compare'];
actions['view-channels']=()=>desktop.layerTab('channels');
menuItems.Window=['workspace-photo','workspace-design','workspace-retouch','-','panel-color','panel-properties','panel-info','panel-layers','panel-channels','panel-paths','panel-history','-','toggle-dock','workspace-reset'];
menuItems.Layer=['add-paint','add-text','add-shape','adjustments','-','group','ungroup','duplicate','merge-selected','-','transform','flip-x','flip-y','-','add-mask','clip','styles','filters','-','smart-convert','smart-edit','smart-replace','smart-independent','-','rename-layer','lock','up','down','delete'];
menuItems.Select=['select-all','deselect','invert-selection','-','select-mask','add-mask','-','cutout-studio','cutout-object','cutout-hair'];
const platform=createPlatformStudio({doc,assets,openFiles,commit,showModal,closeModal,runAction,toast});
actions['canva-connect']=platform.openCanva;actions['platform-status']=platform.compatibility;
actionItems.push(['canva-connect','Canva · mở native & retouch','image',''],['platform-status','Windows, PSD, Canva & kiểm chứng GPU','check','']);
menuItems.File.push('-','canva-connect','platform-status');
workspace = createWorkspace({ doc, layer, assets, addLayer, commit, setDocument, setTool, fit, toast });
bootstrap().then(()=>window.lumaDesktop?.ready());
menuItems.Select.push("-","alpha-save","alpha-load","-","path-from-selection","path-save-layer","path-to-selection");
const studio = { getDocument: () => clone(doc()), getHistory: () => current ? { index: current.history.index, labels: current.history.entries.map((e) => e.label) } : null, runAction, setTool, addAdjustment, openFiles, workspace, photoLab, pro, advanced, desktop, documentTools, assets, setDocument, openSharedDocument, ready: () => !!current };
export {
  studio
};
