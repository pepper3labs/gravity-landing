# 引力盲航 / Gravity Landing 1.0.0-rc.3

TypeScript + Phaser 3 的物理飞行解谜游戏：120 Hz 固定时间步、双起落架损伤模型、30 关五章战役、金币经济、每日挑战与连续远征。程序化美术与合成音效，无外部素材链接；无后端，全部存档保存在浏览器本地。

**当前为 1.0 候选版（rc.3）**：30 关 / 90 星、244 项测试、30 关永久回放全部重放通过、两套构建审计通过。真人手机验收仍以 [发布候选检查清单](docs/RELEASE_CHECKLIST.md) 为边界，不代表已公开发行。

## 关于本项目

本项目是**纯 vibe coding 产物**：物理引擎、30 关关卡配置、经济与远征系统、测试与永久回放档案、程序化美术管线、界面以及全部文档，均由 AI 编程助手在对话中实现与迭代；人类负责玩法方向、验收标准、平台策略与实机试玩决策。仓库中之所以堆满确定性回放、基线冻结与三重验证（类型检查、244 项测试、双构建审计），正是为了给 AI 的产出设定质量下限——每一批改动都必须证明旧关卡没有被改坏。

完整的构建过程见 [开发日志](docs/DEVLOG.md)。

## 在线服务状态

本仓库为平台无关版本：激励广告为本地模拟，在线排行榜默认关闭（no-op 适配器），所有成绩仅保存在本机。接入平台时，需实现 `src/platform-services.ts` 的 `RewardedPort` 与 `src/online-provider.ts` 的 `OnlineLeaderboardHost`，并在 `ONLINE_BOARDS` 中配置榜单编号；未配置前界面按「仅本机成绩」降级，不会上传任何数据。具体接法见 [从零搭建自己的版本](docs/BUILD-YOUR-OWN.md) 第 7、8 节。

## 文档导航

- [开发日志](docs/DEVLOG.md)：从 v0.4 原型到 1.0 候选的完整开发轨迹、每阶段验收证据与工程方法
- [从零搭建自己的版本](docs/BUILD-YOUR-OWN.md)：环境准备、命令表、加关、调手感、接回广告与排行榜、部署与已知坑
- [远征计划](docs/expedition/PLAN.md) / [资源参数](docs/expedition/BALANCE.md) / [平台能力与手机验收](docs/expedition/PLATFORM.md)
- [决策记录](docs/DECISIONS.md) / [测试矩阵](docs/TEST_MATRIX.md) / [逐次进度](docs/PROGRESS.md) / [证据目录](docs/evidence/)

## 快速开始

需要 Node.js ≥ 20.19（Vite 7 要求）。

```sh
npm install
npm run dev            # 开发服务器 0.0.0.0:5173
npm run preview:local  # 固定 127.0.0.1:10453，适合手机同 Wi-Fi 调试
npm run typecheck && npm test
npm run verify:replays # 读取 docs/replays 逐帧复现 30 关终态
npm run build          # 生产构建到 dist/
```

完整命令表、加关流程与平台接入示例见 [从零搭建自己的版本](docs/BUILD-YOUR-OWN.md)。手机同网访问 `http://<电脑 WLAN IP>:5173/`，进度按浏览器与网址隔离。

## 操作与循环

1. 主菜单进入关卡选择，首关默认解锁；后续关卡用金币购买，或在上一个关卡拿到两星免费解锁。
2. 首次进入可阅读或跳过教学；重试不再弹出教学。
3. **W / ↑ / 空格**：推进；**A D / ← →**：旋转；**P / Esc**：暂停；**R**：立即重试；**M**：静音。
4. 手机左手旋转、右手推进，支持双指同时操作；可在设置中开启倾斜控制。切出窗口自动暂停。
5. 停泊时不动、不耗油；主动点火起飞。琥珀色线表示惯性方向，推进方向由机头决定。
6. 接近目标后看平台法向速度、切向速度、姿态与各自阈值；轻触后松开推进，等待稳定确认。
7. 通关至少一星；"先练着陆"从目标上空开始，不计金币、成绩或解锁。
8. 每日挑战按北京时间 00:00 换航线；连续远征可跨 30 关继承燃料、支架与损伤。

## 损伤与奖励

左右支架分别计算接触冲击，角速度参与接触点速度计算；支架断裂后删除其碰撞接触点。主体始终独立判定，以较低冲击阈值承受碰撞。断一条腿仍能通过推力和旋转抢救；单腿迫降必须有真实主体接触并达到更严格的速度/稳定时间要求。所有关卡在成功或失败后显示全程航迹。

本仓库的激励广告为 1.8 秒本地模拟：失败后可回到安全检查点，修复支架并减速（无检查点则回发射台）；救援不重置累计用时，成绩保存为辅助记录。通关可领取一次额外等额金币。不包含真实广告 SDK、联网排行榜或后端。

## 工程与验证

- **确定性物理**：`src/physics.ts` 120 Hz 固定步进；关卡只描述世界（`src/levels.ts` / `level-types.ts`），不写物理。
- **永久回放档案**：`docs/replays/*.json.gz` 固化每关路线，`npm run verify:replays` 复现终态与评分；改规则必须显式重录（`record:replays` / `append:replays`）。
- **基线冻结**：旧版本结果文件（`docs/v05/v06/v07-route-results.json`）保留为对照，测试断言旧成绩不变。
- **证据留档**：测试与构建输出在 `docs/evidence/`，决策在 [DECISIONS](docs/DECISIONS.md)，覆盖矩阵在 [TEST_MATRIX](docs/TEST_MATRIX.md)。
- **调试参数**（生产构建移除）：`?level=<关卡id>` 直接进关不存档；`qa=perfect/damaged/recovered/single-leg/crash` 设定初始场景；`?qa=ad&ad=failed|cancelled|completed` 复现广告异常；`?level=<id>&qa=route` 快速回放整条航迹。

完整的代码地图（32 个模块职责）见 [从零搭建自己的版本](docs/BUILD-YOUR-OWN.md#4-代码地图)。

## 版本记录

| 版本 | 里程碑 | 详细记录 |
|---|---|---|
| v0.4 | 原型：6 关、双起落架、120 Hz 固定步进 | [V04-BASELINE](docs/V04-BASELINE.md) |
| v0.5.1 – v0.5.2 | 训练关与航线重排，8 关 / 24 星，48 测试 | [训练关交付](docs/V052-TRAINING.md) |
| v0.6 | 星际环境：14 关 / 42 星，小行星、双星、低燃料、综合挑战，74 测试 | [交付记录](docs/V06-DELIVERY.md) |
| v0.7 | 重玩目标与成绩分离，扩至 20 关，107 → 111 测试 | [关卡扩充](docs/V07-EXPANSION.md) |
| v0.8 | 本地每日挑战：UTC 日切、回放归档、离线校验 | [每日挑战](docs/V08-DAILY.md) |
| v0.9 | 试玩诊断、性能摘要、设置、广告恢复保护，201 → 207 测试 | [试玩准备](docs/V09-PREPARATION.md) |
| v0.10 | 21–25 关、观测台、最终章 | [最终章](docs/V10-FINAL-CHAPTER.md) |
| v0.14 | 动态黑洞渲染管线（离屏 + 着色器） | [动态黑洞](docs/V14-DYNAMIC-BLACK-HOLE.md) |
| v0.16 | 三星任务系统 | [星级任务](docs/V16-STAR-TASKS.md) |
| v0.17 – v0.18 | 平台广告与在线榜联调（**本仓库已整体移除**，改为 no-op） | [平台自测](docs/V18-PLATFORM-SELFTEST.md) |
| v0.26 – v0.28 | 金币经济、30 关资源继承远征、纯净/综合双榜客户端，255 测试 | [游戏内榜单](docs/V26-IN-GAME-RANKINGS.md) / [发布前修正](docs/V28-PRELAUNCH-FIXES.md) |
| **v1.0.0-rc.1 – rc.3** | 一屏化、手机布局修正、发布候选复核；244 测试、30/30 回放、双构建审计 | [候选清单](docs/RELEASE_CHECKLIST.md) / [rc.1 就绪度](docs/V1-RC1-READINESS.md) |

逐步的逐日进度见 [PROGRESS](docs/PROGRESS.md)；平台发布相关数字与账号标识在公开版本中已脱敏为 `<pkg-XX>` 等占位符。

## 许可证

本项目采用 MIT 许可证发布，详见 [LICENSE](LICENSE)。Copyright (c) 2026 Pepper3Labs。第三方依赖声明见 [third-party-notices.txt](public/third-party-notices.txt)。
