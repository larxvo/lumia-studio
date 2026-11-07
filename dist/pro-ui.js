import {retouchPatch} from './retouch-brush.js';
import {assertCanEdit,canEdit} from './layer-policy.js';
import { createLayer, clone, uid, clamp, MAX_PIXELS } from "./model.js";
import { ancestors, children, subtree, selected, roots, bounds, refreshGroups, groupSelection, ungroup, duplicateObjects, deleteObjects, reorderObject, alignObjects, distribute, affineGeometry, effectiveLocked, snapDelta } from "./pro-model.js";
import { canvas, renderDocument, renderLayer, maskCanvas } from "./renderer.js";
import { FILTERS, morphAlpha } from "./filters.js";
import { exportSvg, zipFiles } from "./pro-export.js";
import { downloadBlob } from "./storage.js";
import { icon } from "./icons.js";
const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)], esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const nice = (s) => s.replace(/(^|[- ])\w/g, (m) => m.toUpperCase()).replaceAll("-", " ");
const actionButton = (id, label, ic = "plus") => `<button class="studio-action" data-action="${id}">${icon(ic)}<span>${label}</span>${icon("chevron-right")}</button>`;
function createProStudio(api) {
  let snap = true, snapLines = [], view = "composite", compare = false, styleClipboard = null, retouch = { size: 60, strength: 40, hardness: 40,aligned:true,range:"all" }, sample = null,sampleDocId=null, cloneOffset = null, stroke = null, pen = [],penUndone=[], penDrag = null, penHover = null;
  const d = api.doc, l = api.layer;
  const change = (name, run) => () => {
    run();
    api.commit(name);
  };
  const editable = () => {
    const x = l();
    if (!x || effectiveLocked(d(), x)) throw new Error("Select an unlocked layer first.");
    return x;
  };
  function transformMasks(list, matrix,{forceDocument=false,width=d().width,height=d().height}={}) {
    for (const x of list) {
      if (!x.mask||!forceDocument&&x.mask.linked===false) continue;
      const c = canvas(width,height), ctx = c.getContext("2d");
      ctx.setTransform(...matrix);
      ctx.drawImage(maskCanvas(d(), {...x.mask,density:100}, 1, api.assets), 0, 0);
      const source = c.toDataURL();
      api.assets.set(source, c);
      x.mask = { type: "paint", source, x: 0, y: 0, width, height, feather: 0, invert: false,linked:x.mask.linked!==false,disabled:!!x.mask.disabled,density:x.mask.density??100 };
    }
  }
  function transformModal() {
    const list = roots(d()).filter((x) => x.type !== "adjustment" && !effectiveLocked(d(), x));
    if (!list.length) throw new Error("Select an unlocked layer first.");
    assertCanEdit(d(),list,"geometry",{descendants:true});
    const box = bounds(list);
    api.showModal("Transform selection", "Uniform scaling keeps rotated layers, type and masks together.", `<div class="modal-grid"><label class="modal-field">Scale (%)<input id="transform-scale" type="number" min="1" max="1000" value="100"></label><label class="modal-field">Rotation (\xB0)<input id="transform-angle" type="number" min="-360" max="360" value="0"></label><label class="modal-field">Move X (px)<input id="transform-x" type="number" value="0"></label><label class="modal-field">Move Y (px)<input id="transform-y" type="number" value="0"></label></div><p>${list.length} selected \xB7 ${Math.round(box.width)} \xD7 ${Math.round(box.height)} px</p>`, [{ label: "Cancel", run: () => api.closeModal(true) }, { label: "Apply transform", primary: true, run: () => {
      try {
        const scale = Number($("#transform-scale").value) / 100, angle = Number($("#transform-angle").value), dx = Number($("#transform-x").value), dy = Number($("#transform-y").value), cx = box.x + box.width / 2, cy = box.y + box.height / 2, affected = roots(d(), list).flatMap((x) => subtree(d(), x.id));
        if (scale <= 0 || scale > 10) throw new Error("Use a scale between 1% and 1000%.");
        const a = angle * Math.PI / 180, c = Math.cos(a) * scale, s = Math.sin(a) * scale, m = [c, s, -s, c, cx - c * cx + s * cy + dx, cy - s * cx - c * cy + dy];
        const backup = clone(d());
        try {
          transformMasks(affected, m);
          affineGeometry(d(), list, { cx, cy, sx: scale, sy: scale, angle, dx, dy });
        } catch (e) {
          Object.assign(d(), backup);
          throw e;
        }
        api.closeModal();
        api.commit("Transform selection");
      } catch (e) {
        api.toast(e.message, true);
      }
    } }]);
  }
  function rasterize() {
    assertCanEdit(d(),roots(d()),"destructive",{descendants:true});
    const target = editable();
    if (target.type === "adjustment") throw new Error("Merge an adjustment with a pixel layer or flatten the document.");
    if (target.type === "group" && target.blend === "pass-through") throw new Error("Choose Normal blending before rasterizing a pass-through group.");
    const c = renderLayer(d(), target, api.assets), source = c.toDataURL();
    api.assets.set(source, c);
    const ids = new Set(subtree(d(), target.id).map((x) => x.id)), at = d().layers.indexOf(target), newLayer = createLayer("image", { name: target.name + " \xB7 raster", source, width: d().width, height: d().height, parentId: target.parentId || null, opacity: target.opacity, blend: target.blend, clipToBelow: !!target.clipToBelow, visible: target.visible });
    d().layers = d().layers.filter((x) => !ids.has(x.id));
    d().layers.splice(at, 0, newLayer);
    d().activeId = newLayer.id;
    d().selectedIds = [newLayer.id];
    api.commit("Rasterize layer");
  }
  function merge() {
    assertCanEdit(d(),roots(d()),"destructive",{descendants:true});
    const list = roots(d());
    if (list.length < 2) throw new Error("Select at least two adjacent layers.");
    const parent = list[0].parentId || null, siblings = children(d(), parent), indices = list.map((x) => siblings.indexOf(x)).sort((a, b) => a - b);
    if (list.some((x) => (x.parentId || null) !== parent || x.type === "adjustment" || effectiveLocked(d(), x) || x.clipToBelow || x.blend !== "normal") || indices.at(-1) - indices[0] + 1 !== indices.length) throw new Error("Merge adjacent unlocked layers with Normal blending in the same group. Rasterize groups first if needed.");
    const ids = new Set(list.flatMap((x) => subtree(d(), x.id).map((x2) => x2.id))), local = { ...d(), layers: clone(d().layers.filter((x) => ids.has(x.id))) };
    for (const x of local.layers) if (list.some((r) => r.id === x.id)) x.parentId = null;
    const c = renderDocument(local, api.assets), source = c.toDataURL();
    api.assets.set(source, c);
    const at = Math.min(...list.map((x) => d().layers.indexOf(x))), merged = createLayer("image", { name: "Merged layers", source, width: d().width, height: d().height, parentId: parent });
    d().layers = d().layers.filter((x) => !ids.has(x.id));
    d().layers.splice(at, 0, merged);
    d().activeId = merged.id;
    d().selectedIds = [merged.id];
    api.commit("Merge selected layers");
  }
  function toggleClip() {
    const target = editable(), siblings = children(d(), target.parentId || null), i = siblings.indexOf(target);
    if (!target.clipToBelow && i === 0) throw new Error("Place a base layer below this layer first.");
    target.clipToBelow = !target.clipToBelow;
    api.commit(target.clipToBelow ? "Create clipping mask" : "Release clipping mask");
  }
  function filtersModal(initialId) {
    assertCanEdit(d(),[l()],"replacepixels");
    const target = editable();
    if (target.type === "adjustment") throw new Error("Select a pixel, text, shape or group layer.");
    target.filters ||= [];
    const original = clone(target.filters);
    let active = target.filters.find(f=>f.id===initialId)?.id || target.filters[0]?.id || null;
    api.showModal("Live filters", target.name + " \xB7 filters stay editable in .luma projects", `<div class="live-filter-layout"><div><select id="filter-kind" aria-label="Filter type">${Object.entries(FILTERS).map(([k, f]) => `<option value="${k}">${f.name}</option>`).join("")}</select><button class="button primary" id="filter-add">Add filter</button><div id="filter-stack"></div></div><div><img id="live-filter-preview" class="effect-preview" alt="Live filter preview"><div id="live-filter-controls"></div></div></div>`, [{ label: "Cancel", run: () => api.closeModal(true) }, { label: "Keep live filters", primary: true, run: () => {
      api.closeModal();
      api.commit("Edit live filter stack");
    } }], () => {
      const preview = () => {
        api.requestRender();
        $("#live-filter-preview").src = renderLayer(d(), target, api.assets, Math.min(1, 420 / Math.max(d().width, d().height))).toDataURL();
      };
      function render() {
        const current = target.filters.find((f) => f.id === active);
        $("#filter-stack").innerHTML = target.filters.map((f) => `<div class="filter-stack-row ${f.id === active ? "active" : ""}"><button data-f-toggle="${f.id}" title="Toggle filter">${icon(f.visible === false ? "eye-off" : "eye")}</button><button data-f-select="${f.id}">${esc(FILTERS[f.type].name)}</button><button data-f-up="${f.id}" title="Move earlier">\u2191</button><button data-f-delete="${f.id}" title="Remove filter">${icon("x")}</button></div>`).join("") || '<p class="library-hint">Add a filter to begin.</p>';
        $("#live-filter-controls").innerHTML = current ? Object.entries(current.params).map(([key2, value]) => `<label class="filter-param">${nice(key2)} <input type="number" data-filter-param="${key2}" min="${key2 === "radius" || key2 === "size" ? 1 : 0}" max="${key2 === "radius" ? 40 : key2 === "size" ? 200 : key2 === "threshold" ? 255 : 200}" value="${value}" aria-label="Filter ${key2}"></label>`).join("") : "<p>Filters do not replace the original pixels.</p>";
        $$("[data-f-select]").forEach((b) => b.onclick = () => {
          active = b.dataset.fSelect;
          render();
        });
        $$("[data-f-toggle]").forEach((b) => b.onclick = () => {
          const f = target.filters.find((f2) => f2.id === b.dataset.fToggle);
          f.visible = f.visible === false;
          render();
        });
        $$("[data-f-delete]").forEach((b) => b.onclick = () => {
          target.filters = target.filters.filter((f) => f.id !== b.dataset.fDelete);
          active = target.filters[0]?.id;
          render();
        });
        $$("[data-f-up]").forEach((b) => b.onclick = () => {
          const i = target.filters.findIndex((f) => f.id === b.dataset.fUp);
          if (i > 0) [target.filters[i - 1], target.filters[i]] = [target.filters[i], target.filters[i - 1]];
          render();
        });
        $$("[data-filter-param]").forEach((input) => input.oninput = () => {
          const n = Number(input.value);
          if (!Number.isFinite(n)) return;
          current.params[input.dataset.filterParam] = clamp(n, Number(input.getAttribute("min")), Number(input.getAttribute("max")));
          preview();
        });
        preview();
      }
      $("#filter-add").onclick = () => {
        if (target.filters.length >= 12) {
          api.toast("Use at most 12 live filters per layer.");
          return;
        }
        const type = $("#filter-kind").value, f = { id: uid(), type, params: clone(FILTERS[type].params), visible: true };
        target.filters.push(f);
        active = f.id;
        render();
      };
      render();
    }, () => {
      target.filters = original;
      api.requestRender();
      api.renderUI();
    });
  }
  function selectionRefine() {
    if (!d().selection) throw new Error("Draw or generate a selection first.");
    const original = clone(d().selection);
    api.showModal("Refine selection", "Feather softens the selection; Expand and Contract change its boundary.", `<label class="modal-field">Đầu ra<select id="refine-output"><option value="selection">Giữ vùng chọn</option><option value="mask">Tạo / thay mask lớp</option></select></label><label class="modal-field">Feather (px)<input id="refine-feather" type="number" min="0" max="100" value="${original.feather || 0}"></label><label class="modal-field">Expand / Contract (px)<input id="refine-expand" type="number" min="-50" max="50" value="0"></label>`, [{ label: "Cancel", run: () => api.closeModal(true) }, { label: "Apply selection", primary: true, run: () => {
      const feather = clamp(Number($("#refine-feather").value) || 0, 0, 100), amount = clamp(Math.round(Number($("#refine-expand").value) || 0), -50, 50);
      let selection = clone(original);
      if (amount) {
        const c = maskCanvas(d(), selection, 1, api.assets), x = c.getContext("2d"), pixels = x.getImageData(0, 0, c.width, c.height), out = morphAlpha(pixels.data, c.width, c.height, amount);
        pixels.data.set(out);
        x.putImageData(pixels, 0, 0);
        const source = c.toDataURL();
        api.assets.set(source, c);
        selection = { type: "paint", source, x: 0, y: 0, width: d().width, height: d().height, invert: false };
      }
      selection.feather = feather;
      if($("#refine-output").value==="mask"){const target=editable();target.mask=selection;d().selection=null;}else d().selection = selection;
      api.closeModal();
      api.commit("Refine selection");
    } }]);
  }
  function guidesModal() {
    api.showModal("Guides & snapping", "Document guides are saved with your .luma project.", `<div class="modal-grid"><label class="modal-field">Axis<select id="guide-axis"><option value="x">Vertical</option><option value="y">Horizontal</option></select></label><label class="modal-field">Position (px)<input id="guide-position" type="number" value="${Math.round(d().width / 2)}"></label></div><button class="button primary" id="guide-add">Add guide</button><div id="guide-list"></div><label class="check-row"><input id="snap-enabled" type="checkbox" ${snap ? "checked" : ""}> Snap to guides, canvas and other layers</label>`, [{ label: "Clear guides", run: () => {
      d().guides = [];
      api.commit("Clear guides");
      api.closeModal();
    } }, { label: "Done", primary: true, run: () => api.closeModal() }], () => {
      const render = () => {
        $("#guide-list").innerHTML = (d().guides || []).map((g, i) => `<div class="guide-row">${g.axis === "x" ? "Vertical" : "Horizontal"} \xB7 ${g.position} px <button data-remove-guide="${i}" aria-label="Remove guide ${i + 1}">${icon("x")}</button></div>`).join("");
        $$("[data-remove-guide]").forEach((b) => b.onclick = () => {
          d().guides.splice(Number(b.dataset.removeGuide), 1);
          api.commit("Remove guide");
          render();
        });
      };
      $("#guide-add").onclick = () => {
        const axis = $("#guide-axis").value, position = Number($("#guide-position").value);
        if (!Number.isFinite(position) || position < 0 || position > (axis === "x" ? d().width : d().height)) {
          api.toast("Place the guide inside the canvas.");
          return;
        }
        if ((d().guides || []).length >= 50) return;
        (d().guides ||= []).push({ axis, position });
        api.commit("Add guide");
        render();
      };
      $("#snap-enabled").onchange = (e) => {
        snap = e.target.checked;
      };
      render();
    });
  }
  function batchExport() {
    const presets = [["original", "Original", d().width, d().height], ["square", "Square", 1080, 1080], ["portrait", "Portrait", 1080, 1350], ["story", "Story", 1080, 1920], ["wide", "Landscape", 1920, 1080]];
    api.showModal("Export a size pack", "Creates a ZIP of PNGs. Fit keeps the whole design; Fill crops its edges.", `${presets.map(([id, n, w, h], i) => `<label class="check-row"><input type="checkbox" data-export-preset="${id}" ${i === 0 ? "checked" : ""}> ${n} <small>${w} \xD7 ${h}</small></label>`).join("")}<div class="modal-grid"><label class="modal-field">Layout<select id="pack-layout"><option value="fit">Fit \xB7 transparent padding</option><option value="fill">Fill \xB7 center crop</option><option value="stretch">Stretch \xB7 rescale proportions</option></select></label><label class="modal-field">Background<select id="pack-bg"><option value="transparent">Transparent</option><option value="#ffffff">White</option><option value="#191c20">Dark</option></select></label></div><p id="pack-progress">Your editable document remains unchanged.</p>`, [{ label: "Cancel", run: () => api.closeModal(true) }, { label: "Export ZIP", primary: true, run: async () => {
      const button = $('[data-modal-button="1"]');
      try {
        const choices = $$("[data-export-preset]").filter((x) => x.checked).map((x) => presets.find((p) => p[0] === x.dataset.exportPreset));
        if (!choices.length) throw new Error("Choose at least one size.");
        button.disabled = true;
        const original = renderDocument(d(), api.assets), files = [], mode = $("#pack-layout").value, bg = $("#pack-bg").value;
        for (const [id, name, w, h] of choices) {
          $("#pack-progress").textContent = "Rendering " + name + "\u2026";
          await new Promise((r) => requestAnimationFrame(r));
          const c = canvas(w, h), x = c.getContext("2d");
          if (bg !== "transparent") {
            x.fillStyle = bg;
            x.fillRect(0, 0, w, h);
          }
          const s = mode === "fill" ? Math.max(w / original.width, h / original.height) : Math.min(w / original.width, h / original.height), dw = mode === "stretch" ? w : original.width * s, dh = mode === "stretch" ? h : original.height * s;
          x.drawImage(original, (w - dw) / 2, (h - dh) / 2, dw, dh);
          const blob = await new Promise((r) => c.toBlob(r, "image/png"));
          if (!blob) throw new Error("This browser could not encode PNG.");
          files.push({ name: `${d().name.replace(/[^a-z0-9_-]/gi, "-")}-${id}-${w}x${h}.png`, data: blob });
        }
        downloadBlob(await zipFiles(files), "luma-size-pack.zip");
        api.closeModal();
        api.toast("Size pack exported.");
      } catch (e) {
        api.toast(e.message, true);
        if (button) button.disabled = false;
      }
    } }]);
  }
  function svgExport() {
    const r = exportSvg(d(), api.assets);
    downloadBlob(new Blob([r.svg], { type: "image/svg+xml" }), d().name.replace(/[<>:"/\\|?*]/g, "-") + ".svg");
    api.toast(r.notes.length ? r.notes.join(" ") : "SVG exported with editable text and vector shapes.");
  }
  function importFont() {
    let input = $("#font-input");
    if (!input) {
      input = document.createElement("input");
      input.type = "file";
      input.id = "font-input";
      input.accept = ".woff,.woff2,.ttf,.otf";
      input.hidden = true;
      document.body.append(input);
      input.onchange = async () => {
        try {
          const file = input.files[0];
          if (!file) return;
          const targetDoc = d(), extension = file.name.split(".").at(-1).toLowerCase();
          if (!["woff", "woff2", "ttf", "otf"].includes(extension)) throw new Error("Choose a WOFF, WOFF2, TTF or OTF font.");
          if (file.size > 25e5) throw new Error("Choose a font smaller than 2.5 MB.");
          if ((d().fonts || []).length >= 8) throw new Error("Use at most 8 embedded fonts per project.");
          const family = "LumaFont_" + uid(), source = await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result);
            r.onerror = reject;
            r.readAsDataURL(file);
          }), font = { family, name: file.name.slice(0, 100), source: source.replace(/^data:[^;]*;base64,/, `data:font/${extension};base64,`) };
          await api.assets.loadFont(font);
          if (d().id !== targetDoc.id) throw new Error("The document changed while loading this font. Import it again in the intended document.");
          (d().fonts ||= []).push(font);
          if (l()?.type === "text" && !effectiveLocked(d(), l())) l().font = family;
          api.commit("Import font");
          api.toast("Font embedded in this project. Use fonts you are licensed to share.");
        } catch (e) {
          api.toast(e.message, true);
        } finally {
          input.value = "";
        }
      };
    }
    input.click();
  }
  function finishPen() {
    if (pen.length < 2) {
      api.toast("Add at least two anchor points.");
      return;
    }
    const all = pen.flatMap((p) => [[p.x, p.y], [p.x - p.dx, p.y - p.dy], [p.x + p.dx, p.y + p.dy]]), x = Math.min(...all.map((p) => p[0])), y = Math.min(...all.map((p) => p[1])), w = Math.max(1, Math.max(...all.map((p) => p[0])) - x), h = Math.max(1, Math.max(...all.map((p) => p[1])) - y);
    if (w * h > MAX_PIXELS) throw new Error("This path exceeds supported dimensions.");
    const path = [["M", pen[0].x - x, pen[0].y - y]];
    for (let i = 1; i < pen.length; i++) {
      const a = pen[i - 1], b = pen[i];
      path.push(["C", a.x + a.dx - x, a.y + a.dy - y, b.x - b.dx - x, b.y - b.dy - y, b.x - x, b.y - y]);
    }
    if (pen.length > 2) {
      const a = pen.at(-1), b = pen[0];
      path.push(["C", a.x + a.dx - x, a.y + a.dy - y, b.x - b.dx - x, b.y - b.dy - y, b.x - x, b.y - y], ["Z"]);
    }
    const pathLayer = createLayer("shape", { name: "Bezier path", shape: "path", path, pathWidth: w, pathHeight: h, x, y, width: w, height: h, color: api.foreground(), fillEnabled: pen.length > 2 });
    if (pen.length === 2) Object.assign(pathLayer.effects, { stroke: true, strokeColor: api.foreground(), strokeWidth: 3 });
    api.addLayer(pathLayer);
    pen = [];penUndone=[];
    penDrag = null;
    api.setTool("move");
  }
  function retouchDown(e, p, tool) {
    if(sampleDocId!==d().id){sample=null;cloneOffset=null;sampleDocId=d().id;}
    if (e.altKey && ["clone", "heal"].includes(tool)) {
      sample = { ...p };
      cloneOffset = null;
      api.toast("Sample set. Paint to retouch on a separate layer.");
      api.overlay();
      return true;
    }
    if (["clone", "heal"].includes(tool) && !sample) {
      api.toast("Alt-click a source point first.");
      return true;
    }
    const ref = renderDocument(d(), api.assets), sourceData = ref.getContext("2d").getImageData(0, 0, ref.width, ref.height).data, name = "Retouch \xB7 " + nice(tool);
    let target = l();
    const before = clone(d());
    if (!target || target.type !== "paint" || target.name !== name || target.parentId || effectiveLocked(d(), target) || target.x !== 0 || target.y !== 0 || target.rotation || target.width !== d().width || target.height !== d().height) {
      if (d().layers.length >= 150) throw new Error("Project layer limit reached.");
      target = createLayer("paint", { name, source: canvas(d().width, d().height).toDataURL(), width: d().width, height: d().height });
      d().layers.push(target);
      d().activeId = target.id;
      d().selectedIds = [target.id];
    }
    const out = canvas(d().width, d().height), image = api.assets.get(target.source);
    if (image) out.getContext("2d").drawImage(image, 0, 0);
    const working = "retouch-" + target.id;
    api.assets.set(working, out);
    target.source = working;
    if(!retouch.aligned)cloneOffset=null;
    if (sample && !cloneOffset) cloneOffset = { x: sample.x - p.x, y: sample.y - p.y };
    stroke = {pointerId:e.pointerId, docId: d().id, target, before, out, sourceData, width: ref.width, height: ref.height, last: p, tool, working, selection: d().selection ? maskCanvas(d(), d().selection, 1, api.assets).getContext("2d").getImageData(0, 0, d().width, d().height).data : null };
    ref.width=ref.height=1;
    stamp(p, e);
    api.renderUI();
    return true;
  }
  function stamp(p, e) {
    const g = stroke;
    if (!g) return;
    const radius = retouch.size / 2, ox = Math.max(0, Math.floor(p.x - radius)), oy = Math.max(0, Math.floor(p.y - radius)), w = Math.min(g.width - ox, Math.ceil(radius * 2 + 2)), h = Math.min(g.height - oy, Math.ceil(radius * 2 + 2));
    if (w < 1 || h < 1) return;
    const x=g.out.getContext('2d'),patch=x.getImageData(ox,oy,w,h),pressure=e.pointerType==='pen'?Math.max(.1,e.pressure||.5):1;
    retouchPatch({patch,source:g.sourceData,width:g.width,height:g.height,left:ox,top:oy,point:p,radius,hardness:retouch.hardness/100,strength:retouch.strength/100*pressure,tool:g.tool,offset:cloneOffset||{x:0,y:0},selection:g.selection,range:retouch.range});
    api.assets.touch(g.working);
    x.putImageData(patch, ox, oy);
    api.requestRender();
  }
  function context(tool) {
    if (["clone", "heal", "dodge", "burn"].includes(tool)) return `<span class="context-extra">${["clone", "heal"].includes(tool) ? "Alt-click source \xB7 Paint on a separate retouch layer" : "Paint on a separate retouch layer"}</span><label>Size <input type="number" data-retouch="size" min="4" max="400" value="${retouch.size}"> px</label><label>Strength <input type="number" data-retouch="strength" min="1" max="100" value="${retouch.strength}"> %</label><label>Hardness <input type="number" data-retouch="hardness" min="0" max="100" value="${retouch.hardness}"> %</label>${['clone','heal'].includes(tool)?`<label><input id="retouch-aligned" type="checkbox" ${retouch.aligned?'checked':''}> Aligned</label>`:`<select id="retouch-range" aria-label="Tonal range">${['all','shadows','midtones','highlights'].map(v=>`<option value="${v}" ${retouch.range===v?'selected':''}>${nice(v)}</option>`).join('')}</select>`}`;
    if (tool === "pen") return '<span class="context-extra">Click for corners \xB7 Drag for curve handles \xB7 Enter to finish</span><button class="button" data-action="finish-path">Finish path</button><button class="button" data-action="cancel-path">Cancel path</button>';
    return null;
  }
  function bindContext() {
    const aligned=$('#retouch-aligned'),range=$('#retouch-range');if(aligned)aligned.onchange=()=>{retouch.aligned=aligned.checked;cloneOffset=null;};if(range)range.onchange=()=>retouch.range=range.value;
    $$("[data-retouch]").forEach((input) => input.onchange = () => {
      retouch[input.dataset.retouch] = clamp(Number(input.value) || 0, Number(input.getAttribute("min")), Number(input.getAttribute("max")));
      input.value = retouch[input.dataset.retouch];
    });
  }
  function pointerDown(e, p) {
    const tool = api.tool();
    if (["clone", "heal", "dodge", "burn"].includes(tool)) return retouchDown(e, p, tool);
    if (tool === "pen") {
      if (pen.length >= 100) {
        api.toast("Finish this path before adding more points.");
        return true;
      }
      if (pen.length > 2 && Math.hypot(p.x - pen[0].x, p.y - pen[0].y) * api.zoom() < 10) {
        finishPen();
        return true;
      }
      const anchor = { x: p.x, y: p.y, dx: 0, dy: 0 };
      penUndone=[];pen.push(anchor);
      penDrag = anchor;
      penHover = p;
      api.overlay();
      return true;
    }
    return false;
  }
  function pointerMove(e, p) {
    if (stroke) {
      if(e.pointerId!==undefined&&stroke.pointerId!==e.pointerId)return true;
      const step = Math.max(1, retouch.size / 8), distance = Math.hypot(p.x - stroke.last.x, p.y - stroke.last.y), n = Math.max(1, Math.ceil(distance / step)), a = stroke.last;
      for (let i = 1; i <= n; i++) stamp({ x: a.x + (p.x - a.x) * i / n, y: a.y + (p.y - a.y) * i / n }, e);
      stroke.last = p;
      return true;
    }
    if (api.tool() === "pen" && pen.length) {
      penHover = p;
      if (penDrag) {
        penDrag.dx = p.x - penDrag.x;
        penDrag.dy = p.y - penDrag.y;
      }
      api.overlay();
      return true;
    }
    return false;
  }
  function pointerUp(e,p) {
    if(stroke&&e?.pointerId!==undefined&&stroke.pointerId!==e.pointerId)return true;
    if(stroke&&p&&Math.hypot(p.x-stroke.last.x,p.y-stroke.last.y)>.01)pointerMove(e,p);
    if (stroke) {
      const g = stroke, source = g.out.toDataURL();
      api.assets.set(source, g.out);
      api.assets.map.delete(g.working);
      g.target.source = source;
      delete g.target.productRecipe;
      delete g.target.cutoutRecipe; delete g.target.paperRecipe; delete g.target.colorRecipe; delete g.target.landscapeRecipe; delete g.target.sceneRecipe; delete g.target.artRecipe;
      delete g.target.photoRecipe;
      delete g.target.removalRecipe;
      stroke = null;
      api.commit("Retouch \xB7 " + nice(g.tool));
      return true;
    }
    if (penDrag) {
      penDrag = null;
      api.overlay();
      return true;
    }
    return false;
  }
  function cancel() {
    if (stroke) {
      const g = stroke;
      Object.assign(d(), g.before);
      api.assets.map.delete(g.working);
      stroke = null;
      api.renderUI();
      api.requestRender();
      return true;
    }
    if (pen.length||penUndone.length) {
      pen = [];penUndone=[];
      penDrag = null;
      api.overlay();
      return true;
    }
    return false;
  }
  function undoDraft(redo=false){
    if(api.tool()!=='pen'||!pen.length&&!penUndone.length)return false;
    if(redo){if(penUndone.length)pen.push(penUndone.pop());}else if(pen.length)penUndone.push(pen.pop());
    penDrag=null;api.overlay();return true;
  }
  function key(e) {
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&undoDraft(e.shiftKey)){e.preventDefault();return true;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'&&undoDraft(true)){e.preventDefault();return true;}
    if (e.key === "Escape" && cancel()) {
      e.preventDefault();
      return true;
    }
    if (e.key === "Enter" && api.tool() === "pen" && pen.length) {
      e.preventDefault();
      finishPen();
      return true;
    }
    return false;
  }
  function drawOverlay(x, z) {
    for (const guide of [...d().guides || [], ...snapLines]) {
      x.save();
      x.strokeStyle = guide.axis === "x" ? "#80bff0" : "#e2a6e9";
      x.lineWidth = 1 / z;
      x.setLineDash([5 / z, 4 / z]);
      x.beginPath();
      if (guide.axis === "x") {
        x.moveTo(guide.position, 0);
        x.lineTo(guide.position, d().height);
      } else {
        x.moveTo(0, guide.position);
        x.lineTo(d().width, guide.position);
      }
      x.stroke();
      x.restore();
    }
    const list = roots(d());
    if (list.length > 1) {
      const b = bounds(list);
      x.save();
      x.strokeStyle = "#cfb6ff";
      x.lineWidth = 1 / z;
      x.setLineDash([5 / z, 3 / z]);
      x.strokeRect(b.x, b.y, b.width, b.height);
      x.restore();
    }
    if (sample && ["clone", "heal"].includes(api.tool())) {
      x.save();
      x.strokeStyle = "#f8d592";
      x.lineWidth = 1 / z;
      x.beginPath();
      x.moveTo(sample.x - 8 / z, sample.y);
      x.lineTo(sample.x + 8 / z, sample.y);
      x.moveTo(sample.x, sample.y - 8 / z);
      x.lineTo(sample.x, sample.y + 8 / z);
      x.stroke();
      x.restore();
    }
    if (pen.length) {
      x.save();
      x.strokeStyle = "#cdb6ff";
      x.fillStyle = "#f3edff";
      x.lineWidth = 1.5 / z;
      x.beginPath();
      x.moveTo(pen[0].x, pen[0].y);
      for (let i = 1; i < pen.length; i++) {
        const a = pen[i - 1], b = pen[i];
        x.bezierCurveTo(a.x + a.dx, a.y + a.dy, b.x - b.dx, b.y - b.dy, b.x, b.y);
      }
      if (penHover && !penDrag) x.lineTo(penHover.x, penHover.y);
      x.stroke();
      for (const p of pen) {
        x.beginPath();
        x.moveTo(p.x - p.dx, p.y - p.dy);
        x.lineTo(p.x + p.dx, p.y + p.dy);
        x.stroke();
        for (const [xx, yy] of [[p.x, p.y], [p.x + p.dx, p.y + p.dy], [p.x - p.dx, p.y - p.dy]]) x.fillRect(xx - 2 / z, yy - 2 / z, 4 / z, 4 / z);
      }
      x.restore();
    }
  }
  function snapMove(list, dx, dy, shift) {
    const r = snap && !shift ? snapDelta(d(), list, dx, dy, 8 / api.zoom()) : { dx, dy, guides: [] };
    snapLines = r.guides;
    return r;
  }
  function renderPanel(root) {
    const list = roots(d());
    root.innerHTML = `<div class="studio-panel"><div class="property-title">${icon("sliders")}Studio tools<span class="badge">${list.length} SELECTED</span></div><p class="panel-description">Shift-click layers to build a selection. Ctrl/\u2318-click toggles individual layers.</p><div class="property-small-heading">LAYER STRUCTURE</div><div class="studio-button-grid">${[["group", "Group"], ["ungroup", "Ungroup"], ["clip", "Clipping mask"], ["merge-selected", "Merge selected"], ["rasterize", "Rasterize"], ["transform", "Transform"]].map(([a, n]) => `<button class="button" data-action="${a}">${n}</button>`).join("")}</div><div class="property-small-heading">ALIGN & DISTRIBUTE</div><div class="align-layer-grid">${[["left", "Left"], ["center-x", "Center X"], ["right", "Right"], ["top", "Top"], ["center-y", "Center Y"], ["bottom", "Bottom"]].map(([a, n]) => `<button data-pro-align="${a}">${n}</button>`).join("")}</div><div class="studio-button-grid"><button class="button" data-action="distribute-x">Distribute X</button><button class="button" data-action="distribute-y">Distribute Y</button></div><div class="property-small-heading">EDITING & OUTPUT</div>${actionButton("filters", "Live filter stack", "sliders")}${actionButton("refine-selection", "Refine selection", "select")}${actionButton("guides", "Guides & snapping", "ruler")}${actionButton("import-font", "Import a font", "text")}${actionButton("export-svg", "Export vector SVG", "shape")}${actionButton("export-pack", "Export a size pack", "download")}<div class="property-small-heading">PREVIEW</div><select id="channel-view" aria-label="Channel preview">${["composite", "red", "green", "blue", "alpha"].map((v) => `<option value="${v}" ${v === view ? "selected" : ""}>${nice(v)}</option>`).join("")}</select><label class="check-row"><input id="compare-edits" type="checkbox" ${compare ? "checked" : ""}> Bypass adjustments & filters in preview</label><p class="library-hint">Channel and comparison previews do not change exports.</p></div>`;
    root.querySelectorAll("[data-pro-align]").forEach((b) => b.onclick = () => api.runAction("align-" + b.dataset.proAlign));
    $("#channel-view").onchange = (e) => {
      view = e.target.value;
      api.requestRender();
    };
    $("#compare-edits").onchange = (e) => {
      compare = e.target.checked;
      api.requestRender();
    };
  }
  function extras(target) {
    const count = target.filters?.length || 0;
    return `${target.type === "text" ? `<div class="control-grid"><label class="number-field"><span>Tracking</span><input data-property="tracking" type="number" min="-20" max="200" value="${target.tracking || 0}" aria-label="Letter spacing"><small>px</small></label><label class="check-row"><input type="checkbox" data-property="underline" ${target.underline ? "checked" : ""}> Underline</label></div>` : ""}${target.type === "shape" && target.gradient ? `<div class="property-row"><span>Gradient</span><select data-property="gradientType" aria-label="Gradient type"><option value="linear" ${target.gradientType !== "radial" ? "selected" : ""}>Linear</option><option value="radial" ${target.gradientType === "radial" ? "selected" : ""}>Radial</option></select></div><label class="number-field"><span>Angle</span><input data-property="gradientAngle" type="number" min="-360" max="360" value="${target.gradientAngle ?? 45}" aria-label="Gradient angle"><small>\xB0</small></label>` : ""}<div class="layer-feature-row"><button class="button" data-action="filters">${icon("sliders")} Live filters <span>${count}</span></button><button class="button ${target.clipToBelow ? "active" : ""}" data-action="clip" title="Clip this layer to the base below">${icon("clip")} Clip</button></div>`;
  }
  const actions = {
    "studio": () => api.openStudio(),
    group: change("Group layers", () => groupSelection(d())),
    ungroup: change("Ungroup layers", () => ungroup(d())),
    clip: toggleClip,
    "merge-selected": merge,
    rasterize,
    transform: transformModal,
    filters: filtersModal,
    "refine-selection": selectionRefine,
    guides: guidesModal,
    "distribute-x": change("Distribute horizontally", () => distribute(d(), "x")),
    "distribute-y": change("Distribute vertically", () => distribute(d(), "y")),
    "copy-style": () => {
      styleClipboard = clone(editable().effects || {});
      api.toast("Layer style copied.");
    },
    "paste-style": change("Paste layer style", () => {
      if (!styleClipboard) throw new Error("Copy a layer style first.");
      for (const target of selected(d())) if (!effectiveLocked(d(), target)) target.effects = clone(styleClipboard);
    }),
    "import-font": importFont,
    "export-svg": svgExport,
    "export-pack": batchExport,
    "finish-path": finishPen,
    "cancel-path": () => {
      pen = [];
      penDrag = null;
      api.overlay();
    },
    "snap": () => {
      snap = !snap;
      api.toast(snap ? "Snapping enabled." : "Snapping disabled.");
    },
    "view-channels": () => api.openStudio(),
    "compare": () => {
      compare = !compare;
      api.requestRender();
      api.toast(compare ? "Preview bypasses adjustments and filters. Exports keep your edits." : "Edited preview restored.");
    }
  };
  for (const mode of ["left", "right", "center-x", "top", "bottom", "center-y"]) actions["align-" + mode] = change("Align selection", () => alignObjects(d(), mode));
  const actionItems = [["studio", "Studio tools", "sliders", ""], ["group", "Group selected layers", "folder", "Ctrl G"], ["ungroup", "Ungroup layers", "folder-open", "Ctrl Shift G"], ["clip", "Create / release clipping mask", "clip", "Ctrl Alt G"], ["merge-selected", "Merge selected layers", "layers", "Ctrl E"], ["rasterize", "Rasterize active layer", "image", ""], ["transform", "Transform selection", "move", "Ctrl T"], ["filters", "Live filter stack", "sliders", ""], ["refine-selection", "Refine selection", "select", ""], ["guides", "Guides & snapping", "ruler", ""], ["snap", "Toggle snapping", "magnet", ""], ["distribute-x", "Distribute horizontally", "align-center", ""], ["distribute-y", "Distribute vertically", "align-center", ""], ["copy-style", "Copy layer style", "copy", ""], ["paste-style", "Paste layer style", "copy", ""], ["import-font", "Import a font", "text", ""], ["export-svg", "Export SVG", "shape", ""], ["export-pack", "Export a size pack", "download", ""], ["view-channels", "Channel preview", "adjust", ""], ["compare", "Bypass adjustments / filters in preview", "eye", ""]];
  return {undoDraft,isDrawing:()=>!!stroke||!!penDrag,mutableIds:()=>stroke?[stroke.target.id]:[],brushSize:()=>retouch.size,cursorInfo:p=>({close:api.tool()==='pen'&&pen.length>2&&p&&Math.hypot(p.x-pen[0].x,p.y-pen[0].y)*api.zoom()<10}), actions, actionItems, openFilters:filtersModal,setView:next=>{if(["composite","red","green","blue","alpha"].includes(next)){view=next;api.requestRender();}}, renderPanel, extras, context, bindContext, pointerDown, pointerMove, pointerUp, cancel, key, drawOverlay, snapMove, remapMasks: transformMasks, clearSnap: () => snapLines = [], view: () => view, previewDocument: (source) => compare ? { ...source, layers: source.layers.map((x) => ({ ...x, filters: [], visible: x.type === "adjustment" ? false : x.visible })) } : source, duplicate: () => {
    duplicateObjects(d());
    api.commit("Duplicate selected layers");
  }, remove: () => {
    deleteObjects(d());
    api.commit("Delete selected layers");
  }, getSelection: () => selected(d()) };
}
export {
  createProStudio
};
