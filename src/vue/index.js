/**
 * Vue 3 的控件适配器雏形（尚未接入模型层，也未参与构建）。
 *
 * 真正可用的 Vue 3 适配器在 src/vue/vue-adapter/ 下。本文件目前不被任何入口引用，
 * 保留在此仅作为后续实现的占位。
 *
 * 注意 JSX 的编译边界：Vue 侧走 @vue/babel-plugin-jsx（见 rollup.config.js 的
 * vueBabelOptions），JSX 最终编译成 vue 的 createVNode，不能套用 @babel/preset-react。
 *
 * @param {any} Com 控件组件
 * @returns {import('vue').VNode} 渲染出的 Vue 节点
 */
function ModelAdapter(Com) {
    return <Com />
}
