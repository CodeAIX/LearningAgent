#!/usr/bin/env bash
set -euo pipefail
VERSION=${1:?提供版本}; SITE_ORIGIN=${2:-https://med.aixico.com}; APP_PORT=${3:-18082}
INSTALL_ROOT=/opt/learning-portal
DATA_ROOT=/srv/learning-portal
PACKAGE_ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
[[ $EUID -eq 0 ]] || { echo '需要 root 权限'; exit 1; }
[[ $(uname -m) == x86_64 ]] || { echo '当前版本支持 x86_64 / amd64'; exit 1; }
[[ ! -e "$INSTALL_ROOT" && ! -e "$DATA_ROOT" ]] || { echo '检测到已有安装或数据，已停止。请使用 learning-portal upgrade 或 restore。'; exit 1; }
[[ "$APP_PORT" =~ ^[0-9]+$ ]] && ((APP_PORT>1024 && APP_PORT<65536)) || { echo '端口不合法'; exit 1; }
python3 - "$SITE_ORIGIN" "$APP_PORT" <<'PY'
import sys,socket,urllib.parse,re
u=urllib.parse.urlsplit(sys.argv[1])
if u.scheme not in ('https','http') or not u.hostname or not re.fullmatch(r'[A-Za-z0-9.-]+',u.hostname) or u.username or u.password or u.path not in ('','/') or u.query or u.fragment or any(c.isspace() for c in sys.argv[1]) or any(c in sys.argv[1] for c in '$`"\'\\'):
    raise SystemExit('域名格式不合法，请填写 https://域名，且不含路径')
with socket.socket() as s:s.bind(('127.0.0.1',int(sys.argv[2])))
PY
SITE_ORIGIN=${SITE_ORIGIN%/}
PORTAL_IMAGE=$(python3 - "$PACKAGE_ROOT/release.json" "$VERSION" <<'PY'
import json,sys,re
m=json.load(open(sys.argv[1]))
if m['version']!=sys.argv[2] or not re.fullmatch(r'ghcr.io/codeaix/learning-portal@sha256:[a-f0-9]{64}',m['image']):raise SystemExit('版本清单无效')
print(m['image'])
PY
)
docker pull "$PORTAL_IMAGE"
install -d -m 755 "$INSTALL_ROOT" "$INSTALL_ROOT/scripts"
install -d -m 700 -o 1000 -g 1000 "$DATA_ROOT"
cp "$PACKAGE_ROOT/compose.yaml" "$PACKAGE_ROOT/release.json" "$INSTALL_ROOT/"
cp "$PACKAGE_ROOT/scripts/"*.sh "$INSTALL_ROOT/scripts/"
printf 'PORTAL_IMAGE=%s\nSITE_ORIGIN=%s\nAPP_PORT=%s\nDATA_ROOT=%s\n' "$PORTAL_IMAGE" "$SITE_ORIGIN" "$APP_PORT" "$DATA_ROOT" > "$INSTALL_ROOT/.env"
chmod 600 "$INSTALL_ROOT/.env"
chmod 755 "$INSTALL_ROOT/scripts/"*.sh
ln -s "$INSTALL_ROOT/scripts/manage.sh" /usr/local/bin/learning-portal
cd "$INSTALL_ROOT"
docker compose config --quiet
docker compose up -d --wait --wait-timeout 90
if [[ ${PORTAL_DEFER_ADMIN:-0} == 1 ]]; then
  echo '管理员创建已延后，请运行：learning-portal create-admin'
else
  docker compose exec app node apps/api/cli.mjs create-admin
fi
curl --fail --silent "http://127.0.0.1:$APP_PORT/health/ready"
printf '\n应用安装完成：%s\n后台：%s/admin\n请核对现有 Tunnel 路由：%s → http://127.0.0.1:%s\n' "$SITE_ORIGIN" "$SITE_ORIGIN" "$SITE_ORIGIN" "$APP_PORT"
