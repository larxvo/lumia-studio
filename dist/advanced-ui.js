import { canvas, renderDocument } from "./renderer.js";
import { clone, validateDocument } from "./model.js";
import { smartAsset, convertSmartObject, replaceSmartContent, makeIndependent, smartContentDocument } from "./smart-objects.js";
import { DEFAULT_COLOR, getProfileBytes, profileInfo, validateICC, bytesToBase64, proofCMYK, separateCMYK, encodeCMYKTiff } from "./color-engine.js";
import { createGenerativeStudio } from "./generative-ui.js";
import { createCollaboration } from "./collaboration-ui.js";
import { downloadBlob } from "./storage.js";
import { icon } from "./icons.js";
import {createDesignImport} from './design-import-ui.js';
import {createPrecisionStudio} from './precision-ui.js';
import {createSkinResearch} from './skin-research-ui.js';
import {createCutoutStudio} from './cutout-ui.js';
import {createRemovalStudio} from './removal-ui.js';
import {createPaperStudio} from './paper-ui.js';
import {createProductStudio} from './product-ui.js';
import {createColorStudio} from './color-ui.js';
import {createLandscapeStudio} from './landscape-ui.js';
const $ = (s) => document.querySelector(s), esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
import {createSceneStudio} from './scene-ui.js';
import {createArtStudio} from './art-ui.js';
function createAdvancedStudio(api) {
  const edits = /* @__PURE__ */ new Map(), generative = createGenerativeStudio(api), collaboration = createCollaboration(api),importer=createDesignImport(api),precision=createPrecisionStudio(api),skinResearch=createSkinResearch(api),cutout=createCutoutStudio(api),removal=createRemovalStudio(api),product=createProductStudio(api),paper=createPaperStudio(api),colorEditor=createColorStudio(api),landscape=createLandscapeStudio(api),scene=createSceneStudio({...api,openSceneAI:prompt=>generative.open('repair',{scenePrompt:prompt})}),art=createArtStudio({...api,openArtAI:target=>generative.open('art',{artTarget:target})});
  let proofTimer = null, proofVersion = 0, proofError = "";
  function proofCanvas(target, source) {
    clearTimeout(proofTimer);
    const version = ++proofVersion, settings = api.doc()?.colorManagement;
    const badge = $("#proof-label");
    if (badge) badge.hidden = !settings?.proof;
    if (!settings?.proof) return;
    proofTimer = setTimeout(async () => {
      try {
        const profile = await getProfileBytes(settings), pixels = source.getContext("2d").getImageData(0, 0, source.width, source.height), data = await proofCMYK(pixels.data, profile, settings);
        if (version !== proofVersion) return;
        pixels.data.set(data);
        target.getContext("2d").putImageData(pixels, 0, 0);
        proofError = "";
        if (badge) badge.textContent = "ICC · CMYK preview";
      } catch (error) {
        if (version !== proofVersion) return;
        if (badge) badge.textContent = "ICC · không xem thử được";
        if (proofError !== error.message) {
          proofError = error.message;
          api.toast(error.message, true);
        }
      }
    }, 180);
  }
  async function convert() {
    convertSmartObject(api.doc(), api.layer(), api.assets);
    validateDocument(api.doc());
    api.commit("Chuyển thành Smart Object");
  }
  function smartManager() {
    const d = api.doc(), candidates = d.layers.filter((l) => l.type !== "adjustment");
    if (!candidates.length) throw new Error("Thêm ảnh, chữ, shape hoặc nhóm trước.");
    api.showModal("Smart Objects", "Nội dung dùng chung · biến đổi độc lập", `<div class="advanced-intro"><span class="live-pill">EDITABLE CONTENT</span><p>Mỗi instance có vị trí, kích thước, mask và bộ lọc riêng. Duplicate dùng chung nguồn; Tạo bản riêng tách nội dung để sửa độc lập.</p></div><label class="modal-field">Layer / nhóm<select id="smart-target">${candidates.map((l) => `<option value="${esc(l.id)}" ${l.id === d.activeId ? "selected" : ""}>${esc(l.name)}${l.smartObjectId ? " · Smart Object" : ""}${l.locked ? " · đang khóa" : ""}</option>`).join("")}</select></label><p id="smart-info" class="advanced-status"></p><div class="studio-button-grid"><button class="button primary" id="smart-convert-button">Chuyển thành Smart Object</button><button class="button" id="smart-edit-button">Sửa nội dung</button><button class="button" id="smart-replace-button">Thay nội dung</button><button class="button" id="smart-independent-button">Tạo bản riêng</button></div><p class="gen-size-note">Sửa nội dung mở tab riêng; dùng Lưu nội dung để cập nhật các instance. .luma giữ cấu trúc; PSD/PSB hỗ trợ Smart Objects nhúng với biến đổi affine, Gaussian Blur / Unsharp Mask tương thích giữ thông số; warp và filter khác dùng composite.</p>`, [{ label: "Đóng", primary: true, run: () => api.closeModal() }], () => {
      const target = () => d.layers.find((l) => l.id === $("#smart-target").value);
      const refresh = () => {
        const l = target(), a = smartAsset(d, l);
        $("#smart-info").textContent = a ? `${a.name} · nguồn ${a.width} × ${a.height} px · ${d.layers.filter((x) => x.smartObjectId === a.id).length} instance` : "Chuyển layer thành nội dung nhúng để sửa lại và dùng chung giữa các bản sao.";
        $("#smart-convert-button").disabled = !!a;
        $("#smart-convert-button").textContent = l?.locked ? "Cần mở khóa trước khi chuyển" : "Chuyển thành Smart Object";
        for (const id of ["edit", "replace", "independent"]) $("#smart-" + id + "-button").disabled = !a;
      };
      $("#smart-target").onchange = refresh;
      refresh();
      for (const action of ["convert", "edit", "replace", "independent"]) $("#smart-" + action + "-button").onclick = () => {
        const l = target();
        if (api.doc() !== d || !l) {
          api.toast("Tài liệu đã thay đổi.", true);
          return;
        }
        api.selectLayer(l.id);

        api.closeModal();
        api.runAction("smart-" + action);
      };
    });
  }
  async function edit() {
    const parent = api.doc(), asset = smartAsset(parent, api.layer());
    if (!asset) throw new Error("Chọn một Smart Object để sửa nội dung.");
    let child = [...edits].find(([id, e]) => e.parentId === parent.id && e.assetId === asset.id && api.findDocument(id));
    if (child) {
      api.setDocument(api.findDocument(child[0]));
      return;
    }
    const nested = smartContentDocument(parent, api.layer());
    await api.assets.hydrate(nested);
    edits.set(nested.id, { parentId: parent.id, assetId: asset.id, signature: JSON.stringify(asset) });
    api.setDocument(nested, "Mở nội dung Smart Object");
    api.toast("Chỉnh nội dung, sau đó bấm Lưu nội dung ở thanh trên.");
  }
  async function saveContent() {
    const child = api.doc(), entry = edits.get(child.id);
    if (!entry) throw new Error("Đây không phải tab nội dung Smart Object.");
    const parent = api.findDocument(entry.parentId), asset = parent?.smartObjects?.find((a) => a.id === entry.assetId);
    if (!asset) throw new Error("Tài liệu cha hoặc Smart Object đã đóng / bị xóa.");
    if (JSON.stringify(asset) !== entry.signature) throw new Error("Nội dung gốc đã thay đổi ở tab khác hoặc người cùng sửa. Mở lại nội dung để tránh ghi đè.");
    validateDocument(clone(child));
    const rendered = renderDocument(child, api.assets);
    replaceSmartContent(parent, asset.id, rendered, api.assets, null, child);
    entry.signature = JSON.stringify(asset);
    api.commitDocument(parent.id, "Cập nhật nội dung Smart Object");
    api.setDocument(parent);
    api.toast("Đã cập nhật mọi instance dùng chung nội dung.");
  }
  function replace() {
    const d = api.doc(), l = api.layer(), asset = smartAsset(d, l);
    if (!asset) throw new Error("Chọn một Smart Object.");
    const signature = JSON.stringify(asset);
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const image = await api.readImageFile(file);
        if (api.doc() !== d || JSON.stringify(smartAsset(d, l)) !== signature) throw new Error("Smart Object đã thay đổi. Chọn lại để thay nội dung.");
        replaceSmartContent(d, asset.id, image, api.assets, file.name.replace(/\.[^.]+$/, ""));
        api.commit("Thay nội dung Smart Object");
      } catch (error) {
        api.toast(error.message, true);
      }
    };
    input.click();
  }
  function independent() {
    makeIndependent(api.doc(), api.layer());
    api.commit("Tạo nội dung Smart Object riêng");
  }
  async function color() {
    const d = api.doc(), settings = { ...DEFAULT_COLOR, ...d.colorManagement }, s = Math.min(1, 700 / Math.max(d.width, d.height)), preview = renderDocument(d, api.assets, { scale: s, background: "#fff" }), raw = preview.getContext("2d").getImageData(0, 0, preview.width, preview.height).data;
    let mounted = true, proof = null, split = 50, version = 0;
    const draw = () => {
      if (!mounted) return;
      const c = $("#color-preview");
      c.width = preview.width;
      c.height = preview.height;
      const x = c.getContext("2d");
      x.drawImage(preview, 0, 0);
      if (proof) {
        x.save();
        x.beginPath();
        x.rect(c.width * split / 100, 0, c.width * (1 - split / 100), c.height);
        x.clip();
        x.drawImage(proof, 0, 0);
        x.restore();
      }
    };
    async function update() {
      const n = ++version;
      $("#color-status").textContent = "Đang chuyển qua ICC bằng LittleCMS…";
      try {
        const profile = await getProfileBytes(settings), pixels = await proofCMYK(raw, profile, settings);
        if (!mounted || n !== version) return;
        proof = canvas(preview.width, preview.height);
        const x = proof.getContext("2d"), image = x.createImageData(preview.width, preview.height);
        image.data.set(pixels);
        x.putImageData(image, 0, 0);
        draw();
        $("#color-status").textContent = "Đã xem thử qua CMYK → sRGB. Pixel tài liệu vẫn giữ trong không gian sRGB.";
        $("#color-save").disabled = false;
      } catch (error) {
        if (mounted) $("#color-status").textContent = error.message;
      }
    }
    api.showModal("Màu in & ICC", "LittleCMS · chuyển đổi thực theo profile", `<div class="color-studio"><div><div class="gen-preview-wrap"><canvas id="color-preview" aria-label="So sánh sRGB và bản xem thử CMYK"></canvas></div><div class="lab-compare"><span>sRGB</span><input id="color-split" type="range" min="0" max="100" value="50" aria-label="So sánh màu in"><span>Qua ICC CMYK</span></div><p id="color-status" class="advanced-status" role="status"></p></div><div><span class="live-pill">ICC / CMYK</span><h3>Chuẩn bị màu để in</h3><p class="lab-explanation">Biên tập trong sRGB, xem thử màu qua profile CMYK và xuất TIFF 8-bit có nhúng ICC. Profile của nhà in quyết định phép tách màu.</p><label class="modal-field">ICC đầu ra<input id="color-profile-name" value="${esc(settings.profileName)}" readonly></label><input type="file" id="color-icc-file" accept=".icc,.icm" hidden><button class="button" id="color-load">Nạp ICC của nhà in</button><button class="button" id="color-default">Dùng profile mẫu</button><p class="gen-size-note">Profile Amethyst đi kèm là mẫu thử nghiệm. Với đơn in thực tế, dùng ICC do nhà in cung cấp.</p><label class="modal-field">Rendering intent<select id="color-intent">${[[0, "Perceptual"], [1, "Relative colorimetric"], [2, "Saturation"], [3, "Absolute colorimetric"]].map(([v, n]) => `<option value="${v}" ${v === settings.intent ? "selected" : ""}>${n}</option>`).join("")}</select></label><label class="check-row"><input type="checkbox" id="color-bpc" ${settings.blackPointCompensation ? "checked" : ""}> Bù điểm đen (BPC)</label><label class="check-row"><input type="checkbox" id="color-proof" ${settings.proof ? "checked" : ""}> Xem thử CMYK trên canvas</label><label class="modal-field">Độ phân giải bản in (DPI)<input id="color-dpi" type="number" value="300" min="1" max="2400"></label><button class="button primary" id="color-export">Xuất TIFF CMYK + ICC</button><p class="gen-size-note">TIFF gộp các layer, nền trắng, không nén. DPI là mật độ in; số pixel giữ nguyên. Lưu .luma để giữ mọi layer và ICC.</p></div></div>`, [{ label: "Hủy", run: () => api.closeModal(true) }, { label: "Lưu thiết lập màu", primary: true, run: () => {
      if (api.doc() !== d) {
        api.toast("Tài liệu đã thay đổi.", true);
        return;
      }
      d.colorManagement = clone(settings);
      api.closeModal();
      api.commit("Thiết lập màu ICC");
    } }], () => {
      $('[data-modal-button="1"]').id = "color-save";
      $("#color-save").disabled = true;
      draw();
      update();
      $("#color-split").oninput = (e) => {
        split = Number(e.target.value);
        draw();
      };
      $("#color-intent").onchange = (e) => {
        settings.intent = Number(e.target.value);
        update();
      };
      $("#color-bpc").onchange = (e) => {
        settings.blackPointCompensation = e.target.checked;
        update();
      };
      $("#color-proof").onchange = (e) => settings.proof = e.target.checked;
      $("#color-load").onclick = () => $("#color-icc-file").click();
      $("#color-icc-file").onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          if (file.size > 6 * 1024 * 1024) throw new Error("ICC tối đa 6 MB.");
          const bytes = validateICC(new Uint8Array(await file.arrayBuffer()), "CMYK").bytes, info = await profileInfo(bytes);
          if (!mounted) return;
          settings.profileData = bytesToBase64(bytes);
          settings.profileName = info.name.slice(0, 200) || file.name.slice(0, 200);
          $("#color-profile-name").value = settings.profileName;
          await update();
        } catch (error) {
          if (mounted) $("#color-status").textContent = error.message;
        }
      };
      $("#color-default").onclick = () => {
        Object.assign(settings, { profileData: null, profileName: DEFAULT_COLOR.profileName });
        $("#color-profile-name").value = settings.profileName;
        update();
      };
      $("#color-export").onclick = async () => {
        const button = $("#color-export");
        button.disabled = true;
        try {
          $("#color-status").textContent = "Đang tách CMYK và nhúng ICC…";
          await new Promise((r) => requestAnimationFrame(r));
          const profile = await getProfileBytes(settings), full = renderDocument(d, api.assets, { background: "#fff" }), data = full.getContext("2d").getImageData(0, 0, full.width, full.height).data, cmyk = await separateCMYK(data, profile, settings), tiff = encodeCMYKTiff(d.width, d.height, cmyk, profile, Number($("#color-dpi").value));
          downloadBlob(new Blob([tiff], { type: "image/tiff" }), (d.name.replace(/[<>:"/\\|?*]/g, "-") || "Luma") + "-CMYK.tif");
          if (mounted) $("#color-status").textContent = "Đã xuất TIFF CMYK 8-bit với ICC.";
        } catch (error) {
          if (mounted) $("#color-status").textContent = error.message;
        } finally {
          if (mounted) button.disabled = false;
        }
      };
    }, () => {
      mounted = false;
      version++;
    });
  }
  function open() {
    const cards=[
      ['portrait-auto','user','Auto chân dung','Gọn mặt / cằm, dịu bóng dầu, chỉnh chân mày & râu. Một chạm rồi tinh chỉnh.','MỚI · PORTRAIT STUDIO 6.9'],
      ['landscape-studio','image','Phong cảnh HDR một chạm','Mở bóng tối, tăng nét, trời xanh và mây chiều ấm. Chỉnh lại bằng thanh trượt.','MỚI · LANDSCAPE STUDIO 6.8'],
      ['wardrobe-color','hue','Đổi màu trang phục','Bấm áo / quần, chọn màu và giữ nếp vải. Vùng chọn, cọ sửa và Undo.','MỚI · WARDROBE COLOR 6.7'],
      ['beverage-studio','temperature','Đồ uống · Màu & hậu cảnh','Chọn ly, xóa mực tối, đổi màu, thay nền và thêm nắng / bokeh.','MỚI · BEVERAGE STUDIO 6.7'],
      ['paper-studio','image','Làm sạch tài liệu','Giảm bóng, đều nền giấy, tăng rõ chữ và dấu đỏ. Giữ ảnh nguồn và thanh chỉnh.','MỚI · PAPER STUDIO 6.6'],
      ['product-studio','sparkles','Retouch sản phẩm','Bấm đồng xu / sản phẩm: giảm ám ố, cân phản quang và ánh sáng. Chỉnh lại bằng thanh trượt.','MỚI · PRODUCT STUDIO 6.5'],
      ['remove-studio','eraser','Xóa người & vật thể','Chọn người cần giữ, xóa người còn lại; sửa mask và so sánh ngữ cảnh nền.','NÂNG CẤP · GIỮ NGƯỜI CHÍNH'],
      ['eyes-lab','eye','Mắt đỏ · 1 chạm','Sửa ánh đỏ đồng tử, đổi màu mống mắt và tinh chỉnh từng mắt.','MỚI · RETOUCH 6.3'],
      ['hair-lab','sparkles','Màu tóc & râu','Màu tóc theo mask AI, kiểu râu theo mốc mặt và cọ sửa viền.','MỚI · TRÊN THIẾT BỊ'],
      ['retouch-lab','clone','Da studio & biểu cảm','Giữ kết cấu da gốc, giảm đồi mồi / nhăn, chỉnh cả cung môi.','MỚI · TÙY CHỈNH SAU'],
      ['ai-beard','user','Xóa / tạo râu AI','LaMa xóa vùng râu trên thiết bị; ComfyUI sinh kiểu râu ảnh thật.','AI THEO VÙNG'],
      ['cutout-studio','mask','Tách nền & vật thể','Tự tách chủ thể, bấm chọn vật thể, giữ tóc mềm và tạo nhiều layer có mask.','MỚI · CHẠY TRÊN THIẾT BỊ'],
      ['skin-research','clone','Phân loại da · nghiên cứu','Xếp hạng nhãn qua model local; không phải chẩn đoán hay xác suất bệnh.','CẦN LOCAL GPU + MODEL'],
      ['design-import','image','Thiết kế từ Canva','Nhập PPTX / SVG đã tải xuống, sửa các ô chữ, ảnh và vector được hỗ trợ.','NHẬP TỆP · MỚI'],
      ['skin-map','clone','Bản đồ bề mặt da','Tách vùng tối, đỏ, sáng và rãnh tương đối để duyệt vùng retouch.','TRÊN THIẾT BỊ · MỚI'],
      ['reference-restore','history','Phục hồi có tham chiếu','Căn ba cặp điểm và ghép chi tiết từ bản scan hoặc ảnh tham chiếu.','CÓ NGUỒN ĐỐI CHIẾU · MỚI'],
      ['guided-color','temperature','Màu theo chỉ dẫn','Tô màu đã biết theo vùng, giữ độ sáng và chi tiết nguồn.','MÀU DO BẠN CHỌN · MỚI'],
      ['ai-verify','check','Kiểm chứng CUDA & ảnh','Kiểm tra tensor CUDA trong bản local và đối chiếu kết quả sinh ảnh.','WINDOWS + NVIDIA'],
      ['generative-studio','sparkles','Vá & tái dựng AI','LaMa vá theo ngữ cảnh trên thiết bị; ComfyUI tạo nội dung theo mô tả.','AI THEO VÙNG'],
      ['smart-manager','layers','Smart Objects','Sửa nội dung nhúng và cập nhật các bản sao dùng chung.','NỘI DUNG SỬA LẠI'],
      ['color-studio','hue','CMYK & ICC','Nạp profile, xem thử màu và xuất TIFF CMYK có nhúng ICC.','LITTLECMS'],
      ['collaborate','copy','Đồng biên tập','Đồng bộ layer giữa hai trình duyệt qua P2P hoặc relay tự host.','2 NGƯỜI · CẦN KẾT NỐI']
    ];
    api.showModal('Luma Studio 6.6','Thiết kế tiếp nối · phục hồi có căn cứ · AI có kiểm chứng',`<div class="advanced-hero"><span class="live-pill">SUBJECT & PAPER · 6.6</span><h3>Chỉnh sâu hơn. Kiểm soát rõ hơn.</h3><p>Chuyển thiết kế thành layer, chọn vùng da cần retouch và phục hồi từ tư liệu. Mỗi công cụ ghi rõ nguồn xử lý và cách kiểm tra kết quả.</p></div><div class="advanced-grid">${cards.map(([action,i,title,description,badge])=>`<button class="advanced-card" data-advanced-action="${action}"><span class="advanced-card-icon">${icon(i)}</span><small>${badge}</small><strong>${title}</strong><p>${description}</p><span class="advanced-card-go">Mở công cụ ↗</span></button>`).join('')}</div>`,[{label:'Kết nối máy AI',run:()=>generative.configure()},{label:'Trở lại canvas',primary:true,run:()=>api.closeModal()}],()=>{document.querySelectorAll('[data-advanced-action]').forEach(b=>b.onclick=()=>{api.closeModal();api.runAction(b.dataset.advancedAction);});});
  }
  const actions = { 'art-studio':()=>art.open('dots'),'art-vector':()=>art.open('trace'),'art-3d':()=>art.open('voxel'),'ai-art':()=>generative.open('art'), 'scene-studio':()=>scene.open('auto'), 'scene-autumn':()=>scene.open('autumn'), 'scene-winter':()=>scene.open('winter'), 'scene-night':()=>scene.open('night'), 'scene-day':()=>scene.open('day'), 'shadow-studio':()=>scene.open('floating'), "skin-research":()=>skinResearch.open(), "design-import":()=>importer.open(), "skin-map":()=>precision.openSkin(), "reference-restore":()=>precision.openReference(), "guided-color":()=>precision.openReference("color"), "ai-verify":()=>generative.verify(), "advanced-studio": open, "smart-manager": smartManager, "smart-convert": convert, "smart-edit": edit, "smart-save-content": saveContent, "smart-replace": replace, "smart-independent": independent, "color-studio": color, "generative-studio": () => generative.open("repair"), "ai-colorize": () => generative.open("colorization"), "ai-expression": () => generative.open("expression"), "ai-skin": () => generative.open("skin"), "ai-beard": () => generative.open("beard"), "ai-connect": () => generative.configure(), collaborate: () => collaboration.open() };
  const actionItems = [['art-studio','Ảnh thành Art & Pattern · chấm, dấu cộng, pixel','sparkles',''],['art-vector','Ảnh thành vector màu · xuất SVG','pen',''],['art-3d','Ảnh thành khối nổi 2.5D','layers',''],['ai-art','Art & 3D tạo sinh · ComfyUI','sparkles',''],['scene-studio','Preset & Actions · Studio, mùa và ánh sáng','sparkles',''],['scene-autumn','Thu lá vàng · hiệu ứng lá bay','image',''],['scene-winter','Đông tuyết rơi','image',''],['scene-night','Ngày thành đêm · trăng & đèn','image',''],['scene-day','Đêm thành ngày · trời xanh','image',''],['shadow-studio','Bóng vật thể · tiếp xúc, bay và chiếu','layers',''],["skin-research","Phân loại da · nghiên cứu local","clone",""],["design-import","Thiết kế từ Canva · nhập PPTX / SVG","image",""],["skin-map","Bản đồ bề mặt da · vùng retouch","clone",""],["reference-restore","Phục hồi · ảnh tham chiếu","history",""],["guided-color","Tô màu · chỉ dẫn theo vùng","temperature",""],["ai-verify","Kiểm chứng ComfyUI · job thực & báo cáo","check",""],["smart-manager", "Smart Objects · quản lý nội dung", "layers", ""], ["advanced-studio", "Production · Smart Objects, CMYK & AI", "layers", ""], ["smart-convert", "Chuyển thành Smart Object", "layers", ""], ["smart-edit", "Sửa nội dung Smart Object", "pen", ""], ["smart-save-content", "Lưu nội dung Smart Object", "check", ""], ["smart-replace", "Thay nội dung Smart Object", "image", ""], ["smart-independent", "Smart Object · tạo nội dung riêng", "copy", ""], ["color-studio", "CMYK / ICC · màu in & TIFF", "hue", ""], ["generative-studio", "Generative Studio · vá & tái dựng", "sparkles", ""], ["ai-colorize", "Tô màu AI · ảnh đen trắng", "temperature", ""], ["ai-expression", "Biểu cảm AI · cười / miệng khép", "clone", ""], ["ai-skin", "AI da · chọn vùng & xử lý dấu vết", "clone", ""], ["ai-beard", "Râu AI · xóa râu / ria mép / quai nón", "user", ""], ["ai-connect", "Kết nối máy AI · ComfyUI", "sliders", ""], ["collaborate", "Đồng biên tập · kết nối hai người", "copy", ""]];
  Object.assign(actions,{'cutout-studio':()=>cutout.open(),'cutout-portrait':()=>cutout.open('portrait'),'cutout-hair':()=>cutout.open('hair'),'cutout-object':()=>cutout.open('point')});
  actions['remove-studio']=()=>removal.open();
  actions['landscape-studio']=()=>landscape.open();
  actionItems.unshift(['landscape-studio','Phong cảnh HDR · trời trong & chiều nhẹ','image','']);
  actions['wardrobe-color']=()=>colorEditor.open('garment');
  actions['beverage-studio']=()=>colorEditor.open('beverage');
  actionItems.unshift(['wardrobe-color','Đổi màu trang phục · chọn áo / quần','hue',''],['beverage-studio','Đồ uống · xóa logo, đổi màu & hậu cảnh','temperature','']);
  actions['paper-studio']=()=>paper.open();
  actionItems.unshift(['paper-studio','Làm sạch tài liệu · bóng giấy, chữ & dấu','image','']);
  actions['product-studio']=()=>product.open();
  actionItems.unshift(['product-studio','Retouch sản phẩm · bạc sáng sạch & ánh sáng','sparkles','']);
  actionItems.unshift(['remove-studio','Xóa người & vật thể · 1 lần bấm','eraser','']);
  actionItems.unshift(['cutout-studio','Tách nền & vật thể','mask',''],['cutout-portrait','Tách chân dung & viền tóc','mask',''],['cutout-hair','Chỉ chọn vùng tóc','mask',''],['cutout-object','Bấm chọn vật thể','select','']);
  return { actions, actionItems, open, generative, collaboration, importer, precision, cutout, removal, product, paper, colorEditor, landscape, scene, art, proofCanvas, rebaseDocumentIdentity(previousId,copyId) {
    const child=edits.get(previousId);if(child){edits.delete(previousId);edits.set(copyId,child);}
    for(const entry of edits.values())if(entry.parentId===previousId)entry.parentId=copyId;
  }, cancel() {
    art.cancel();
    scene.cancel();
    landscape.cancel();
    colorEditor.cancel();
    paper.cancel();
    product.cancel();
    removal.cancel();
    cutout.cancel();
    generative.cancel();
    precision.cancel();
  }, update() {
    const b = $("#smart-save-content");
    if (b) b.hidden = !edits.has(api.doc()?.id);
  }, extras(l) {
    if (!l.smartObjectId) return "";
    const asset = smartAsset(api.doc(), l);
    return `<div class="smart-panel"><span class="live-pill">SMART OBJECT</span><p>${esc(asset?.name)} · ${asset?.width} × ${asset?.height} px<br>${api.doc().layers.filter((x) => x.smartObjectId === l.smartObjectId).length} instance dùng chung nội dung</p><button class="button primary" data-action="smart-edit">Sửa nội dung</button><div class="studio-button-grid"><button class="button" data-action="smart-replace">Thay nội dung</button><button class="button" data-action="smart-independent">Tạo bản riêng</button></div></div>`;
  } };
}
export {
  createAdvancedStudio
};
