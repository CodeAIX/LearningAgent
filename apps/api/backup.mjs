import {
  readFileSync,
  writeFileSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  mkdirSync,
  existsSync,
  copyFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { gzipSync, gunzipSync } from "node:zlib";
import { DatabaseSync } from "node:sqlite";
import { hash, VERSION } from "./data.mjs";
const LIMIT = 64 * 1024 * 1024;
export function backup(db, root) {
  const temp = mkdtempSync(join(tmpdir(), "lp-backup-"));
  try {
    db.prepare("VACUUM INTO ?").run(join(temp, "portal.sqlite"));
    const names = readdirSync(join(root, "uploads")).filter((n) =>
      /^[a-f0-9-]+\.webp$/.test(n),
    );
    const files = {};
    let total = 0;
    for (const name of ["portal.sqlite", ...names.map((n) => "uploads/" + n)]) {
      const content = readFileSync(
        name === "portal.sqlite" ? join(temp, name) : join(root, name),
      );
      total += content.length;
      if (total > LIMIT) throw Error("备份数据超过 64 MiB，请使用停机目录备份");
      files[name] = { sha256: hash(content), data: content.toString("base64") };
    }
    const meta = {
      format: 1,
      version: VERSION,
      schema: 1,
      createdAt: new Date().toISOString(),
      files,
    };
    const name =
      "portal-" +
      new Date().toISOString().replace(/[:.]/g, "-") +
      ".lpbackup.gz";
    writeFileSync(join(root, "backups", name), gzipSync(JSON.stringify(meta)), {
      mode: 0o600,
      flag: "wx",
    });
    return name;
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}
export function restore(archive, target) {
  if (existsSync(join(target, "portal.sqlite")))
    throw Error("恢复目标已有数据库，请先保留现有数据并使用空目录");
  const compressed = readFileSync(archive);
  if (compressed.length > LIMIT) throw Error("备份文件过大");
  const data = JSON.parse(
    gunzipSync(compressed, { maxOutputLength: 100 * 1024 * 1024 }).toString(),
  );
  if (
    data.format !== 1 ||
    data.schema !== 1 ||
    !data.files?.["portal.sqlite"] ||
    typeof data.version !== "string"
  )
    throw Error("不支持的备份格式");
  const entries = Object.entries(data.files);
  if (entries.length > 10000) throw Error("文件数量过多");
  let total = 0;
  const decoded = [];
  for (const [name, value] of entries) {
    if (name !== "portal.sqlite" && !/^uploads\/[a-f0-9-]+\.webp$/.test(name))
      throw Error("备份路径不合法");
    if (typeof value.data !== "string" || typeof value.sha256 !== "string")
      throw Error("文件格式不正确");
    const buf = Buffer.from(value.data, "base64");
    total += buf.length;
    if (total > LIMIT || hash(buf) !== value.sha256)
      throw Error("备份大小或校验和错误");
    decoded.push([name, buf]);
  }
  const temp = mkdtempSync(join(tmpdir(), "lp-restore-"));
  try {
    mkdirSync(join(temp, "uploads"));
    for (const [n, b] of decoded)
      writeFileSync(join(temp, n), b, { mode: 0o600 });
    const check = new DatabaseSync(join(temp, "portal.sqlite"));
    try {
      if (
        check.prepare("PRAGMA integrity_check").get().integrity_check !==
          "ok" ||
        check.prepare("PRAGMA user_version").get().user_version !== 1
      )
        throw Error("数据库校验失败");
      for (const table of [
        "resources",
        "settings",
        "admins",
        "sessions",
        "taxonomy",
        "audit",
      ])
        check.prepare("SELECT count(*) FROM " + table).get();
      check.exec("DELETE FROM sessions; PRAGMA journal_mode=DELETE;");
    } finally {
      check.close();
    }
    mkdirSync(target, { recursive: true, mode: 0o700 });
    mkdirSync(join(target, "uploads"), { recursive: true });
    mkdirSync(join(target, "backups"), { recursive: true, mode: 0o700 });
    for (const [n] of decoded) copyFileSync(join(temp, n), join(target, n));
    return { version: data.version, files: entries.length };
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}
