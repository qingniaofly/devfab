let isInit = false
let components = {} // 组件
let renderFactory = null

function initComponent(name, comp) {
    if (!name) {
        return
    }
    if (typeof name === 'string') {
        if (components[name]) {
            console.log(`[warning] Component ${name} is exist!`)
            return
        }
        components[name] = comp
        return
    }
    Object.assign(components, name)
}

function getComponent(name) {
    return components[name]
}

function clearComponents() {
    components = {}
}

function initRenderFactory(fn) {
    renderFactory = fn
}

function renderComponent(config, extraConfig) {
    if (!Array.isArray(config)) {
        return
    }
    const _component = []
    config.forEach((item, i) => {
        const { component: _com, children: _children, render: _render, ..._props } = item
        const component = getComponent(_com)
        if (!component && typeof _render !== 'function') {
            console.log(`[warning] Component ${_com} is not registered!`)
        }
        const children = renderComponent(_children, extraConfig)
        const node = {
            component,
            children,
        }
        _props.index = i
        const props = Object.assign({}, extraConfig?.props, _props)
        if (typeof _render === 'function') {
            _component.push(_render({ node, props }))
        } else if (typeof renderFactory === 'function') {
            _component.push(renderFactory({ node, props }))
        } else {
            Object.assign(node, props)
            _component.push(node)
        }
    })
    return _component
}

class Builder {
    init(fn) {
        if (isInit) {
            return
        }
        if (typeof fn === 'function') {
            fn()
        }
        isInit = true
    }
    initComponent(name, comp) {
        initComponent(name, comp)
    }
    getComponents() {
        return { ...components }
    }
    getComponent(name) {
        return getComponent(name)
    }
    hasComponent(name) {
        return !!getComponent(name)
    }
    initRenderFactory(fn) {
        initRenderFactory(fn)
    }

    initRequest() {
        //
    }
    render(config, extraConfig) {
        return renderComponent(config, extraConfig)
    }
    clear() {
        clearComponents()
        renderFactory = null
        isInit = false
    }
}
export default Builder
