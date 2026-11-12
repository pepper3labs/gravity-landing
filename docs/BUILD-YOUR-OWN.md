# 从零搭建自己的版本

这份指南面向想基于本仓库二次开发的人：如何跑起来、怎么改、怎么验证，以及如何接回自己的广告与排行榜。本仓库是**平台无关版本**：默认无联网、无后端，广告为本地模拟，在线榜关闭。

## 1. 环境准备

- **Node.js ≥ 20.19**（Vite 7 的最低要求；推荐 22 LTS 或更新版本）
- **npm**（随 Node 附带）与 **Git**
- Windows / macOS / Linux 均可；Windows 建议用 Git Bash 或 PowerShell

```sh
git clone https://github.com/pepper3labs/gravity-landing.git
cd gravity-landing
npm install
```

## 2. 跑起来

```sh
npm run dev            # 开发服务器，监听 0.0.0.0:5173
npm run preview:local  # 固定 127.0.0.1:10453，适合手机同网调试
```

- 手机同 Wi-Fi 访问 `http://<你的电脑 WLAN IP>:5173/`；连不上时检查防火墙是否允许 Node 入站、是否处于同一网段、是否用了虚拟网卡（Meta/ZeroTier 等）。
- 开发模式支持调试参数（生产构建会移除这些入口）：
  - `?level=<关卡id>`：直接进入某关，不保存成绩与解锁
  - `?level=emergency&qa=single-leg`：单腿迫降场景
  - `qa` 可选 `perfect / damaged / recovered / single-leg / crash`
  - `?qa=ad&ad=failed`：广告失败态复现

进度、金币与成绩都保存在浏览器 `localStorage`，按"浏览器 + 网址"隔离：`localhost` 与局域网 IP 不共享存档。

## 3. 常用命令

| 命令 | 作用 | 备注 |
|---|---|---|
| `npm run typecheck` | 类型检查 | 与构建同一套 `tsc --noEmit` |
| `npm test` | 全部单元/回放测试 | 当前 244 项 |
| `npm run verify:levels` | 用输入驱动飞完全部 30 关，输出路线结果 | **会重写** `docs/v07-route-results.json`，见第 9 节 |
| `npm run verify:replays` | 读取 `docs/replays/*.json.gz` 重放并比对终态 | 不重新生成航线 |
| `npm run record:replays` | 有意重录全部回放档案 | 改动规则/关卡后才用 |
| `npm run append:replays` | 只追加新关回放 | 扩关时用 |
| `npm run verify:daily -- <文件>` | 离线复核每日回放导出 | 不联网 |
| `npm run fingerprints` | 生成每日航线指纹 | — |
| `npm run build` | 生产构建到 `dist/` | 含类型检查 |
| `npm run audit:build` | 审计构建产物并写 `build-manifest.json` | 需先构建 |
| `npm run package:local` | 构建 + 审计，一次完成 | 不会上传任何东西 |
| `npm run build:candidate` | 构建到 `dist-candidate` 并审计 | 用于候选包复核 |
| `npm run verify:v09` | 完整验收链（类型、测试、回放、双构建、审计） | **要求仓库已有至少 1 个提交**（审计会读 `git rev-parse HEAD`） |

## 4. 代码地图

| 路径 | 职责 |
|---|---|
| `src/physics.ts` | 120 Hz 固定步进物理、推力/旋转、接触与着陆判定、损伤 |
| `src/levels.ts` / `level-types.ts` | 30 关配置（世界、目标、教学、三星规则、解锁关系、验证航线） |
| `src/economy*.ts` | 金币经济、关卡解锁花费、星级差额奖励、远征资源继承 |
| `src/scoring.ts` / `progress.ts` | 三星评分、版本化本地存档、正常/辅助成绩隔离 |
| `src/replay.ts` / `scripts/replays.ts` | 输入驱动回放、永久档案录制/校验 |
| `src/daily*.ts` | 每日挑战航线、回放归档、UTC/北京日切 |
| `src/expedition-*.ts` / `expedition-view.ts` | 连续远征结算、提交与界面 |
| `src/leaderboard-reader.ts` / `leaderboard-view.ts` | 在线榜读取与展示（依赖注入宿主） |
| `src/online-provider.ts` | 在线榜抽象 + 默认 no-op 实现（**接平台时改这里**） |
| `src/platform-services.ts` | `RewardedPort`/`CallbackRewardedAd` 广告抽象 + 本地模拟广告（**接平台时改这里**） |
| `src/main.ts` | 组装：菜单、HUD、结算、设置、同意弹窗 |
| `src/visuals.ts` / `art.ts` / `camera.ts` | 程序化美术与画面 |
| `src/input.ts` / `tilt.ts` | 键盘/触屏/倾斜输入与安全校验 |
| `src/settings.ts` / `local-data.ts` | 设置持久化、本地数据导出与清除 |
| `src/diagnostics.ts` / `performance.ts` | 试玩诊断、帧间隔摘要（只在内存，可导出） |
| `public/` | 数据说明页、图标、第三方软件声明 |
| `docs/` | 开发日志、决策、测试矩阵、证据与历史交付文档 |

## 5. 加一关（最常见需求）

1. 在 `src/levels.ts` 的 `LEVELS` 数组里追加一个 `CampaignLevel`：
   - 必填字段参考同章节现有条目：`id`（稳定唯一，进存档与回放）、`order`、`title`、`planets`、`platforms`、`initialFuel`、`contact`/`landing`、`scoring`、`tutorial`、`unlockNext`；
   - 有障碍物时按现有示例添加 `obstacles`/`asteroidBelts`，不要手写不确定的解析式轨迹；
   - 给 `verificationRoute` 提供一条只靠推进/旋转就能飞完的验证航线。
2. 在 `src/economy-config.ts` 的 `ECONOMY` 中加入该关的解锁价格与远征参数。
3. 运行 `npm run verify:levels` 确认能通关，再 `npm run append:replays` 固化该关回放。
4. 跑 `npm test`；如果动了既有参数，必须同时更新对应基线（见第 9 节），否则测试会按设计失败。

## 6. 调手感

- 物理常量集中在 `src/physics.ts` 的 `CONFIG`（重力、推力、转动、接触阈值等），每关可再覆盖。
- 改完必须做两件事：跑 `npm run verify:replays` 逐帧对齐旧档案；对受影响的关卡用 `record:replays` 明确重录并写清原因。
- 手感类改动建议保留"旧参数 → 新参数"的对比记录，`docs/DECISIONS.md` 就是用来放这类决策的。

## 7. 接回自己的广告（激励视频）

抽象层已经就位：`RewardedPort` 只要求"打开一次激励广告，并以 `completed/cancelled/failed` 回传一次结果"。

```ts
// 示意：按你所用 SDK 的真实回调接入，不要伪造 completed
import type {RewardedPort} from './platform-services';

export const myAdPort:RewardedPort = {
  open(placement, signal, lifetime) {
    if (lifetime.aborted) return;
    const ad = mySdk.createRewardedVideoAd({adUnitId: 'YOUR_AD_UNIT_ID'});
    const done = (result: 'completed' | 'cancelled' | 'failed') => {
      cleanup();
      signal(result); // 只回传一次；CallbackRewardedAd 自带去重与超时
    };
    const cleanup = () => { try { ad.destroy(); } catch {} };
    lifetime.addEventListener('abort', cleanup, {once: true});
    ad.onClose((r) => done(r?.isEnded ? 'completed' : 'cancelled'));
    ad.onError(() => done('failed'));
    ad.show().catch(() => done('failed'));
  },
};
```

然后在 `src/platform-services.ts` 里把 `platformServices` 从"只返回本地模拟"扩展为返回 `new CallbackRewardedAd(myAdPort)`（保留 `MockRewardedAd` 作为本地 QA 模式）。注意：

- `placement` 只是用途标记（`rescue` / `double-coins` / `expedition-refit`），奖励发放由 `src/rewarded-action.ts` 统一控制，不要在端口里直接发奖；
- 请求超时、取消、迟到回调都已在 `CallbackRewardedAd` 处理，你只需保证 SDK 监听器在结束时释放；
- 平台侧的广告资质与协议需要你自己申请，本项目不含任何真实广告位配置。

## 8. 接回自己的排行榜

`src/online-provider.ts` 是唯一入口：

```ts
// 1) 实现宿主：把平台 SDK 的四类调用映射到 OnlineLeaderboardHost
export function onlineLeaderboardHost(): OnlineLeaderboardHost | undefined {
  if (!globalThis.mySdk) return undefined; // 非平台环境：保持 no-op
  return {
    submitScores: (o) => mySdk.submitScores(o.scores, o.callback),
    openLeaderboard: (o) => mySdk.openLeaderboard(o.leaderboardId, o.collection, o.callback),
    loadLeaderboardScores: (o) => mySdk.loadScores(o.leaderboardId, o.maxSize, o.callback),
    loadCurrentPlayerLeaderboardScore: (o) => mySdk.loadMine(o.leaderboardId, o.callback),
  };
}

// 2) 填入你自己的榜单编号（不要提交任何真实编号到公开仓库）
export const ONLINE_BOARDS: OnlineBoards = { daily: 'YOUR_DAILY_ID', pure: 'YOUR_PURE_ID', overall: 'YOUR_OVERALL_ID' };

// 3) 每日榜还需要一个 DailyOnlineBoard（提交、打开、接受当日航线）
export const myDailyBoard = (): DailyOnlineBoard => ({ /* available / accepts / submit / open */ });
```

接线要点：

- `LeaderboardReader` 与 `ExpeditionBoards` 默认就会用 `onlineLeaderboardHost()`；返回 `undefined` 时界面按"仅本机成绩"降级，这是刻意设计的失败关闭。
- 参与授权弹窗（`src/ranking-consent.ts`）默认是"未选择"，不要改成默认开启；只提交分数，不上传回放。
- 每日榜有跨日保护（零点前 30 秒暂停、跨日回执不冒充当日成功），改实现时别绕过。

## 9. 构建、部署与两个已知坑

```sh
npm run build          # dist/
npm run audit:build    # 生成 dist/build-manifest.json（文件哈希、大小、源码指纹）
```

- 产物是纯静态站点，可直接放到 GitHub Pages / Netlify / 任意静态托管。部署到子路径时加 `--base ./`（`npm run build:candidate` 就是这么干的）。
- Phaser 单独分包约 1.2 MB（gzip ~330 KB），Vite 会提示 chunk 过大，属正常现象。
- **坑 1：`verify:v09` 需要 git 提交**。审计脚本读 `git rev-parse HEAD`，空仓库直接跑会报 `ambiguous argument 'HEAD'`。先 `git commit` 一次即可。
- **坑 2：`verify:levels` 会重写 `docs/v07-route-results.json`**。该文件是 v0.7 的 20 关历史基线，`tests/v10-content.test.ts` 会断言它保持 20 条；在 30 关版本上跑完 `verify:levels` 后，用 `git checkout -- docs/v07-route-results.json` 恢复，再跑 `npm test` 才是全绿。这个行为是历史遗留，不是 bug。

## 10. 数据、隐私与合规

- 无后端、无账号体系；进度/金币/成绩/设置都在 `localStorage`。设置里有"管理本地数据"：可导出完整存档、输入"清除"二次确认后删除。
- 试玩诊断与性能摘要只保存在内存，需手动导出；默认不上传。
- 接平台 SDK 时请自行补齐隐私政策与未成年人保护要求，`public/about-data.html` 是数据说明页的模板，需要按你的实际接入改写。

## 11. 许可证

本项目以 MIT 许可证发布，详见 [LICENSE](../LICENSE)。第三方依赖（Phaser、eventemitter3、matter-js）均为 MIT，声明见 [third-party-notices.txt](../public/third-party-notices.txt)。二次分发时请保留许可证与声明文件；"引力盲航 / Gravity Landing"的名称与美术属于原项目，若要商用改名或替换美术请自行确认权利。
