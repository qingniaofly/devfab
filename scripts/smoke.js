/**
 * 零依赖冒烟测试：直接跑构建产物，覆盖本次修复的关键路径。
 *
 * 用法：
 *   npm run build && npm run smoke
 *
 * 之所以不引入 jest / vitest：这个库目前一个测试都没有，先用一个能立刻跑的
 * 最小校验把「模型驱动控件」「builder 注册表」「运行时挂载」「产物自包含」
 * 这几条最容易回归的路径钉住，后续再决定上不上测试框架。
 */
const assert = require('assert')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const dist = (p) => path.join(ROOT, 'dist', p)

let passed = 0
const failures = []

function check(name, fn) {
    try {
        fn()
        passed++
        console.log(`  ok   ${name}`)
    } catch (err) {
        failures.push({ name, message: err && err.message })
        console.log(`  FAIL ${name}`)
        console.log(`       ${err && err.message}`)
    }
}

let skipped = 0

function skip(name, reason) {
    skipped++
    console.log(`  skip ${name}（${reason}）`)
}

// 让 core 在 Node 下也走到 window 分支，验证 mountRuntime 的挂载行为
global.window = {}

console.log('\n[1] 运行时挂载与读取（dist/index.js）')
const core = require(dist('index.js'))
const devfab = core.default

check('mountRuntime 把 builder 挂到 window.devfab', () => {
    assert.ok(global.window.devfab, 'window.devfab 不存在')
    assert.strictEqual(global.window.devfab.builder, devfab.builder)
    assert.strictEqual(typeof global.window.devfab.utils.models.SimpleModel, 'function')
})

check('getRuntime() / hasRuntime() 可用', () => {
    assert.strictEqual(core.hasRuntime(), true)
    assert.strictEqual(core.getRuntime().builder, devfab.builder)
})

check('UMD 产物在浏览器 <script> 场景下能挂载 window.devfab', () => {
    const vm = require('vm')
    const sandbox = { console, setTimeout, clearTimeout }
    sandbox.window = sandbox
    sandbox.self = sandbox
    vm.createContext(sandbox)
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'lib/devfab.js'), 'utf8'), sandbox)

    assert.ok(sandbox.devfab, 'window.devfab 未挂载')
    assert.strictEqual(typeof sandbox.devfab.builder.render, 'function')
    assert.strictEqual(typeof sandbox.devfab.utils.models.ViewModel, 'function')
    // UMD 走 `global.devfab = {}` 分支时 exports 就是 window.devfab，
    // 所以 default 与顶层 builder 指向同一个对象
    assert.strictEqual(sandbox.devfab.default.builder, sandbox.devfab.builder)
})

console.log('\n[2] builder 组件注册与渲染')
const { builder } = devfab

check('initComponent 能注册组件（原实现判空写反，注册不进去）', () => {
    const Input = function Input() {}
    builder.reset()
    builder.initComponent('Input', Input)
    assert.strictEqual(builder.getComponent('Input'), Input)
    assert.strictEqual(builder.hasComponent('Input'), true)
})

check('重复注册不会覆盖已有组件', () => {
    const Input = builder.getComponent('Input')
    builder.initComponent('Input', function Other() {})
    assert.strictEqual(builder.getComponent('Input'), Input)
})

check('支持一次性批量注册（对象形式）', () => {
    builder.initComponent({ Button: function Button() {} })
    assert.strictEqual(builder.hasComponent('Button'), true)
})

check('render 按元数据生成节点，未注册组件只告警不抛错', () => {
    builder.initRenderFactory(({ node, props }) => Object.assign({}, node, props))
    const nodes = builder.render([{ component: 'Input', name: 'title' }, { component: 'NotExist' }])
    assert.strictEqual(nodes.length, 2)
    assert.strictEqual(nodes[0].name, 'title')
    assert.strictEqual(nodes[0].component, builder.getComponent('Input'))
    assert.strictEqual(nodes[1].component, undefined)
})

console.log('\n[3] 模型层 -> 控件 的状态推送')
const { SimpleModel, ViewModel } = devfab.utils.models

function createControl() {
    const calls = []
    return {
        calls,
        setState(patch) {
            calls.push(patch)
        },
        getState(key) {
            const last = calls[calls.length - 1] || {}
            return key ? last[key] : last
        },
    }
}

check('setValue 会把值推给受控组件（原实现只有 setVisible/setDisabled 有兜底）', () => {
    const model = new SimpleModel({ name: 'title', value: 'old' })
    const control = createControl()
    model.addComponent(control, 'title')
    model.setValue('new')
    assert.deepStrictEqual(control.calls, [{ value: 'new' }])
    assert.strictEqual(model.getValue(), 'new')
})

check('setVisible / setDisabled 同样能推给控件', () => {
    const model = new SimpleModel({ name: 'title', value: 'v' })
    const control = createControl()
    model.addComponent(control, 'title')
    model.setVisible(false)
    model.setDisabled(true)
    assert.deepStrictEqual(control.calls, [{ visible: false }, { disabled: true }])
})

check('ctrlName 定向通知：只推给对应控件', () => {
    const model = new SimpleModel({ name: 'title', value: 'v' })
    const a = createControl()
    const b = createControl()
    model.addComponent(a, 'title')
    model.addComponent(b, 'subTitle')
    model.setValue('x', 'subTitle')
    assert.strictEqual(a.calls.length, 0)
    assert.deepStrictEqual(b.calls, [{ value: 'x' }])
})

check('removeComponent 之后不再推送', () => {
    const model = new SimpleModel({ name: 'title', value: 'v' })
    const control = createControl()
    model.addComponent(control, 'title')
    model.setValue('a')
    model.removeComponent(control)
    model.setValue('b')
    assert.deepStrictEqual(control.calls, [{ value: 'a' }])
})

check('控件回写 setState 能更新模型值', () => {
    const model = new SimpleModel({ name: 'title', value: 'v' })
    const control = createControl()
    model.addComponent(control, 'title')
    model.setState('value', 'fromControl')
    assert.strictEqual(model.getValue(), 'fromControl')
})

check('ViewModel.addProperty + getData 能收集到子模型的值', () => {
    const vm = new ViewModel({ billno: 'TEST' })
    const model = new SimpleModel({ name: 'title', value: 'hello' })
    vm.addProperty('title', model)
    assert.strictEqual(vm.getData().title, 'hello')
    assert.strictEqual(model.getParent(), vm)
    assert.strictEqual(model.getName(), 'title')
})

check('removeProperty 后不再收集', () => {
    const vm = new ViewModel({})
    const model = new SimpleModel({ name: 'title', value: 'hello' })
    vm.addProperty('title', model)
    vm.removeProperty('title')
    assert.strictEqual(vm.getData().title, undefined)
})

console.log('\n[4] BaseModel 历史缺陷')
check('_cls_data 之后仍可继续写数据（原实现把 _data 置 null 后必抛错）', () => {
    const model = new SimpleModel({ value: 1 })
    model._cls_data()
    model._set_data('value', 2)
    assert.strictEqual(model.getValue(), 2)
})

check('getAllData(true) 会跳过 isGrid 子模型（原实现直接返回 {}）', () => {
    const vm = new ViewModel({})
    const normal = new SimpleModel({ value: 1 })
    const grid = new SimpleModel({ value: 2 })
    grid._set_data('isGrid', true)
    vm.addProperty('normal', normal)
    vm.addProperty('grid', grid)
    assert.deepStrictEqual(vm.getAllData(), { normal: 1, grid: 2 })
    assert.deepStrictEqual(vm.getAllData(true), { normal: 1 })
})

console.log('\n[5] 产物自包含与重复实现清理')

function assertRequiresResolve(file) {
    const source = fs.readFileSync(file, 'utf8')
    const dir = path.dirname(file)
    // 压缩后的产物可能用双引号，单双都要认
    const relatives = [...source.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)].map((m) => m[1])
    assert.ok(relatives.length > 0, `${path.relative(ROOT, file)} 没有相对依赖，疑似读取失败`)
    relatives.forEach((rel) => {
        assert.ok(fs.existsSync(path.resolve(dir, rel)), `${path.relative(ROOT, file)} 缺少相对依赖 ${rel}`)
    })
}

check('dist/react 产物不引用 @babel/runtime（避免 CJS require ESM helper）', () => {
    const files = ['index.js', 'adapter/index.js', 'adapter/model/modelAdapter.js', 'adapter/model/pageAdapter.js']
    files.forEach((rel) => {
        const source = fs.readFileSync(dist(path.join('react', rel)), 'utf8')
        assert.ok(!source.includes('@babel/runtime'), `dist/react/${rel} 仍引用 @babel/runtime`)
    })
})

check('dist/react 相对依赖全部存在于产物内', () => {
    ;['index.js', 'adapter/index.js', 'adapter/model/modelAdapter.js', 'adapter/model/pageAdapter.js'].forEach((rel) => {
        assertRequiresResolve(dist(path.join('react', rel)))
    })
})

check('核心产物不含 babel 外部 helper 依赖', () => {
    const source = fs.readFileSync(dist('index.js'), 'utf8')
    assert.ok(!source.includes('@babel/runtime'), 'dist/index.js 仍引用 @babel/runtime')
})

check('React 产物不引用 react/jsx-runtime（JSX 必须编译成 createElement）', () => {
    const rel = 'react/adapter/model/modelAdapter.js'
    const source = fs.readFileSync(dist(rel), 'utf8')
    assert.ok(!source.includes('react/jsx-runtime'), `dist/${rel} 引用了 react/jsx-runtime，产物会绑定 node_modules 结构`)
    assert.ok(source.includes('createElement'), `dist/${rel} 未使用 createElement，JSX 编译方式已改变`)
    assert.ok(!fs.existsSync(dist('react/node_modules')), 'dist/react 下不应出现 node_modules')
})

check('重复实现已清理（src/utils/models.ts / src/dever.js）', () => {
    assert.ok(!fs.existsSync(path.join(ROOT, 'src/utils/models.ts')), 'src/utils/models.ts 仍然存在')
    assert.ok(!fs.existsSync(path.join(ROOT, 'src/dever.js')), 'src/dever.js 仍然存在')
})

function walkFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name)
        return entry.isDirectory() ? walkFiles(full) : [full]
    })
}

check('工程已无 TypeScript 残留（配置 / 源文件 / 类型产物全部移除）', () => {
    ;['tsconfig.json', 'tsconfig.types.json', 'api-extractor.json', 'api-extractor.tsconfig.json'].forEach((file) => {
        assert.ok(!fs.existsSync(path.join(ROOT, file)), `${file} 仍然存在`)
    })
    assert.ok(!fs.existsSync(dist('types')), 'dist/types 仍然存在')
    const leftovers = walkFiles(path.join(ROOT, 'src')).filter((f) => /\.tsx?$/.test(f))
    assert.deepStrictEqual(leftovers, [], `仍有 TS 源文件：${leftovers.join(', ')}`)
})

check('vue3-adapter 只产出 CJS / ESM，不产出 UMD、不挂全局', () => {
    assert.ok(fs.existsSync(dist('vue/vue3-adapter.js')), '缺少 dist/vue/vue3-adapter.js')
    assert.ok(fs.existsSync(dist('vue/vue3-adapter.esm.js')), '缺少 dist/vue/vue3-adapter.esm.js')
    assert.ok(!fs.existsSync(dist('vue/vue3-adapter.umd.js')), '不应产出 dist/vue/vue3-adapter.umd.js')
    ;['vue/vue3-adapter.js', 'vue/vue3-adapter.esm.js'].forEach((rel) => {
        const source = fs.readFileSync(dist(rel), 'utf8')
        assert.ok(!/global\.devfab|window\.devfab|globalThis\.devfab/.test(source), `dist/${rel} 仍在向全局挂载`)
    })
})

const vueVersion = (() => {
    try {
        return require('vue/package.json').version
    } catch (e) {
        return null
    }
})()

if (!vueVersion) {
    skip('vue3-adapter 产物可加载', '未安装 vue')
} else if (vueVersion.startsWith('2')) {
    skip('vue3-adapter 产物可加载', `本地安装的是 vue@${vueVersion}，package.json 已改为 ^3.4，npm install 后生效`)
} else {
    check('vue3-adapter 产物可加载', () => {
        const vue = require(dist('vue/vue3-adapter.js'))
        assert.strictEqual(typeof vue.defineClassComponent, 'function')
        assert.strictEqual(typeof vue.defineFunctionComponent, 'function')
    })
}

console.log(`\n通过 ${passed} 项，失败 ${failures.length} 项，跳过 ${skipped} 项`)
if (failures.length) {
    failures.forEach((f) => console.log(`  - ${f.name}: ${f.message}`))
    process.exit(1)
}
