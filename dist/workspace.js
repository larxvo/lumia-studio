import {NAV_GROUPS,TOOL_INDEX,SAMPLE_ACTIONS,matchesTool,normalizedSearch} from './workspace-navigation.js';
import { ancestors } from "./pro-model.js";
import { TEMPLATES, makeTemplate } from "./templates.js";
import { createLayer, clone, moveLayer, clamp } from "./model.js";
import { canvas, renderDocument, maskCanvas } from "./renderer.js";
import { icon } from "./icons.js";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const $ = (s) => document.querySelector(s);
const categories = [[15, "Person"], [8, "Cat"], [12, "Dog"], [5, "Bottle"], [9, "Chair"], [7, "Car"], [16, "Plant"], [2, "Bicycle"], [3, "Bird"], [10, "Cow"], [13, "Horse"], [18, "Sofa"]];
function createWorkspace(api) {
  let toolQuery='',recent=[],designTab='templates';const toolQueries={},groupFilters={};
  let opened = "", filter = "All", query = "", aiMode = "portrait", result = null, aiBusy = false, controller = null, threshold = 0.5, softness = 0.12, selectedCategory = 15, targetId = "", aiError = "";
  const root = $("#creative-panel"), thumbs = /* @__PURE__ */ new Map();
  const signature = (l) => JSON.stringify([l.source, l.x, l.y, l.width, l.height, l.rotation, l.flipX, l.flipY]);
  const targets = () => api.doc()?.layers.filter((l) => ["image", "paint"].includes(l.type)) || [];
  const target = () => targets().find((l) => l.id === targetId) || targets().find((l) => l.id === api.doc()?.activeId) || targets().at(-1);
  function open(name) {
    opened = opened === name ? "" : name;
    if(NAV_GROUPS[opened])toolQuery=toolQueries[opened]||'';
    root.hidden = !opened;
    document.querySelectorAll("[data-library]").forEach((b) => {
      b.classList.toggle("active", b.dataset.library === (["templates","elements","type"].includes(opened)?"templates":opened));
      b.setAttribute("aria-expanded", String(b.dataset.library === (["templates","elements","type"].includes(opened)?"templates":opened)));
    });
    $("#app").classList.toggle("library-open", !!opened);
    render();
    requestAnimationFrame(() => api.fit());
  }
  function render() {
    if (!opened) return;
    if(NAV_GROUPS[opened]){renderTools();return;}
    const titles = { templates: ["Thiết kế", "Bắt đầu từ mẫu, thành phần hoặc chữ."], elements: ["Thành phần", "Thêm hình, màu và bố cục của bạn."], type: ["Chữ & kiểu chữ", "Chọn kiểu rồi sửa nội dung theo ý."], uploads: ["Tệp của bạn", "Mở ảnh, PSD hoặc dự án để tiếp tục."], ai: ["A little intelligence.", "On your device. Under your control."] };
    const [title, subtitle] = titles[opened];root.setAttribute("aria-label",title);
    root.innerHTML = `<div class="creative-head"><span class="creative-eyebrow">${opened === "ai" ? "✦ ON-DEVICE AI" : "YOUR CREATIVE TOOLKIT"}</span><button class="icon-button" data-shelf-close aria-label="Close design library">${icon("x")}</button><h2>${title}</h2><p>${subtitle}</p></div><div class="creative-body" id="creative-body"></div><div class="creative-foot">${icon("shield")} ${opened === "ai" ? "No uploads. No credits. No subscription." : "Free to create. Yours to keep."}</div>`;
    root.querySelector("[data-shelf-close]").onclick = () => open(opened);
    if(['templates','elements','type'].includes(opened)){
      designTab=opened;
      root.querySelector('.creative-head').insertAdjacentHTML('afterend',`<div class="design-subtabs" role="tablist" aria-label="Nhóm thiết kế">${[['templates','Mẫu'],['elements','Thành phần'],['type','Chữ']].map(([key,title])=>`<button role="tab" aria-selected="${key===opened}" data-design-tab="${key}">${title}</button>`).join('')}</div>`);
      root.querySelectorAll('[data-design-tab]').forEach(b=>b.onclick=()=>{opened=b.dataset.designTab;render();});
    }
    if (opened === "templates") renderTemplates();
    else if (opened === "elements") renderElements();
    else if (opened === "type") renderType();
    else if (opened === "uploads") renderUploads();
    else renderAI();
  }
  function renderTools(){
    const titles={photo:['Chỉnh ảnh','Chọn việc cần làm. Tinh chỉnh theo ý bạn.'],'ai-tools':['Công cụ AI','Tạo sinh, phục hồi và máy AI của bạn.'],advanced:['Nâng cao','Layer, màu in và trao đổi tài liệu.']};
    const [title,subtitle]=titles[opened];root.setAttribute("aria-label",title);
    root.innerHTML=`<div class="creative-head task-head"><span class="creative-eyebrow">LUMA WORKSPACE</span><button class="icon-button" data-shelf-close aria-label="Đóng bảng công cụ">${icon('x')}</button><h2>${title}</h2><p>${subtitle}</p></div><div class="task-search"><label class="library-search">${icon('search')}<input id="tool-search" aria-label="Tìm trong nhóm công cụ" placeholder="Tìm công cụ…" value="${esc(toolQuery)}"></label></div><div id="tool-categories" class="task-categories" aria-label="Nhóm công việc"></div><div class="creative-body task-body" id="creative-body"></div><div class="creative-foot">${icon('search')} Tìm mọi công cụ bằng Ctrl K</div>`;
    root.querySelector('[data-shelf-close]').onclick=()=>open(opened);
    $('#tool-search').oninput=e=>{toolQuery=e.target.value;toolQueries[opened]=toolQuery;groupFilters[opened]='';renderToolCategories();renderToolCards();};renderToolCategories();renderToolCards();
  }
  function renderToolCategories(){
    const groups=NAV_GROUPS[opened];if(!groups)return;
    $('#tool-categories').innerHTML=[['','Tất cả'],...groups.map(([name])=>[name,name])].map(([key,title])=>`<button data-tool-group="${esc(key)}" aria-pressed="${(groupFilters[opened]||'')===key}">${esc(title)}</button>`).join('');
    root.querySelectorAll('[data-tool-group]').forEach(b=>b.onclick=()=>{groupFilters[opened]=b.dataset.toolGroup;toolQuery='';toolQueries[opened]='';$('#tool-search').value='';renderToolCategories();renderToolCards();});
  }
  function renderToolCards(){
    if(!NAV_GROUPS[opened])return;
    const l=api.layer(),hasImage=targets().length>0,groups=NAV_GROUPS[opened],query=toolQuery;
    const edits=l?[['artRecipe','art-studio','Art & Pattern'],['sceneRecipe','scene-studio','Preset & Mùa'],['photoRecipe','retouch-lab','Retouch chân dung'],['cutoutRecipe','cutout-studio','Tách nền'],['removalRecipe','remove-studio','Xóa người'],['productRecipe','product-studio','Sản phẩm'],['paperRecipe','paper-studio','Tài liệu'],['landscapeRecipe','landscape-studio','Phong cảnh'],['colorRecipe',l.colorRecipe?.mode==='beverage'?'beverage-studio':'wardrobe-color','Màu & hậu cảnh']].filter(([key])=>l[key]):[];
    const card=tool=>{const [id,ic,title,description]=tool;const needsImage=(opened==='photo'&&(!hasImage||l?.smartObjectId))||(opened==='ai-tools'&&id!=='ai-connect'&&!hasImage);return `<button class="task-card" data-action="${id}" ${needsImage?'disabled':''}><span class="task-card-icon">${icon(ic)}</span><span><strong>${esc(title)}</strong><small>${esc(description)}</small></span>${icon('chevron-right')}</button>`;};
    let html=opened==='photo'&&!hasImage?`<div class="task-context"><p>Mở ảnh hoặc chọn layer ảnh để bắt đầu.</p><button class="button" data-action="open">${icon('folder-open')} Mở ảnh / PSD</button></div>`:'';
    if(opened==='photo'&&l?.smartObjectId)html+=`<div class="task-context"><p>Layer đang chọn là Smart Object.</p><button class="button" data-action="smart-edit">Sửa nội dung</button></div>`;
    if(!query&&edits.length&&opened==='photo')html+=`<section class="task-section"><h3>ĐANG CHỈNH</h3>${edits.map(([,id,title])=>`<button class="task-resume" data-action="${id}">${icon('sliders')} Sửa lại ${title}${icon('chevron-right')}</button>`).join('')}</section>`;
    if(!query&&!groupFilters[opened]&&recent.length) {const items=recent.map(id=>TOOL_INDEX.find(i=>i.tool[0]===id)).filter(i=>i&&groups.some(([,tools])=>tools.includes(i.tool)));if(items.length)html+=`<section class="task-section task-recent"><h3>DÙNG GẦN ĐÂY</h3>${items.map(i=>`<button data-action="${i.tool[0]}">${esc(i.tool[2])}</button>`).join('')}</section>`;}
    let count=0;for(const [group,tools]of groups){if(groupFilters[opened]&&groupFilters[opened]!==group)continue;const visible=tools.filter(tool=>matchesTool(tool,query,group));count+=visible.length;if(visible.length)html+=`<section class="task-section"><h3>${esc(group)}</h3>${visible.map(card).join('')}</section>`;}
    if(!count)html+='<p class="library-hint">Không có công cụ phù hợp. Thử từ ngắn hơn hoặc dùng Ctrl K để tìm trong toàn bộ Luma.</p>';
    if(opened==='photo'&&!query)html+=`<details class="task-samples"><summary>Thử bằng ảnh mẫu</summary>${SAMPLE_ACTIONS.map(([id,title])=>`<button data-action="${id}">${title}</button>`).join('')}</details>`;
    $('#creative-body').innerHTML=html;
  }
  function remember(id){if(!TOOL_INDEX.some(i=>i.tool[0]===id))return;recent=[id,...recent.filter(x=>x!==id)].slice(0,4);if(NAV_GROUPS[opened])renderToolCards();}
  function renderTemplates() {
    const body = $("#creative-body");
    body.innerHTML = `<label class="library-search">${icon("search")}<input id="template-search" aria-label="Search templates" placeholder="Find your next starting point…" value="${esc(query)}"></label><div class="library-filters">${["All", "Social", "Poster", "Story", "Presentation"].map((c) => `<button data-filter="${c}" class="${c === filter ? "active" : ""}">${c}</button>`).join("")}</div><div class="library-section-label">CURATED BY LUMA <span>6 free templates</span></div><div class="template-grid" id="template-grid"></div><button class="library-blank" data-action="new">${icon("plus")} Start with a blank canvas ${icon("chevron-right")}</button><p class="library-hint">Every shape and word is editable. Your current document stays open in its own tab.</p>`;
    function cards() {
      const list = TEMPLATES.filter((t) => (filter === "All" || t.category === filter) && `${t.name} ${t.category}`.toLowerCase().includes(query.toLowerCase()));
      $("#template-grid").innerHTML = list.map((t) => `<button class="template-card" data-template="${t.id}"><div class="template-preview"><img src="${thumb(t)}" alt="${esc(t.name)} design template" loading="lazy"><span>USE TEMPLATE ${icon("chevron-right")}</span></div><strong>${t.name}</strong><small>${t.size} · ${t.category}</small></button>`).join("") || '<p class="library-hint">No matching templates. Try another search.</p>';
      root.querySelectorAll("[data-template]").forEach((b) => b.onclick = () => {
        api.setDocument(makeTemplate(b.dataset.template), "Use design template");
        api.setTool("move");
        api.toast("Your template is ready. Select any text or shape to make it yours.");
        if (window.innerWidth < 1100) open(opened);
      });
    }
    cards();
    $("#template-search").oninput = (e) => {
      query = e.target.value;
      cards();
    };
    root.querySelectorAll("[data-filter]").forEach((b) => b.onclick = () => {
      filter = b.dataset.filter;
      renderTemplates();
    });
  }
  function thumb(t) {
    if (!thumbs.has(t.id)) thumbs.set(t.id, renderDocument(makeTemplate(t.id), api.assets, { scale: 220 / t.width }).toDataURL("image/png"));
    return thumbs.get(t.id);
  }
  function renderElements() {
    $("#creative-body").innerHTML = `<div class="library-section-label">THE ESSENTIALS</div><div class="element-grid">${[["rect", "Rectangle"], ["round", "Round card"], ["ellipse", "Circle"], ["triangle", "Triangle"], ["star", "Star"], ["line", "Line"]].map(([s, n]) => `<button data-element="${s}"><i class="element-sample element-${s}"></i><span>${n}</span></button>`).join("")}</div><div class="library-section-label">COLOR STORIES</div>${[["Field notes", ["#ecf1d5", "#174d3b", "#b6d474", "#6c8c49"]], ["Clay & rose", ["#f4b5a1", "#542b45", "#d45235", "#f4dbbd"]], ["After hours", ["#23223e", "#d1c3ff", "#8b6bdd", "#faf4e8"]]].map(([n, colors]) => `<div class="palette-row"><span>${n}</span><div>${colors.map((c) => `<button data-palette="${c}" style="--swatch:${c}" title="Apply ${c}" aria-label="Apply color ${c}"></button>`).join("")}</div></div>`).join("")}<button class="library-blank" id="add-gradient">${icon("gradient")} Add a gradient card ${icon("plus")}</button><p class="library-hint">Choose a color to update the selected shape or text. Elements stay editable at any size.</p>`;
    root.querySelectorAll("[data-element]").forEach((b) => b.onclick = () => {
      const d = api.doc(), type = b.dataset.element, w = d.width * 0.32, h = type === "line" ? Math.max(3, d.height * 6e-3) : d.width * 0.32;
      api.addLayer(createLayer("shape", { name: type === "round" ? "Rounded card" : type[0].toUpperCase() + type.slice(1), shape: type === "round" ? "rect" : type, color: "#a5e4d1", x: (d.width - w) / 2, y: (d.height - h) / 2, width: w, height: h, radius: type === "round" ? 36 : 0 }));
      api.setTool("move");
    });
    root.querySelectorAll("[data-palette]").forEach((b) => b.onclick = () => {
      const l = api.layer();
      if (!l || !["text", "shape"].includes(l.type) || l.locked) {
        api.toast("Select an unlocked text or shape layer first.");
        return;
      }
      l.color = b.dataset.palette;
      api.commit("Apply palette color");
    });
    $("#add-gradient").onclick = () => {
      const d = api.doc();
      api.addLayer(createLayer("shape", { name: "Gradient card", shape: "rect", color: "#8b6bdd", color2: "#f4b5a1", gradient: true, radius: 36, x: d.width * 0.2, y: d.height * 0.3, width: d.width * 0.6, height: d.height * 0.4 }));
    };
  }
  function renderType() {
    $("#creative-body").innerHTML = `<div class="type-preset-list">${[["headline", "Make a statement.", "Inter", 800], ["editorial", "A different point of view.", "Georgia", 400], ["body", "A little room for your story.", "Inter", 400], ["label", "THE LITTLE DETAILS", "Inter", 600]].map(([id, text, font, weight]) => `<button data-type-preset="${id}" style="font-family:${font};font-weight:${weight}">${text}<small>${id === "headline" ? "Bold headline" : id === "editorial" ? "Editorial serif" : id === "body" ? "Body copy" : "Small label"} ${icon("plus")}</small></button>`).join("")}</div><p class="library-hint">Double-click text on your canvas to edit. Fine-tune font, color, spacing and alignment in Properties.</p><button class="library-blank" data-action="add-text">${icon("text")} Add custom text ${icon("plus")}</button>`;
    root.querySelectorAll("[data-type-preset]").forEach((b) => b.onclick = () => {
      const d = api.doc(), id = b.dataset.typePreset, settings = { headline: ["Make a statement.", "Inter", 800, 0.105], editorial: ["A different\npoint of view.", "Georgia", 400, 0.09], body: ["A little room for your story.\nAdd the words that make it yours.", "Inter", 400, 0.037], label: ["THE LITTLE DETAILS", "Inter", 600, 0.022] }[id], size = Math.round(d.width * settings[3]);
      api.addLayer(createLayer("text", { name: id[0].toUpperCase() + id.slice(1), text: settings[0], font: settings[1], fontWeight: settings[2], fontSize: size, lineHeight: 1.2, color: "#f3efe5", align: "left", x: d.width * 0.1, y: d.height * 0.3, width: d.width * 0.8, height: size * 3.5 }));
      api.setTool("move");
    });
  }
  function renderUploads() {
    $("#creative-body").innerHTML = `<div class="import-card">${icon("folder-open")}<h3>Bring something in.</h3><p>PNG, JPG, WebP or a layered PSD.<br>Drag a file onto the canvas anytime.</p><button class="button primary" data-action="open">Open a file</button><button class="button" data-action="place">Place image as a layer</button></div><div class="library-section-label">KEEP CREATING</div><button class="library-link" data-action="recent">${icon("history")} Recent projects ${icon("chevron-right")}</button><button class="library-link" data-action="save">${icon("save")} Save editable .luma project ${icon("chevron-right")}</button><div class="psd-info"><span>PSD, WITH CLARITY.</span><p>Pixel layers, simple text, supported adjustments and simple groups can be edited. Complex Photoshop effects may require the merged preview. Import tells you what was preserved.</p><p>RGB · 8-bit · Native pixels · Device capacity<br>Canva-style design workflow; .canva files are not supported.</p></div>`;
  }
  function renderAI() {
    const list = targets(), t = target();
    if (t) targetId = t.id;
    $("#creative-body").innerHTML = `<button class="cutout-launch" data-action="cutout-studio"><span>SUBJECT STUDIO · MỚI</span><strong>Tách nền &amp; vật thể</strong><small>Tự tìm chủ thể · bấm chọn vật thể · giữ viền tóc · cọ sửa mask.</small><span>Mở không gian tách ảnh ↗</span></button><div class="ai-local-badge"><span></span> Private by design <small>NEURAL MODEL</small></div><div class="ai-mode-tabs"><button data-ai-mode="portrait" class="${aiMode === "portrait" ? "active" : ""}">Portrait</button><button data-ai-mode="objects" class="${aiMode === "objects" ? "active" : ""}">Objects</button></div><h3 class="ai-tool-title">${aiMode === "portrait" ? "A subject. A clean start." : "Find the things that matter."}</h3><p class="library-hint">${aiMode === "portrait" ? "Separate people from the background, then refine the editable mask." : "Select a recognized object category. Best for clearly visible subjects; edges may need refining."}</p><label class="library-field">Image layer<select id="ai-target" aria-label="AI image layer">${list.length ? list.map((l) => `<option value="${l.id}" ${l.id === targetId ? "selected" : ""}>${esc(l.name)}</option>`).join("") : "<option>No image layers yet</option>"}</select></label>${aiMode === "objects" ? `<label class="library-field">Find<select id="ai-category" aria-label="Object category">${categories.map(([id, n]) => `<option value="${id}" ${id === selectedCategory ? "selected" : ""}>${n}</option>`).join("")}</select></label>` : ""}<button class="button ai-run" id="ai-run" ${aiBusy || !list.length ? "disabled" : ""}>${icon("sparkles")} ${aiBusy ? "Working on your device…" : "Create subject mask"}</button><div class="ai-progress" id="ai-progress" ${aiBusy ? "" : "hidden"}><i></i><span>Starting neural model…</span><button id="ai-cancel">Cancel</button></div><p class="ai-download-note">First use loads about ${aiMode === "portrait" ? "15" : "23"} MB. Images are processed locally; no account or API key needed.</p>${aiError ? `<div class="ai-error" role="alert">${esc(aiError)}</div>` : ""}<div id="ai-result"></div><button class="library-blank" data-action="place">${icon("image")} Add an image ${icon("plus")}</button><button class="library-blank" data-action="retouch-lab">${icon("sparkles")} Retouch da, khuôn mặt & ảnh cũ ${icon("chevron-right")}</button><div class="ai-boundary"><span>WHAT THIS AI DOES</span><p>Basic portrait and category masks are available here. Open Subject Studio above for point selection, portrait alpha, hair masks and separate object layers.</p></div>`;
    root.querySelectorAll("[data-ai-mode]").forEach((b) => b.onclick = () => {
      if (aiBusy) return;
      aiMode = b.dataset.aiMode;
      result = null;
      renderAI();
    });
    $("#ai-target").onchange = (e) => {
      targetId = e.target.value;
      result = null;
      renderResult();
    };
    if ($("#ai-category")) $("#ai-category").onchange = (e) => {
      selectedCategory = Number(e.target.value);
      result = null;
      renderResult();
    };
    $("#ai-run").onclick = runAI;
    $("#ai-cancel").onclick = () => controller?.abort();
    renderResult();
  }
  async function runAI() {
    if (aiBusy) return;
    const d = api.doc(), l = target();
    if (!l) {
      api.toast("Place or open an image first.");
      return;
    }
    const image = api.assets.get(l.source);
    if (!image) {
      api.toast("This image is still loading.", true);
      return;
    }
    const saved = { docId: d.id, layerId: l.id, signature: signature(l), width: d.width, height: d.height, geometry: clone(l), image };
    aiBusy = true;
    result = null;
    aiError = "";
    controller = new AbortController();
    renderAI();
    try {
      const { segmentImage } = await import("./ai.js");
      const response = await segmentImage(image, { mode: aiMode, category: selectedCategory, signal: controller.signal, onProgress: (text) => {
        if ($("#ai-progress span")) $("#ai-progress span").textContent = text;
      } });
      result = { ...saved, response };
      api.toast("Subject mask ready. Preview it, then apply or refine.");
    } catch (e) {
      if (e.name !== "AbortError") {
        aiError = e.message;
        console.error("AI Studio:", e);
        api.toast(e.message, true);
      } else api.toast("AI cancelled. Your image is unchanged.");
    } finally {
      aiBusy = false;
      controller = null;
      if (opened === "ai") renderAI();
    }
  }
  async function renderResult() {
    const holder = $("#ai-result");
    if (!holder || !result) return;
    const snapshot = result, { confidenceMask } = await import("./ai.js");
    if (result !== snapshot || !$("#ai-result")) return;
    holder.innerHTML = `<div class="ai-result-head"><strong>YOUR SUBJECT MASK</strong><span>Preview</span></div><div class="ai-compare"><figure><img id="ai-before" alt="Original image"><figcaption>Original</figcaption></figure><figure class="checker"><img id="ai-after" alt="AI subject mask preview"><figcaption>Mask preview</figcaption></figure></div><label class="library-field">Subject threshold <output id="threshold-label">${Math.round(threshold * 100)}%</output><input type="range" id="ai-threshold" aria-label="Subject threshold" min="10" max="90" value="${threshold * 100}"></label><label class="library-field">Edge softness <output id="softness-label">${Math.round(softness * 100)}%</output><input type="range" id="ai-softness" aria-label="AI edge softness" min="1" max="30" value="${softness * 100}"></label><p class="ai-mask-note" id="ai-mask-note"></p><button class="button primary ai-apply" id="ai-apply">${icon("mask")} Apply editable mask</button><button class="button ai-selection" id="ai-selection">Load as selection</button>`;
    function preview() {
      const { canvas: mask, coverage } = confidenceMask(result.response, threshold, softness);
      result.mask = mask;
      result.coverage = coverage;
      const scale = Math.min(1, 320 / Math.max(result.image.width, result.image.height)), c = canvas(result.image.width * scale, result.image.height * scale), x = c.getContext("2d");
      x.drawImage(result.image, 0, 0, c.width, c.height);
      $("#ai-before").src = c.toDataURL();
      x.globalCompositeOperation = "destination-in";
      x.drawImage(mask, 0, 0, c.width, c.height);
      $("#ai-after").src = c.toDataURL();
      $("#ai-mask-note").textContent = coverage < 5e-3 ? "No clear subject found. Try Objects or another photo." : coverage > 0.995 ? "Almost the whole image was selected. Check the category or increase the threshold." : "The original image stays intact. Paint on the mask to refine edges.";
      $("#ai-apply").disabled = coverage < 5e-3;
      $("#ai-selection").disabled = coverage < 5e-3;
    }
    preview();
    $("#ai-threshold").oninput = (e) => {
      threshold = Number(e.target.value) / 100;
      $("#threshold-label").textContent = e.target.value + "%";
      preview();
    };
    $("#ai-softness").oninput = (e) => {
      softness = Number(e.target.value) / 100;
      $("#softness-label").textContent = e.target.value + "%";
      preview();
    };
    $("#ai-apply").onclick = () => apply(false);
    $("#ai-selection").onclick = () => apply(true);
  }
  function apply(selection) {
    const d = api.doc(), l = d?.layers.find((l2) => l2.id === result?.layerId);
    if (l && ancestors(d, l).some((g) => g.locked)) {
      api.toast("Unlock the parent group before applying an AI mask.", true);
      return;
    }
    if (!result || d.id !== result.docId || !l || signature(l) !== result.signature || d.width !== result.width || d.height !== result.height) {
      api.toast("The source changed. Run AI again before applying.", true);
      return;
    }
    const c = canvas(d.width, d.height), x = c.getContext("2d");
    x.translate(l.x + l.width / 2, l.y + l.height / 2);
    x.rotate((l.rotation || 0) * Math.PI / 180);
    x.scale(l.flipX ? -1 : 1, l.flipY ? -1 : 1);
    x.drawImage(result.mask, -l.width / 2, -l.height / 2, l.width, l.height);
    x.setTransform(1, 0, 0, 1, 0, 0);
    if (l.mask && !selection) {
      x.globalCompositeOperation = "destination-in";
      x.drawImage(maskCanvas(d, l.mask, 1, api.assets), 0, 0);
    }
    const source = c.toDataURL();
    api.assets.set(source, c);
    const mask = { type: "paint", source, x: 0, y: 0, width: d.width, height: d.height, feather: 0, invert: false };
    if (selection) d.selection = mask;
    else {
      l.mask = mask;
      l.locked = false;
      d.activeId = l.id;
    }
    api.commit(selection ? "AI subject selection" : "AI subject mask");
    api.toast(selection ? "Selection ready. Add an adjustment or a mask." : "Mask applied. Use Brush or Eraser in mask mode to refine.");
  }
  function update() {
    if(NAV_GROUPS[opened])renderToolCards();
    if (opened === "ai" && !aiBusy && !result) {
      const current = targets().map((l) => l.id + l.name).join("");
      if (root.dataset.targets !== current) {
        root.dataset.targets = current;
        renderAI();
      }
    }
  }
  root.addEventListener('keydown',e=>{if(e.key==='Escape'&&opened){const selected=['templates','elements','type'].includes(opened)?'templates':opened;e.preventDefault();e.stopPropagation();open(opened);document.querySelector(`[data-library="${selected}"]`)?.focus();}});
  document.querySelectorAll("[data-library]").forEach((b) => b.onclick = () => open(b.dataset.library==="templates"?designTab:b.dataset.library));
  return { open, update, makeTemplate, runAI,remember };
}
export {
  createWorkspace
};
