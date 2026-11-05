# GPU and generative-quality verification

The release does not include a physical-GPU quality certification. The development environment's blocked hardware report is preserved at `qa/platform9-hardware.json`. A GitHub-hosted Windows packaging runner is not treated as an NVIDIA inference workstation.

## Run on your CUDA workstation

1. Configure the optional Windows/NVIDIA companion according to `gpu-kit/README.vi.md`. Supply your compatible ComfyUI installation/checkpoint. Research model weights and generative checkpoints are not included in this repository.
2. Run `gpu-kit/probe.py --output hardware-report.json` using the Python environment with CUDA-enabled PyTorch.
3. Run `gpu-kit/Run-Benchmark.ps1` with the configured checkpoint. Review the script's parameters before running it.
4. Inspect `report.json` and `review.html`, plus source/input/raw/composed PNGs. Record visual review separately.

The probe checks an actual CUDA tensor operation and hash. The benchmark requires CUDA evidence plus ComfyUI reporting a CUDA device; it does not silently substitute CPU. Three synthetic damage masks on one known image exercise reconstruction. The report records checkpoint identity/hash when available, seed, settings, elapsed time, masked MAE/PSNR/region SSIM, boundary error and changes outside the mask.

`gpu-executed-review-required` means jobs ran and artifacts were collected. It is not a general aesthetic approval. Device names, WebGL acceleration, a tensor proof, mocked HTTP tests and a visually attractive single example are different evidence levels.

## Remaining evaluation

Evaluate a representative licensed dataset covering portraits, skin tones, hair edges, crowds, foliage, transparent products, small text, restoration damage and large missing regions. Review identity, anatomy, texture, seams and protected regions at native resolution. Measure repeated-run latency and memory separately from image quality. Preserve failed cases as well as successes.

Generated detail in a missing region is an inference. Historical accuracy requires independent reference material. The software does not certify medical diagnosis or the original wording of unreadable text/seals.
