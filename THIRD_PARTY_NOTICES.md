# Third-party notices

The compiled UI includes third-party libraries originally declared by the application:

- Vue 3 (MIT), copyright Evan You: https://github.com/vuejs/core/blob/main/LICENSE
- Chart.js (MIT), copyright Chart.js Contributors: https://github.com/chartjs/Chart.js/blob/master/LICENSE.md
- Lucide icons (ISC), copyright Lucide Contributors; some icons derive from Feather (MIT): https://github.com/lucide-icons/lucide/blob/main/LICENSE

Electron is downloaded through npm during development/build and carries the MIT license and Chromium third-party notices. Preserve the Electron and Chromium license files shipped with packaged builds.

The project license does not replace third-party licenses. Original comments and notices in compiled files are retained. Contact/payment QR images are supplied by the project owner for the support page; replace them when distributing a rebranded fork.

## Dream Westward Journey PC-game item pictures

Two independent, unmodified item pictures were downloaded on 2026-10-27 from the crafting-material section of Sina Games' **Dream Westward Journey official-cooperation section**, not from the mobile-game section:

- Source page: https://games.sina.com.cn/z/xyq/2/mfjn/index.shtml — “技能大全 / 打造原料”. The page explicitly labels the two pictures “制造指南书” and “百炼精铁”.
- Manufacturing guide / 制造指南书: `dist/icons/treasure/zhizao-zhinanshu.jpg`, original URL https://i2.sinaimg.cn/gm/ol/mhxy/new/item002.jpg; SHA256 `a8259d462a4f8e87f15384ad0580cbf55ea45502cb393892ed7d98c34e6b8c4d`.
- Refined iron / 百炼精铁: `dist/icons/treasure/bailian-jingtie.jpg`, original URL https://i1.sinaimg.cn/gm/ol/mhxy/new/item001.jpg; SHA256 `91a0770e1cb15e7dfb74e6d96e2ccdb4642db0c6b649ac1202c99a335682498f`.

Both originals are 120×120 JPEGs. They were visually checked locally and retain their original bytes: no crop, screenshot extraction, redraw, recolor or synthetic replacement was performed. The pictures contain no visible item-level numeral; the same picture is used as the material icon while the application displays the actual level separately.

The game artwork remains the property of the relevant rights holders, including NetEase. The source page does **not** provide an open redistribution license. These images are **not** licensed under this project's MIT license, and this notice does not grant redistribution rights. Obtain any necessary permission before public/commercial redistribution. Other code-authored generic symbols remain explicitly identified as generic in `dist/icons/treasure/manifest.json`.
# 场景召唤兽参考图片补充说明（2026-10-27）

六个常用场景的 55 种召唤兽参考图随本地运行包提供，具体来源、图片 URL、SHA256、原始尺寸及核对说明逐项记录于 `dist/icons/scene-pets/manifest.json`。

- 54 项来自叶子猪梦幻西游召唤兽染色图鉴：<http://xyq.yzz.cn/special/zhstj/> 及其公开资料数据与图片。
- 司辰侍者（未来）来自游侠图鉴第 176 项“普通”配图：<https://gl.ali213.net/html/2025-4/1642673.html>。此项按来源明确的未来标签作为参考图；未取得带未来名称的独立游戏面板截图，不据此声称已独立验证过去/未来的造型差异。
- 所有下载的原始图片字节保留不变。部分来源为完整属性卡或染色展示，界面通过 CSS `object-view-box` 仅展示主体部分；不是重绘、生成或改写游戏原图。
- 游戏角色和原画权利归网易及相应权利人；第三方站点图片及整理内容权利归相应权利人。公开可访问不代表开放许可或再分发授权，以上图片不纳入本项目 MIT 许可。对外发布或商业分发前应另行确认所需授权。

