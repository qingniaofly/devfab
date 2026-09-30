/**
 * vue-function-adapter
 * 用 React 函数组件 + Hooks 一样写 Vue 3 组件
 *
 * dev 环境下的 Hook 校验（生产环境自动跳过）：
 *   1. 同一索引位置上前后两次调用了不同的 Hook -> console.error，并重置该槽位
 *   2. 前后两次渲染的 Hook 数量不一致 -> console.error
 * 因此 Hook 必须在渲染函数里「无条件、按固定顺序」调用，
 * 不能写在 if / for / 提前 return 之后。
 */
import { defineComponent, ref, h, onUnmounted, inject, provide, nextTick } from 'vue'

/* ---------------- Hook 存储 ---------------- */
let currentStore = null

// dev 环境判定（webpack 会替换 process.env.NODE_ENV）
const isDev = (() => {
    try {
        return process.env.NODE_ENV !== 'production'
    } catch (e) {
        return true
    }
})()

class HookStore {
    constructor() {
        this.slots = []
        this.cursor = 0
        this.unmounted = false
        this.prevCount = 0
    }
    startRender() {
        this.cursor = 0
        this.prevCount = this.slots.length
        currentStore = this
    }
    endRender() {
        currentStore = null
        // 首次渲染 prevCount 为 0，不做数量校验
        if (isDev && this.prevCount > 0 && this.cursor !== this.prevCount) {
            console.error(`[Hook 数量错误] 本次渲染调用了 ${this.cursor} 个 Hook，上次是 ${this.prevCount} 个。` + 'Hook 必须无条件、按固定顺序调用（不能写在 if / for / 提前 return 之后）。')
        }
    }
    getSlot(type, hookName) {
        const i = this.cursor++
        const exists = this.slots[i]

        if (!exists) {
            const slot = { type: null, hookName }
            this.slots[i] = slot
            return slot
        }

        // 同一个索引位置前后两次调用了不同的 Hook => 顺序被条件分支破坏了。
        // 不报错的话会静默返回上一次的错值，所以这里必须显式提示。
        if (exists.type !== type) {
            if (isDev) {
                console.error(
                    `[Hook 顺序错误] 第 ${i + 1} 个 Hook 调用不一致：上次是 ${exists.hookName}，本次是 ${hookName}。` +
                        'Hook 必须无条件、按固定顺序调用（不能写在 if / for / 提前 return 之后）。' +
                        '该位置的状态已重置，组件行为可能异常。'
                )
            }
            const slot = { type: null, hookName }
            this.slots[i] = slot
            return slot
        }

        return exists
    }
    cleanup() {
        this.unmounted = true
        for (const slot of this.slots) {
            if (slot && slot.type === 'effect' && typeof slot.cleanup === 'function') {
                try {
                    slot.cleanup()
                } catch (e) {
                    console.error(e)
                }
                slot.cleanup = null
            }
        }
    }
}

function depsEqual(a, b) {
    if (a === b) {
        return true
    }
    if (!a || !b || a.length !== b.length) {
        return false
    }
    for (let i = 0; i < a.length; i++) {
        if (!Object.is(a[i], b[i])) {
            return false
        }
    }
    return true
}

/* ---------------- Hooks ---------------- */

function getCurrentSlot(type, hookName) {
    if (!currentStore) {
        throw new Error(`[${hookName}] 只能在组件渲染过程中调用（defineFunctionComponent 的渲染函数内部），` + '不能写在事件回调、setTimeout 或组件外部。')
    }
    return currentStore.getSlot(type, hookName)
}

export function useState(initial) {
    const slot = getCurrentSlot('state', 'useState')
    if (slot.type !== 'state') {
        slot.type = 'state'
        slot.ref = ref(typeof initial === 'function' ? initial() : initial)
    }
    const setState = (v) => {
        slot.ref.value = typeof v === 'function' ? v(slot.ref.value) : v
    }
    return [slot.ref, setState]
}

export function useRef(initial) {
    const slot = getCurrentSlot('ref', 'useRef')
    if (slot.type !== 'ref') {
        slot.type = 'ref'
        slot.obj = { current: initial }
    }
    return slot.obj
}

export function useMemo(factory, deps) {
    const slot = getCurrentSlot('memo', 'useMemo')
    if (slot.type !== 'memo' || !depsEqual(slot.deps, deps)) {
        slot.type = 'memo'
        slot.value = factory()
        slot.deps = deps
    }
    return slot.value
}

export function useCallback(fn, deps) {
    // 独立 slot 类型：和 useMemo 写错位置时能被顺序校验发现
    const slot = getCurrentSlot('callback', 'useCallback')
    if (slot.type !== 'callback' || !depsEqual(slot.deps, deps)) {
        slot.type = 'callback'
        slot.value = fn
        slot.deps = deps
    }
    return slot.value
}

export function useEffect(effect, deps) {
    const slot = getCurrentSlot('effect', 'useEffect')
    const store = currentStore
    const isFirst = slot.type !== 'effect'

    if (isFirst) {
        slot.type = 'effect'
        slot.cleanup = null
        slot.deps = undefined
        slot.scheduled = false
        slot.effect = null
    }

    // 总是更新为最新闭包（避免 use deps 时读到旧值）
    slot.effect = effect

    const shouldRun = isFirst || !depsEqual(slot.deps, deps)

    if (shouldRun) {
        slot.deps = deps
        if (!slot.scheduled) {
            slot.scheduled = true
            nextTick(() => {
                slot.scheduled = false
                if (store.unmounted) {
                    return
                }
                if (slot.cleanup) {
                    try {
                        slot.cleanup()
                    } catch (e) {
                        console.error(e)
                    }
                    slot.cleanup = null
                }
                const r = slot.effect()
                slot.cleanup = typeof r === 'function' ? r : null
            })
        }
    }
}

export function useLayoutEffect(effect, deps) {
    // 简化处理：Vue 的 DOM 更新是同步的
    useEffect(effect, deps)
}

export function useReducer(reducer, initialArg, init) {
    const slot = getCurrentSlot('reducer', 'useReducer')
    if (slot.type !== 'reducer') {
        slot.type = 'reducer'
        slot.ref = ref(init ? init(initialArg) : initialArg)
    }
    slot.reducer = reducer // 每次渲染更新，避免闭包陷阱
    const dispatch = (action) => {
        slot.ref.value = slot.reducer(slot.ref.value, action)
    }
    return [slot.ref, dispatch]
}

export function useContext(key, defaultValue) {
    const slot = getCurrentSlot('context', 'useContext')
    if (slot.type !== 'context') {
        slot.type = 'context'
        slot.value = inject(key, defaultValue)
    }
    return slot.value
}

export function useProvide(key, value) {
    const slot = getCurrentSlot('provide', 'useProvide')
    if (slot.type !== 'provide') {
        slot.type = 'provide'
        provide(key, value)
    }
}

/* ---------------- 主函数 ---------------- */

export function defineFunctionComponent(fn, options = {}) {
    if (typeof fn !== 'function') {
        throw new TypeError('[defineFunctionComponent] 参数必须是函数')
    }
    const name = options.name || fn.displayName || fn.name || 'FunctionComponent'

    return defineComponent({
        name,
        props: options.props ?? fn.props,
        emits: options.emits ?? fn.emits,
        inheritAttrs: options.inheritAttrs ?? fn.inheritAttrs ?? true,
        components: options.components ?? fn.components,
        directives: options.directives ?? fn.directives,

        setup(props, ctx) {
            const store = new HookStore()
            onUnmounted(() => store.cleanup())

            // 返回渲染函数：Vue 每次需要重新渲染时会再次调用它，
            // 于是 fn 会被再次执行，Hooks 通过索引复用上一次的状态。
            return () => {
                store.startRender()
                try {
                    return fn(props, ctx, h)
                } finally {
                    store.endRender()
                }
            }
        },
    })
}

export default defineFunctionComponent
