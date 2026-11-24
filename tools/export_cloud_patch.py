"""导出云端沙箱改动包（自动严格排除 assets/、Music/、tests/node_modules/ 等非代码替身目录）。

用法：python tools/export_cloud_patch.py
输出：
  - cloud_sandbox_deliverable.zip（只含本次云端新增/修改的代码、样式、剧本、测试文件）
  - CLOUD_CHANGES_MANIFEST.json（精确变更清单：added / modified / deleted）
"""
from __future__ import annotations

import hashlib
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASELINE_PATH = ROOT / "tools" / ".cloud_baseline_hashes.json"
OUT_ZIP = ROOT / "cloud_sandbox_deliverable.zip"
OUT_MANIFEST = ROOT / "CLOUD_CHANGES_MANIFEST.json"

SKIP_PREFIXES = (
    "assets/",
    "Music/",
    "tests/node_modules/",
    ".git/",
    "tools/art_pipeline/raw/",
    "tools/art_pipeline/prompts/",
    "__pycache__/",
)
SKIP_NAMES = {
    "cloud_sandbox_deliverable.zip",
    "CLOUD_CHANGES_MANIFEST.json",
    ".cloud_baseline_hashes.json",
}


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def should_skip(rel: str, name: str) -> bool:
    if name in SKIP_NAMES or rel.endswith(".pyc"):
        return True
    return any(rel.startswith(pref) or f"/{pref}" in rel for pref in SKIP_PREFIXES)


def main() -> None:
    if not BASELINE_PATH.is_file():
        raise SystemExit(f"找不到基线哈希文件: {BASELINE_PATH}")
    baseline: dict[str, str] = json.loads(BASELINE_PATH.read_text("utf-8"))

    current: dict[str, str] = {}
    for p in sorted(ROOT.rglob("*")):
        if not p.is_file():
            continue
        rel = p.relative_to(ROOT).as_posix()
        if should_skip(rel, p.name):
            continue
        current[rel] = sha256_file(p)

    added = sorted(k for k in current if k not in baseline)
    modified = sorted(k for k in current if k in baseline and current[k] != baseline[k])
    deleted = sorted(k for k in baseline if k not in current)
    changed = added + modified

    manifest = {
        "added": added,
        "modified": modified,
        "deleted": deleted,
        "total_changed": len(changed),
    }
    OUT_MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    with zipfile.ZipFile(OUT_ZIP, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        zf.write(OUT_MANIFEST, arcname="CLOUD_CHANGES_MANIFEST.json")
        for rel in changed:
            zf.write(ROOT / rel, arcname=rel)

    print(f"✅ 导出成功: {OUT_ZIP} ({OUT_ZIP.stat().st_size / 1024:.1f} KB)")
    print(f"   新增 {len(added)} | 修改 {len(modified)} | 删除 {len(deleted)}")
    for rel in changed[:40]:
        print(f"   - {rel}")
    if len(changed) > 40:
        print(f"   ... 其余 {len(changed) - 40} 项见 CLOUD_CHANGES_MANIFEST.json")


if __name__ == "__main__":
    main()
