import React, { useRef, forwardRef, useEffect } from 'react'

function getBaseProps(props) {
    const baseProps = {}
    for (let key in props) {
        const val = props[key]
        if (key === 'children' || key === 'ref' || typeof val === 'function') {
            continue
        }
        baseProps[key] = val
    }
    return baseProps
}

const ModelAdapter = (Com) => {
    return forwardRef((props, ref) => {
        const { children, vm, ...rest } = props
        const instance = useRef({
            ref: null,
        })
        useEffect(() => {
            const { SimpleModel } = devfab.utils.models
            const baseProps = getBaseProps(props)
            const name = baseProps.name
            const model = new SimpleModel(baseProps)
            const control = instance.current.ref
            if (name && vm) {
                // 走 addProperty 才会登记进 propertyNames，父级 getData() 才能收集到这个字段
                if (typeof vm.addProperty === 'function') {
                    vm.addProperty(name, model)
                } else {
                    vm._set_data(name, model, true)
                }
                model.setName(name)
                // 把控件交给模型托管：模型 setValue / setVisible / setDisabled 时会推给控件
                model.addComponent(control, baseProps.ctrlName)
            }
            return () => {
                if (name && vm) {
                    if (typeof vm.removeProperty === 'function') {
                        vm.removeProperty(name)
                    } else {
                        vm._set_data(name, null)
                    }
                    model.removeComponent(control)
                }
            }
        }, [])
        return (
            <Com {...rest} ref={(el) => (instance.current.ref = el)}>
                {children}
            </Com>
        )
    })
}
export default ModelAdapter
