"""Write an honest hardware/compute report, including when CUDA is unavailable."""
from __future__ import annotations
import argparse, hashlib, json, platform, shutil, subprocess
from datetime import datetime, timezone
from pathlib import Path

def probe(proof_runner=None):
    report = {'schema': 'luma-hardware-probe-v1', 'time': datetime.now(timezone.utc).isoformat(),
              'platform': platform.system(), 'architecture': platform.machine(),
              'status': 'blocked', 'computeVerified': False, 'imageQualityVerified': False,
              'hardware': [], 'cudaProof': None, 'reasons': [],
              'scope': 'Hardware inventory plus a checked CUDA operation. Not a photo-quality certification.'}
    executable = shutil.which('nvidia-smi')
    if executable:
        try:
            r = subprocess.run([executable, '--query-gpu=name,driver_version,memory.total,uuid', '--format=csv,noheader,nounits'], capture_output=True, text=True, timeout=15, check=True)
            for line in r.stdout.strip().splitlines():
                values = [v.strip() for v in line.split(',')]
                if len(values) == 4:
                    # Don't publish raw hardware UUIDs.
                    report['hardware'].append({'name': values[0], 'driver': values[1], 'vramMiB': values[2], 'deviceFingerprint': hashlib.sha256(values[3].encode()).hexdigest()})
        except (OSError, subprocess.SubprocessError): report['reasons'].append('NVIDIA driver inventory could not be read.')
    else: report['reasons'].append('nvidia-smi is not available in this environment.')
    try:
        if proof_runner is None:
            from research_core import cuda_proof
            proof_runner = cuda_proof
        proof = proof_runner()
        if proof.get('status') != 'passed' or proof.get('backend') != 'cuda' or not str(proof.get('tensorDevice', '')).startswith('cuda:') or not proof.get('outputSHA256'):
            raise RuntimeError('CUDA proof did not pass.')
        report.update(status='cuda-compute-passed', computeVerified=True, cudaProof=proof)
    except (ImportError, RuntimeError, OSError) as error:
        report['reasons'].append('CUDA operation unavailable: ' + str(error)[:250])
    return report

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default='hardware-report.json')
    args = parser.parse_args()
    report = probe()
    target = Path(args.output); target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + '\n', encoding='utf-8')
    print(json.dumps({'status': report['status'], 'computeVerified': report['computeVerified'], 'imageQualityVerified': False, 'report': str(target)}))
    return 0 if report['computeVerified'] else 2

if __name__ == '__main__': raise SystemExit(main())
