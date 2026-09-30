# devfab

低代码「开发者工厂」的浏览器运行时库。

链路：后端按 `billno` 下发视图元数据 JSON → `builder.render(meta)` 渲染成组件树 → 各 adapter 把第三方控件包成「受模型驱动、状态可被外部 `setState` / `getState` 读写」的受控组件。

## 安装

```bash
npm install devfab
```

外部依赖由宿主提供，不打进产物（见 `peerDependencies`）：

- React 侧：`react` / `react-dom` / `classnames`
- Vue 侧：`vue` >= 3（**仅支持 Vue 3**，适配层使用 `defineComponent` / `reactive` / `h`）

## 开发与构建

源码为纯 JavaScript（`.js` / `.jsx`），不含 TypeScript，也不产出类型声明。

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 清理后以 development 模式构建 |
| `npm run build` | 清理 → 生产构建（含压缩产物） |
| `npm run smoke` | 构建产物冒烟测试（需先 `npm run build`） |
| `npm run lint` / `npm run format` | ESLint / Prettier |

## 产物清单

| 路径 | 格式 | 说明 |
| --- | --- | --- |
| `lib/devfab.js` | UMD | 核心运行时，`<script>` 引入后挂到 `window.devfab` |
| `lib/devfab.min.js` | UMD | 压缩版，仅生产构建产出 |
| `lib/requirejs.js` | — | vendored RequireJS，挂 `window.require` / `window.define` |
| `dist/index.js` `.esm.js` `.umd.js` | CJS / ESM / UMD | 核心包入口，对应 `package.json` 的 `main` / `module` / `umd` |
| `dist/react/**` | CJS（保留模块结构） | React 适配层 |
| `dist/vue/vue3-adapter.js` `.esm.js` | CJS / ESM | Vue 3 适配层，由宿主显式 import 引用，不挂全局 |

> `dist/` 与 `lib/` 是构建产物，已移出版本控制，不要手改；改完源码重新构建。

## 运行时契约

React / Vue 适配层从运行时读取 `builder` 与 `models`。两种初始化方式：

```js
// 方式一：包引入，会自动挂载 window.devfab
import devfab from 'devfab'

// 方式二：页面里按顺序引脚本（require 与 define 由 requirejs.js 单独提供）
// <script src=".../lib/requirejs.js"></script>
// <script src=".../lib/devfab.js"></script>
```

运行时未就绪时使用适配层会抛出明确错误，而不是让调用方拿到 `undefined` 再二次崩溃：

```js
import devfab, { hasRuntime, getRuntime } from 'devfab'

hasRuntime() // false：还没挂载
getRuntime() // 抛错：[devfab] 运行时未初始化：请先加载 devfab 核心...
```

## 模型层

`utils.models` 提供四个模型类，职责从下往上叠加：

| 类 | 职责 |
| --- | --- |
| `BaseModel` | 状态容器：`_data` 读写、`setValue` / `setVisible` / `setDisabled` 推送、事件与缓存 |
| `SimpleModel` | 单字段受控模型，额外提供 `setDisabled` / `setReadonly` |
| `ViewModel` | 页面级容器，`addProperty` 登记子模型，`getData` / `getAllData` 收集数据 |
| `FilterModel` | 筛选条件容器，`getParams` 收集条件后 `search()` 触发查询 |

## React 用法

```jsx
import React from 'react'
import devfab from 'devfab'
import ModelAdapter from 'devfab/dist/react/adapter/model/modelAdapter'

const { builder } = devfab

// 1. 注册控件：把元数据里的 component 名映射到实际组件
builder.initComponent({
    Input: ModelAdapter(Input),
})

// 2. 告诉 builder 如何把节点变成 React 元素（必须由宿主提供）
builder.initRenderFactory(({ node, props }) =>
    React.createElement(node.component || 'div', { key: node.key, ...props, vm }, props.children)
)

// 3. 用后端下发的元数据渲染
const nodes = builder.render(meta)
```

`ModelAdapter(Com)` 包出来的组件在挂载时会把实例交给 `SimpleModel` 托管：

- `model.setValue('x')` / `setVisible(false)` / `setDisabled(true)` 会推给控件；
- 控件的 `setState('value', v)` 会回写模型值；
- 组件以 `name` 登记进 `vm`，父级 `vm.getData()` 才能收集到这个字段；
- 传 `ctrlName` 可做定向通知，只推给指定控件。

## Vue 3 用法

```js
import { defineClassComponent, defineFunctionComponent } from 'devfab/dist/vue/vue3-adapter'
// 只提供 CJS / ESM，模块引用即可；不产出 UMD，也不会挂到 window
```

class 心智模型（`this.$el` / `$refs` / `$nextTick` 在所有钩子与 `render` 中行为一致）：

```js
export default defineClassComponent(
    class Counter {
        state = { n: 0 }

        componentDidMount() {
            console.log(this.$el)
        }

        render(h) {
            return h('div', { onClick: () => this.setState({ n: this.state.n + 1 }) }, String(this.state.n))
        }
    }
)
```

函数组件 + Hooks 心智模型（`h` 由第三个参数注入，Hooks 按索引复用状态）：

```js
import { defineFunctionComponent, useState } from 'devfab/dist/vue/vue3-adapter'

export default defineFunctionComponent((props, ctx, h) => {
    const [n, setN] = useState(0)
    return h('div', { onClick: () => setN(n.value + 1) }, String(n.value))
})
```

可用 Hooks：`useState`、`useRef`、`useMemo`、`useCallback`、`useEffect`、`useLayoutEffect`、`useReducer`、`useContext`、`useProvide`。

## 已知约束

- Vue 适配层仅支持 Vue 3，产物文件名带 `vue3` 即用于标明这条边界；如需兼容 Vue 2，需要另写适配层。
- 工程为纯 JavaScript，不产出类型声明；宿主若需要类型提示，请自行声明或依赖 `JSDoc`。
- `builder` 是模块级单例（`isInit` / `components` / `renderFactory` 均在模块作用域），一个页面只能存在一份运行时，微前端或多实例场景需要额外隔离。
