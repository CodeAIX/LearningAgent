import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { buildApp } from "../apps/api/server.mjs";
import { openDB, createAdmin } from "../apps/api/data.mjs";
import { restore } from "../apps/api/backup.mjs";
const origin = "https://portal.example.com";
async function setup(t) {
  const root = mkdtempSync(join(tmpdir(), "portal-test-"));
  const db = openDB(root);
  createAdmin(db, "testadmin", "test-password-12345");
  db.close();
  const app = await buildApp({ root, origin });
  await app.ready();
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  const response = await app.inject({
    method: "POST",
    url: "/api/login",
    headers: { origin, "x-requested-with": "LearningPortal" },
    payload: { username: "testadmin", password: "test-password-12345" },
  });
  assert.equal(response.statusCode, 200);
  const cookie = response.headers["set-cookie"].split(";")[0];
  const request = (method, url, payload, extra = {}) =>
    app.inject({
      method,
      url,
      payload,
      headers: {
        origin,
        "x-requested-with": "LearningPortal",
        cookie,
        ...extra,
      },
    });
  return { root, app, request, cookie };
}
test("public resources, authentication, origin checks and draft lifecycle", async (t) => {
  const { app, request } = await setup(t);
  const pub = (await app.inject("/api/public")).json();
  assert.equal(pub.resources.length, 4);
  assert.ok(
    pub.resources.some((r) => r.url === "https://microbiolab.aixico.com/"),
  );
  assert.equal((await app.inject("/api/admin")).statusCode, 401);
  assert.equal(
    (
      await request("POST", "/api/resources", pub.resources[0], {
        origin: "https://evil.test",
      })
    ).statusCode,
    403,
  );
  const input = { ...pub.resources[0], title: "独立新增资源", status: "draft" };
  delete input.id;
  const created = await request("POST", "/api/resources", input);
  assert.equal(created.statusCode, 200);
  const id = created.json().id;
  assert.equal((await app.inject("/api/public")).json().resources.length, 4);
  assert.equal(
    (
      await request("PUT", "/api/resources/" + id, {
        ...input,
        status: "published",
      })
    ).statusCode,
    200,
  );
  assert.equal((await app.inject("/api/public")).json().resources.length, 5);
  assert.equal(
    (
      await request("PUT", "/api/resources/" + id, {
        ...input,
        status: "archived",
      })
    ).statusCode,
    200,
  );
  assert.equal((await app.inject("/api/public")).json().resources.length, 4);
  assert.equal(
    (
      await request("POST", "/api/resources", {
        ...input,
        url: "javascript:alert(1)",
      })
    ).statusCode,
    400,
  );
  for (const path of [
    "/portal.sqlite",
    "/.env",
    "/data/portal.sqlite",
    "/media/../portal.sqlite",
    "/api/backups/portal-fake.lpbackup.gz",
    "/covers/%2e%2e/%2e%2e/.env",
  ])
    assert.ok([401, 404].includes((await app.inject(path)).statusCode), path);
});
test("real image upload, complete backup, fresh restore, corrupted backup rejection", async (t) => {
  const { root, app, request, cookie } = await setup(t);
  const raw = readFileSync("assets/covers/laboratory.webp");
  const boundary = "test-boundary";
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="cover.webp"\r\nContent-Type: image/webp\r\n\r\n`,
    ),
    raw,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const upload = await request("POST", "/api/upload", payload, {
    "content-type": "multipart/form-data; boundary=" + boundary,
  });
  assert.equal(upload.statusCode, 200, upload.body);
  const r = (await request("GET", "/api/admin")).json().resources[0];
  await request("PUT", "/api/resources/" + r.id, {
    ...r,
    cover: upload.json().url,
    title: "恢复后仍存在的标题",
  });
  const saved = await request("POST", "/api/backups");
  assert.equal(saved.statusCode, 200, saved.body);
  const file = join(root, "backups", saved.json().name);
  assert.ok(existsSync(file));
  const download = await request("GET", "/api/backups/" + saved.json().name);
  assert.equal(download.statusCode, 200);
  assert.ok(download.headers["content-disposition"].includes("attachment"));
  const target = mkdtempSync(join(tmpdir(), "portal-restored-"));
  t.after(() => rmSync(target, { recursive: true, force: true }));
  restore(file, target);
  const recovered = await buildApp({ root: target, origin });
  await recovered.ready();
  t.after(() => recovered.close());
  const restored = (await recovered.inject("/api/public"))
    .json()
    .resources.find((a) => a.id === r.id);
  assert.equal(restored.title, "恢复后仍存在的标题");
  assert.equal((await recovered.inject(restored.cover)).statusCode, 200);
  assert.equal(
    (await recovered.inject({ url: "/api/admin", headers: { cookie } }))
      .statusCode,
    401,
  );
  assert.equal(
    (
      await recovered.inject({
        method: "POST",
        url: "/api/login",
        headers: { origin, "x-requested-with": "LearningPortal" },
        payload: { username: "testadmin", password: "test-password-12345" },
      })
    ).statusCode,
    200,
  );
  const decoded = JSON.parse(gunzipSync(readFileSync(file)));
  decoded.files["../escape"] = { data: "eA==", sha256: "bad" };
  const evil = join(root, "bad.gz");
  writeFileSync(evil, gzipSync(JSON.stringify(decoded)));
  assert.throws(() => restore(evil, join(target, "bad")), /路径不合法/);
  delete decoded.files["../escape"];
  decoded.files["portal.sqlite"].sha256 = "tampered";
  writeFileSync(evil, gzipSync(JSON.stringify(decoded)));
  assert.throws(() => restore(evil, join(target, "bad")), /校验和/);
  assert.throws(() => restore(file, target), /已有数据库/);
});
test("import is validated, duplicate handling explicit, password changes invalidate sessions", async (t) => {
  const { request, app } = await setup(t);
  const data = (await request("GET", "/api/export")).json();
  assert.equal(data.resources.length, 4);
  let r = await request("POST", "/api/import/preview", data);
  assert.equal(r.statusCode, 200);
  assert.equal(r.json().resources.filter((x) => x.duplicate).length, 4);
  r = await request("POST", "/api/import", { data, mode: "skip" });
  assert.equal(r.json().count, 0);
  const original = data.resources[0].title;
  data.resources[0].title = "导入覆盖";
  r = await request("POST", "/api/import", { data, mode: "replace" });
  assert.equal(r.json().count, 4);
  assert.ok(
    (await app.inject("/api/public"))
      .json()
      .resources.some((x) => x.title === "导入覆盖"),
  );
  assert.equal(
    (
      await request("POST", "/api/import", {
        data: { ...data, resources: [data.resources[0], data.resources[0]] },
        mode: "replace",
      })
    ).statusCode,
    400,
  );
  const changed = await request("POST", "/api/password", {
    current: "test-password-12345",
    password: "new-password-67890",
  });
  assert.equal(changed.statusCode, 200);
  assert.equal((await request("GET", "/api/admin")).statusCode, 401);
});

test("one container routes the platform and medical portal by hostname", async (t) => {
  const { app } = await setup(t);
  const platform = await app.inject({
    url: "/",
    headers: { host: "aixico.com" },
  });
  assert.equal(platform.statusCode, 200);
  assert.match(platform.body, /让智能，/);
  assert.match(platform.body, /https:\/\/med\.aixico\.com\//);
  assert.match(
    platform.headers["content-security-policy"],
    /script-src 'self'/,
  );
  const medical = await app.inject({
    url: "/",
    headers: { host: "med.aixico.com" },
  });
  assert.equal(medical.statusCode, 200);
  assert.match(medical.body, /id="root"/);
  assert.doesNotMatch(medical.body, /class="constellation"/);
  const admin = await app.inject({
    url: "/admin",
    headers: { host: "aixico.com" },
  });
  assert.equal(admin.statusCode, 302);
  assert.equal(admin.headers.location, "https://med.aixico.com/admin");
  assert.equal(
    (await app.inject({ url: "/admin", headers: { host: "med.aixico.com" } }))
      .statusCode,
    200,
  );
  assert.equal((await app.inject("/platform/")).body, platform.body);
  for (const asset of [
    "/platform/home.css",
    "/platform/home.js",
    "/covers/laboratory.webp",
    "/favicon.svg",
  ])
    assert.equal((await app.inject(asset)).statusCode, 200, asset);
  assert.equal(
    (await app.inject({ url: "/not-a-page", headers: { host: "aixico.com" } }))
      .statusCode,
    404,
  );
});
