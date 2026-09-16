# 爱习酷｜医学智学空间 · LearningAgent

一个可以随时编辑的医学学习资源门户。以 **察微 · 循迹 · 守衡** 为主线，连接智能学伴、虚拟仿真实验与后续学习工具。

**一个 Docker 容器，一个数据目录。** 内置公开首页、中文管理后台、SQLite、封面管理与完整备份。复用已有 Cloudflare Tunnel。

线上站点品牌为 **爱习酷｜医学智学空间**，英文副标题为 **AI·XI·CO｜MEDICAL LEARNING SPACE**。徽标中两组中英文共用一条竖线分隔。站点名称可在管理后台「站点设置」修改；它会同步显示在左上角徽标、首页页脚和浏览器标题中。

## 功能

- 手机与桌面自适应的插画资源卡片、搜索、课程和类型筛选。
- 预置医学微生物学、人体寄生虫学、医学免疫学智能学伴，以及 MicroBioLab 入口。
- 管理员登录；资源新增、编辑、推荐、排序、草稿、发布、下架、归档与恢复。
- 图片上传、压缩、裁切位置选择、默认主题封面。
- 分类与标签、站点设置、JSON 清单导入预览和重复项处理。
- 完整备份、恢复、账号密码重置、自动备份与操作记录。

## 一键安装

要求：Ubuntu 24.04 / Debian 同类环境，x86_64，Docker Engine 与 Docker Compose v2、curl、python3、tar、sha256sum 已安装；至少 512 MB 可用内存和足够的数据磁盘空间。

以 v1.0.4 为例，一条命令下载固定版本引导脚本并开始安装：

```bash
curl -fL --retry 3 https://github.com/CodeAIX/LearningAgent/releases/download/v1.0.4/bootstrap.sh -o /tmp/learning-portal-bootstrap.sh && sudo bash /tmp/learning-portal-bootstrap.sh v1.0.4 https://med.aixico.com 18082
```

脚本会校验同版本部署包、按 digest 拉取公开 GHCR 镜像、创建数据目录、启动应用并引导创建管理员。账号至少 3 位，密码至少 12 位。没有默认密码。已有安装或数据会阻止全新安装，避免覆盖。

程序位于 `/opt/learning-portal`，数据位于 `/srv/learning-portal`。仅绑定 `127.0.0.1:18082`。VPS 不需要 Node.js、不编译源码、不需要 GitHub Token 或 docker login。

### Cloudflare Tunnel

在已有宿主机 cloudflared 对应的 Tunnel 中添加公开主机名：

```text
med.aixico.com → HTTP → 127.0.0.1:18082
```

应用安装完成与公网域名可访问是两个检查步骤。首次需要配置这条路由；域名尚未配置时，脚本会显示待配置说明。若 cloudflared 运行在其他容器中，应通过共享 Docker 网络访问应用，不能直接使用该容器的 127.0.0.1。

首页：`https://med.aixico.com`；后台：`https://med.aixico.com/admin`。`i.aixico.com` 的 DNS、Tunnel 路由和重定向已解除，保留供其他项目使用。

v1.0.3 起，默认安装域名为 `med.aixico.com`。

## 维护

```bash
sudo learning-portal status
sudo learning-portal backup
sudo learning-portal restore /完整路径/portal-时间戳.lpbackup.gz
sudo learning-portal upgrade v1.0.4
sudo learning-portal reset-password admin
```

升级示例中的版本须已发布。升级先保存原程序和数据副本，健康检查失败自动回退。镜像版本和数据库版本必须配套，不直接用旧镜像打开新数据库。

### 备份说明

- 后台可在线生成并下载完整备份。备份含 SQLite、上传图片、站点设置和管理员密码哈希；恢复时清除旧会话。
- 程序直接操作本地 SQLite，无需独立的应用签名密钥或数据库密码。域名、端口和镜像等部署配置位于 `/opt/learning-portal/.env`，迁移时也应私下保存，或按新环境重新生成。
- 数据库使用官方 `VACUUM INTO` 快照；备份档案包含逐文件 SHA-256。恢复验证路径、格式、校验和与数据库完整性。
- 在线备份限原始数据 64 MiB，超过后请使用停机目录备份。上传图片最大 5 MiB，处理后保存 WebP。
- 后台备份会短暂占用应用事件循环；小规模资源库通常很快。命令行 `backup` 会短暂停止门户，备份后自动启动。
- 应用每小时检查一次，最新备份超过 24 小时后生成备份；清理时保留最近 7 份和额外 4 个周区间的代表备份。停机期间不会生成备份，下次检查补做。
- 至少保留一份离开 VPS 的备份。同机备份不能防止整机或磁盘丢失。`backups`、数据库与会话数据不会通过静态文件服务公开。

### 迁移

新服务器安装相同版本应用，再执行 `learning-portal restore` 恢复备份。若希望跳过新管理员创建，可用 `PORTAL_DEFER_ADMIN=1` 执行引导脚本，再直接恢复。旧数据会保存到独立目录，恢复失败不会直接丢弃原数据。

把 Tunnel 路由切到新服务器，并避免同一 Tunnel 同时将流量分配到持有不同 SQLite 数据的两台主机。Cloudflare 凭据不在应用镜像或备份内。

### 大型资源库目录备份

当在线备份超过上限时，停止应用后将整个 `/srv/learning-portal` 和 `/opt/learning-portal/.env` 复制到受保护的备份位置，再启动应用。SQLite 的 WAL/SHM 文件与主文件必须一起保留；不要在应用写入期间只复制主数据库文件。

## 本地开发

Node.js 24 或更高支持版本：

```bash
npm ci
npm run dev:api
# 另一个终端
npm run dev
```

开发首页 `http://127.0.0.1:5173`，API `127.0.0.1:18082`。创建本地管理员：

```bash
node apps/api/cli.mjs create-admin
```

生产构建与测试：

```bash
npm run check
npm start
```

直接用生产服务预览时，设置 `SITE_ORIGIN=http://127.0.0.1:18082`，使登录来源校验与浏览器地址一致。本地默认数据目录 `.data`，生产为 `/data`。

## 镜像发布

本地构建目标架构镜像：

```bash
docker buildx build --platform linux/amd64 --load -f infra/Dockerfile --build-arg REVISION="$(git rev-parse HEAD)" -t ghcr.io/codeaix/learning-portal:v1.0.4 .
```

源码存放在 GitHub；镜像放在 GHCR，设置为公开包；部署包放在固定版本 Release。生产 Compose 使用镜像 digest。发布前验证匿名下载与镜像拉取。

附带工作流 `Publish locally built image` 可以下载 draft Release 中已在本地构建并校验的 `container-amd64.tar.gz` 与 `CONTAINER-SHA256SUMS`，使用仓库临时 `GITHUB_TOKEN` 将同一镜像推送 GHCR；它不在云端重新构建应用。发布完成后移除中转镜像附件，只保留安装附件。

真实 `.env`、数据库、备份、管理员凭据及本地运维资料必须保持在 Git 和构建上下文之外。
