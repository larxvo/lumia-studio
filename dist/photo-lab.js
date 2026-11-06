import {canEdit} from './layer-policy.js';
import { createLayer, clone, uid } from "./model.js";
import { canvas, maskCanvas } from "./renderer.js";
import { PHOTO_DEFAULTS, PHOTO_PRESETS, PHOTO_FIELDS, PHOTO_GROUP_FIELDS, presetParams } from "./photo-settings.js";
import { createPhotoWorker } from "./photo-client.js";
import { validatePhotoRecipe } from "./photo-recipe.js";
import { icon } from "./icons.js";
import {autoPortraitParams} from './portrait-auto.js';
import {createEditHistory,bindEditorHistory} from './edit-history.js';
const $ = (s) => document.querySelector(s), esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const LABELS = { strength: "Cường độ chung", smooth: "Làm mịn", blemish: "Vá đốm nhỏ", sensitivity: "Độ nhạy tìm đốm", pigment: "Giảm đốm sắc tố", wrinkles: "Giảm rãnh nhăn", redness: "Giảm sắc đỏ", flakes: "Giảm vảy / kết cấu nổi", texture: "Giữ kết cấu", eyeSize: "Kích thước mắt", eyeWidth: "Chiều ngang mắt", lipThickness: "Độ dày môi", mouthWidth: "Chiều ngang miệng", mouthOpen: "Độ mở miệng", smile: "Nâng / hạ khóe môi", neutral: "Đưa khóe môi về giữa", browThickness: "Độ dày chân mày", browDensity: "Độ đậm chân mày", levels: "Cân sáng tự động", denoise: "Khử nhiễu", stain: "Cân vùng ố loang", decast: "Giảm ám màu", scratches: "Tìm xước / bụi mảnh", repair: "Mức vá vùng hỏng", sharp: "Độ rõ chi tiết", blackwhite: "Giữ đen trắng", warmth: "Sắc ấm" };
Object.assign(LABELS, { studio: "Cân màu da studio", grain: "Hạt ảnh bổ sung (tùy chọn)", smileShape: "Độ cong toàn cung môi", smileAsymmetry: "Cười lệch trái / phải", redEye: "Sửa ánh đỏ đồng tử", redEyeSensitivity: "Độ nhạy mắt đỏ", irisAmount: "Cường độ màu mắt", hairAmount: "Cường độ màu tóc", hairLight: "Nâng / hạ sáng tóc", stubble: "Giảm sợi râu lún phún", beardAmount: "Độ đậm râu", beardDensity: "Mật độ sợi râu", beardLength: "Độ dài sợi", beardSeed: "Biến thể sợi râu" });
Object.assign(LABELS,{faceSlim:'Thu gọn hai má',jawSlim:'Thu gọn góc hàm',chinSlim:'Thu gọn cằm',shine:'Giảm bóng dầu',shineSensitivity:'Độ nhạy vùng bóng'});
const negative = /* @__PURE__ */ new Set(["eyeSize", "eyeWidth", "lipThickness", "mouthWidth", "mouthOpen", "smile", "browThickness", "browDensity", "warmth"]);
for (const key of ["smileShape", "smileAsymmetry", "hairLight"]) negative.add(key);
const TITLES = { portrait:"Auto chân dung",skin: "Da studio", face: "Mặt & biểu cảm", eyes: "Mắt", hair: "Tóc", beard: "Râu", restore: "Ảnh cũ" };
const EXPLANATIONS = { skin: "Cân màu da theo tần số, giữ chi tiết lỗ chân lông từ ảnh gốc. AI chọn vùng da; không chẩn đoán bệnh da. Hạt ảnh bổ sung mặc định tắt.", face: "Chỉnh hình học cả cung môi, độ mở, chiều ngang và khóe môi. Không sinh thêm răng; dùng Biểu cảm AI khi cần tái dựng miệng.", eyes: "Sửa mắt đỏ tự động theo vùng mống mắt; giữ điểm lóe sáng. Nếu nhận diện thiếu, bật Chạm vào mắt rồi chạm đồng tử. Màu mắt giữ đồng tử, mí và lòng trắng.", hair: "AI nhận diện vùng tóc. Màu giữ độ sáng tối và sợi tóc gốc; dùng cọ + / − để sửa viền. Nâng sáng là mô phỏng màu, không tái dựng tóc bị che.", beard: "Râu mô phỏng bằng từng sợi theo mốc hàm và môi. Giảm râu lún phún xử lý sợi tối nhỏ. Râu dày hoặc râu ảnh thật có luồng AI riêng để bạn xem và duyệt.", restore: "Sửa bạc màu, nhiễu, ố loang và xước nhỏ bằng pixel lân cận. Chi tiết đã mất hoặc màu lịch sử không thể xác minh chỉ từ ảnh này." };
EXPLANATIONS.portrait='Bấm Tự chỉnh tự nhiên, sau đó kéo các thanh theo ý bạn. Chỉ retouch khuôn mặt đã chọn; giữ mắt, mũi, miệng và kết cấu da gốc. Giảm bóng sáng là ước lượng từ ảnh; râu dày dùng mục Râu → AI.';
const sig = (l) => JSON.stringify([l.id, l.source, l.x, l.y, l.width, l.height, l.rotation, l.flipX, l.flipY, l.mask, l.filters, l.effects]);
function encodedAnalysis(analysis) {
  if (!analysis) return null;
  const value = { faces: clone(analysis.faces || []) };
  if (analysis.skin) {
    const s = analysis.skin, c = canvas(s.width, s.height), x = c.getContext("2d"), image = x.createImageData(c.width, c.height);
    for (let i = 0; i < s.values.length; i++) {
      image.data[i * 4] = Math.round(s.values[i] * 255);
      image.data[i * 4 + 1] = Math.round(s.face[i] * 255);
      image.data[i * 4 + 2] = Math.round((s.hair?.[i] || 0) * 255);
      image.data[i * 4 + 3] = 255;
    }
    x.putImageData(image, 0, 0);
    value.skinSource = c.toDataURL();
    if (s.hair) value.partsVersion = 1;
  }
  return value;
}
async function decodedAnalysis(saved, assets) {
  if (!saved) return null;
  const result = { faces: clone(saved.faces || []), skin: null };
  if (saved.skinSource) {
    const image = await assets.load(saved.skinSource), c = canvas(image.width, image.height), x = c.getContext("2d");
    x.drawImage(image, 0, 0);
    const pixels = x.getImageData(0, 0, c.width, c.height).data, values = new Float32Array(c.width * c.height), face = new Float32Array(values.length);
    for (let i = 0; i < values.length; i++) {
      values[i] = pixels[i * 4] / 255;
      face[i] = pixels[i * 4 + 1] / 255;
    }
    result.skin = { width: c.width, height: c.height, values, face };
    if (saved.partsVersion === 1) result.skin.hair = Float32Array.from(values, (_, i) => pixels[i * 4 + 2] / 255);
  }
  return result;
}
function createPhotoLab(api, { analyzerFactory = () => createPhotoWorker("analyze"), processorFactory = () => createPhotoWorker("process") } = {}) {
  let active = null;
  async function open(initialMode = null) {
    const projectDoc = api.doc();
    let target = api.layer();
    if (!target || !["image", "paint"].includes(target.type)) target = projectDoc?.layers.filter((l) => ["image", "paint"].includes(l.type) && l.visible).sort((a, b) => b.width * b.height - a.width * a.height)[0];
    if (!target) throw new Error("Mở một ảnh hoặc chọn layer ảnh trước khi dùng Retouch Lab.");
    if (target.smartObjectId) throw new Error('Mở Sửa nội dung Smart Object để retouch nguồn bên trong.');
    if (active) active.close();
    const originalRecipe = target.photoRecipe, mode = initialMode || originalRecipe?.mode || "portrait", source = originalRecipe?.source || target.source, image = await api.assets.load(source), documentId = projectDoc.id, targetId = target.id, signature = sig(target), savedSelection = originalRecipe?.selectionSource ? await api.assets.load(originalRecipe.selectionSource) : null;
    const previewScale = Math.min(1, 1e3 / Math.max(image.width, image.height)), preview = canvas(Math.max(1, Math.round(image.width * previewScale)), Math.max(1, Math.round(image.height * previewScale)));
    preview.getContext("2d").drawImage(image, 0, 0, preview.width, preview.height);
    let params = { ...PHOTO_DEFAULTS, ...originalRecipe?.params }, strokes = clone(originalRecipe?.strokes || []), analysis = await decodedAnalysis(originalRecipe?.analysis, api.assets), selectedPreset = "", currentMode = mode, mounted = true, busy = false, analyzing = false, error = "", analysisError = "", result = null, maskView = false, brush = "view", brushSize = 0.035, split = 50, debounce = null, job = 0, pendingStroke = null, zoomMode = "fit", viewOffset = { x: 0, y: 0 }, pendingPan = null;
    let eyePoints = clone(originalRecipe?.eyePoints || []);
    let eyeRadius = eyePoints.at(-1)?.radius || .012;
    let unbindHistory=()=>{},autoRequested=false;
    const history=createEditHistory({limit:40});
    const snapshot=()=>({params:clone(params),strokes:clone(strokes),eyePoints:clone(eyePoints),currentMode,selectedPreset});
    function historyButtons(){if(!mounted)return;$('#lab-undo').disabled=busy||!history.canUndo();$('#lab-redo').disabled=busy||!history.canRedo();}
    function record(label,key=null){history.record(snapshot(),label,key);historyButtons();}
    function restoreHistory(next){if(!next||busy)return;autoRequested=false;processor.stop();job++;params=clone(next.params);strokes=clone(next.strokes);eyePoints=clone(next.eyePoints);currentMode=next.currentMode;selectedPreset=next.selectedPreset;pendingStroke=null;renderControls();renderFaceOptions();historyButtons();refresh();}
    const undo=()=>{if(!busy)restoreHistory(history.undo());},redo=()=>{if(!busy)restoreHistory(history.redo());};
    const analyzer = analyzerFactory(), processor = processorFactory();
    if (!originalRecipe && !["face","portrait"].includes(mode)) {
      selectedPreset = PHOTO_PRESETS[mode][0].id;
      params = presetParams(mode, selectedPreset, params);
    }
    const state = { close: () => {
      mounted = false;
      clearTimeout(debounce);
      analyzer.stop();
      processor.stop();
      unbindHistory();history.clear();autoRequested=false;
      if (active === state) active = null;
    }, getState: () => ({ params: clone(params), strokes: clone(strokes), eyePoints: clone(eyePoints), analysis, result, busy, mode: currentMode,history:history.stats() }) };
    active = state;
    function selectionFor(w, h) {
      if (!projectDoc.selection && !savedSelection) return null;
      const c = canvas(w, h), x = c.getContext("2d");
      if (savedSelection) {
        x.drawImage(savedSelection, 0, 0, w, h);
        const bytes2 = x.getImageData(0, 0, w, h).data, values2 = new Float32Array(w * h);
        for (let i = 0; i < values2.length; i++) values2[i] = bytes2[i * 4 + 3] / 255;
        return values2;
      }
      x.scale(w / target.width, h / target.height);
      x.translate(target.width / 2, target.height / 2);
      x.scale(target.flipX ? -1 : 1, target.flipY ? -1 : 1);
      x.rotate(-(target.rotation || 0) * Math.PI / 180);
      x.translate(-target.x - target.width / 2, -target.y - target.height / 2);
      x.drawImage(maskCanvas(projectDoc, projectDoc.selection, 1, api.assets), 0, 0);
      const bytes = x.getImageData(0, 0, w, h).data, values = new Float32Array(w * h);
      for (let i = 0; i < values.length; i++) values[i] = bytes[i * 4 + 3] / 255;
      return values;
    }
    function status(text, isError = false) {
      if (!mounted) return;
      $("#lab-status").textContent = text;
      $("#lab-status").classList.toggle("is-error", isError);
    }
    function viewRect() {
      const face = analysis?.faces?.[params.faceIndex], b = face?.box;
      let w = 1, h = 1, cx = 0.5, cy = 0.5;
      if (zoomMode !== "fit") {
        if (b) {
          cx = b.x + b.width / 2;
          cy = b.y + b.height / 2;
        }
        if (zoomMode === "face" && b) {
          w = Math.min(1, b.width * 1.65);
          h = Math.min(1, b.height * 1.65);
        } else {
          const z = Number(zoomMode) || 2;
          w = h = 1 / z;
        }
      }
      const vx = Math.max(0, Math.min(1 - w, cx - w / 2 + viewOffset.x)), vy = Math.max(0, Math.min(1 - h, cy - h / 2 + viewOffset.y));
      return { x: vx, y: vy, width: w, height: h };
    }
    function draw() {
      if (!mounted) return;
      const out = $("#lab-preview"), v = viewRect(), sx = v.x * preview.width, sy = v.y * preview.height, sw = v.width * preview.width, sh = v.height * preview.height;
      out.width = Math.max(1, Math.round(sw));
      out.height = Math.max(1, Math.round(sh));
      const x = out.getContext("2d");
      x.clearRect(0, 0, out.width, out.height);
      x.drawImage(preview, sx, sy, sw, sh, 0, 0, out.width, out.height);
      if (result) {
        const edited = canvas(result.width, result.height);
        const px = edited.getContext("2d").createImageData(result.width, result.height);
        px.data.set(result.data);
        edited.getContext("2d").putImageData(px, 0, 0);
        x.save();
        x.beginPath();
        x.rect(out.width * split / 100, 0, out.width * (1 - split / 100), out.height);
        x.clip();
        x.drawImage(edited, sx, sy, sw, sh, 0, 0, out.width, out.height);
        x.restore();
      }
      if (maskView && result?.mask && currentMode !== "face") {
        const mask = canvas(preview.width, preview.height), mx = mask.getContext("2d"), pixels = mx.createImageData(preview.width, preview.height);
        for (let i = 0; i < result.mask.length; i++) {
          pixels.data[i * 4] = currentMode === "restore" ? 244 : 102;
          pixels.data[i * 4 + 1] = currentMode === "restore" ? 140 : 225;
          pixels.data[i * 4 + 2] = currentMode === "restore" ? 108 : 193;
          pixels.data[i * 4 + 3] = result.mask[i] * 110;
        }
        mx.putImageData(pixels, 0, 0);
        x.drawImage(mask, sx, sy, sw, sh, 0, 0, out.width, out.height);
      }
      if (currentMode === "face" && analysis) {
        x.save();
        x.lineWidth = Math.max(1, out.width / 900);
        for (let i = 0; i < analysis.faces.length; i++) {
          const face = analysis.faces[i], b = face.box;
          x.strokeStyle = i === params.faceIndex ? "#b4f0da" : "#8c95a0";
          x.strokeRect((b.x - v.x) / v.width * out.width, (b.y - v.y) / v.height * out.height, b.width / v.width * out.width, b.height / v.height * out.height);
          if (maskView) {
            x.fillStyle = "#a5e4d1";
            for (const p of face.points) {
              x.beginPath();
              x.arc((p.x - v.x) / v.width * out.width, (p.y - v.y) / v.height * out.height, Math.max(1, out.width / 700), 0, Math.PI * 2);
              x.fill();
            }
          }
        }
        x.restore();
      }
      if (currentMode === "eyes" && eyePoints.length) {
        x.strokeStyle = "#a5e4d1"; x.lineWidth = 1.5;
        for (const p of eyePoints) {
          x.beginPath();
          x.arc((p.x - v.x) * out.width / v.width, (p.y - v.y) * out.height / v.height, p.radius * Math.min(preview.width, preview.height), 0, Math.PI * 2);
          x.stroke();
        }
      }
      if (brush === "view" && split > 0 && split < 100) {
        x.strokeStyle = "#f4f7f5";
        x.lineWidth = Math.max(1, out.width / 800);
        x.beginPath();
        x.moveTo(out.width * split / 100, 0);
        x.lineTo(out.width * split / 100, out.height);
        x.stroke();
      }
    }
    async function refresh() {
      if (!mounted || busy) return;
      $("#lab-active-groups").textContent = "Đang áp dụng: " + (Object.keys(TITLES).filter(g => g!=="portrait" && PHOTO_FIELDS[g].some(k => params[k] !== PHOTO_DEFAULTS[k])).map(g => TITLES[g]).join(" · ") || "Ảnh gốc");
      clearTimeout(debounce);
      const own = ++job;
      status(analyzing ? "Đang nhận diện da và mốc khuôn mặt…" : "Đang dựng bản xem trước…");
      try {
        const input = { data: preview.getContext("2d").getImageData(0, 0, preview.width, preview.height).data, width: preview.width, height: preview.height, params: clone(params), analysis, strokes: clone(strokes), eyePoints: clone(eyePoints), selection: selectionFor(preview.width, preview.height), mode: currentMode };
        const value = await processor.run(input);
        if (!mounted || own !== job) return;
        result = { ...value, width: preview.width, height: preview.height };
        draw();
        $("#lab-skin-coverage").textContent = currentMode === "eyes" ? (value.stats.redEyePixels || 0) + " pixel đỏ được sửa" : currentMode === "hair" ? Math.round((value.stats.hairCoverage || 0) * 100) + "% vùng tóc" : analysis?.skin ? Math.round(value.stats.skinCoverage * 100) + "% vùng da" : "Chưa có mask AI";
        $("#lab-face-count").textContent = analysis ? analysis.faces.length + " khuôn mặt" : "Chưa nhận diện";
        if (analysisError) status(analysisError, true);
        else if (!analyzing) {
          const noFace = ["portrait","face", "beard"].includes(currentMode) && analysis && !analysis.faces.length;
          status(noFace ? "Chưa nhận được mặt đủ rõ. Thử ảnh chính diện, đủ sáng hoặc chọn ảnh khác." : currentMode === "eyes" && params.redEye && !value.stats.redEyePixels ? "Không phát hiện pixel mắt đỏ đủ rõ. Có thể chạm vào đồng tử để kiểm tra vùng nhỏ hơn." : currentMode === "hair" && !value.stats.hairCoverage ? "Chưa có vùng tóc đủ tin cậy. Nhận diện lại hoặc dùng cọ + để chọn tóc." : "Xem trước đã cập nhật. Kéo thanh so sánh và tinh chỉnh mức độ.", noFace);
        }
        error = "";
      } catch (e) {
        if (e.name === "AbortError") return;
        error = e.message;
        status(error, true);
      }
    }
    function schedule() {
      clearTimeout(debounce);
      job++;debounce = setTimeout(refresh, 120);
    }
    function autoNatural(){
      if(busy||!mounted)return;
      if(!analysis){autoRequested=true;status('Đang nhận diện để tự chỉnh khuôn mặt…');if(!analyzing)detect();return;}
      autoRequested=false;
      if(!analysis.faces.length){status('Chưa nhận được mặt đủ rõ để tự chỉnh. Thử ảnh chính diện, đủ sáng.',true);return;}
      const input=preview.getContext('2d').getImageData(0,0,preview.width,preview.height);
      params=autoPortraitParams({data:input.data,width:preview.width,height:preview.height,analysis,faceIndex:params.faceIndex,current:params}).params;
      currentMode='portrait';selectedPreset='natural-auto';brush='view';record('Tự chỉnh chân dung');renderControls();renderFaceOptions();schedule();
    }
    async function detect() {
      if (analyzing || busy || !mounted) return;
      analyzing = true;
      error = "";
      analysisError = "";
      $("#lab-detect").disabled = true;
      $("#lab-apply").disabled = true;
      status("Đang tải model nhận diện cục bộ…");
      try {
        const bitmap = await createImageBitmap(preview), value = await analyzer.run(bitmap, (text) => status(text));
        if (!mounted) return;
        analysis = value;
        params.faceIndex = Math.min(params.faceIndex, Math.max(0, value.faces.length - 1));
        renderFaceOptions();
        if (!value.faces.length && currentMode === "face") status("Chưa nhận được mặt đủ rõ. Thử ảnh chính diện, đủ sáng hoặc chọn ảnh khác.", true);
        else if (currentMode === "skin" && !value.skin.values.some((v) => v > 0.5)) status("Mask da có độ tin cậy thấp. Bật xem mask rồi tô bổ sung.", true);
        else status("Nhận diện xong. Chọn preset và kiểm tra vùng mask.");
      } catch (e) {
        if (e.name !== "AbortError") {
          analysisError = e.message;
          status(analysisError, true);
        }
      } finally {
        analyzing = false;
        if (mounted) {
          $("#lab-detect").disabled = false;
          $("#lab-apply").disabled = busy;
          await refresh();
          renderControls();
          if(autoRequested){autoRequested=false;if(analysis&&!analysisError)autoNatural();}
        }
      }
    }
    function renderFaceOptions() {
      const select = $("#lab-face");
      select.innerHTML = analysis?.faces.length ? analysis.faces.map((f, i) => `<option value="${i}" ${i === params.faceIndex ? "selected" : ""}>Mặt ${i + 1}</option>`).join("") : '<option value="0">Chưa có khuôn mặt</option>';
      select.disabled = !analysis?.faces.length;
    }
    function field(key) {
      const min = negative.has(key) ? -80 : 0, max = negative.has(key) ? 80 : 100, value = params[key];
      return `<label class="lab-slider"><span>${LABELS[key]}</span><output id="lab-value-${key}">${value}</output><input data-lab-param="${key}" aria-label="${LABELS[key]}" type="range" min="${min}" max="${max}" value="${value}" step="1" ${["portrait","face", "beard"].includes(currentMode) && !analysis?.faces.length ? "disabled" : ""}></label>`;
    }
    function colorControl(key, label, swatches) {
      return `<div class="lab-color-control"><label>${label}<input data-lab-setting="${key}" type="color" value="${params[key]}" aria-label="${label}"></label><div class="lab-swatches">${swatches.map(([name, hex]) => `<button type="button" data-lab-color="${key}" data-color="${hex}" title="${name}" aria-label="${name}" style="--swatch:${hex}"></button>`).join("")}</div></div>`;
    }
    function renderControls() {
      if (!mounted) return;
      $("#lab-tabs").innerHTML = Object.entries(TITLES).map(([key, title]) => `<button data-lab-mode="${key}" role="tab" aria-selected="${key === currentMode}" class="${key === currentMode ? "active" : ""}">${title}</button>`).join("");
      $("#lab-presets").innerHTML = PHOTO_PRESETS[currentMode].map((p) => `<button data-lab-preset="${p.id}" class="${selectedPreset === p.id ? "active" : ""}"${p.params.hairColor || p.params.irisColor ? ` style="--preset-color:${p.params.hairColor || p.params.irisColor}"` : ""}><strong>${p.name}</strong><small>${p.description}</small></button>`).join("");
      $('#lab-auto-card').hidden=currentMode!=='portrait';$('#lab-preset-drawer').open=currentMode!=='portrait';
      $('#lab-auto').disabled=busy;$('#lab-auto').textContent=analyzing?'Đang nhận diện · bấm để tự chỉnh sau đó':'Tự chỉnh tự nhiên · 1 chạm';
      $("#lab-explanation").textContent = EXPLANATIONS[currentMode];
      $("#lab-settings").innerHTML = (currentMode === "skin" ? `<label class="lab-select">Vùng da<select id="lab-scope" aria-label="Vùng da"><option value="all" ${params.scope === "all" ? "selected" : ""}>Da mặt + cơ thể</option><option value="face" ${params.scope === "face" ? "selected" : ""}>Da của khuôn mặt đã chọn</option><option value="body" ${params.scope === "body" ? "selected" : ""}>Da cơ thể</option><option value="manual" ${params.scope === "manual" ? "selected" : ""}>Chỉ vùng tự tô</option></select></label><label class="check-row"><input id="lab-protect" type="checkbox" ${params.protect ? "checked" : ""}> Bảo vệ mắt, môi và chân mày</label><label class="check-row"><input id="lab-freckles" type="checkbox" ${params.keepFreckles ? "checked" : ""}> Giữ đốm tối khi tự tìm khuyết điểm</label>` : "") + (currentMode==='portrait' ? [['Gọn mặt & cằm',['faceSlim','jawSlim','chinSlim']],['Da tự nhiên',['shine','shineSensitivity','studio','texture']],['Chân mày & râu',['browThickness','browDensity','stubble']]].map(([title,keys])=>`<h4 class="lab-section-title">${title}</h4>${keys.map(field).join('')}`).join('') : PHOTO_FIELDS[currentMode].map(field).join("")) + field("strength");
      if (currentMode === "eyes") $("#lab-settings").insertAdjacentHTML('afterbegin', `<label class="check-row"><input type="checkbox" data-lab-setting="redEyeAll" ${params.redEyeAll ? "checked" : ""}> Sửa mắt đỏ trên tất cả khuôn mặt</label><div class="lab-eye-tap-row"><button class="button ${brush === "eye" ? "active" : ""}" id="lab-eye-tap">${brush === "eye" ? "Đang chạm chọn đồng tử" : "Chạm vào mắt"}</button><button class="button" id="lab-eye-undo">Lùi điểm</button></div><label class="lab-slider">Bán kính khi chạm<output id="lab-eye-radius-value">${Math.round(eyeRadius * 1000) / 10}%</output><input id="lab-eye-radius" type="range" min=".2" max="5" step=".1" value="${eyeRadius * 100}" aria-label="Bán kính sửa mắt đỏ"></label>${colorControl("irisColor", "Màu mống mắt", [["Nâu", "#865334"], ["Xanh lá", "#65875e"], ["Xanh lam", "#5b89af"], ["Xám", "#85949c"]])}<label class="lab-select">Mắt đổi màu<select data-lab-setting="irisSide" aria-label="Mắt đổi màu">${[["both", "Cả hai mắt"], ["left", "Bên trái ảnh"], ["right", "Bên phải ảnh"]].map(([v, n]) => `<option value="${v}" ${params.irisSide === v ? "selected" : ""}>${n}</option>`).join("")}</select></label>`);
      if (currentMode === "hair") $("#lab-settings").insertAdjacentHTML('afterbegin', `${colorControl("hairColor", "Màu tóc tùy chọn", [["Nâu chocolate", "#64402f"], ["Đồng", "#b86835"], ["Đỏ rượu", "#863753"], ["Đen", "#272329"], ["Vàng mật ong", "#c9a46b"], ["Xám khói", "#818c9b"]])}<label class="check-row"><input type="checkbox" data-lab-setting="hairAll" ${params.hairAll ? "checked" : ""}> Toàn bộ tóc trong ảnh</label>`);
      if (currentMode === "beard") $("#lab-settings").insertAdjacentHTML('afterbegin', `${colorControl("beardColor", "Màu sợi râu", [["Đen", "#211d1b"], ["Nâu", "#50382b"], ["Nâu đỏ", "#875334"], ["Muối tiêu", "#8a8780"]])}<label class="lab-select">Kiểu râu mô phỏng<select data-lab-setting="beardStyle" aria-label="Kiểu râu">${[["none", "Không thêm râu"], ["stubble", "Lún phún"], ["moustache", "Ria mép"], ["chin", "Râu cằm"], ["goatee", "Râu dê"], ["boxed", "Quai nón gọn"], ["full", "Quai nón đầy"]].map(([v, n]) => `<option value="${v}" ${params.beardStyle === v ? "selected" : ""}>${n}</option>`).join("")}</select></label>`);
      $("#lab-ai-link").hidden = !["face", "beard"].includes(currentMode);
      $("#lab-ai-link").textContent = currentMode === "beard" ? "Áp retouch & mở xóa râu / tạo râu AI ↗" : "Áp retouch & mở tạo kiểu cười AI ↗";
      $("#lab-active-groups").textContent = "Đang áp dụng: " + (Object.keys(TITLES).filter(g => g!=="portrait" && PHOTO_FIELDS[g].some(k => params[k] !== PHOTO_DEFAULTS[k])).map(g => TITLES[g]).join(" · ") || "Ảnh gốc");
      $("#lab-brush-tools").hidden = ["portrait","face", "eyes"].includes(currentMode);
      $("#lab-detection-row").hidden = currentMode === "restore";
      $("#lab-face-field").hidden = currentMode === "restore";
      $("#lab-mask-label").textContent = { portrait:"Hiện mask da",face: "Hiện mốc mặt", restore: "Hiện vùng vá", eyes: "Hiện vùng mắt", hair: "Hiện vùng tóc", beard: "Hiện vùng râu", skin: "Hiện mask da" }[currentMode];
      for (const button of document.querySelectorAll("[data-lab-mode]")) button.onclick = () => {
        if (busy) return;
        currentMode = button.dataset.labMode;
        selectedPreset = "";
        brush = "view";
        renderControls();
        if (currentMode !== "restore" && (!analysis || currentMode === "hair" && !analysis.skin?.hair) && !analyzing) detect();
        else refresh();
      };
      for (const button of document.querySelectorAll("[data-lab-preset]")) button.onclick = () => {
        if (busy) return;
        if(currentMode==="portrait"&&button.dataset.labPreset==="natural-auto"){autoNatural();return;}
        selectedPreset = button.dataset.labPreset;
        params = presetParams(currentMode, selectedPreset, params);
        if(currentMode==="portrait"){params.scope="face";params.protect=true;}record("Preset "+selectedPreset);
        renderControls();
        schedule();
      };
      for (const input of document.querySelectorAll("[data-lab-param]")) input.oninput = () => {
        if (busy) return;
        params[input.dataset.labParam] = Number(input.value);
        selectedPreset = "";
        document.querySelectorAll("[data-lab-preset].active").forEach((button) => button.classList.remove("active"));
        $("#lab-value-" + input.dataset.labParam).textContent = input.value;record(LABELS[input.dataset.labParam],input.dataset.labParam);
        schedule();
      };
      for(const input of document.querySelectorAll("[data-lab-param]"))input.onchange=()=>history.endGroup();
      for (const input of document.querySelectorAll("[data-lab-setting]")) input.onchange = () => {
        if (busy) return;
        params[input.dataset.labSetting] = input.type === "checkbox" ? input.checked : input.value;record("Đổi thiết lập");
        selectedPreset = "";
        schedule();
      };
      for (const b of document.querySelectorAll("[data-lab-color]")) b.onclick = () => {
        if (busy) return;
        params[b.dataset.labColor] = b.dataset.color;
        if (b.dataset.labColor === "irisColor" && !params.irisAmount) params.irisAmount = 65;
        if (b.dataset.labColor === "hairColor" && !params.hairAmount) params.hairAmount = 78;
        record("Đổi màu");renderControls(); schedule();
      };
      if ($("#lab-eye-tap")) {
        $("#lab-eye-tap").onclick = () => { if (busy) return; brush = brush === "eye" ? "view" : "eye"; renderControls(); draw(); };
        $("#lab-eye-undo").onclick = () => { if (busy) return; eyePoints.pop();record("Bỏ điểm mắt"); refresh(); };
        $("#lab-eye-radius").oninput = e => { eyeRadius = Number(e.target.value) / 100; $("#lab-eye-radius-value").textContent = e.target.value + "%"; };
      }
      if ($("#lab-scope")) $("#lab-scope").onchange = (e) => {
        params.scope = e.target.value;record("Đổi vùng xử lý");
        schedule();
      };
      if ($("#lab-protect")) $("#lab-protect").onchange = (e) => {
        params.protect = e.target.checked;record("Đổi vùng xử lý");
        schedule();
      };
      if ($("#lab-freckles")) $("#lab-freckles").onchange = (e) => {
        params.keepFreckles = e.target.checked;record("Đổi vùng xử lý");
        schedule();
      };
      $("#lab-preview").style.cursor = brush === "view" ? "default" : "crosshair";
      for (const b of document.querySelectorAll("[data-lab-brush]")) b.classList.toggle("active", b.dataset.labBrush === brush);
    }
    async function apply() {
      if (busy || analyzing) return;
      const current = api.doc()?.layers.find((l) => l.id === targetId);
      if (api.doc()?.id !== documentId || !current || sig(current) !== signature) {
        status("Layer nguồn đã thay đổi. Đóng và mở lại Retouch Lab.", true);
        return;
      }
      if (!originalRecipe && projectDoc.layers.length >= 150) {
        status("Đã đạt giới hạn 150 layer.", true);
        return;
      }
      if (["portrait","face", "beard"].includes(currentMode) && !analysis?.faces.length) {
        status("Cần nhận diện được khuôn mặt trước khi chỉnh hình dáng.", true);
        return;
      }
      busy = true;
      clearTimeout(debounce);
      job++;
      processor.stop();
      $("#lab-apply").disabled = true;
      $("#lab-settings").inert = true;
      $("#lab-presets").inert = true;
      $("#lab-tabs").inert = true;
      status("Đang dựng ảnh kết quả ở độ phân giải đầu ra…");
      try {
        const scale = 1, w = Math.max(1, Math.floor(image.width * scale)), h = Math.max(1, Math.floor(image.height * scale)), full = canvas(w, h);
        full.getContext("2d").drawImage(image, 0, 0, w, h);
        const savedMask = selectionFor(w, h);
        const value = await processor.run({ data: full.getContext("2d").getImageData(0, 0, w, h).data, width: w, height: h, params: clone(params), analysis, strokes: clone(strokes), eyePoints: clone(eyePoints), selection: savedMask, mode: currentMode });
        if (!mounted) return;
        const check = api.doc()?.layers.find((l) => l.id === targetId);
        if (api.doc()?.id !== documentId || !check || sig(check) !== signature) throw new Error("Layer nguồn đã thay đổi trong khi xử lý. Không áp kết quả cũ.");
        if(originalRecipe&&!canEdit(projectDoc,check,"replacepixels"))throw Error("Mở khóa nội dung trước khi ghi lại retouch.");
        const pixels = full.getContext("2d").createImageData(w, h);
        pixels.data.set(value.data);
        full.getContext("2d").putImageData(pixels, 0, 0);
        const outSource = full.toDataURL();
        api.assets.set(outSource, full);
        const recipe = { version: 1, mode: currentMode, source, originId: originalRecipe?.originId || targetId, params: clone(params), analysis: encodedAnalysis(analysis), strokes: clone(strokes), eyePoints: clone(eyePoints) };
        if (savedMask) {
          const m = canvas(w, h), mx = m.getContext("2d"), mp = mx.createImageData(w, h);
          for (let i = 0; i < savedMask.length; i++) {
            mp.data[i * 4] = mp.data[i * 4 + 1] = mp.data[i * 4 + 2] = 255;
            mp.data[i * 4 + 3] = savedMask[i] * 255;
          }
          mx.putImageData(mp, 0, 0);
          recipe.selectionSource = m.toDataURL();
        }
        validatePhotoRecipe(recipe, (s) => {
          if (!s.startsWith("data:image/") && s !== "assets/wave.jpg") throw new Error("Invalid embedded source.");
        });
        if (originalRecipe) {
          check.source = outSource;
          check.photoRecipe = recipe;
          delete check.productRecipe; delete check.cutoutRecipe; delete check.paperRecipe; delete check.colorRecipe; delete check.landscapeRecipe; delete check.sceneRecipe; delete check.artRecipe;
          delete check.removalRecipe;
        } else {
          const next = createLayer("image", { ...clone(check), id: uid(), type: "image", locked: false, locks: {}, name: "Retouch · " + TITLES[currentMode], source: outSource, photoRecipe: recipe });
          delete next.productRecipe; delete next.cutoutRecipe; delete next.paperRecipe; delete next.colorRecipe; delete next.landscapeRecipe; delete next.sceneRecipe; delete next.artRecipe;
          delete next.removalRecipe;
          check.visible = false;
          projectDoc.layers.splice(projectDoc.layers.indexOf(check) + 1, 0, next);
          projectDoc.activeId = next.id;
          projectDoc.selectedIds = [next.id];
        }
        state.close();
        api.closeModal();
        api.commit(originalRecipe ? "Chỉnh lại Retouch Lab" : "Retouch Lab · " + TITLES[currentMode]);
        api.toast("Đã áp kết quả. Chọn Sửa lại Retouch để đổi preset / thông số.");
      } catch (e) {
        if (e.name !== "AbortError" && mounted) status(e.message, true);
      } finally {
        busy = false;
        if (mounted) {
          $("#lab-apply").disabled = false;
          $("#lab-settings").inert = false;
          $("#lab-presets").inert = false;
          $("#lab-tabs").inert = false;
        }
      }
    }
    const outputScale = 1, outputW = Math.floor(image.width * outputScale), outputH = Math.floor(image.height * outputScale);
    api.showModal("Retouch Lab", "Preset trước. Tinh chỉnh sau. Nguồn ảnh được giữ lại.", `<div class="photo-lab"><section class="lab-image-side"><div class="lab-preview-heading"><span>${esc(target.name)}</span><select id="lab-zoom" aria-label="Thu phóng preview" title="Khi phóng to, kéo ảnh để di chuyển vùng xem"><option value="fit">Toàn ảnh</option><option value="face">Soi khuôn mặt</option><option value="2">200%</option><option value="4">400%</option></select><span class="lab-local">${icon("shield")} ON DEVICE</span></div><div class="lab-canvas-wrap"><canvas id="lab-preview" width="${preview.width}" height="${preview.height}" aria-label="Retouch preview. Before on the left, edited on the right."></canvas></div><div class="lab-compare"><span>Gốc</span><input id="lab-split" type="range" min="0" max="100" value="50" aria-label="So sánh trước sau"><span>Kết quả</span></div><div class="lab-history"><button class="button" id="lab-undo" title="Hoàn tác · Ctrl+Z">↶ Hoàn tác</button><button class="button" id="lab-redo" title="Làm lại · Ctrl+Shift+Z">↷ Làm lại</button><span>Ctrl+Z / Ctrl+Shift+Z</span></div><div class="lab-tools"><label class="check-row"><input id="lab-mask" type="checkbox"> <span id="lab-mask-label">Hiện mask da</span></label><div id="lab-brush-tools"><button data-lab-brush="view" title="Xem ảnh">${icon("eye")}</button><button data-lab-brush="add" title="Tô bổ sung vùng xử lý">${icon("plus")}</button><button data-lab-brush="subtract" title="Bảo vệ / bỏ vùng xử lý">${icon("minus")}</button><label>Cọ<input id="lab-brush-size" aria-label="Cỡ cọ tinh chỉnh" type="range" min="1" max="15" value="3.5" step=".5"></label><button id="lab-undo-stroke" title="Bỏ nét tô cuối">${icon("undo")}</button></div></div><div class="lab-detection-row" id="lab-detection-row"><span id="lab-face-count">Chưa nhận diện</span><span id="lab-skin-coverage">Chưa có mask AI</span><button class="button" id="lab-detect">Nhận diện lại da & mặt</button></div><p class="lab-status" id="lab-status" role="status">Đang chuẩn bị ảnh…</p><p class="lab-output-note">Đầu ra ${outputW} × ${outputH} px${savedSelection ? " · Giữ vùng chọn đã lưu" : projectDoc.selection ? " · Chỉ áp vào vùng chọn hiện tại" : ""}. Lưu .luma để sửa lại thông số.</p></section><section class="lab-control-side"><div class="lab-auto-card" id="lab-auto-card"><span class="lab-auto-kicker">PORTRAIT STUDIO · 6.9</span><h3>Tự nhiên, theo cách của bạn.</h3><p>Một chạm chỉnh nhẹ. Mọi thông số đều có thể thay đổi.</p><button class="button primary" id="lab-auto">Tự chỉnh tự nhiên · 1 chạm</button><small>Áp vào khuôn mặt đang chọn bên dưới.</small></div><div id="lab-tabs" class="lab-tabs" role="tablist" aria-label="Loại retouch"></div><div class="lab-preset-heading"><span>PRESET NHANH</span><button id="lab-reset" type="button">Đặt lại mục này</button></div><details id="lab-preset-drawer" class="lab-preset-drawer"><summary>Mở các preset có sẵn</summary><div id="lab-presets" class="lab-presets"></div></details><p id="lab-active-groups" class="lab-active-groups" aria-live="polite"></p><p id="lab-explanation" class="lab-explanation"></p><button id="lab-ai-link" class="button lab-ai-link" hidden></button><label class="lab-select" id="lab-face-field">Khuôn mặt<select id="lab-face" aria-label="Chọn khuôn mặt"></select></label><div id="lab-settings"></div></section></div>`, [{ label: "Hủy", run: () => api.closeModal(true) }, { label: originalRecipe ? "Cập nhật Retouch" : "Áp thành layer riêng", primary: true, run: apply }, { label: "Thử ảnh mẫu", run: () => {
      api.closeModal(true);
      currentMode === "restore" ? api.openRestoreSample?.() : api.openSample?.();
    } }], () => {
      const applyButton = document.querySelector('[data-modal-button="1"]');
      applyButton.id = "lab-apply";
      renderControls();
      renderFaceOptions();history.reset(snapshot());historyButtons();
      $('#lab-undo').onclick=undo;$('#lab-redo').onclick=redo;$('#lab-auto').onclick=autoNatural;
      unbindHistory=bindEditorHistory(undo,redo,document.querySelector('#modal'));
      const out = $("#lab-preview");
      $("#lab-zoom").onchange = (e) => {
        zoomMode = e.target.value;
        viewOffset = { x: 0, y: 0 };
        draw();
      };
      $("#lab-split").oninput = (e) => {
        split = Number(e.target.value);
        draw();
      };
      $("#lab-mask").onchange = (e) => {
        maskView = e.target.checked;
        draw();
      };
      $("#lab-detect").onclick = detect;
      $("#lab-face").onchange = (e) => {
        if (busy) return;
        params.faceIndex = Number(e.target.value);record("Chọn khuôn mặt");
        viewOffset = { x: 0, y: 0 };
        schedule();
      };
      $("#lab-reset").onclick = () => {
        if (busy) return;
        for (const key of PHOTO_GROUP_FIELDS[currentMode]) params[key] = PHOTO_DEFAULTS[key];
        if (currentMode === "eyes") eyePoints = [];
        selectedPreset = "";record("Đặt lại mục này");
        renderControls();
        schedule();
      };
      $("#lab-undo-stroke").onclick = () => {
        if (busy) return;
        const type = { skin: "skin", hair: "hair", beard: "beard", restore: "damage" }[currentMode];
        const index = strokes.findLastIndex(s => s.type === type);
        if (index >= 0){strokes.splice(index, 1);record("Bỏ nét tô");}
        schedule();
      };
      $("#lab-ai-link").onclick = async () => {
        if (busy || analyzing) return;
        const nextMode = currentMode === "beard" ? "beard" : "expression";
        await apply();
        if (!mounted) api.openGenerative?.(nextMode);
      };
      $("#lab-brush-size").oninput = (e) => brushSize = Number(e.target.value) / 100;
      for (const button of document.querySelectorAll("[data-lab-brush]")) button.onclick = () => {
        brush = button.dataset.labBrush;
        maskView = brush !== "view";
        $("#lab-mask").checked = maskView;
        renderControls();
        draw();
      };
      const point = (e) => {
        const r = out.getBoundingClientRect();
        const v = viewRect();
        return [Math.max(0, Math.min(1, v.x + (e.clientX - r.left) / r.width * v.width)), Math.max(0, Math.min(1, v.y + (e.clientY - r.top) / r.height * v.height))];
      };
      out.onpointerdown = (e) => {
        if (busy || e.button && e.button !== 0) return;
        if (currentMode === "eyes" && brush === "eye") {
          if (eyePoints.length >= 16) { status("Tối đa 16 điểm mắt. Bấm Lùi điểm để bỏ điểm cuối.", true); return; }
          const [x, y] = point(e);
          eyePoints.push({ x, y, radius: Math.max(.002, Math.min(.05, eyeRadius)) });
          params.redEye = 100;record("Chạm sửa mắt đỏ"); renderControls(); refresh(); return;
        }
        if (brush === "view") {
          if (zoomMode !== "fit") {
            out.setPointerCapture(e.pointerId);
            pendingPan = { x: e.clientX, y: e.clientY, offset: { ...viewOffset }, view: viewRect() };
          }
          return;
        }
        if (["portrait","face", "eyes"].includes(currentMode)) return;
        if (strokes.length >= 80 || strokes.reduce((n, s) => n + s.points.length, 0) >= 2e4) {
          status("Tối đa 80 nét tinh chỉnh. Bỏ bớt nét cuối hoặc áp một lượt trước.", true);
          return;
        }
        e.preventDefault();
        out.setPointerCapture(e.pointerId);
        pendingStroke = { type: { restore: "damage", hair: "hair", beard: "beard", skin: "skin" }[currentMode], add: brush === "add", radius: brushSize, points: [point(e)] };
      };
      out.onpointermove = (e) => {
        if (pendingPan) {
          const r = out.getBoundingClientRect();
          viewOffset = { x: pendingPan.offset.x - (e.clientX - pendingPan.x) / r.width * pendingPan.view.width, y: pendingPan.offset.y - (e.clientY - pendingPan.y) / r.height * pendingPan.view.height };
          draw();
          return;
        }
        if (!pendingStroke) return;
        const points = pendingStroke.points, last = points.at(-1), p = point(e);
        if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 3e-3 && points.length < 2e3 && strokes.reduce((n, s) => n + s.points.length, 0) + points.length < 2e4) points.push(p);
        const x = out.getContext("2d");
        x.save();
        x.strokeStyle = pendingStroke.add ? "#8ce6c2" : "#fcad91";
        x.lineWidth = brushSize * Math.min(preview.width, preview.height) * 2;
        x.lineCap = "round";
        x.beginPath();
        const v = viewRect();
        x.moveTo((last[0] - v.x) / v.width * out.width, (last[1] - v.y) / v.height * out.height);
        x.lineTo((p[0] - v.x) / v.width * out.width, (p[1] - v.y) / v.height * out.height);
        x.stroke();
        x.restore();
      };
      const finish = () => {
        if (pendingPan) {
          pendingPan = null;
          return;
        }
        if (!pendingStroke) return;
        strokes.push(pendingStroke);
        pendingStroke = null;record("Tô vùng xử lý");
        refresh();
      };
      out.onpointerup = finish;
      out.onpointercancel = () => {
        pendingPan = null;
        pendingStroke = null;
        draw();
      };
      draw();
      refresh();
      if (currentMode !== "restore" && (!analysis || currentMode === "hair" && !analysis.skin?.hair)) detect();
    }, () => state.close());
    return state;
  }
  return { open, cancel: () => {
    if (active) {
      active.close();
      api.closeModal();
    }
  }, current: () => active, actions: { "retouch-lab": () => open(), "portrait-auto":()=>open("portrait"), "skin-lab":()=>open("skin"), "face-lab": () => open("face"), "eyes-lab": () => open("eyes"), "hair-lab": () => open("hair"), "beard-lab": () => open("beard"), "restore-lab": () => open("restore") }, actionItems: [["skin-lab","Da studio · làm mịn & kết cấu","clone",""],["portrait-auto","Auto chân dung · Gọn mặt & giảm bóng dầu","user",""],["retouch-lab", "Retouch Lab · Chân dung & da studio", "sparkles", ""], ["face-lab", "Retouch Lab · Mặt & biểu cảm", "user", ""], ["eyes-lab", "Mắt đỏ 1 chạm & màu mắt", "eye", ""], ["hair-lab", "Đổi màu tóc · AI mask", "sparkles", ""], ["beard-lab", "Râu · kiểu dáng & xóa râu", "user", ""], ["restore-lab", "Retouch Lab · Phục hồi ảnh cũ", "history", ""]] };
}
export {
  createPhotoLab
};
