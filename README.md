# AI 战术板 · Step 1（MVP/PWA）

本包包含最小可用版本：半场/全场画布、攻防棋子拖拽、跑位虚线/传球箭头、撤销/重做、导出 PNG（带水印），以及首发战术/训练数据文件夹。可直接本地打开或部署到任意静态托管。

## 快速开始
1. 本地打开 `index.html`（推荐用 VSCode 的 Live Server / 任意 http server）。
2. 手机/iPad 访问后 “添加到主屏幕”，即可离线使用（视频播放需联网）。
3. 工具栏选择 **拖拽/跑位线/传球箭头**，绘制后可 **撤销/重做**；右下角 **导出 PNG**。

## 目录结构
```
/app (合并到根，见本包文件)
/plays/plays.json    # 12 张首发战术（可扩充）
/drills/drills.json  # 训练元数据（占位 videoId）
/assets/icon-*.png   # PWA 图标
index.html
main.js
manifest.json
service-worker.js
README.md
```

## 主题与样式
- 主题色在 `index.html` 中的 `:root` 变量配置，当前为 **橙色 + 白色**（可后续统一设计）。

## 已实现
- 半场/全场切换、棋子拖拽
- 跑位虚线、传球箭头（带箭头头部）
- 撤销/重做（针对线条对象）
- PNG 导出（右下角水印时间戳）
- PWA：离线缓存静态资源

## 待办（下一步）
- 战术库页面（载入 `plays/plays.json` 并应用到画布）
- 训练页（载入 `drills/drills.json`，嵌入播放器）
- 轻 AI 推荐（本地规则映射）与提示条
- 橡皮擦、对象选择与删除
- 触控缩放与平移（双指）

—— 2025-09-11
