/**
 * vue-class-adapter
 * 用 React Class 组件的心智模型写 Vue 3 组件
 *
 * this 约定：render 与所有生命周期钩子都通过 proxy 调用（.call(proxy)），
 * 所以在任何钩子里 this.$el / this.$refs / this.$nextTick / this.$forceUpdate
 * 的取值与在 render 中一致；class 自有属性（props / state / setState 等）优先于
 * Vue 实例属性。
 */
import {
    defineComponent,
    reactive,
    toRaw,
    h as createElement,
    getCurrentInstance,
    onBeforeMount,
    onMounted,
    onBeforeUpdate,
    onUpdated,
    onBeforeUnmount,
    onUnmounted,
    onErrorCaptured,
    nextTick,
} from 'vue'

/* ------------------------------------------------------------------ */
/* 可选基类：帮你把 props / context 存好，不继承也行                    */
/* ------------------------------------------------------------------ */
export class VueComponent {
    constructor(props, ctx) {
        this.props = props
        this.context = ctx
    }
}

/* ------------------------------------------------------------------ */
/* 工具                                                                */
/* ------------------------------------------------------------------ */
function shallowEqual(a, b) {
    if (a === b) {
        return true
    }
    if (!a || !b) {
        return false
    }
    const ka = Object.keys(a)
    const kb = Object.keys(b)
    if (ka.length !== kb.length) {
        return false
    }
    for (let i = 0; i < ka.length; i++) {
        const k = ka[i]
        if (a[k] !== b[k] || !Object.prototype.hasOwnProperty.call(b, k)) {
            return false
        }
    }
    return true
}

/* ------------------------------------------------------------------ */
/* 主函数                                                              */
/* ------------------------------------------------------------------ */
export function defineClassComponent(ClassComponent, options = {}) {
    if (typeof ClassComponent !== 'function') {
        throw new TypeError('[defineClassComponent] 第一个参数必须是 class')
    }

    const name = options.name || ClassComponent.displayName || ClassComponent.name || 'AnonymousClassComponent'

    const props = options.props ?? ClassComponent.props ?? {}
    const emits = options.emits ?? ClassComponent.emits
    const inheritAttrs = options.inheritAttrs ?? ClassComponent.inheritAttrs ?? true
    const components = options.components ?? ClassComponent.components
    const directives = options.directives ?? ClassComponent.directives

    return defineComponent({
        name,
        props,
        emits,
        inheritAttrs,
        components,
        directives,

        setup(_rawProps, ctx) {
            const internal = getCurrentInstance()
            const vm = internal.proxy

            /* ---------------- 1. 实例化 ---------------- */
            const rawProps = {}
            Object.assign(rawProps, _rawProps, ctx.attrs)
            const instance = new ClassComponent(rawProps, ctx)

            /* ---------------- 2. state ---------------- */
            const initial = (typeof instance.state === 'function' ? instance.state(rawProps) : instance.state) || (typeof instance.data === 'function' ? instance.data() : {}) || {}

            const state = reactive({ ...initial })

            // 用 getter/setter 包一层：this.state = {...} 也能保持响应式
            Object.defineProperty(instance, 'state', {
                get: () => state,
                set: (next) => {
                    if (next && typeof next === 'object') {
                        Object.assign(state, next)
                    }
                },
                enumerable: true,
                configurable: true,
            })

            /* ---------------- 3. 渲染上下文 ---------------- */
            instance.props = rawProps
            instance.context = ctx
            instance.h = createElement

            /* ---------------- 4. proxy：打通 this.$el 等 ---------------- */
            const proxy = new Proxy(instance, {
                get(target, key, receiver) {
                    if (key in target) {
                        return Reflect.get(target, key, receiver)
                    }
                    if (vm && key in vm) {
                        return vm[key]
                    }
                    return undefined
                },
                set(target, key, value, receiver) {
                    return Reflect.set(target, key, value, receiver)
                },
                has(target, key) {
                    return key in target || (vm ? key in vm : false)
                },
            })

            /* ---------------- 5. setState / forceUpdate ---------------- */
            instance.setState = function setState(partial, callback) {
                const patch = typeof partial === 'function' ? partial(state, rawProps) : partial

                if (patch && typeof patch === 'object') {
                    Object.assign(state, patch)
                }
                if (typeof callback === 'function') {
                    nextTick(() => callback.call(proxy))
                }
            }

            instance.forceUpdate = function forceUpdate(callback) {
                vm.$forceUpdate()
                if (typeof callback === 'function') {
                    nextTick(() => callback.call(proxy))
                }
            }

            /* ---------------- 6. 更新快照 ---------------- */
            let prevProps = { ...rawProps }
            let prevState = { ...toRaw(state) }

            /* ---------------- 7. 生命周期桥接 ---------------- */
            // 统一用 .call(proxy) 调用：this 始终是 proxy，
            // 这样 this.$el / this.$refs / this.$nextTick / this.$forceUpdate 等
            // 在所有钩子里行为一致（否则只有 render 里能拿到，钩子里是 undefined）。
            onBeforeMount(() => {
                instance.componentWillMount?.call(proxy)
            })

            onMounted(() => {
                instance.componentDidMount?.call(proxy)
            })

            onBeforeUpdate(() => {
                if (typeof instance.componentWillReceiveProps === 'function') {
                    const nextProps = { ...rawProps }
                    if (!shallowEqual(nextProps, prevProps)) {
                        instance.componentWillReceiveProps.call(proxy, nextProps, prevProps)
                    }
                }
            })

            onUpdated(() => {
                instance.componentDidUpdate?.call(proxy, prevProps, prevState)
                prevProps = { ...rawProps }
                prevState = { ...toRaw(state) }
            })

            onBeforeUnmount(() => {
                instance.componentWillUnmount?.call(proxy)
            })

            onUnmounted(() => {
                instance.componentDidUnmount?.call(proxy)
            })

            onErrorCaptured((err, errorInstance, info) => {
                if (typeof instance.componentDidCatch === 'function') {
                    instance.componentDidCatch.call(proxy, err, {
                        vueInstance: errorInstance,
                        info,
                    })
                    return false // 阻止继续向上冒泡
                }
                return undefined
            })

            /* ---------------- 8. 渲染函数 ---------------- */
            return function render() {
                if (typeof instance.render !== 'function') {
                    throw new Error(`[defineClassComponent] 组件「${name}」缺少 render 方法`)
                }
                return instance.render.call(proxy, createElement)
            }
        },
    })
}

export default defineClassComponent
