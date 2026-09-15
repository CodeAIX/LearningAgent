#!/usr/bin/env bash
set -euo pipefail
INSTALL_ROOT=/opt/learning-portal
[[ $EUID -eq 0 ]] || { echo '请使用 sudo learning-portal'; exit 1; }
cd "$INSTALL_ROOT"
# This file is created by the installer, root-owned and mode 600.
set -a
source .env
set +a
case ${1:-help} in
 status) docker compose ps; curl -fsS "http://127.0.0.1:$APP_PORT/health/ready"; echo ;;
 create-admin|reset-password) command=$1; shift; docker compose exec app node apps/api/cli.mjs "$command" "$@" ;;
 backup)
  docker compose stop app
  trap 'docker compose up -d >/dev/null' EXIT
  docker compose run --rm --no-deps app node apps/api/cli.mjs backup-offline
  echo "备份目录：$DATA_ROOT/backups" ;;
 restore)
  archive=${2:?用法：learning-portal restore /完整备份路径}
  [[ -f "$archive" ]] || { echo '备份不存在'; exit 1; }
  stage=$(mktemp -d /srv/learning-portal-restore.XXXXXX)
  chown 1000:1000 "$stage"
  install -m 600 -o 1000 -g 1000 "$archive" "$stage/source.lpbackup.gz"
  docker run --rm --user 1000:1000 --read-only --cap-drop ALL --security-opt no-new-privileges --tmpfs /tmp:rw,size=192m,mode=1777 -e DATA_DIR=/data -v "$stage:/data" "$PORTAL_IMAGE" node apps/api/cli.mjs restore /data/source.lpbackup.gz
  rm "$stage/source.lpbackup.gz"
  docker compose stop app
  old="${DATA_ROOT}.before-restore-$(date +%Y%m%d-%H%M%S)"
  mv "$DATA_ROOT" "$old"
  mv "$stage" "$DATA_ROOT"
  if ! docker compose up -d --wait --wait-timeout 90; then
   docker compose stop app
   mv "$DATA_ROOT" "${DATA_ROOT}.failed-restore-$(date +%s)"
   mv "$old" "$DATA_ROOT"
   docker compose up -d
   echo '恢复后健康检查失败，已切回原数据'; exit 1
  fi
  echo "恢复完成，旧数据保留于 $old；旧会话已注销" ;;
 upgrade)
  version=${2:?用法：learning-portal upgrade v1.0.1}
  [[ "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo '版本格式不合法'; exit 1; }
  work=$(mktemp -d); trap 'rm -rf "$work"' EXIT
  base="https://github.com/CodeAIX/LearningAgent/releases/download/$version"
  curl -fL --retry 3 "$base/learning-portal-$version.tar.gz" -o "$work/learning-portal-$version.tar.gz"
  curl -fL --retry 3 "$base/SHA256SUMS" -o "$work/SHA256SUMS"
  (cd "$work" && sha256sum -c SHA256SUMS)
  python3 - "$work/learning-portal-$version.tar.gz" "$work/package" <<'PY'
import sys,tarfile
with tarfile.open(sys.argv[1]) as a:
 for m in a.getmembers():
  if m.name.startswith('/') or '..' in m.name.split('/') or not (m.isfile() or m.isdir()):raise SystemExit('部署包路径不合法')
 a.extractall(sys.argv[2],filter='data')
PY
  next_image=$(python3 - "$work/package/release.json" "$version" <<'PY'
import json,sys,re
m=json.load(open(sys.argv[1]))
if m['version']!=sys.argv[2] or not re.fullmatch(r'ghcr.io/codeaix/learning-portal@sha256:[a-f0-9]{64}',m['image']):raise SystemExit('版本清单不合法')
print(m['image'])
PY
)
  docker pull "$next_image"
  stamp=$(date +%Y%m%d-%H%M%S)
  config_backup="${INSTALL_ROOT}.before-upgrade-$stamp"
  cp -a "$INSTALL_ROOT" "$config_backup"
  docker compose stop app
  # The archive includes database + images; retain the full stopped directory for automatic rollback.
  data_backup="${DATA_ROOT}.before-upgrade-$stamp"
  cp -a "$DATA_ROOT" "$data_backup"
  restart_old(){ cp -a "$config_backup/." "$INSTALL_ROOT/"; set -a; source .env; set +a; docker compose up -d; }
  trap 'restart_old; rm -rf "$work"' ERR
  cp "$work/package/compose.yaml" "$work/package/release.json" "$INSTALL_ROOT/"
  cp "$work/package/scripts/"*.sh "$INSTALL_ROOT/scripts/"
  sed -i "s|^PORTAL_IMAGE=.*|PORTAL_IMAGE=$next_image|" .env
  export PORTAL_IMAGE="$next_image"
  if ! docker compose up -d --wait --wait-timeout 90; then
   docker compose stop app
   mv "$DATA_ROOT" "${DATA_ROOT}.failed-upgrade-$stamp"
   mv "$data_backup" "$DATA_ROOT"
   restart_old
   echo '升级未通过健康检查，程序和数据已回退'; exit 1
  fi
  trap - ERR
  echo "升级完成；回退副本：$config_backup 和 $data_backup" ;;
 *) echo '用法：learning-portal status | create-admin | reset-password <账号> | backup | restore <完整备份路径> | upgrade <版本>' ;;
esac
