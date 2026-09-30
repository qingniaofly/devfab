// rollup.js 编译支持 npm 模块和 CommonJS 模块
import commonjs from '@rollup/plugin-commonjs'
import postcss from 'rollup-plugin-postcss'

// 编译代码
import babel from '@rollup/plugin-babel'
import { DEFAULT_EXTENSIONS } from '@babel/core'
// 压缩代码
import terser from '@rollup/plugin-terser'
// 将我们编写的源码与依赖的第三方库进行合并
import resolve from '@rollup/plugin-node-resolve'
// 替换环境变量
import replace from 'rollup-plugin-replace'
import copy from 'rollup-plugin-copy'

import pkg from './package.json' // 当前运行环境，可通过 cross-env 命令行设置

const NODE_ENV = process.env.NODE_ENV
const isPrd = NODE_ENV === 'production'

// 生产构建压缩产物，开发构建保持可读便于调试。
// 例外：lib/devfab.js 始终不压缩，它是供 <script> 直接引用的可读版本，
// 压缩版另有 lib/devfab.min.js。
function minifyOnPrd() {
    return isPrd ? [terser()] : []
}

// 由依赖方提供，不打进产物（与 package.json peerDependencies 对齐）
const umdGlobals = {
    react: 'React',
    'react-dom': 'ReactDOM',
    vue: 'vue',
    antd: 'antd',
    classnames: 'classnames',
}

// 工程已无 TypeScript：源码是 .js / .jsx。
// 适配层文件用 .jsx，而内部 import 不带扩展名，node-resolve 默认只认 .js / .mjs，
// 所以这里必须显式把 .jsx 加进解析列表，否则 `./common/refAdapter` 这类引用会解析失败。
const resolveExtensions = ['.mjs', '.js', '.jsx', '.json']

// React 侧：JSX 交给 @babel/preset-react，编译为 React.createElement
// DEFAULT_EXTENSIONS 本身已含 .js / .jsx / .mjs，不需要再补 TS 扩展名
const reactBabelOptions = {
    presets: ['@babel/preset-env', '@babel/preset-react'],
    extensions: [...DEFAULT_EXTENSIONS],
    exclude: 'node_modules/**',
    // 内联 helper：preserveModules 产物如果引用 @babel/runtime，
    // 会在 CJS 中 require ESM 版 helper 而报错。
    babelHelpers: 'bundled',
}

// Vue 侧：JSX 交给 Vue 官方插件 @vue/babel-plugin-jsx，编译为 createVNode
// 这里不能再挂 @babel/preset-react —— 否则 Vue 组件里的 JSX 会被编译成
// React.createElement，在只装了 vue 的环境里直接崩。
const vueBabelOptions = {
    presets: ['@babel/preset-env'],
    plugins: ['@vue/babel-plugin-jsx'],
    extensions: [...DEFAULT_EXTENSIONS],
    exclude: 'node_modules/**',
    babelHelpers: 'bundled',
}

function getCommonConfig(opts) {
    const { babelOptions = reactBabelOptions } = opts || {}
    const commonConfig = {
        plugins: [
            resolve({ extensions: resolveExtensions }),
            replace({
                'process.env.NODE_ENV': JSON.stringify(NODE_ENV),
            }),
            commonjs(),
            babel(babelOptions),
            postcss({
                extract: true, // 提取CSS到单独文件
                minimize: true, // 生产环境压缩
                modules: true, // 启用CSS Modules
                use: {
                    less: { javascriptEnabled: true }, // 启用Less
                },
            }),
            copy({
                targets: ['src/_lib/requirejs.js'],
                outputFolder: 'lib',
            }),
        ],
    }

    return commonConfig
}

const main = {
    input: 'src/index.js',
    output: [
        {
            file: pkg.main,
            format: 'cjs',
            exports: 'named',
            globals: umdGlobals,
            plugins: minifyOnPrd(),
        },
        {
            file: pkg.module,
            format: 'es',
            globals: umdGlobals,
            plugins: minifyOnPrd(),
        },
        {
            name: 'devfab',
            exports: 'named',
            file: pkg.umd,
            format: 'umd',
            globals: umdGlobals,
            plugins: minifyOnPrd(),
        },
        {
            // 可读版本，故意不压缩：宿主用 <script src=".../lib/devfab.js"> 直引时便于排查
            name: 'devfab',
            exports: 'named',
            file: './lib/devfab.js',
            format: 'umd',
            globals: umdGlobals,
        },
        {
            // lib/devfab.js 的压缩版；始终压缩，避免两个产物只差文件名
            name: 'devfab',
            exports: 'named',
            file: './lib/devfab.min.js',
            format: 'umd',
            globals: umdGlobals,
            plugins: [terser()],
        },
    ],
    ...getCommonConfig(),
}

const reactConfig = {
    input: 'src/react/index.js',
    output: [
        {
            format: 'cjs',
            dir: 'dist/react',
            exports: 'named',
            globals: umdGlobals,
            preserveModules: true, // 保留模块结构
            preserveModulesRoot: 'src/react', // 输出结构对齐 src/react
            plugins: minifyOnPrd(),
        },
    ],
    ...getCommonConfig(),
    external: ['react', 'react-dom', 'classnames', 'antd'],
}

const vueConfig = {
    input: 'src/vue/vue-adapter/index.js',
    // 只产出 CJS / ESM，不产出 UMD、不挂任何全局变量：这个适配层由宿主显式
    // import 使用，不需要往 window 上塞东西。
    // 文件名带 vue3 是因为它用的是 defineComponent/reactive/h 等 Vue 3 API，
    // 与 Vue 2 不兼容；叫 index.js 既容易被误当成 vue 子包的入口，也看不出这条边界。
    output: [
        {
            file: './dist/vue/vue3-adapter.js',
            format: 'cjs',
            exports: 'named',
            plugins: minifyOnPrd(),
        },
        {
            file: './dist/vue/vue3-adapter.esm.js',
            format: 'es',
            plugins: minifyOnPrd(),
        },
    ],
    ...getCommonConfig({ babelOptions: vueBabelOptions }),
    external: ['vue'],
}

const modelsConfig = {
    input: 'src/_models/index.js',
    output: [
        {
            file: './dist/common/models.js',
            format: 'cjs',
            exports: 'named',
            plugins: minifyOnPrd(),
        },
        {
            file: './dist/common/models.esm.js',
            format: 'es',
            plugins: minifyOnPrd(),
        },
    ],
    ...getCommonConfig(),
}

const utilsConfig = {
    input: 'src/_utils/index.js',
    output: [
        {
            file: './dist/common/utils.js',
            format: 'cjs',
            exports: 'named',
            plugins: minifyOnPrd(),
        },
        {
            file: './dist/common/utils.esm.js',
            format: 'es',
            plugins: minifyOnPrd(),
        },
    ],
    ...getCommonConfig(),
}

export default [main, reactConfig, vueConfig, modelsConfig, utilsConfig]
