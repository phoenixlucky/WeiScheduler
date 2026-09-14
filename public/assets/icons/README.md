# WeiScheduler icon library

页面图标统一由 `src/components/UiIcon.vue` 提供。它是一套项目内自绘的非 SVG 图标组件，使用统一的线性比例、圆角与主题色 token；页面不要直接写图标字符或引入第三方 SVG。

需要新增图标时，在 `UiIcon.vue` 增加一个语义化 `name` 与对应绘制规则，并从页面通过 `<UiIcon name="..." />` 引用。位图插画与背景图继续分别放在 `public/assets/illustrations` 与 `public/assets/background`。
