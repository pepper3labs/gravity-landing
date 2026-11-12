# dev.18 广告自测与官方榜适配

2026-10-20。用户明确授权绑定dev.17草稿主包并创建联调用榜，不包含公开发布。

## 已执行及服务端证据

- CLI select-package以expected.kind=none将main绑定H5版本<pkg-34>，返回updated/revision=<revision-id>。后续上传响应也读回main为<pkg-34>。
- 官方MCP强制刷新后get_app_status确认app_status=0/review_status=0；check_ads_status确认广告已生效、screen_orientation=1、广告位<ad-unit-id>；get_ad_integration_guide再次返回同一广告位。
- src/taptap-ad-config.ts启用该公开广告位；仍仅在H5且宿主API存在时可用，保留严格完整观看奖励与异常处理。没有新增插屏、Banner或强制观看。
- 更新自测数据说明，明确主动广告联网、奖励条件与回放不上传；此说明不是正式平台隐私政策。

## 榜单限制与未执行动作

在执行create_leaderboard前检查官方MCP 1.24.14实现，发现它在创建后立即调用/open/leaderboard/v1/set-whitelist-only，参数whitelist_only=false，自动公开所有用户可见。工具描述未体现该副作用；本轮没有调用，未创建或发布榜单。

官方文档支持后台设置“仅白名单可见”并添加测试TapTap ID：https://developer.taptap.cn/minigameapidoc/dev/tutorial/open-capabilities/leaderboard-tutorial/ 。尝试通过内置浏览器打开后台，41秒超时，没有可靠页面状态或任何写入。

需要负责人在后台创建仅白名单联调榜（名称“每日盲航·指定日期联调”、数值降序、保留最佳、永久周期），添加测试账号并告知完成及测试日期。随后从官方工具读取客户端ID并绑定该日期，避免未验证的日切时区让不同航线混排。不要公开发布。正式每日榜周期时区、同分规则仍待对齐，联调榜不是最终每日榜。

## 本地客户端适配

TapDailyLeaderboard使用官方submitScores及openLeaderboard回调API，15秒超时、并发隔离、迟到回调忽略、同步错误处理；提交前重放核验并校验当前日期/规则，仅发送榜ID和整数分数，要求返回匹配榜ID及合理rawScore的回执。固定日期测试配置当前undefined，不显示联网按钮、不提交数据。配置后玩家主动同意才提交，打开public总榜（此参数不是将榜单公开的后台设置），不申请好友关系。

本机仍按分数/用时/余油排序；联调平台榜只传分数，不宣称与本机细排一致。本地复核不是服务端防作弊。

## 验证与包体

207/207测试、类型检查、完整主回放/mastery/旧每日、普通和H5构建审计通过，artifacts/v09-validation/2026-10-20T07-45-14.409Z。新增适配测试覆盖有效回执/空回执/错误榜ID、篡改分数、日期/旧规则拒绝、无宿主、超时并发、旧回调、失败及重试。

dev.18 ZIP 9资源，1,531,937字节，SHA256 289ea9c36317a1dc16c3713439e6648cd7a8c971530288b85395d9a929918056，sourceFingerprint 5fed5a9a319e9d149c9112b9b2829b57bcb411097cb1587aec1a081da931d0e0。平台预检无告警，上传任务<task-id>-d98b-4b3f-9349-c1dd73115654，版本<pkg-35>、包体<pkg-12>；列表读回竖屏/is_releasing=false。二维码artifacts/taptap-selftest/qr-dev18.png。主包仍为用户明确批准的dev.17，不将上传成功当作dev.18已绑定或已真人验收。

手机请测试战役救援和结算双倍金币：完整观看只发一次、提前关闭不发、失败仍可免费重试、返回后声音/触控正常；不要把测试期间广告点击当成奖励条件。真实广告是否有填充及宿主播放结果待真人提供。本轮没有游戏提审、正式发布或协议签署。
