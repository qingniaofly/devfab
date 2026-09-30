import React, { useEffect, forwardRef, useImperativeHandle, useRef } from 'react'

export default function FilterAdapter(Com) {
    return forwardRef((props, ref) => {
        const { children, vm, ...rest } = props
        const devfabBuilder = devfab.builder

        const _ref = useRef(null)

        const { FilterModel } = devfab.utils.models
        // 只在首次渲染时实例化，避免每次渲染都白创建一个模型
        const filterModel = useRef(null)
        if (!filterModel.current) {
            filterModel.current = new FilterModel(rest)
        }

        const filterVM = filterModel.current
        function onSearch() {
            filterVM.search()
        }

        function renderCondition(item, i) {
            const meta = Object.assign({}, item, { key: i, vm: filterVM })
            return devfabBuilder.render([meta])
        }

        useEffect(() => {
            const filterVM = filterModel.current
            filterVM.mounted()
            return () => {
                filterVM.unmounted()
            }
        }, [])
        useImperativeHandle(ref, () => {
            return {
                ref: filterModel.current,
            }
        }, [])
        return (
            <Com {...rest} onSearch={onSearch} renderCondition={renderCondition} ref={_ref}>
                {children}
            </Com>
        )
    })
}
