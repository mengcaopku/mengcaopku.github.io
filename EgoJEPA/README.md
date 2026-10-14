# EgoJEPA 项目主页

纯静态页面，不需要构建。版式参考 π0.5 博客（https://www.pi.website/blog/pi05）：暖色纸底、衬线大标题、等宽字体注释、横向视频轮播、可交互图表。

## 内容来源

页面是展示型：每个部分只有标题、一句话和图（视频、论文图或交互图表），细节留给论文。文字和数字全部来自论文 `Ego_JEPA/EgoJEPA.pdf`：

| 页面部分 | 论文出处 |
|---|---|
| 标题、一句话简介、顶部数字 | 标题页、Abstract |
| 方法图 `assets/img/method-overview.jpg` 和三阶段卡片 | Figure 2、Section 3 |
| 人类数据统计和示例图 `assets/img/human-data-*.jpg` | Table A1、Figure A3 |
| 成功率图表（悬停可看每个方法是什么） | Figure 3、Section 4.1 |
| 机器人数据效率 | Figure 5 右（按网格读点：每点 20 次试验，数值都是 5% 的整数倍） |
| 抗噪实验 | Figure 6 |
| 训练耗时 | Figure 1、Figure 7 |

图表颜色沿用论文：紫色 = EgoJEPA，橙色 = 重定向基线；训练耗时图按阶段类型上色，与论文 Figure 7 一致。每张图表下面都有“Show data table”，可以看到全部原始数字。

## 顶部链接

标题下的 arXiv 和 GitHub 按钮现在指向 `#`。在 `index.html` 里搜 `data-link="arxiv"` 和 `data-link="github"`，把各自的 `href="#"` 换成真实地址。有了 arXiv 之后，BibTeX 也建议换成 arXiv 给出的条目。

## 目录

```
index.html                 页面
assets/css/style.css       样式
assets/js/main.js          视频只在可见时播放、开场合辑进度条、轮播、倍速、视频和论文图放大查看
assets/js/charts.js        四组交互图表（无第三方依赖）
assets/videos/             网页用视频
assets/posters/            视频封面
assets/img/                论文图、网站图标、社交分享图 og-image.jpg
.nojekyll                  让 GitHub Pages 原样发布
```

## 视频

全部来自 `Ego_JEPA/in_paper.zip`，重新编码为 H.264 High、30 fps 恒定帧率、CRF 26、去掉音轨、faststart（边下边播）。

| 网页文件 | 原文件 | 时长 | 说明 |
|---|---|---|---|
| `toy-grasping-sharpa.mp4` | `pick_doll_sharpa.mp4` | 0:10 | Toy grasping，Sharpa hand |
| `cup-stacking-wuji.mp4` | `cup.mp4` | 0:46 | Cup stacking，Wuji hand |
| `zipper-pulling-wuji.mp4` | `zip.mp4` | 0:46 | Zipper pulling，Wuji hand |
| `bottle-cap-unscrewing-wuji.mp4` | `scew.mp4` | 0:33 | Bottle cap unscrewing，Wuji hand |
| `box-folding-gripper.mp4` | `cardboxFolding.mp4` | 4:07 | Cardboard box folding，Xense Tac UMI gripper（页面默认 4 倍速） |
| `toy-grasping-wuji.mp4` | `pick_doll-wuji.mp4` | 0:24 | 额外视频：论文评测里 toy grasping 用的是 Sharpa hand |
| `hero-reel.mp4` | 上面前 5 段的剪辑 | 0:33 | 开场合辑 |

开场合辑：5 段各约 7 秒，段间 0.5 秒交叉淡化。截取位置：`cup` 33–40 秒，`zip` 14–21 秒，`scew` 20–27 秒，`pick_doll_sharpa` 2.3–9.3 秒（裁成 16:9），`cardboxFolding` 168–210 秒（6 倍速，裁成 16:9）。换片段时要同步改 `index.html` 里 `.hero-seg` 的 `data-start` / `data-end`。

## 本地预览

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000
```

Python 自带的服务器不支持分段请求，视频拖动进度条可能不灵；发布到 GitHub Pages 后没有这个问题。

## 发布到 GitHub Pages

```bash
gh auth login
git init -b main && git add . && git commit -m "EgoJEPA project page"
gh repo create <仓库名> --public --source . --push
gh api -X POST repos/<用户名>/<仓库名>/pages -f "source[branch]=main" -f "source[path]=/"
# 网址：https://<用户名>.github.io/<仓库名>/
```

发布后把 `index.html` 里 `og:image` 改成完整网址，社交平台的分享卡片才会显示图片。论文目前在双盲审稿期：页面上没有作者信息，发布时也不要用能识别身份的账号。

视频和图片合计约 36 MB，单个文件最大 8.8 MB，在 GitHub 的文件大小限制内。
