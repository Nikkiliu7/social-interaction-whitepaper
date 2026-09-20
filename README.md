# 社交互动体验白皮书 · Web 端

零依赖静态站：原生 ES Module + CSS，无构建步骤、无 node_modules、无外链资源。
Windows / macOS、Codemaker / Codex / 其他 AI 工具均可直接编辑运行。

## 启动

浏览器禁止 `file://` 页面读取本地 JSON，**必须用本地静态服务器打开**（双击 `index.html` 会看到提示与命令）。

```bash
# macOS / Linux
cd web && python3 -m http.server 8000
```

```bat
:: Windows
cd web && python -m http.server 8000
```

然后访问 http://localhost:8000 。没有 Python 时可用 `npx serve web` 或任意静态服务器。

## 分享给别人

网页在你本机的 `d:\ai_empty\社交白皮书\web\`（仓库内 `web/`）。它是纯静态站，没有后端，所以 `http://localhost:8000` 这个地址**只有你自己能打开**，直接发给别人无效。三种可行方式：

| 方式 | 做法 | 适合 | 限制 |
| --- | --- | --- | --- |
| 局域网临时分享 | `cd web && python -m http.server 8000 --bind 0.0.0.0`，把 `http://<你的内网IP>:8000` 发给同网段同事（Windows 用 `ipconfig` 查 IPv4） | 会议室现场演示 | 需同一网络；你的电脑关机/休眠即失效；可能要放行防火墙 |
| 静态托管（长期推荐） | 把整个 `web/` 目录上传到任意静态服务：内网 Nginx、对象存储、GitHub Pages 等，无需构建，上传即用 | 固定链接、长期分享 | 需要一个托管位置；含公司资料时注意选内网 |
| 打包发送 | 压缩 `web/` 发给对方，对方解压后同样用 `python -m http.server` 打开 | 离线、外发评审 | 对方不能双击 `index.html`（浏览器禁止 `file://` 读 JSON） |

说明：清单的「分享链接」是把勾选结果编码进 URL 的 hash，本身不含服务器，所以它只能在**对方也能打开这个站点**的前提下生效；否则请改用清单导出的 Markdown / CSV / JSON 文件。

## 目录

```
web/
  index.html              页面骨架（头部、菜篮栏、弹层容器）
  assets/css/
    tokens.css            设计变量（颜色、阴影、间距、字号）——改主题只改这里
    base.css              重置、背景渐变层、排版
    layout.css            页面骨架与响应式断点
    components.css        按钮、标签、卡片、筛选、弹层、清单等组件
  assets/js/
    main.js               入口：装配数据、路由、视图与全部交互（唯一事件绑定处）
    data.js               唯一读取数据处：加载、归一化、建索引、筛选与计数
    state.js              状态中枢：清单方案、偏好；变更一律走这里
    router.js             hash 路由：筛选/搜索/当前案例/分享载荷的编解码
    views/                home.js｜list.js｜detail.js｜basket.js
    components/           filters.js｜caseCard.js｜ui.js（标签/弹层/Toast/灯箱）
    lib/                  store.js｜export.js｜share.js｜particles.js｜dom.js
  data/
    social-library.json   由 Excel 导出（勿手改）
    build-info.json       数据版本信息，显示在页脚
    assets/               案例配图（由导出脚本生成）
    scenario-packs.json   首页「推荐场景包」，packs 为空时该入口自动隐藏
  tools/                  开发期自检脚本（不参与页面运行）
```

## 数据同步（表格改了怎么办）

三步，页面代码不需要改：

```bash
# 1. 在 Excel 里改完并保存
# 2. 重新导出（无宏稿为默认来源）
python maintenance/import_social_library.py "outputs/social-library-v1.1/社交体验列表_v1.1_无宏审核稿.xlsx" web/data
# 3. 刷新浏览器
```

宏稿同样支持：把路径换成 `社交体验列表_v1.1_宏审核稿.xlsm` 即可，页面零改动。页脚会显示当前数据来自哪份文件、导出于何时。

依赖：Python + `openpyxl`（提取图片还需 `pillow`）。

```bash
python -m pip install openpyxl pillow
```

规则（详见仓库根目录《社交白皮书维护说明.md》）：

- 新增列必须先在 Excel 里登记 `sl_field_*` 命名引用，否则导出会**明确报错**，不会静默丢列。
- 改表头显示名 = 改网页显示标题，无需动代码。
- 新增标签值会自动出现在筛选面板里。
- 游戏名由 `参考案例` 的「｜」前缀派生，无前缀时回退为「蛋仔派对」；将来表里新增正式「游戏名称」列后会自动优先使用。

## 自检

```bash
node web/tools/check.mjs          # ESM 语法 / 导入路径 / 导出符号
node web/tools/smoke.mjs          # 数据层、筛选、分享、导出导入
python maintenance/test_import_contract.py   # Excel 契约回归（临时副本，不碰源表）

# DOM 级流程自检（需临时安装 jsdom，不写入仓库）
npm install jsdom --no-save --prefix "%TEMP%\slw-jsdom"          # Windows
SLW_JSDOM=<jsdom>/lib/api.js node web/tools/dom-smoke.mjs        # macOS / Linux
```

## 约定

- 页面不得硬编码标签值、列号或字段显示标题；一切来自 `data/social-library.json`。
- 新增交互统一走 `main.js` 的 `ACTIONS` 表 + `data-action` 属性。
- 新文件一律 UTF-8 + LF（见根目录 `.gitattributes` / `.editorconfig`）。
