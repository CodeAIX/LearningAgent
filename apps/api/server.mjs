import Fastify from "fastify";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import staticFiles from "@fastify/static";
import sharp from "sharp";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  existsSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
  readdirSync,
  statSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import {
  openDB,
  uid,
  hash,
  passwordOK,
  passwordHash,
  resourceSchema,
  settingsSchema,
  taxonomySchema,
  resources,
  settings,
  saveResource,
  audit,
  VERSION,
} from "./data.mjs";
import { backup } from "./backup.mjs";
const project = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export async function buildApp({
  root = process.env.DATA_DIR || resolve(".data"),
  origin = process.env.SITE_ORIGIN || "http://127.0.0.1:5173",
  logger = false,
} = {}) {
  root = resolve(root);
  const db = openDB(root);
  const app = Fastify({ logger, bodyLimit: 1024 * 1024 });
  let busy = false;
  const secure = new URL(origin).protocol === "https:";
  const csrf = (req, reply) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.url.startsWith("/api/") &&
      (req.headers.origin !== origin ||
        req.headers["x-requested-with"] !== "LearningPortal")
    )
      return reply
        .code(403)
        .send({ error: "请求来源校验失败，请刷新页面后重试" });
  };
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 1 },
  });
  app.addHook("onRequest", async (req, reply) => {
    reply
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "strict-origin-when-cross-origin")
      .header("X-Frame-Options", "DENY")
      .header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    reply.header(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    if (req.url.startsWith("/api/")) reply.header("Cache-Control", "no-store");
    if (secure) reply.header("Strict-Transport-Security", "max-age=31536000");
    return csrf(req, reply);
  });
  const admin = async (req, reply) => {
    const session = req.cookies.lp_session;
    const row =
      session &&
      db
        .prepare(
          "SELECT a.id,a.username FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token=? AND s.expires>?",
        )
        .get(hash(session), Date.now());
    if (!row) return reply.code(401).send({ error: "请先登录管理员账号" });
    req.admin = row;
    if (busy && !["GET", "HEAD"].includes(req.method))
      return reply.code(503).send({ error: "备份正在进行，请稍后重试" });
  };
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof z.ZodError)
      return reply.code(400).send({
        error: err.issues
          .map((i) => i.path.join(".") + ": " + i.message)
          .slice(0, 3)
          .join("；"),
      });
    if (err.statusCode && err.statusCode < 500)
      return reply
        .code(err.statusCode)
        .send({
          error:
            err.statusCode === 413 ? "上传文件过大，最大 5 MB" : err.message,
        });
    req.log.error(err);
    return reply
      .code(500)
      .send({ error: "操作未完成，请稍后重试或查看服务日志" });
  });
  app.get("/health/live", async () => ({ ok: true, version: VERSION }));
  app.get("/health/ready", async () => {
    db.prepare("SELECT 1").get();
    return { ok: true, version: VERSION };
  });
  app.get("/api/public", async () => ({
    settings: settings(db),
    resources: resources(db).filter((r) => r.status === "published"),
  }));
  app.post(
    "/api/login",
    { config: { rateLimit: { max: 15, timeWindow: "15 minutes" } } },
    async (req, reply) => {
      const { username, password } = z
        .object({ username: z.string().max(80), password: z.string().max(200) })
        .parse(req.body);
      const account = db
        .prepare("SELECT * FROM admins WHERE username=?")
        .get(username);
      // Perform a password derivation for missing users as well.
      const valid = passwordOK(
        password,
        account?.password ||
          "00000000000000000000000000000000:" + "00".repeat(64),
      );
      if (!account || !valid)
        return reply.code(401).send({ error: "账号或密码不正确" });
      db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
      const token = randomBytes(32).toString("hex");
      db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
        hash(token),
        account.id,
        Date.now() + 8 * 3600e3,
      );
      reply.setCookie("lp_session", token, {
        httpOnly: true,
        secure,
        sameSite: "strict",
        path: "/",
        maxAge: 8 * 3600,
      });
      audit(db, "登录", account.username);
      return { ok: true };
    },
  );
  app.post("/api/logout", { preHandler: admin }, async (req, reply) => {
    db.prepare("DELETE FROM sessions WHERE token=?").run(
      hash(req.cookies.lp_session),
    );
    reply.clearCookie("lp_session", { path: "/" });
    return { ok: true };
  });
  app.get("/api/admin", { preHandler: admin }, async (req) => ({
    username: req.admin.username,
    settings: settings(db),
    resources: resources(db),
    taxonomy: db.prepare("SELECT * FROM taxonomy ORDER BY kind,name").all(),
    audit: db.prepare("SELECT * FROM audit ORDER BY id DESC LIMIT 30").all(),
    version: VERSION,
  }));
  app.post("/api/password", { preHandler: admin }, async (req, reply) => {
    const b = z
      .object({
        current: z.string().max(200),
        password: z.string().min(12).max(200),
      })
      .parse(req.body);
    if (
      !passwordOK(
        b.current,
        db.prepare("SELECT password FROM admins WHERE id=?").get(req.admin.id)
          .password,
      )
    )
      return reply.code(400).send({ error: "当前密码不正确" });
    db.prepare("UPDATE admins SET password=? WHERE id=?").run(
      passwordHash(b.password),
      req.admin.id,
    );
    db.prepare("DELETE FROM sessions WHERE admin_id=?").run(req.admin.id);
    reply.clearCookie("lp_session", { path: "/" });
    audit(db, "修改密码", req.admin.username);
    return { ok: true };
  });
  app.post("/api/resources", { preHandler: admin }, async (req) => {
    const data = resourceSchema.parse(req.body);
    checkCover(data.cover);
    const id = uid();
    saveResource(db, id, data);
    audit(db, "新增资源", data.title);
    return { id };
  });
  app.put("/api/resources/:id", { preHandler: admin }, async (req, reply) => {
    const id = z.uuid().parse(req.params.id);
    if (!db.prepare("SELECT id FROM resources WHERE id=?").get(id))
      return reply.code(404).send({ error: "资源不存在" });
    const data = resourceSchema.parse(req.body);
    checkCover(data.cover);
    saveResource(db, id, data);
    audit(db, "编辑资源", data.title);
    return { id };
  });
  function checkCover(cover) {
    if (
      cover.startsWith("/media/") &&
      !existsSync(join(root, "uploads", cover.slice(7)))
    ) {
      const e = Error("封面文件不存在，请重新上传");
      e.statusCode = 400;
      throw e;
    }
  }
  app.put("/api/settings", { preHandler: admin }, async (req) => {
    const data = settingsSchema.parse(req.body);
    db.prepare("UPDATE settings SET content=? WHERE id=1").run(
      JSON.stringify(data),
    );
    audit(db, "更新站点", data.name);
    return { ok: true };
  });
  app.post("/api/taxonomy", { preHandler: admin }, async (req) => {
    const d = taxonomySchema.parse(req.body);
    db.prepare("INSERT OR IGNORE INTO taxonomy VALUES(?,?,?)").run(
      uid(),
      d.kind,
      d.name,
    );
    audit(db, "新增分类", d.name);
    return { ok: true };
  });
  app.delete("/api/taxonomy/:id", { preHandler: admin }, async (req, reply) => {
    const item = db
      .prepare("SELECT * FROM taxonomy WHERE id=?")
      .get(z.uuid().parse(req.params.id));
    if (!item) return reply.code(404).send({ error: "分类不存在" });
    if (
      resources(db).some((r) =>
        item.kind === "type"
          ? r.type === item.name
          : item.kind === "course"
            ? r.courses.includes(item.name)
            : r.tags.includes(item.name),
      )
    )
      return reply
        .code(409)
        .send({ error: "此分类仍被资源使用，请先编辑对应资源" });
    db.prepare("DELETE FROM taxonomy WHERE id=?").run(item.id);
    audit(db, "删除分类", item.name);
    return { ok: true };
  });
  app.post("/api/upload", { preHandler: admin }, async (req, reply) => {
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "请选择图片" });
    const buf = await file.toBuffer();
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype))
      return reply.code(400).send({ error: "支持 JPG、PNG、WebP 图片" });
    let result;
    try {
      result = await sharp(buf, { limitInputPixels: 24000000 })
        .rotate()
        .resize({
          width: 1600,
          height: 1600,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 84 })
        .toBuffer();
    } catch {
      return reply
        .code(400)
        .send({ error: "图片无法处理，请使用有效且不超过 2400 万像素的图片" });
    }
    if (busy)
      return reply.code(503).send({ error: "备份正在进行，请稍后上传" });
    const name = uid() + ".webp";
    writeFileSync(join(root, "uploads", name), result);
    audit(db, "上传封面", name);
    return { url: "/media/" + name };
  });
  app.get("/api/export", { preHandler: admin }, async (req, reply) =>
    reply
      .header(
        "Content-Disposition",
        'attachment; filename="learning-resources.json"',
      )
      .send({ format: 1, resources: resources(db) }),
  );
  const importSchema = z.object({
    format: z.literal(1),
    resources: z
      .array(resourceSchema.extend({ id: z.uuid().optional() }))
      .max(500),
  });
  function preview(body) {
    const data = importSchema.parse(body);
    const seen = new Set();
    for (const r of data.resources) {
      if (r.id && seen.has(r.id))
        throw Object.assign(Error("导入文件含重复 ID"), { statusCode: 400 });
      if (r.id) seen.add(r.id);
    }
    return data;
  }
  app.post("/api/import/preview", { preHandler: admin }, async (req) => {
    const data = preview(req.body);
    const ids = new Set(resources(db).map((r) => r.id));
    return {
      resources: data.resources.map((r) => ({
        ...r,
        duplicate: !!r.id && ids.has(r.id),
        missingCover:
          r.cover.startsWith("/media/") &&
          !existsSync(join(root, "uploads", r.cover.slice(7))),
      })),
    };
  });
  app.post("/api/import", { preHandler: admin }, async (req) => {
    const b = z
      .object({ data: z.unknown(), mode: z.enum(["skip", "replace"]) })
      .parse(req.body);
    const data = preview(b.data);
    let count = 0;
    db.exec("BEGIN");
    try {
      for (const item of data.resources) {
        const { id, ...r } = item;
        const exists =
          id && db.prepare("SELECT id FROM resources WHERE id=?").get(id);
        if (exists && b.mode === "skip") continue;
        if (
          r.cover.startsWith("/media/") &&
          !existsSync(join(root, "uploads", r.cover.slice(7)))
        )
          r.cover = "";
        saveResource(db, id || uid(), r);
        count++;
      }
      audit(db, "导入资源", count);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    return { count };
  });
  app.post("/api/backups", { preHandler: admin }, async () => {
    busy = true;
    try {
      const name = backup(db, root);
      audit(db, "完整备份", name);
      return { name };
    } finally {
      busy = false;
    }
  });
  app.get("/api/backups/:name", { preHandler: admin }, async (req, reply) => {
    if (!/^portal-[0-9TZ-]+\.lpbackup\.gz$/.test(req.params.name))
      return reply.code(404).send({ error: "备份不存在" });
    const path = join(root, "backups", req.params.name);
    if (!existsSync(path)) return reply.code(404).send({ error: "备份不存在" });
    return reply
      .type("application/gzip")
      .header(
        "Content-Disposition",
        `attachment; filename="${req.params.name}"`,
      )
      .send(readFileSync(path));
  });
  await app.register(staticFiles, {
    root: join(root, "uploads"),
    prefix: "/media/",
    decorateReply: false,
    cacheControl: true,
    maxAge: "1y",
    immutable: true,
    index: false,
    redirect: false,
  });
  await app.register(staticFiles, {
    root: join(project, "assets", "covers"),
    prefix: "/covers/",
    decorateReply: false,
    maxAge: "1d",
    index: false,
    redirect: false,
  });
  const web = join(project, "dist", "web");
  if (existsSync(web)) {
    for (const path of ["/", "/admin", "/admin/"])
      app.get(path, async (req, reply) =>
        reply.type("text/html").send(readFileSync(join(web, "index.html"))),
      );
    await app.register(staticFiles, {
      root: web,
      prefix: "/",
      decorateReply: true,
      maxAge: 0,
      index: false,
    });
  }
  app.setNotFoundHandler(async (req, reply) => {
    if (
      req.method === "GET" &&
      ["/", "/admin", "/admin/"].includes(req.url.split("?")[0]) &&
      existsSync(join(web, "index.html"))
    )
      return reply
        .type("text/html")
        .send(readFileSync(join(web, "index.html")));
    return reply.code(404).send({ error: "页面不存在" });
  });
  const timer = setInterval(() => {
    const files = readdirSync(join(root, "backups"))
      .filter((n) => /^portal-.*\.lpbackup\.gz$/.test(n))
      .sort()
      .reverse();
    if (
      files[0] &&
      Date.now() - statSync(join(root, "backups", files[0])).mtimeMs <
        24 * 3600e3
    )
      return;
    busy = true;
    try {
      backup(db, root);
      const sorted = readdirSync(join(root, "backups"))
        .filter((n) => /^portal-.*\.lpbackup\.gz$/.test(n))
        .sort()
        .reverse();
      const keep = new Set(sorted.slice(0, 7));
      const weeks = new Set();
      for (const f of sorted.slice(7)) {
        const week = Math.floor(
          statSync(join(root, "backups", f)).mtimeMs / (7 * 86400e3),
        );
        if (weeks.size < 4 && !weeks.has(week)) {
          weeks.add(week);
          keep.add(f);
        }
      }
      for (const f of sorted)
        if (!keep.has(f)) unlinkSync(join(root, "backups", f));
    } catch (e) {
      app.log.error(e, "定时备份失败");
    } finally {
      busy = false;
    }
  }, 3600e3);
  timer.unref();
  app.addHook("onClose", async () => {
    clearInterval(timer);
    db.close();
  });
  return app;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = await buildApp({ logger: true });
  await app.listen({
    host: process.env.HOST || "127.0.0.1",
    port: Number(process.env.PORT || 18082),
  });
  for (const signal of ["SIGTERM", "SIGINT"])
    process.once(signal, async () => {
      await app.close();
      process.exit(0);
    });
}
