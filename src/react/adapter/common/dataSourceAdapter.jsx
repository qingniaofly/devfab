import React, { useState, useEffect, forwardRef, useRef, useImperativeHandle } from 'react'

export function TableAdapter(Com) {
    return forwardRef((props, ref) => {
        const { children, table, ...rest } = props
        const _ref = useRef(null)

        function onActionCallback(action, record) {
            //
            debugger
        }

        return (
            <Com {...rest} {...table} ref={ref} onActionCallback={onActionCallback}>
                {children}
            </Com>
        )
    })
}
export default function DataSourceAdapter(Com) {
    return forwardRef((props, ref) => {
        const { children, ...rest } = props
        const _ref = useRef(null)
        // 加载数据
        const loadData = async (param) => {
            await new Promise((resolve) => setTimeout(resolve, 800))
            return new Promise((resolve) => {
                props.api?.list?.(param).then((res) => {
                    resolve(res)
                })
            })
        }

        function handleLoadData(data = {}) {
            const params = {
                billno: props.cardno || props.billno,
                data,
            }
            props.beforeSearch?.(params)
            _ref.current?.setLoading?.(true)
            loadData(params).then((res) => {
                const data = res.data
                props.beforeSetData?.(data)
                _ref.current?.setData?.(data)
                props.afterSetData?.(data)
                _ref.current?.setLoading?.(false)
            })
        }

        useEffect(() => {
            handleLoadData()

            return () => {
                //
            }
        }, [])

        useImperativeHandle(ref, () => {
            return {
                loadData: handleLoadData,
                ..._ref.current,
            }
        })

        return (
            <Com {...rest} ref={_ref}>
                {children}
            </Com>
        )
    })
}
