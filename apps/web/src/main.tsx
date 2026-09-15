import React, { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  Sparkles,
  Search,
  FlaskConical,
  Plus,
  SlidersHorizontal,
  LogOut,
  X,
  Upload,
  Download,
  Save,
  Settings,
  Archive,
  RotateCcw,
  Pencil,
  ChevronRight,
  Leaf,
  ShieldCheck,
  Waypoints,
  Microscope,
  LoaderCircle,
  ExternalLink,
} from "lucide-react";
import "./style.css";
type Resource = {
  id?: string;
  title: string;
  subtitle: string;
  description: string;
  url: string;
  type: string;
  courses: string[];
  tags: string[];
  cover: string;
  theme: "teal" | "amber" | "indigo" | "sage";
  focusX: number;
  focusY: number;
  status: "draft" | "published" | "hidden" | "archived";
  featured: boolean;
  sort: number;
};
type Site = { name: string; tagline: string; intro: string; footer: string };
type Tax = { id: string; kind: "type" | "course" | "tag"; name: string };
type Data = {
  settings: Site;
  resources: Resource[];
  taxonomy?: Tax[];
  username?: string;
  version?: string;
  audit?: { id: number; action: string; subject: string; at: string }[];
};
const blank: Resource = {
  title: "",
  subtitle: "",
  description: "",
  url: "",
  type: "智能学伴",
  courses: [],
  tags: [],
  cover: "",
  theme: "teal",
  focusX: 50,
  focusY: 50,
  status: "draft",
  featured: false,
  sort: 0,
};
const statusLabels = {
  draft: "草稿",
  published: "已发布",
  hidden: "已下架",
  archived: "已归档",
};
const defaults = {
  teal: "/covers/microbiology.webp",
  amber: "/covers/parasitology.webp",
  indigo: "/covers/immunology.webp",
  sage: "/covers/laboratory.webp",
};
async function api(path: string, method = "GET", body?: unknown) {
  const isForm = body instanceof FormData;
  const r = await fetch("/api" + path, {
    method,
    headers:
      method === "GET"
        ? {}
        : {
            "X-Requested-With": "LearningPortal",
            ...(!isForm ? { "Content-Type": "application/json" } : {}),
          },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "请求失败");
  return data;
}
function Cover({ r, className = "" }: { r: Resource; className?: string }) {
  return (
    <img
      className={className}
      src={r.cover || defaults[r.theme]}
      style={{ objectPosition: `${r.focusX}% ${r.focusY}%` }}
      alt=""
      loading="lazy"
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = defaults[r.theme];
      }}
    />
  );
}
function Brand({ name }: { name: string }) {
  return (
    <a className="brand" href="/">
      <span className="brandmark">
        <BookOpen size={22} />
      </span>
      <span>
        {name}
        <small>MEDICAL LEARNING SPACE</small>
      </span>
    </a>
  );
}
function ResourceCard({ r }: { r: Resource }) {
  return (
    <article className={`resource-card ${r.theme}`}>
      <a
        className="cover-link"
        href={r.url}
        target="_blank"
        rel="noopener noreferrer"
        tabIndex={-1}
        aria-hidden="true"
      >
        <Cover r={r} />
        <span className="cover-label">{r.tags[0] || r.type}</span>
        <span className="image-arrow">
          <ArrowUpRight size={20} />
        </span>
      </a>
      <div className="card-body">
        <div className="eyebrow">{r.courses[0] || r.type}</div>
        <h3>
          <a href={r.url} target="_blank" rel="noopener noreferrer">
            {r.title}
          </a>
        </h3>
        <div className="subtitle">{r.subtitle}</div>
        <p>{r.description}</p>
        <div className="card-bottom">
          <span>
            <Sparkles size={13} />
            {r.type}
          </span>
          <a href={r.url} target="_blank" rel="noopener noreferrer">
            {r.type === "智能学伴" ? "与学伴对话" : "开始探索"}
            <ArrowUpRight size={15} />
          </a>
        </div>
      </div>
    </article>
  );
}
function PublicPage() {
  const [data, setData] = useState<Data>();
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("全部资源");
  const [course, setCourse] = useState("全部课程");
  const refresh = () =>
    api("/public")
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    refresh();
    const f = () => refresh();
    window.addEventListener("focus", f);
    return () => window.removeEventListener("focus", f);
  }, []);
  useEffect(() => {
    if (data) document.title = data.settings.name;
  }, [data]);
  if (!data)
    return (
      <div className="loading-page">
        <BookOpen size={30} />
        <p>{error || "正在打开学习空间…"}</p>
        {error && <button onClick={refresh}>重新加载</button>}
      </div>
    );
  const all = data.resources;
  const types = ["全部资源", ...new Set(all.map((r) => r.type))];
  const courses = ["全部课程", ...new Set(all.flatMap((r) => r.courses))];
  const list = all.filter(
    (r) =>
      (type === "全部资源" || r.type === type) &&
      (course === "全部课程" || r.courses.includes(course)) &&
      `${r.title} ${r.subtitle} ${r.description} ${r.courses.join(" ")} ${r.tags.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const filtered = query || type !== "全部资源" || course !== "全部课程";
  const featured = list.filter((r) => r.featured);
  const other = list.filter((r) => !r.featured);
  return (
    <>
      <header className="site-header">
        <div className="shell header-inner">
          <Brand name={data.settings.name} />
          <nav>
            <a href="#companions">智能学伴</a>
            <a href="#explore">探索资源</a>
            <a className="nav-action" href="#explore">
              开始学习 <ArrowUpRight size={15} />
            </a>
          </nav>
        </div>
      </header>
      <main className="shell">
        <section className="hero">
          <div className="hero-copy">
            <div className="hero-kicker">
              <span /> A LITTLE CURIOSITY, A WORLD OF DISCOVERY
            </div>
            <h1>
              让好奇，成为
              <br />
              <em>学习的开始。</em>
            </h1>
            <p>{data.settings.intro}</p>
            <a className="primary" href="#companions">
              遇见你的智能学伴 <ArrowRight size={17} />
            </a>
            <div className="hero-notes">
              <span>
                <i />
                {all.length} 个精选学习入口
              </span>
              <span>{courses.length - 1} 门医学课程</span>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="art-cell">
              <img src="/covers/microbiology.webp" alt="" />
              <div className="art-cell-caption">从微观，发现无限</div>
            </div>
            <div className="thought thought-one">
              <Microscope size={20} />
              <span>
                察微<small>看见不可见</small>
              </span>
            </div>
            <div className="thought thought-two">
              <Waypoints size={20} />
              <span>
                循迹<small>让知识相连</small>
              </span>
            </div>
            <div className="thought thought-three">
              <ShieldCheck size={20} />
              <span>
                守衡<small>理解生命的平衡</small>
              </span>
            </div>
            <span className="star star-one">✦</span>
            <span className="star star-two">✧</span>
            <span className="art-label">OBSERVE. CONNECT. UNDERSTAND.</span>
          </div>
        </section>
        <div className="manifesto">
          <span>三门课程，三种思维</span>
          <div>
            <b>察微</b>
            <i>认识微观世界</i>
            <span className="dot">·</span>
            <b>循迹</b>
            <i>追寻知识脉络</i>
            <span className="dot">·</span>
            <b>守衡</b>
            <i>理解动态平衡</i>
          </div>
          <Leaf size={21} />
        </div>
        <section className="resources-section" id="companions">
          <div className="section-heading">
            <div>
              <div className="section-kicker">01 / LEARN WITH A COMPANION</div>
              <h2>
                学习路上，有问有伴<span>精选智能学伴</span>
              </h2>
            </div>
            <p>从疑问到理解，多一个一起思考的伙伴。</p>
          </div>
          <div className="filter-bar" id="explore">
            <div className="type-tabs">
              {types.map((t) => (
                <button
                  key={t}
                  className={type === t ? "active" : ""}
                  onClick={() => setType(t)}
                >
                  {t}
                  {t === "全部资源" && <small>{all.length}</small>}
                </button>
              ))}
            </div>
            <div className="search-tools">
              {courses.length > 2 && (
                <select
                  aria-label="筛选课程"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                >
                  {courses.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              )}
              <label className="search">
                <Search size={16} />
                <input
                  placeholder="发现你需要的资源"
                  aria-label="搜索学习资源"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button aria-label="清除搜索" onClick={() => setQuery("")}>
                    <X size={14} />
                  </button>
                )}
              </label>
            </div>
          </div>
          {filtered ? (
            <>
              <div className="result-count">找到 {list.length} 个学习资源</div>
              <div className="cards-grid">
                {list.map((r) => (
                  <ResourceCard r={r} key={r.id} />
                ))}
              </div>
              {!list.length && (
                <div className="empty">
                  <Search size={30} />
                  <h3>换个关键词试试看</h3>
                  <p>也可以切换课程或资源类型，继续探索。</p>
                  <button
                    onClick={() => {
                      setQuery("");
                      setType("全部资源");
                      setCourse("全部课程");
                    }}
                  >
                    查看全部资源
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="cards-grid">
                {featured.map((r) => (
                  <ResourceCard r={r} key={r.id} />
                ))}
              </div>
              {other.length > 0 && (
                <div className="more-section">
                  <div className="section-heading">
                    <div>
                      <div className="section-kicker">
                        02 / LEARNING BY EXPLORING
                      </div>
                      <h2>
                        把知识，变成体验<span>探索更多可能</span>
                      </h2>
                    </div>
                    <FlaskConical size={26} />
                  </div>
                  {other.length === 1 ? (
                    <article className="lab-banner">
                      <div className="lab-image">
                        <Cover r={other[0]} />
                        <span className="lab-image-note">
                          A SPACE TO EXPLORE
                        </span>
                      </div>
                      <div className="lab-copy">
                        <span className="pill">
                          <FlaskConical size={14} />
                          {other[0].type}
                        </span>
                        <h3>{other[0].title}</h3>
                        <p>{other[0].description}</p>
                        <div className="lab-tags">
                          {other[0].tags.map((t) => (
                            <span key={t}>{t}</span>
                          ))}
                        </div>
                        <a
                          className="primary"
                          href={other[0].url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          进入探索 <ArrowUpRight size={17} />
                        </a>
                      </div>
                    </article>
                  ) : (
                    <div className="cards-grid">
                      {other.map((r) => (
                        <ResourceCard key={r.id} r={r} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>
        <div className="closing">
          <span>✦</span>
          <p>每一个好问题，都是新的开始。</p>
          <small>{data.settings.footer}</small>
        </div>
      </main>
      <footer className="site-footer">
        <div className="shell">
          <span>
            {data.settings.name} <i> / </i> {data.settings.tagline}
          </span>
          <a href="/admin">
            资源管理 <ArrowUpRight size={13} />
          </a>
        </div>
      </footer>
    </>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="关闭">
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Editor({
  initial,
  taxonomy,
  onClose,
  onSave,
}: {
  initial: Resource;
  taxonomy: Tax[];
  onClose: () => void;
  onSave: (r: Resource) => Promise<void>;
}) {
  const [r, setR] = useState({ ...initial });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key: keyof Resource, value: unknown) =>
    setR((p) => ({ ...p, [key]: value }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave(r);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={initial.id ? "编辑学习资源" : "添加学习资源"}
      onClose={onClose}
    >
      <form onSubmit={save}>
        <div className="editor-grid">
          <div className="editor-fields">
            <label>
              资源名称 *
              <input
                required
                maxLength={100}
                value={r.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="例如：见微知著"
              />
            </label>
            <label>
              副标题
              <input
                value={r.subtitle}
                maxLength={150}
                onChange={(e) => set("subtitle", e.target.value)}
                placeholder="例如：《医学微生物学》智能学伴"
              />
            </label>
            <label>
              目标网址 *
              <input
                required
                type="url"
                maxLength={2000}
                value={r.url}
                onChange={(e) => set("url", e.target.value)}
                placeholder="https://…"
              />
            </label>
            <label>
              简短介绍
              <textarea
                maxLength={600}
                rows={3}
                value={r.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </label>
            <div className="form-row">
              <label>
                资源类型 *
                <input
                  required
                  list="resource-types"
                  value={r.type}
                  onChange={(e) => set("type", e.target.value)}
                />
                <datalist id="resource-types">
                  {taxonomy
                    .filter((t) => t.kind === "type")
                    .map((t) => (
                      <option key={t.id} value={t.name} />
                    ))}
                </datalist>
              </label>
              <label>
                显示顺序
                <input
                  type="number"
                  min={-10000}
                  max={10000}
                  value={r.sort}
                  onChange={(e) => set("sort", Number(e.target.value))}
                />
              </label>
            </div>
            <label>
              所属课程（逗号分隔）
              <input
                value={r.courses.join("，")}
                onChange={(e) => set("courses", e.target.value.split(/[,，]/))}
                onBlur={() =>
                  set("courses", r.courses.map((s) => s.trim()).filter(Boolean))
                }
                list="courses"
              />
              <datalist id="courses">
                {taxonomy
                  .filter((t) => t.kind === "course")
                  .map((t) => (
                    <option key={t.id} value={t.name} />
                  ))}
              </datalist>
            </label>
            <label>
              标签（逗号分隔）
              <input
                value={r.tags.join("，")}
                onChange={(e) => set("tags", e.target.value.split(/[,，]/))}
                onBlur={() =>
                  set("tags", r.tags.map((s) => s.trim()).filter(Boolean))
                }
              />
            </label>
            <div className="form-row">
              <label>
                发布状态
                <select
                  value={r.status}
                  onChange={(e) => set("status", e.target.value)}
                >
                  {Object.entries(statusLabels).map(([v, l]) => (
                    <option value={v} key={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={r.featured}
                  onChange={(e) => set("featured", e.target.checked)}
                />
                首页推荐
              </label>
            </div>
          </div>
          <aside className="editor-preview">
            <span className="section-kicker">封面与卡片预览</span>
            <ResourceCard
              r={{
                ...r,
                title: r.title || "资源名称",
                description:
                  r.description ||
                  "添加一句介绍，让学生更容易找到适合自己的资源。",
                url: r.url || "#",
              }}
            />
            <div className="form-row">
              <label>
                主题
                <select
                  value={r.theme}
                  onChange={(e) => set("theme", e.target.value)}
                >
                  <option value="teal">青绿 · 察微</option>
                  <option value="amber">琥珀 · 循迹</option>
                  <option value="indigo">靛蓝 · 守衡</option>
                  <option value="sage">鼠尾草 · 探索</option>
                </select>
              </label>
            </div>
            <label className="upload-button">
              <Upload size={16} />
              {busy ? "正在处理…" : "上传封面"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={busy}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) {
                    setError("图片不能超过 5 MB");
                    return;
                  }
                  setBusy(true);
                  try {
                    const form = new FormData();
                    form.append("file", file);
                    const data = await api("/upload", "POST", form);
                    set("cover", data.url);
                  } catch (err) {
                    setError((err as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </label>
            <button
              type="button"
              className="text-button"
              onClick={() => set("cover", "")}
            >
              使用主题默认封面
            </button>
            <small>JPG / PNG / WebP，最大 5 MB</small>
            <label>
              裁切位置 · 水平
              <input
                type="range"
                min="0"
                max="100"
                value={r.focusX}
                onChange={(e) => set("focusX", Number(e.target.value))}
              />
            </label>
            <label>
              裁切位置 · 垂直
              <input
                type="range"
                min="0"
                max="100"
                value={r.focusY}
                onChange={(e) => set("focusY", Number(e.target.value))}
              />
            </label>
          </aside>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button className="primary" disabled={busy} type="submit">
            <Save size={16} />
            保存资源
          </button>
        </div>
      </form>
    </Modal>
  );
}
function Login({ onLogin }: { onLogin: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="login-page">
      <a href="/" className="back-home">
        ← 返回学习空间
      </a>
      <div className="login-card">
        <span className="brandmark">
          <BookOpen size={26} />
        </span>
        <div className="section-kicker">A SPACE FOR GOOD RESOURCES</div>
        <h1>管理学习空间</h1>
        <p>把值得分享的资源，放到学生身边。</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            try {
              await api("/login", "POST", {
                username: f.get("username"),
                password: f.get("password"),
              });
              onLogin();
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            管理员账号
            <input name="username" autoComplete="username" required autoFocus />
          </label>
          <label>
            密码
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "登录中…" : "登录后台"}
            <ArrowRight size={17} />
          </button>
        </form>
        <small>账号由部署管理员创建</small>
      </div>
    </div>
  );
}
function Admin() {
  const [data, setData] = useState<Data>();
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("resources");
  const [editor, setEditor] = useState<Resource>();
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [archive, setArchive] = useState(false);
  const [importData, setImportData] = useState<{
    source: unknown;
    rows: (Resource & { duplicate: boolean; missingCover: boolean })[];
  }>();
  const [mode, setMode] = useState("skip");
  const [pending, setPending] = useState(false);
  const load = async () => {
    try {
      setData(await api("/admin"));
    } catch {
      setData(undefined);
    } finally {
      setLoaded(true);
    }
  };
  useEffect(() => {
    load();
    document.title = "资源管理 · 医学智学空间";
  }, []);
  const run = async (fn: () => Promise<unknown>, message: string) => {
    setPending(true);
    try {
      await fn();
      setNotice(message);
      await load();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setPending(false);
    }
  };
  if (!loaded) return <div className="loading-page">正在打开管理后台…</div>;
  if (!data) return <Login onLogin={load} />;
  const rs = data.resources.filter(
    (r) =>
      (archive ? r.status === "archived" : r.status !== "archived") &&
      `${r.title} ${r.courses.join(" ")}`.includes(search),
  );
  return (
    <div className="admin-page">
      <header className="admin-header">
        <Brand name={data.settings.name} />
        <div>
          <a href="/" target="_blank" rel="noopener noreferrer">
            查看首页 <ExternalLink size={15} />
          </a>
          <button onClick={() => run(() => api("/logout", "POST"), "已退出")}>
            <LogOut size={16} />
            退出
          </button>
        </div>
      </header>
      <main className="admin-main">
        <div className="admin-title">
          <div>
            <div className="section-kicker">YOUR LEARNING SPACE</div>
            <h1>让好资源，被发现。</h1>
            <p>你好，{data.username}。在这里打理你的学习空间。</p>
          </div>
          <button
            className="primary"
            onClick={() => setEditor({ ...blank, sort: data.resources.length })}
          >
            <Plus size={17} />
            添加资源
          </button>
        </div>
        <div className="stats">
          <div>
            <span>资源总数</span>
            <strong>
              {data.resources.filter((r) => r.status !== "archived").length}
            </strong>
          </div>
          <div>
            <span>已发布</span>
            <strong>
              {data.resources.filter((r) => r.status === "published").length}
            </strong>
          </div>
          <div>
            <span>课程分类</span>
            <strong>
              {data.taxonomy?.filter((t) => t.kind === "course").length}
            </strong>
          </div>
          <div>
            <span>当前版本</span>
            <strong className="version">v{data.version}</strong>
          </div>
        </div>
        <div className="admin-tabs">
          {[
            ["resources", "资源管理"],
            ["taxonomy", "分类与标签"],
            ["settings", "站点设置"],
            ["backup", "备份与导入"],
            ["account", "账号设置"],
          ].map(([id, name]) => (
            <button
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
              key={id}
            >
              {name}
            </button>
          ))}
        </div>
        {notice && (
          <div className="notice" role="status">
            <span>{notice}</span>
            <button aria-label="关闭提示" onClick={() => setNotice("")}>
              <X size={16} />
            </button>
          </div>
        )}
        {tab === "resources" && (
          <section className="admin-panel">
            <div className="panel-toolbar">
              <label className="search">
                <Search size={16} />
                <input
                  placeholder="搜索资源名称或课程"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <button onClick={() => setArchive(!archive)}>
                {archive ? <RotateCcw size={16} /> : <Archive size={16} />}{" "}
                {archive ? "查看资源" : "归档箱"}
              </button>
            </div>
            <div className="resource-table">
              {rs.map((r) => (
                <div className="resource-row" key={r.id}>
                  <Cover r={r} />
                  <div className="row-info">
                    <h3>{r.title}</h3>
                    <p>
                      {r.type} <span>·</span>{" "}
                      {r.courses.join(" / ") || "未分类"}
                    </p>
                  </div>
                  <span className={`status ${r.status}`}>
                    {statusLabels[r.status]}
                  </span>
                  <span className="order">顺序 {r.sort}</span>
                  <div className="row-actions">
                    <button
                      aria-label={"编辑" + r.title}
                      onClick={() => setEditor(r)}
                    >
                      <Pencil size={16} />
                      <span>编辑</span>
                    </button>
                    <button
                      disabled={pending}
                      aria-label={(archive ? "恢复" : "归档") + r.title}
                      onClick={() =>
                        run(
                          () =>
                            api("/resources/" + r.id, "PUT", {
                              ...r,
                              status: archive ? "draft" : "archived",
                            }),
                          archive ? "已恢复为草稿" : "已归档，可在归档箱恢复",
                        )
                      }
                    >
                      {archive ? (
                        <RotateCcw size={16} />
                      ) : (
                        <Archive size={16} />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {rs.length === 0 && (
              <div className="empty">
                <BookOpen />
                <p>{archive ? "归档箱为空" : "还没有匹配的资源"}</p>
              </div>
            )}
          </section>
        )}
        {tab === "taxonomy" && (
          <section className="admin-panel">
            <h2>分类与标签</h2>
            <p className="muted">
              添加资源时，也可以直接填写新的分类。被资源使用的分类需要先解除关联才能删除。
            </p>
            {(["type", "course", "tag"] as const).map((kind) => (
              <div className="taxonomy-group" key={kind}>
                <h3>
                  {
                    { type: "资源类型", course: "课程分类", tag: "资源标签" }[
                      kind
                    ]
                  }
                </h3>
                <div className="tax-chips">
                  {data.taxonomy
                    ?.filter((t) => t.kind === kind)
                    .map((t) => (
                      <span key={t.id}>
                        {t.name}
                        <button
                          aria-label={"删除" + t.name}
                          disabled={pending}
                          onClick={() =>
                            run(
                              () => api("/taxonomy/" + t.id, "DELETE"),
                              "分类已删除",
                            )
                          }
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                </div>
                <form
                  className="inline-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = e.currentTarget;
                    const name = String(new FormData(f).get("name") || "");
                    run(
                      () => api("/taxonomy", "POST", { kind, name }),
                      "分类已添加",
                    ).then(() => f.reset());
                  }}
                >
                  <input
                    name="name"
                    placeholder="输入新名称"
                    required
                    maxLength={60}
                  />
                  <button disabled={pending}>
                    <Plus size={15} />
                    添加
                  </button>
                </form>
              </div>
            ))}
          </section>
        )}
        {tab === "settings" && (
          <section className="admin-panel narrow-panel">
            <h2>站点设置</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                run(
                  () => api("/settings", "PUT", Object.fromEntries(f)),
                  "站点设置已保存",
                );
              }}
            >
              <label>
                站点名称
                <input
                  name="name"
                  required
                  defaultValue={data.settings.name}
                  maxLength={60}
                />
              </label>
              <label>
                课程主线
                <input
                  name="tagline"
                  defaultValue={data.settings.tagline}
                  maxLength={120}
                />
              </label>
              <label>
                首页介绍
                <textarea
                  name="intro"
                  rows={4}
                  defaultValue={data.settings.intro}
                  maxLength={400}
                />
              </label>
              <label>
                页脚寄语
                <input
                  name="footer"
                  defaultValue={data.settings.footer}
                  maxLength={180}
                />
              </label>
              <button className="primary" disabled={pending}>
                <Save size={16} />
                保存设置
              </button>
            </form>
          </section>
        )}
        {tab === "backup" && (
          <section className="admin-panel">
            <h2>备份与迁移</h2>
            <div className="backup-grid">
              <div>
                <span className="feature-icon">
                  <Download />
                </span>
                <h3>完整备份</h3>
                <p>
                  保存资源、封面、站点设置与管理员数据。恢复时使用服务器维护命令，适合迁移到新
                  VPS。
                </p>
                <button
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const result = await api("/backups", "POST");
                      const a = document.createElement("a");
                      a.href = "/api/backups/" + result.name;
                      a.download = result.name;
                      document.body.append(a);
                      a.click();
                      a.remove();
                    }, "完整备份已生成，下载已开始")
                  }
                >
                  <Download size={16} />
                  生成并下载备份
                </button>
                <small>
                  包含管理员数据，请妥善保存。应用每小时检查一次，距最新备份满
                  24 小时后自动备份。
                </small>
              </div>
              <div>
                <span className="feature-icon">
                  <SlidersHorizontal />
                </span>
                <h3>资源清单</h3>
                <p>
                  导出可编辑的 JSON
                  资源清单，或从清单批量导入资源。上传的封面文件需要通过完整备份迁移。
                </p>
                <a className="button" href="/api/export" download>
                  <Download size={16} />
                  导出清单
                </a>
                <label className="upload-button inline-upload">
                  <Upload size={16} />
                  导入清单
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      try {
                        if (f.size > 1024 * 1024) throw Error("清单最大 1 MB");
                        const source = JSON.parse(await f.text());
                        const preview = await api(
                          "/import/preview",
                          "POST",
                          source,
                        );
                        setImportData({ source, rows: preview.resources });
                      } catch (err) {
                        setNotice((err as Error).message);
                      }
                    }}
                  />
                </label>
              </div>
            </div>
            <details className="audit">
              <summary>最近操作记录</summary>
              {data.audit?.map((a) => (
                <p key={a.id}>
                  <time>{new Date(a.at).toLocaleString("zh-CN")}</time>{" "}
                  {a.action} · {a.subject}
                </p>
              ))}
            </details>
          </section>
        )}
        {tab === "account" && (
          <section className="admin-panel narrow-panel">
            <h2>修改管理员密码</h2>
            <p className="muted">
              修改后将退出所有会话，请使用新密码重新登录。
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                if (f.get("password") !== f.get("repeat")) {
                  setNotice("两次新密码不一致");
                  return;
                }
                run(
                  () =>
                    api("/password", "POST", {
                      current: f.get("current"),
                      password: f.get("password"),
                    }),
                  "密码已更新，请重新登录",
                );
              }}
            >
              <label>
                当前密码
                <input
                  name="current"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>
              <label>
                新密码
                <input
                  name="password"
                  type="password"
                  minLength={12}
                  maxLength={200}
                  autoComplete="new-password"
                  required
                />
              </label>
              <label>
                再次输入新密码
                <input
                  name="repeat"
                  type="password"
                  minLength={12}
                  autoComplete="new-password"
                  required
                />
              </label>
              <button className="primary" disabled={pending}>
                更新密码
              </button>
            </form>
          </section>
        )}
      </main>
      <footer className="admin-footer">
        LearningAgent · 用心整理，自由探索
      </footer>
      {editor && (
        <Editor
          initial={editor}
          taxonomy={data.taxonomy || []}
          onClose={() => setEditor(undefined)}
          onSave={async (r) => {
            await api(
              "/resources" + (r.id ? "/" + r.id : ""),
              r.id ? "PUT" : "POST",
              r,
            );
            await load();
            setNotice("资源已保存");
          }}
        />
      )}
      {importData && (
        <Modal title="预览导入资源" onClose={() => setImportData(undefined)}>
          <div className="import-preview">
            <p>
              共 {importData.rows.length} 条，其中{" "}
              {importData.rows.filter((r) => r.duplicate).length} 条 ID 已存在。
            </p>
            <label>
              重复项处理
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="skip">跳过已有资源</option>
                <option value="replace">覆盖已有资源</option>
              </select>
            </label>
            <ul>
              {importData.rows.map((r, i) => (
                <li key={i}>
                  {r.title}
                  <span>
                    {r.duplicate ? "已存在" : "新增"}
                    {r.missingCover ? " · 图片未迁移，将使用默认封面" : ""}
                  </span>
                </li>
              ))}
            </ul>
            <div className="modal-actions">
              <button onClick={() => setImportData(undefined)}>取消</button>
              <button
                className="primary"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    await api("/import", "POST", {
                      data: importData.source,
                      mode,
                    });
                    setImportData(undefined);
                  }, "资源导入完成")
                }
              >
                确认导入
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {location.pathname.startsWith("/admin") ? <Admin /> : <PublicPage />}
  </React.StrictMode>,
);
