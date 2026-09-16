import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  randomUUID,
  scryptSync,
  randomBytes,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { z } from "zod";
export const VERSION = "1.0.4";
export const uid = () => randomUUID();
export const hash = (t) => createHash("sha256").update(t).digest("hex");
export function passwordHash(p) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(p, salt, 64).toString("hex");
}
export function passwordOK(p, h) {
  try {
    const [salt, key] = h.split(":");
    return timingSafeEqual(scryptSync(p, salt, 64), Buffer.from(key, "hex"));
  } catch {
    return false;
  }
}
const text = (n) => z.string().trim().max(n);
export const resourceSchema = z.object({
  title: text(100).min(1),
  subtitle: text(150).default(""),
  description: text(600).default(""),
  url: z
    .url()
    .max(2000)
    .refine(
      (v) =>
        ["http:", "https:"].includes(new URL(v).protocol) &&
        !new URL(v).username &&
        !new URL(v).password,
      "网址必须是无账号密码的 HTTP/HTTPS 链接",
    ),
  type: text(60).min(1),
  courses: z.array(text(60).min(1)).max(12).default([]),
  tags: z.array(text(40).min(1)).max(12).default([]),
  cover: z
    .string()
    .regex(/^(?:|\/covers\/[a-z0-9-]+\.webp|\/media\/[a-f0-9-]+\.webp)$/)
    .default(""),
  theme: z.enum(["teal", "amber", "indigo", "sage"]).default("teal"),
  focusX: z.number().min(0).max(100).default(50),
  focusY: z.number().min(0).max(100).default(50),
  status: z.enum(["draft", "published", "hidden", "archived"]).default("draft"),
  featured: z.boolean().default(false),
  sort: z.number().int().min(-10000).max(10000).default(0),
});
export const settingsSchema = z.object({
  name: text(60).min(1),
  tagline: text(120),
  intro: text(400),
  footer: text(180),
});
export const taxonomySchema = z.object({
  kind: z.enum(["type", "course", "tag"]),
  name: text(60).min(1),
});
export const publicResource = (r) => ({
  ...JSON.parse(r.content),
  id: r.id,
  updatedAt: r.updated_at,
});
export function openDB(root) {
  mkdirSync(root, { recursive: true, mode: 0o700 });
  mkdirSync(join(root, "uploads"), { recursive: true });
  mkdirSync(join(root, "backups"), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(join(root, "portal.sqlite"));
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
  );
  const version = db.prepare("PRAGMA user_version").get().user_version;
  if (version > 1) throw Error("数据库版本高于当前应用，请使用匹配版本");
  db.exec(`CREATE TABLE IF NOT EXISTS resources(id TEXT PRIMARY KEY,content TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1),content TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS taxonomy(id TEXT PRIMARY KEY,kind TEXT NOT NULL,name TEXT NOT NULL,UNIQUE(kind,name));
 CREATE TABLE IF NOT EXISTS admins(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,password TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,admin_id TEXT NOT NULL REFERENCES admins(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT,action TEXT NOT NULL,subject TEXT NOT NULL,at TEXT NOT NULL);
 PRAGMA user_version=1;`);
  if (!db.prepare("SELECT id FROM settings").get()) {
    db.exec("BEGIN");
    try {
      db.prepare("INSERT INTO settings VALUES(1,?)").run(
        JSON.stringify({
          name: "爱习酷｜医学智学空间",
          tagline: "察微 · 循迹 · 守衡",
          intro:
            "从一个问题出发，走进更广阔的医学世界。\n与你的智能学伴一起思考，在虚拟实验中探索。",
          footer: "保持好奇，让每一次探索都有收获。",
        }),
      );
      const seeds = [
        [
          "见微知著",
          "《医学微生物学》智能学伴",
          "观察微观世界，由微见著。与学伴一起认识肉眼不可见的病原世界。",
          "45f00082d9ae41cf97ace199d805370f",
          "医学微生物学",
          "察微",
          "teal",
          "microbiology",
        ],
        [
          "抽丝剥茧",
          "《人体寄生虫学》智能学伴",
          "梳理复杂生活史，循迹明理。沿着宿主转换与传播链条，串联知识。",
          "b5e90c65b0504d84bae390021112d48c",
          "人体寄生虫学",
          "循迹",
          "amber",
          "parasitology",
        ],
        [
          "安内攘外",
          "《医学免疫学》智能学伴",
          "识别与清除威胁，维持耐受与稳态。在动态平衡中理解免疫。",
          "bf02e72ee3374169b396247794d84ce0",
          "医学免疫学",
          "守衡",
          "indigo",
          "immunology",
        ],
      ];
      seeds.forEach((s, i) =>
        saveResource(
          db,
          uid(),
          resourceSchema.parse({
            title: s[0],
            subtitle: s[1],
            description: s[2],
            url:
              "https://robot-lc.chaoxing.com/prime/web?unitId=681&robotId=" +
              s[3],
            type: "智能学伴",
            courses: [s[4]],
            tags: [s[5]],
            theme: s[6],
            cover: "/covers/" + s[7] + ".webp",
            featured: true,
            status: "published",
            sort: i,
          }),
        ),
      );
      saveResource(
        db,
        uid(),
        resourceSchema.parse({
          title: "医学微生物学虚拟仿真实验平台",
          subtitle: "MicroBioLab",
          description:
            "把课堂上的知识，变成可以亲手探索的体验。随时进入虚拟实验室，在观察与思考中加深理解。",
          url: "https://microbiolab.aixico.com/",
          type: "虚拟实验",
          courses: ["医学微生物学"],
          tags: ["交互探索"],
          theme: "sage",
          cover: "/covers/laboratory.webp",
          status: "published",
          sort: 3,
        }),
      );
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  return db;
}
export function saveResource(db, id, data) {
  db.prepare(
    "INSERT INTO resources VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content,updated_at=excluded.updated_at",
  ).run(id, JSON.stringify(data), new Date().toISOString());
  const add = db.prepare("INSERT OR IGNORE INTO taxonomy VALUES(?,?,?)");
  add.run(uid(), "type", data.type);
  for (const c of data.courses) add.run(uid(), "course", c);
  for (const t of data.tags) add.run(uid(), "tag", t);
}
export const resources = (db) =>
  db
    .prepare("SELECT * FROM resources")
    .all()
    .map(publicResource)
    .sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title, "zh-CN"));
export const settings = (db) =>
  JSON.parse(
    db.prepare("SELECT content FROM settings WHERE id=1").get().content,
  );
export function audit(db, action, subject) {
  db.prepare("INSERT INTO audit(action,subject,at) VALUES(?,?,?)").run(
    action,
    String(subject).slice(0, 200),
    new Date().toISOString(),
  );
  db.exec(
    "DELETE FROM audit WHERE id < (SELECT COALESCE(MAX(id),0)-2000 FROM audit)",
  );
}
export function createAdmin(db, username, password) {
  if (!/^[a-zA-Z0-9_.@-]{3,80}$/.test(username))
    throw Error("账号需为 3–80 位字母、数字或 _.@-");
  if (password.length < 12 || password.length > 200)
    throw Error("密码长度须为 12–200 位");
  db.prepare("INSERT INTO admins VALUES(?,?,?)").run(
    uid(),
    username,
    passwordHash(password),
  );
}
