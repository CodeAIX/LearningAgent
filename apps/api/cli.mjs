import { openDB, createAdmin, passwordHash } from "./data.mjs";
import { restore, backup } from "./backup.mjs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
const root = process.env.DATA_DIR || resolve(".data");
const [command, ...args] = process.argv.slice(2);
async function prompt(label, hidden = false) {
  let muted = false;
  const output = new Writable({
    write(chunk, enc, next) {
      if (!muted) process.stdout.write(chunk);
      next();
    },
  });
  const rl = createInterface({
    input: process.stdin,
    output,
    terminal: !!process.stdin.isTTY,
  });
  const answer = rl.question(label);
  muted = hidden;
  const v = await answer;
  rl.close();
  if (hidden) process.stdout.write("\n");
  return v;
}
try {
  if (command === "restore") {
    if (!args[0]) throw Error("请提供备份路径");
    console.log(restore(args[0], root));
  } else if (command === "create-admin" || command === "reset-password") {
    const db = openDB(root);
    try {
      const username = args[0] || (await prompt("管理员账号（至少 3 位）："));
      let pass;
      if (process.env.PASSWORD_STDIN === "1") {
        let s = "";
        for await (const c of process.stdin) s += c;
        pass = s.replace(/\r?\n$/, "");
      } else {
        pass = await prompt("密码（至少 12 位，输入隐藏）：", true);
        if (pass !== (await prompt("再次输入密码：", true)))
          throw Error("两次密码不一致");
      }
      if (command === "create-admin") createAdmin(db, username, pass);
      else {
        if (pass.length < 12 || pass.length > 200)
          throw Error("密码长度须为 12–200 位");
        const a = db
          .prepare("SELECT id FROM admins WHERE username=?")
          .get(username);
        if (!a) throw Error("账号不存在");
        db.prepare("UPDATE admins SET password=? WHERE id=?").run(
          passwordHash(pass),
          a.id,
        );
        db.prepare("DELETE FROM sessions WHERE admin_id=?").run(a.id);
      }
      console.log("管理员账号已更新");
    } finally {
      db.close();
    }
  } else if (command === "backup-offline") {
    const db = openDB(root);
    try {
      console.log(backup(db, root));
    } finally {
      db.close();
    }
  } else
    throw Error(
      "用法：create-admin [账号] | reset-password [账号] | restore <备份路径> | backup-offline",
    );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
