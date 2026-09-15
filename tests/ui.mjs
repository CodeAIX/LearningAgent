import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:18182/");
await page.getByRole("heading", { name: /让好奇/ }).waitFor();
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: ".local/home-desktop.png", fullPage: true });
assert.equal(await page.locator(".resource-card").count(), 3);
assert.equal(await page.locator(".lab-banner").count(), 1);
await page.getByRole("textbox", { name: "搜索学习资源" }).fill("免疫");
assert.equal(await page.locator(".resource-card").count(), 1);
await page.getByRole("textbox", { name: "搜索学习资源" }).fill("");
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: ".local/home-mobile.png", fullPage: true });
assert.ok(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
);
await page.goto("http://127.0.0.1:18182/admin");
await page.getByLabel("管理员账号").fill("testadmin");
await page.getByLabel("密码", { exact: true }).fill("test-password-12345");
await page.getByRole("button", { name: "登录后台" }).click();
await page.getByRole("button", { name: "添加资源", exact: true }).waitFor();
await page.setViewportSize({ width: 1440, height: 1000 });
await page.getByRole("button", { name: "添加资源", exact: true }).click();
await page.getByLabel("资源名称 *").fill("界面测试资源");
await page.getByLabel("目标网址 *").fill("https://example.com/learn");
await page.getByLabel("简短介绍").fill("验证从新增到发布的完整流程。");
await page.getByLabel("发布状态").selectOption("published");
await page.getByRole("button", { name: "保存资源", exact: true }).click();
await page
  .getByRole("heading", { name: "界面测试资源", exact: true })
  .waitFor();
await page.screenshot({ path: ".local/admin-desktop.png", fullPage: true });
await page
  .getByRole("button", { name: "编辑界面测试资源", exact: true })
  .click();
await page.getByLabel("资源名称 *").fill("编辑成功的资源");
await page.getByRole("button", { name: "保存资源", exact: true }).click();
await page
  .getByRole("heading", { name: "编辑成功的资源", exact: true })
  .waitFor();
await page
  .getByRole("button", { name: "归档编辑成功的资源", exact: true })
  .click();
await page.getByRole("button", { name: "归档箱", exact: true }).click();
await page
  .getByRole("button", { name: "恢复编辑成功的资源", exact: true })
  .waitFor();
await page
  .getByRole("button", { name: "恢复编辑成功的资源", exact: true })
  .click();
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: ".local/admin-mobile.png", fullPage: true });
assert.ok(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
);
await page.getByRole("button", { name: "备份与导入", exact: true }).click();
const downloaded = page.waitForEvent("download");
await page.getByRole("button", { name: "生成并下载备份", exact: true }).click();
assert.match((await downloaded).suggestedFilename(), /\.lpbackup\.gz$/);
await page.getByRole("button", { name: "退出", exact: true }).click();
await page.getByRole("button", { name: "登录后台" }).waitFor();
assert.deepEqual(errors, []);
await browser.close();
console.log(
  "UI passed: desktop/mobile, search, login, create, edit, archive, restore, backup, logout; zero console errors",
);
