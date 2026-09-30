# devfab

低代码「开发者工厂」的浏览器运行时库。

链路：后端按 `billno` 下发视图元数据 JSON → `builder.render(meta)` 渲染成组件树 → 各 adapter 把第三方控件包成「受模型驱动、状态可被外部 `setState` / `getState` 读写」的受控组件。

- 源码纯 JavaScript（`.js` / `.jsx`），无 TypeScript、不产出类型声明
- React 与 Vue 3 双适配层，共用一个与框架无关的模型层（`BaseModel` 体系）
- 通过 RequireJS 加载领域扩展脚本，实现「元数据 + 扩展脚本」的二次开发模式

## 目录结构

```
src/
├── index.js                 包入口：组装 builder / models / utils
├── _models/                 模型层（与框架无关）
│   ├── BaseModel.js         状态容器基类：_data 读写、状态推送、事件、缓存、代理
│   ├── SimpleModel.js       单字段受控模型
│   ├── ViewModel.js         页面级容器：子模型登记与数据收集
│   ├── FilterModel.js       筛选条件容器
│   ├── GridModel.js         表格模型（两层数据 / 行状态 / 分页 / 选中 / 校验）
│   └── index.js             模型工厂 createViewModel / initViewModel
├── _utils/
│   ├── builder.js           组件注册表 + 渲染工厂（模块级单例）
│   ├── event.js             事件总线（同步 execute + 异步 promiseExecute）
│   ├── cache.js             键值缓存
│   ├── dynamicProxy.js      把接口配置映射成可调用的方法
│   ├── ajax.js              XHR / JSONP 请求封装
│   └── string.js            URL 拼接、QueryString、uid 生成、base64
├── _lib/requirejs.js        vendored RequireJS 2.3.2 + 扩展脚本适配层
├── react/
│   ├── index.js             React 适配层入口
│   └── adapter/
│       ├── common/          refAdapter / labelAdapter / loadMetaAdapter / dataSourceAdapter / modalAdapter
│       └── model/           modelAdapter / pageAdapter / dataSourceAdapter / filterAdapter
└── vue/
    ├── index.js             Vue 适配层占位（未参与构建）
    └── vue-adapter/         Vue 3 适配层：class-adapter / function-adapter
```

`dist/` 与 `lib/` 是构建产物，已移出版本控制，不要手改；改完源码重新构建。

## 安装

```bash
npm install devfab
```

外部依赖由宿主提供，不打进产物（见 `peerDependencies`）：

- React 侧：`react` >= 16 / `react-dom` >= 16 / `classnames`
- Vue 侧：`vue` >= 3（**仅支持 Vue 3**，适配层使用 `defineComponent` / `reactive` / `h`）
- `antd` 在构建配置里被列为 React 产物的 `external`，但未写进 `peerDependencies`，宿主需自行保证存在

## 开发与构建

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 清理后以 development 模式构建（产物不压缩，便于调试） |
| `npm run build` | 清理 → 生产构建（压缩产物） |
| `npm run smoke` | 产物冒烟测试（零依赖脚本，需先 `npm run build`） |
| `npm run lint` / `npm run lint:fix` | ESLint 检查 / 自动修复 |
| `npm run format` / `npm run format:check` | Prettier 格式化 / 校验 |
| `npm run clean` | 删除 `dist` 与 `lib` |

构建用 Rollup 多入口配置（`rollup.config.js`），每个入口产出 CJS / ESM（部分含 UMD）。几处需要注意的编译边界：

- React 侧 JSX 走 `@babel/preset-react`（编译成 `createElement`）；Vue 侧 JSX 走 `@vue/babel-plugin-jsx`（编译成 `createVNode`）。两套 babel 配置不能混用。
- `resolve.extensions` 显式加入了 `.jsx` —— 适配层文件名是 `.jsx`，但内部 import 不带扩展名。
- `babelHelpers: 'bundled'` 内联 helper，避免 `preserveModules` 产物在 CJS 里 `require` ESM 版 `@babel/runtime` helper。

## 产物清单

| 路径 | 格式 | 说明 |
| --- | --- | --- |
| `lib/devfab.js` | UMD | 核心运行时，`<script>` 引入后挂到 `window.devfab`；始终不压缩，便于排查 |
| `lib/devfab.min.js` | UMD | 压缩版，任何构建模式都产出 |
| `lib/requirejs.js` | — | vendored RequireJS，挂 `window.require` / `window.define` 与 `window.__devfab` |
| `dist/index.js` `.esm.js` `.umd.js` | CJS / ESM / UMD | 核心包入口，对应 `package.json` 的 `main` / `module` / `umd` |
| `dist/react/**` | CJS（`preserveModules`，保留 `src/react` 目录结构） | React 适配层 |
| `dist/vue/vue3-adapter.js` `.esm.js` | CJS / ESM | Vue 3 适配层，由宿主显式 import，不产出 UMD、不挂全局 |
| `dist/common/models.js` `.esm.js` | CJS / ESM | 模型层单独入口，可脱离框架使用 |
| `dist/common/utils.js` `.esm.js` | CJS / ESM | 工具层单独入口 |

## 运行时契约

React 适配层从**全局**读取运行时：`src/react/adapter/**` 里直接使用裸标识符 `devfab.builder`、`devfab.utils.models`，编译后原样保留，运行时解析到 `window.devfab`。因此宿主必须先准备好全局运行时，再加载适配层组件：

```html
<script src="..../lib/requirejs.js"></script>
<script src="..../lib/devfab.js"></script>
```

## 模型层

### `BaseModel` —— 状态容器基类

所有模型共享的底座，数据统一放在 `_data` 里（`_set_data` / `_get_data` / `_del_data` / `_cls_data`）。

| 分组 | 方法 |
| --- | --- |
| 取值 | `getValue` / `getData` / `get(name)` / `getState(name, ctrlName)` |
| 赋值 | `setValue(value, fireEvent, ctrlName)` / `setState(name, value, ctrlName)` / `setVisible` / `setDisabled` |
| 控件登记 | `addComponent(component, ctrlName)` / `removeComponent` / `doPropertyChange` |
| 父子关系 | `setParent` / `getParent` / `getRootParent` / `setName` / `getName` |
| 脏检查 | `setDirty` / `getDirtyData(necessary)` / `clear(useDefault)` |
| 事件 | `on` / `onFirst` / `un` / `hasEvent` / `execute` / `fireEvent` / `promiseExecute` |
| 缓存 | `setCache` / `getCache` / `clearCache` |
| 请求代理 | `setProxy(config)` / `getProxy()` |

状态推送的核心是 `_applyState(name, value, ctrlName)`：优先调用控件的 `setXxx`（如 `setValue`），控件没实现就退回 `setState({ [name]: value })`。传 `ctrlName` 可定向通知，只推给匹配的控件。

`setValue` 支持事件拦截：传 `fireEvent`（或模型上标记 `forceFireEvent`）时走 `promiseExecute('beforeValueChange', ...)`，先跑 `beforeValueChange` 监听，通过后才写入并触发 `afterValueChange`，任一步返回 `false` 则回滚成旧值。

### 四个具体模型

| 类 | 职责 |
| --- | --- |
| `SimpleModel` | 单字段受控模型，补充 `setReadonly` / `getReadonly` |
| `ViewModel` | 页面级容器：`addProperty` 登记子模型，`getData` / `getAllData(withOutGrid)` 收集数据，`getGridModel` / `getGridModels` 定位子表格，`loadData` 批量灌数据 |
| `FilterModel` | 筛选条件容器：`mounted` 按 `conditions` 初始化条件模型，`getParams` 收集条件，`search()` 触发查询事件 |
| `GridModel` | 表格模型，见下 |

### `GridModel`

参照中台 `mdf-cube/src/models/GridModel.js` 重写，把它的约定搬进 devfab 的 ui-model 体系（文件头注释里有完整对照说明）：

- 两层数据：`dataSource`（全量）+ `rows`（当前展示行，本地模式下是 `dataSource` 的分页切片）
- 行状态与数据同序：`rowsDataState[i]` 对应 `dataSource[i]`，取值见 `DataStates`（`''` / `Insert` / `Update` / `Delete`）
- 内部字段：`_id` / `_selected` / `_status`
- 列是 **object map**（key = `field`）而非数组，渲染 vxe-grid 时用 `getColumnList()` 转数组
- 分页状态叫 `pageInfo`（`pageIndex` / `pageSize` / `pageCount` / `recordCount`），`pageSize = -1` 表示不分页
- 选中分两层：当前页 `_selected` 标记 + 跨页选中缓存
- 提供 `insertRow` / `appendRow` / `updateRow` / `deleteRows` / `clear`、`getDirtyData` / `backupState` / `restoreState`、`getCellValue` / `setCellValue` / `setCellState`、`validate` 等

与中台实现的有意差异：取数直接用 `proxyConfig.load`（兼容旧的 `dataSource: fn` / `cUrl`）；`setRows` 推原始行对象而非 `getShowRows()` 展示副本（否则选中回灌与单元格编辑会落到副本上）；未移植中台的行模型（editRowModel / ReferModel / 特征 / 孙表）。

### 模型工厂

`_models/index.js` 提供两个入口，用于按元数据批量造模型：

```js
import { createViewModel, initViewModel } from 'devfab/dist/common/models'

// 返回 VM 类，可自行 new + init
const VM = createViewModel(meta, params)
// 直接返回实例：内部已执行 init(meta.models, meta)
const vm = initViewModel(meta, params)
```

`params` 可配置：`domainKeyField` / `billNoField` / `modelNameField`（默认 `domainKey` / `billNo` / `modelName`）、`enableExtendjs`（是否加载扩展脚本）、`require`（覆盖 require 实现）、`createModelFactory`（自定义控件类型的模型映射）、`onBeforeCreateModel`（造模型前的钩子）。

创建后 `initData()` → `initExtendJs()` 会加载 `${billno}_VM.Extend.js` 并执行其 `doAction('init', vm)`；无论成功失败都会抛出 `extendReady` 事件，宿主可监听它作为「渲染就绪」信号。

## `builder` —— 组件注册与渲染

`_utils/builder.js` 是模块级单例（`isInit` / `components` / `renderFactory` 都在模块作用域），一个页面只能存在一份。

| 方法 | 说明 |
| --- | --- |
| `init(fn)` | 只执行一次的初始化钩子 |
| `initComponent(name, comp)` / `initComponent({ Name: comp })` | 注册组件，支持单个或对象批量；重名只告警不覆盖 |
| `getComponent` / `hasComponent` / `getComponents` | 读取注册表 |
| `initRenderFactory(fn)` | 注入「元数据节点 → 框架元素」的转换函数，**必须由宿主提供** |
| `render(config, extraConfig)` | 按元数据数组递归渲染，返回节点数组 |
| `clear()` | 清空注册表、渲染工厂与初始化标记 |

`render` 的渲染优先级：节点自带的 `render({ node, props })` > 全局 `renderFactory({ node, props })` > 直接返回 `{ component, children, ...props }`。`extraConfig.props` 会作为默认 props 展开。组件未注册时只打印告警，不抛错。

## React 适配层

所有 adapter 都是高阶组件：`Adapter(Com) => 包装后的组件`。

### `common/`

| 文件 | 作用 |
| --- | --- |
| `refAdapter.jsx` | 受控壳：维护 `value` / `disabled` / `visible` / `readOnly` / `required` 状态，`visible === false` 时不渲染；通过 `useImperativeHandle` 暴露 `setState`（兼容 `setState(obj)` 与 `setState(key, val)`）与 `getState`。`readonly` 会归一化成控件惯用的 `readOnly` |
| `labelAdapter.jsx` | 给控件套 `label` 外壳（`mini-control-block` 结构），`required` 时加必输样式 |
| `loadMetaAdapter.jsx` | 挂载时调 `getViewMeta(billno)` 拉视图元数据，加载完成前渲染占位，完成后把元数据作为 props 铺给内层组件 |
| `dataSourceAdapter.jsx` | 取数壳：调 `props.api.list` 拉数据，并 `setData` / `setLoading` 到内层组件；暴露 `loadData` 命令式方法。同文件里的 `TableAdapter` 未导出 |
| `modalAdapter.jsx` | 把组件包进 Modal（`visible` → `open`、关闭时回调 `onClose`）。**当前未被 `adapter/index.js` 导出** |

### `model/`

| 导出 | 作用 |
| --- | --- |
| `ModelAdapter(Com)` | 控件接入模型层。挂载时按 props 造 `SimpleModel`，以 `name` 登记进 `vm`（走 `addProperty`，父级 `getData()` 才收得到），并把控件实例交给模型托管；卸载时反注册 |
| `PageModelAdapter(Com)` | 页面外壳：创建根 `ViewModel` 并以 `vm` / `builder` 两个 prop 注入内层组件 |
| `ExtendjsAdapter(Com)` | 加载 `extendjs` 扩展脚本（默认延迟 300ms，可被 `extendDelay` 覆盖），加载完成前渲染 loading；`devfab.require` 不可用时直接跳过，避免页面卡死 |
| `BillAdapter(Com)` / `BillListAdapter(Com)` | 单据 / 列表外壳：把单据的 `vm` 挂到根 `vm` 上（key 为 `billno`），触发 `afterMount` / `afterUnMount`；列表额外把 `filterModel` 的 `search` 事件接到 `vm.execute('loadData', params)` |
| `DataSourceModelAdapter(Com)` | 把 `vm` 的 `loadData` 事件接到取数壳，并从 `parentModel` 合并 `api.bill` 配置 |
| `FilterAdapter(Com)` | 创建 `FilterModel`，向内层注入 `onSearch` 与 `renderCondition`（用 `builder.render` 渲染单个条件） |

用法示意：

```jsx
import React from 'react'
import { adapter } from 'devfab/dist/react'
import Input from 'antd/lib/input'

const { ModelAdapter, PageModelAdapter } = adapter

// 1. 注册控件：把元数据里的 component 名映射到实际组件
builder.initComponent({
    Input: ModelAdapter(Input),
})

// 2. 告诉 builder 如何把节点变成 React 元素（必须由宿主提供）
builder.initRenderFactory(({ node, props }) =>
    React.createElement(node.component || 'div', { key: props.key, ...props }, node.children)
)

// 3. 用后端下发的元数据渲染
const nodes = builder.render(meta)
```

> 组件里出现的全局 `devfab` 由宿主的 `<script>`（或引入 `devfab` 后自行赋值）提供，见「运行时契约」。

## Vue 3 适配层

入口 `src/vue/vue-adapter/index.js`，产物 `dist/vue/vue3-adapter.{js,esm.js}`，由宿主显式 `import` / `require`，不产出 UMD、不挂全局。两个入口函数分别对应 React 的两种组件心智模型：

**`defineClassComponent(Class, options)`** —— 用 class 写组件。`this` 由 Proxy 包装，`this.$el` / `this.$refs` / `this.$nextTick` / `this.$forceUpdate` 在 `render` 与所有钩子里行为一致；同时提供 `this.setState` / `this.forceUpdate`。生命周期桥接：`componentWillMount` / `componentDidMount` / `componentWillReceiveProps`（浅比较 props）/ `componentDidUpdate` / `componentWillUnmount` / `componentDidUnmount` / `componentDidCatch`。可选基类 `VueComponent` 负责存好 `props` / `context`。

```js
import { defineClassComponent } from 'devfab/dist/vue/vue3-adapter'

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

**`defineFunctionComponent(fn, options)`** —— 用函数组件 + Hooks 写组件，`h` 由第三个参数注入，Hooks 按索引复用状态。

```js
import { defineFunctionComponent, useState } from 'devfab/dist/vue/vue3-adapter'

export default defineFunctionComponent((props, ctx, h) => {
    const [n, setN] = useState(0)
    return h('div', { onClick: () => setN(n.value + 1) }, String(n.value))
})
```

可用 Hooks：`useState`、`useRef`、`useMemo`、`useCallback`、`useEffect`、`useLayoutEffect`、`useReducer`、`useContext`、`useProvide`。

Hooks 依赖索引存储，必须**无条件、按固定顺序**调用。非生产环境下内置了一道校验：索引位置上的 Hook 类型变了、或本次与上次调用的 Hook 数量不一致，都会 `console.error` 提示。

## 扩展脚本机制（`_lib/requirejs.js`）

vendored 的 RequireJS 2.3.2 之上挂了一层本地适配，暴露到 `window.__devfab`：

| 成员 | 说明 |
| --- | --- |
| `__devfab.require(domain, deps, callback, errback)` | 扩展脚本加载入口，支持 `require(deps, cb, err)` 与 `require(domain, deps, cb, err)` 两种签名 |
| `__devfab.define` | 扩展脚本注册入口 |
| `__devfab.requireInner` / `defineInner` | 原生 RequireJS 实现，绕过适配层 |

另外定制了 `req.createNode`：URL 以 `.css` 结尾时创建 `<link>` 而不是 `<script>`，扩展脚本可以顺带带样式。模型层默认从 `window.__devfab.require` 取加载器（见 `_models/index.js`）。

## 已知约束与当前实现状态

### 设计约束

- Vue 适配层仅支持 Vue 3，产物文件名带 `vue3` 即用于标明这条边界；兼容 Vue 2 需另写适配层。
- 纯 JavaScript 工程，不产出类型声明。
- `builder` 是模块级单例，微前端或多实例场景需要额外隔离。
- React 适配层依赖全局 `devfab`，不支持「多份运行时共存」。

### 待收敛项（写 README 时已核实，非推测）

- **包入口与适配层约定的运行时形状不一致**：`src/index.js` 导出的 default 是 `{ utils: { builder, cache, event }, common: {...} }`，而 React 适配层读的是 `devfab.builder`、`devfab.utils.models`，`scripts/smoke.js` 还要求 `hasRuntime()` / `getRuntime()` 与挂载 `window.devfab` 的行为。这些在源码里都**尚未实现**，因此当前构建产物跑 `npm run smoke` 会失败。
- **`ExtendjsAdapter` 调用的 `getRuntime()` 未定义**（`_utils/index.js` 与 `src` 全局都没有），走到扩展脚本分支会直接 `ReferenceError`。
- **`GridModel` 存在从原实现带过来的未定义引用**：`setCachePaginationRowData`、`resetSelected`、`createDefaults`、以及全局 `cb`、`_`（lodash）。涉及 `setDataSource` / `showPage` 等取数与分页路径。
- **`src/vue/index.js` 目前不被任何入口引用**，`vue-adapter` 由 `src/vue/vue-adapter/index.js` 单独作为构建入口，前者只是占位。
- **`adapter/index.js` 未导出 `ModalAdapter`**，`common/dataSourceAdapter.jsx` 里的 `TableAdapter` 也未导出且含 `debugger` 语句。
- `npm run lint` 当前不通过（约 200+ error），主要是 `react/prop-types` 与 `react/display-name`，也有上面列的 `no-undef`。
- `package.json` 的 `license` 写的是 `ISC`，而 `LICENSE` 文件是 Apache License 2.0。

## License

Apache License 2.0，见 [LICENSE](./LICENSE)。
