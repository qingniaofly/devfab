module.exports = {
    presets: [
        [
            '@babel/preset-env',
            {
                /* Babel 会在 Rollup 有机会做处理之前，将我们的模块转成 CommonJS，导致 Rollup 的一些处理失败 */
                modules: false,
            },
        ],
    ],
    // 不再使用 @babel/plugin-transform-runtime：它会把 helper 变成对 @babel/runtime 的
    // import，而 preserveModules 产物（dist/react）在 CJS 里 require 了 ESM 版 helper
    // （@babel/runtime/helpers/esm/*），Node 侧会直接报错。
    // 这里改为由 rollup 侧的 babelHelpers: 'bundled' 内联 helper。
    plugins: [],
}
