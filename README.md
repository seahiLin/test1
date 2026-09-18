# Weave

pnpm workspace，三个独立应用，统一使用 TypeScript。

```text
apps/web   React + Vite + TanStack Router 文件路由 + shadcn/ui + Tailwind CSS
apps/api    Hono Cloudflare Worker + Better Auth + Drizzle + D1
apps/agents Flue 2 + Cloudflare Durable Objects + Worker RPC + OpenRouter
```

调用链：浏览器 `@flue/react` → `/api/chat/:conversationId` → Hono（校验登录及会话归属）→ `AGENTS.conversation()` 私有 RPC → Flue Assistant Durable Object → OpenRouter。
agents 使用 Flue 官方 Vite / Cloudflare 插件生成 Worker 和 SQLite Durable Object。`src/cloudflare.ts` 导出命名 RPC 服务；默认 HTTP handler 仅返回 404，关闭 workers.dev、preview URLs，且不配置公开 routes。

每个账号可以新建、列出和切换多个会话，标题来自首条消息，列表按最近发送时间排列。刷新后恢复上次选择，退出重登后仍可读取历史。

职责划分遵循 Flue 原生机制：
- Flue 为 `Assistant` 生成 `FlueAssistantAgent` DO 类；每个会话 ID 对应该类的独立 DO 实例。业务代码不手写 DO 类或消息存储。
- D1 的 `conversation` 表只保存会话 ID、用户归属、标题及时间，不保存消息。Flue 没有枚举全部会话的 API，这个目录由应用维护。
- `/api/conversations` 提供列表和新建；`/api/chat/:conversationId` 校验登录和会话归属，再通过 RPC 进入 Flue 原生路由。
- `@flue/react` 加载历史、跟随消息流；前端只发送新消息，上下文由 Flue 管理。

迁移 `0001_plain_medusa.sql` 为升级前的每个账号建立“历史对话”目录，保留原先用户 ID 对应的 Flue 实例，不复制或修改旧消息。新会话使用服务端生成的 UUID；首次发送前只有目录记录，尚无消息流。

尚未提供删除会话、工具调用或附件上传。旧版（接入 Flue 前）仅在页面内存中的聊天无法迁移。
默认模型为 `deepseek/deepseek-v4-flash-0731:free`（DeepSeek V4 Flash 0731 免费版），可在 agents 的 Wrangler vars 中调整。会话目录的读写及归属校验统一使用 Drizzle；聊天内容仍由 Flue 管理。

## 代码组织

- `apps/api/src/index.ts` 只组装中间件、路由和全局错误处理。
- `apps/api/src/middleware/session.ts` 统一认证，向后续路由提供当前用户。
- `apps/api/src/routes` 负责 HTTP 校验、响应及 Flue 转发；`db/conversations.ts` 集中管理会话目录查询，所有操作限定当前用户。
- `apps/web/src/routes` 只声明页面路由；`features/auth/home.tsx` 负责登录、注册及会话入口。
- `apps/web/src/components/conversations.tsx` 组装工作空间；同名目录中的 `api.ts` 封装会话请求，`use-conversations.ts` 管理列表、选择和持久化，`sidebar.tsx` 展示导航及搜索。
- `apps/web/src/components/chat.tsx` 展示消息；同名目录中的 `use-chat.ts` 管理 Flue、草稿及发送生命周期，`composer.tsx` 负责输入交互，`copy-message.tsx` 负责复制反馈。

聊天组件按会话 ID 设置 React `key`，账号工作空间按用户 ID 设置 `key`；切换时重建局部状态，避免草稿和首次发送标记串到其他会话。新增功能优先放入对应业务模块，共用 UI 保留在 `components/ui`，不要把业务请求放回路由或展示组件。

## 本地开发

使用 Node.js 22.19+（推荐 Node 24 LTS）和 pnpm 10.9.0。

```sh
pnpm install
# 首次克隆时创建以下文件；当前初始化已生成本地配置，无需覆盖
cp apps/api/.dev.vars.example apps/api/.dev.vars
cp apps/agents/.dev.vars.example apps/agents/.dev.vars
# 设置随机 BETTER_AUTH_SECRET（至少 32 字符）和 OPENROUTER_API_KEY
pnpm db:migrate
pnpm dev
```

打开 http://localhost:5173，可注册、登录、调用模型、退出。
前端 Vite 将 `/api` 代理到 localhost:8787。`pnpm dev` 先构建 Flue agents，再监听源码重新构建；Wrangler 同时启动 api 和 agents 构建产物，使 RPC 和 Durable Object 在本地可用。不要单独用 `wrangler dev -c apps/agents/wrangler.jsonc` 启动未构建的 agents。
本地 D1 和 Durable Object 数据保存在 Wrangler 的 `.wrangler/state` 中，重启后保留；删除该目录会清空本地数据。
使用 localhost 访问前端，以匹配 Better Auth 的 trusted origin。
每次重启开发服务前，无需重复迁移，只有新增迁移时再执行。

`.dev.vars`、`.env*` 已被 Git 忽略，密钥只存储在本地 agents 配置中；前端不包含 OpenRouter key。
后端不需要 OpenRouter key。生产密钥通过 Wrangler secret 配置，不要提交。

## 校验

```sh
pnpm build       # 前端构建 + 两个 Worker dry-run，不上传
pnpm typecheck
pnpm test        # 需先运行 pnpm dev；使用本地 D1 创建测试账号
TEST_MODEL_FAILURE=1 pnpm test # 可选：模型不可用时，验证失败事件和跨会话消息隔离
TEST_MODEL=1 pnpm test # 额外验证 Flue → OpenRouter、历史读取及重登恢复，会消耗模型额度
```

路由文件位于 `apps/web/src/routes`；`routeTree.gen.ts` 由 Vite 插件自动生成。
增加 shadcn 组件：`pnpm --filter @weave/web exec pnpm dlx shadcn@latest add <组件名>`。
修改数据表后运行 `pnpm --filter @weave/api db:generate`，再执行迁移。

## GitHub → Cloudflare CI/CD

仓库：`git@github.com:seahiLin/test1.git`。工作流位于 `.github/workflows/deploy.yml`，所有分支的 push 自动触发，也可在 Actions 中手动运行（全量发布）。

### 首次配置

在 [GitHub Actions Secrets](https://github.com/seahiLin/test1/settings/secrets/actions) 中添加：

| Secret | 用途 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | 限定目标账号，授予 Account / Workers Scripts / Edit、Account / D1 / Edit、Account / Account Settings / Read 权限 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账号 ID |
| `BETTER_AUTH_SECRET` | 至少 32 字符的随机认证密钥 |
| `OPENROUTER_API_KEY` | Agents 调用 OpenRouter 的密钥 |

在 Cloudflare Workers & Pages 中先启用账号的 `workers.dev` 子域名。无需提前创建 Worker 或 D1：流水线按名称查询并复用 D1，不存在时创建，再执行 Drizzle SQL 迁移。生产 D1 名称为 `weave-auth`；已有同名数据库时会复用它。

配置后在 Actions → Deploy Cloudflare → Run workflow 选择分支发布，或者重新运行第一次因缺少 Secrets 而失败的任务。最终访问地址显示在 web job 的 Summary 中：`https://weave-web.<账号子域名>.workers.dev`。

### 按包发布

| 改动 | 发布 |
| --- | --- |
| `apps/web/**` | web |
| `apps/api/**`（包括迁移） | api |
| `apps/agents/**` | agents、依赖其 RPC 契约的 api |
| 根依赖清单/锁文件、workspace、TypeScript/Node 配置、`.github/**`、`scripts/ci/**` | 三个包 |
| 仅 README 等文档 | 不发布 |

每个包有独立 job，运行类型检查后构建发布；首次创建及全量发布按 agents → api → web 排序，满足 Service Binding 的部署依赖。变更对比该分支上一次完成且成功的工作流提交，连续推送被合并排队时也不会漏掉较早提交。无历史、上次失败/取消、旧提交不可用或手动运行时，全量发布以修复可能的部分部署。

### 生产和分支预览

- `main` 使用 `weave-web`、`weave-api`、`weave-agents` 和 `weave-auth`。
- 其他分支的资源名加上截短分支名及原始分支名 SHA-256 前 10 位；斜杠、大小写或截短后的名称不会直接混用。每个分支有独立 D1、Durable Objects、服务绑定和访问地址。
- 只有 web 开启公开 `workers.dev`，它托管 SPA 静态文件，将 `/api` 和 `/api/*` 原样转发给私有 api，再由 api 调用私有 agents。无需额外购买域名或配置 `/api` 公共路由。
- API 的认证 URL 与可信来源自动设置为该分支 web origin；预览认证签名密钥由仓库密钥和分支名派生。各分支使用相同的 OpenRouter key。
- D1 迁移先于 API 发布执行，建议保持向后兼容；Worker 上传和数据库迁移不是同一个事务。
- 删除 Git 分支不会自动删除云端资源或数据，需要在 Cloudflare 中手动清理对应的三个 Worker 和 D1。

本地开发仍使用原有配置。流水线临时生成 `wrangler.ci.json`，Agents 构建时临时应用分支名称并让 Flue 生成最终 DO 配置；这些文件和密钥文件不提交 Git。

```sh
node --test scripts/ci/*.test.mjs # 分支隔离、按包变更、认证隔离、API 转发测试
```

实现依据：[Cloudflare Static Assets](https://developers.cloudflare.com/workers/static-assets/)、[Service Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)、[D1 Migrations](https://developers.cloudflare.com/d1/reference/migrations/)。

Flue 相关文件：`apps/agents/src/agents/assistant.ts` 定义模型与提示词，`vite.config.ts` 配置生成过程，`wrangler.jsonc` 保存 `FlueAssistantAgent` 的 SQLite 迁移。不要直接编辑生成目录。修改模型时也应核对 assistant.ts 的模型能力配置（当前使用 DeepSeek 免费版的 1048576 上下文及零价格元数据，应用单次输出上限设为 16384 token；零价格不保证模型端点仍可用）。

Flue 生成的 Durable Object 类名由 Agent 函数名决定。已有数据后不要直接重命名 `Assistant`；需要配套的 Durable Object 迁移。

配置 GitHub Secrets 后，分支推送将自动创建所需云端资源并发布。邮箱密码登录已启用；邮件验证、密码找回邮件和业务级模型配额尚未配置。

参考：[Flue Cloudflare](https://flueframework.com/docs/ecosystem/deploy/cloudflare/)、[Flue React](https://flueframework.com/docs/guide/react/)、[TanStack Router](https://tanstack.com/router/latest/docs/installation/with-vite)、[shadcn/ui](https://ui.shadcn.com/docs/installation/manual)、[Better Auth / Hono](https://better-auth.com/docs/integrations/hono)、[Cloudflare RPC](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/rpc/)、[DeepSeek V4 Flash 0731 (free)](https://openrouter.ai/deepseek/deepseek-v4-flash-0731:free)。
