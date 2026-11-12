# dev.14 动态黑洞视觉原型

2026-10-17，用户要求实现动态版本查看效果。本批不修改物理、关卡配置、评分或存档。

## 实现与预览

`scripts/generate-black-hole-lut.py`独立积分光路，输出2048×1024 RG16逆半径查找表（450359字节PNG，解码约8MiB）。查找表存储轨道数据，没有盘面成品颜色。`src/black-hole.frag`每帧按观察倾角取三阶盘面交点，以同一半径/方位/时间生成差速旋转的亮斑、云团与细丝，因此上下弯曲像随同一盘面变化。四个邻近采样提供有限实时辉光；局部程序星场的偏折为艺术化径向近似，没有对现有整个游戏场景做光线追踪，不是三维体积气体或Kerr自旋模拟。

Phaser SinglePipeline已接入终局，游戏固定10度倾角，时钟沿用暂停/低特效冻结与重试重置。Canvas或片元高精度不支持时回退dev.13静态图。查找表使用原级线性采样，禁止mipmap平均破坏数据。动态着色器在低特效下时间冻结，但仍有片元绘制成本；手机GPU尚未测量。

独立预览`artifacts/black-hole-preview.html`嵌入同一fragment和查找表，无联网请求，可直接双击打开。提供暂停/恢复、速度、3–35度倾角、600/960/1440宽度和局部星场切换，支持减少动态偏好、后台时间冻结及WebGL上下文恢复。运行`python scripts/build-black-hole-preview.py`可重新生成。该页面用于画质review，不写游戏成绩，也未作为游戏生产入口打包。

## 验证

`scripts/verify-black-hole-render.py`在本机AMD Radeon 860M离屏OpenGL实际编译同一fragment（仅适配GLSL版本语法），验证时间0/2秒画面差异、同时间重复画面完全一致、10/30度倾角改变几何、中心暗影及盘面亮度。证据`evidence/v14-render-validation.json`及t0/t2/angle30 PNG，72帧6秒GIF `evidence/v14-dynamic-black-hole.gif`。这是实际GPU渲染采样，不是Phaser浏览器截图，也不能代替WebGL/TapTap/手机验收。ModernGL 5.13.0与glcontext 3.1.0只安装在忽略目录artifacts/visual-tools，不属于游戏依赖。

最终`npm run verify:v09`通过：186测试、类型检查、30当前主回放/退役终关、三星/旧每日、普通与H5构建和资源审计。日志`artifacts/v09-validation/2026-10-17T07-58-01.023Z`。既有物理规则与旧回放不变，没有重新录制。

本地候选`artifacts/taptap-selftest/gravity-0.9.0-dev.14.zip`，9资源/1527471字节，SHA256 `6dc2325b381ee29189f4a132c04e100535aef252a80930ac32c180011379978f`，ZIP逐项读回通过。平台仍dev.13，未上传或发布。

本轮浏览器工具再次返回空连接；本地预览已发起系统打开请求，不能据此声称浏览器显示成功。下一步用户review实际动态效果，补Phaser浏览器及手机GPU验收，再按反馈调整画质/性能。初稿亮部偏白、细纹过于整齐，经离屏图片审阅降低曝光并增加云团调制；未改变游戏手感。
