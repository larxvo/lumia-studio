# Installation and first edit

## Windows 10/11 x64

1. Download `Luma-Studio-<version>-Setup-x64.exe` from [GitHub Releases](https://github.com/larxvo/lumia-studio/releases).
2. Compare the file's SHA-256 with the accompanying `.sha256` file. In PowerShell:

   ```powershell
   Get-FileHash .\Luma-Studio-9.0.1-Setup-x64.exe -Algorithm SHA256
   ```

3. Run setup for your Windows account. Choose an empty folder or an existing Luma installation. The editor does not need Node.js or Python installed separately.
4. Open an image or an RGB/8-bit PSD. Use **Chỉnh ảnh** for task tools, **Thiết kế** for layout/type and **Nâng cao** for Smart Objects, print color, Canva and verification.
5. Apply an auto preset, review the preview and adjust its sliders. Use **Ctrl+Z** / **Ctrl+Shift+Z** for undo/redo. Save `.luma` for future editing and export a separate finished image.

The installer is not code-signed. Publisher verification, native Windows execution and GPU validation are separate items; read the release notes and attached reports. Do not disable Windows security protections to install software.

Close Luma before updating or removing it. Windows Settings → Apps → Luma Studio provides removal. The removal manifest targets packaged application files; projects, unrelated files and the user's AppData are retained. PSD/PSB are added to Open With rather than forcibly becoming the default application.

## Browser / self-hosting

Use the [public browser demo](https://luma-photo-studio.tuhaotp.chatgpt.site/), or clone this repository and serve its `dist/` directory over HTTP. The public demo can lag the latest packaging release. The Electron OAuth bridge is not available in an ordinary browser tab; PPTX/SVG import is available there.

See [development setup](DEVELOPMENT.md) for commands. Opening `index.html` as `file://` is not supported because module workers and WebAssembly need an HTTP or the desktop application's registered origin.

## Optional ComfyUI

The bundled local retouch/selection tools use CPU/WASM. Generative Fill, generative expression and some illustration workflows require your own ComfyUI installation, compatible checkpoint and adequate hardware. Open **AI → Kết nối máy AI** and inspect the endpoint before running a job. Images are sent to the endpoint you configure when you request those operations.

The Windows/NVIDIA companion scripts in `gpu-kit/` are separate from the editor installer. Read [GPU verification](GPU-VERIFICATION.md) before interpreting a device check as a quality result.

## Optional Canva

See [Canva setup](CANVA.md). The current connector needs a configured Canva Developer app; it is not yet a turnkey shared public OAuth service.

## Troubleshooting

| Problem | Check |
| --- | --- |
| Image allocation fails | Available RAM, document pixel count and canvas capacity; compressed file size alone does not predict memory use. |
| PSD opens flattened | Read its import report and compare against the saved Photoshop composite. Preserve the original PSD. |
| Selection loses hair or an arm edge | Restore source pixels with mask correction; use positive/negative prompts and inspect at 100%. |
| Generative command cannot connect | Endpoint availability, authentication, nodes, selected checkpoint and VRAM. |
| Canva login fails | Client ID/secret, registered redirect URL, scopes and the user's grant; do not publish credentials in an issue. |
| Print color differs | Output ICC, rendering intent, display calibration and the print provider's requirements. |
| Windows update cannot replace files | Exit all Luma windows before installing. |
