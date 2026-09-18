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

仓库：`git@github.com:seahiLin/test1.git`。只有 `main` 是长期集成分支，staging / production 是固定部署环境，不另建对应 Git 分支。

| 事件 | 行为 |
| --- | --- |
| 普通功能分支 push | CI：类型检查、构建和部署脚本测试，不创建云端资源 |
| 同仓库非 Draft PR → main | 创建/更新 `pr-<编号>` 预览；Draft 转为 ready 时创建 |
| Fork PR | 仅 CI，不提供部署凭据或创建预览 |
| PR 关闭或合并 | 删除该 PR 的三个 Worker 和 D1；只允许清理 `pr-<编号>` |
| main push | 构建一次 → staging → 健康及集成测试 → production → 只读健康检查 |
| Actions 手动运行 Deploy Cloudflare | 仅 main 有效，全量执行 staging → production |

### 按包发布

| 改动 | 构建和发布 |
| --- | --- |
| `apps/web/**` | web |
| `apps/api/**`（包括迁移） | api |
| `apps/agents/**` | agents 和依赖其 RPC 契约的 api |
| 根依赖清单/锁文件、workspace、TypeScript/Node 配置、`.github/**`、`scripts/ci/**`、冒烟测试 | 三个包 |
| 仅 README 等文档 | 不发布 |

首次预览、PR 重开、Draft 转 ready、无成功历史、上次失败/取消、旧提交不可用或手动运行时，全量部署。其他更新相对之前完成且成功的部署提交检测改动，避免连续推送或部分失败漏发。

构建 job 不接收云端凭据；发布 job 下载同一次工作流的构建产物。staging 和 production 复用相同的前端静态文件、API bundle 和 Flue bundle，只调整资源名称、绑定、URL 和密钥。每个环境按 agents → api → web 顺序部署实际有改动的包。

staging / PR 验证登录注册、D1 会话目录、会话归属、私有 RPC 及 Durable Object 历史接口；会创建带 `smoke-` 前缀的测试账号，不调用模型。production 仅验证页面、API 健康和未登录访问保护。staging 验证失败会阻止 production 发布。模型调用测试单独按需执行，避免每次 CI 消耗额度。

### GitHub 与 Cloudflare 配置

[GitHub Actions Secrets](https://github.com/seahiLin/test1/settings/secrets/actions)：

| Secret | 用途 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | 当前账号的 Workers Scripts Write、D1 Write、Account Settings Read |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账号 ID |
| `BETTER_AUTH_SECRET` | 至少 32 字符的随机认证密钥 |
| `OPENROUTER_API_KEY` | Agents 调用 OpenRouter 的密钥 |

工作流引用 `preview`、`staging`、`production` 三个 GitHub Environments。staging / production 限制来自 main；preview 接受 PR 的执行引用及 main 上的清理工作流。只允许可信仓库协作者提交使用部署密钥的 PR；Fork PR 不部署。

Cloudflare 账号需启用 `workers.dev`。生产资源保持 `weave-web`、`weave-api`、`weave-agents`、`weave-auth`；staging 资源加 `-staging`；PR 资源加 `-pr-123`。各环境隔离 D1、Durable Objects 和认证签名，OpenRouter key 共用。

只有 web 开启公开 `workers.dev`，它托管 SPA，将 `/api` 和 `/api/*` 原样转发给私有 api，再调用私有 agents。最终 URL 显示在工作流 Summary 和 GitHub Environments 中。

D1 按环境名查询并复用，不存在时自动创建，再执行迁移。迁移先于 API 发布执行，应保持向后兼容；迁移和 Worker 发布不属于同一个事务。PR 关闭后数据随预览一起删除，重新打开会重新初始化。删除一个仍未关闭 PR 的源分支不是清理触发器，应关闭 PR；保留未关闭预览没有额外的定时 TTL。

清理工作流使用 `pull_request_target: closed`，只检出可信 main，从事件中读取数字 PR 编号，绝不检出或执行 PR 代码。部署与清理使用同一 PR 并发锁。

```sh
node --test scripts/ci/*.test.mjs
```

本地开发配置保持不变，临时 CI 配置和密钥均不提交 Git。参考：[GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow)、[Cloudflare Static Assets](https://developers.cloudflare.com/workers/static-assets/)、[Service Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)。

Flue 相关文件：`apps/agents/src/agents/assistant.ts` 定义模型与提示词，`vite.config.ts` 配置生成过程，`wrangler.jsonc` 保存 `FlueAssistantAgent` 的 SQLite 迁移。不要直接编辑生成目录。修改模型时也应核对 assistant.ts 的模型能力配置（当前使用 DeepSeek 免费版的 1048576 上下文及零价格元数据，应用单次输出上限设为 16384 token；零价格不保证模型端点仍可用）。

Flue 生成的 Durable Object 类名由 Agent 函数名决定。已有数据后不要直接重命名 `Assistant`；需要配套的 Durable Object 迁移。

配置 GitHub Secrets 后，main 推送和非 Draft PR 将按上述规则创建资源并发布。邮箱密码登录已启用；邮件验证、密码找回邮件和业务级模型配额尚未配置。

参考：[Flue Cloudflare](https://flueframework.com/docs/ecosystem/deploy/cloudflare/)、[Flue React](https://flueframework.com/docs/guide/react/)、[TanStack Router](https://tanstack.com/router/latest/docs/installation/with-vite)、[shadcn/ui](https://ui.shadcn.com/docs/installation/manual)、[Better Auth / Hono](https://better-auth.com/docs/integrations/hono)、[Cloudflare RPC](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/rpc/)、[DeepSeek V4 Flash 0731 (free)](https://openrouter.ai/deepseek/deepseek-v4-flash-0731:free)。
