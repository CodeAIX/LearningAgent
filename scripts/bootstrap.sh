#!/usr/bin/env bash
set -euo pipefail
VERSION=${1:-v1.2.0}
[[ "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo '版本格式应为 v1.0.0'; exit 1; }
[[ $EUID -eq 0 ]] || { echo '请使用 sudo bash 执行'; exit 1; }
for tool in curl sha256sum tar python3 docker; do command -v "$tool" >/dev/null || { echo "缺少依赖：$tool"; exit 1; }; done
docker compose version >/dev/null
DOWNLOAD_DIR=$(mktemp -d)
trap 'rm -rf "$DOWNLOAD_DIR"' EXIT
BASE_URL="https://github.com/CodeAIX/LearningAgent/releases/download/$VERSION"
curl --fail --location --retry 3 "$BASE_URL/learning-portal-$VERSION.tar.gz" -o "$DOWNLOAD_DIR/learning-portal-$VERSION.tar.gz"
curl --fail --location --retry 3 "$BASE_URL/SHA256SUMS" -o "$DOWNLOAD_DIR/SHA256SUMS"
(cd "$DOWNLOAD_DIR" && sha256sum --check SHA256SUMS)
python3 - "$DOWNLOAD_DIR/learning-portal-$VERSION.tar.gz" "$DOWNLOAD_DIR/package" <<'PY'
import sys,tarfile
with tarfile.open(sys.argv[1]) as archive:
    for m in archive.getmembers():
        if m.name.startswith('/') or '..' in m.name.split('/') or not (m.isfile() or m.isdir()): raise SystemExit('部署包路径或类型不合法')
    archive.extractall(sys.argv[2],filter='data')
PY
bash "$DOWNLOAD_DIR/package/scripts/install.sh" "$VERSION" "${2:-https://med.aixico.com}" "${3:-18082}"
