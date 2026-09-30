import React, { useRef, useState, forwardRef, useImperativeHandle } from 'react'

// 模型层用的是 `readonly`，antd 等控件用的是 `readOnly`，这里做一次归一化，
// 否则 SimpleModel.setReadonly() 改了状态但控件上不生效。
function normalizeState(patch) {
    if (patch && Object.prototype.hasOwnProperty.call(patch, 'readonly')) {
        patch.readOnly = patch.readonly
    }
    return patch
}

const RefAdapter = (Com) => {
    return forwardRef((props, ref) => {
        const { children, ...rest } = props
        const _ref = useRef(null)
        const [state, setState] = useState({
            value: props.value,
            disabled: props.disabled,
            visible: props.visible,
            readOnly: props.readOnly,
            required: props.required,
            ...rest,
        })
        const instance = useRef({ state })
        instance.current.state = state
        // 空依赖数组让句柄在整个生命周期内保持同一个引用：
        // 模型层是按引用登记控件（addComponent / removeComponent）的，
        // 句柄每次渲染都换新对象会让登记失效。ref 用 getter 取实时值。
        useImperativeHandle(
            ref,
            () => {
                return {
                    get ref() {
                        return _ref.current
                    },
                    // 兼容两种调用形式：setState({ value }) 与 setState('value', v)
                    setState: (keyOrState, val) => {
                        setState((r) => {
                            if (keyOrState && typeof keyOrState === 'object') {
                                return { ...r, ...normalizeState({ ...keyOrState }) }
                            }
                            return {
                                ...r,
                                ...normalizeState({ [keyOrState]: val }),
                            }
                        })
                    },
                    getState: (key) => {
                        const state = instance.current.state
                        if (!key) {
                            return state
                        }
                        return state[key]
                    },
                }
            },
            []
        )

        if (state.visible === false) {
            return null
        }
        return (
            <Com
                {...rest}
                {...state}
                ref={_ref}
                onChange={(val) => {
                    setState((r) => {
                        return {
                            ...r,
                            value: val,
                        }
                    })
                    props.onChange?.(val)
                }}
            >
                {children}
            </Com>
        )
    })
}
export default RefAdapter
