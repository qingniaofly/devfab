import React, { useState, useEffect, forwardRef, useRef } from 'react'

// 宿主可能还在异步配置 requirejs 的 baseUrl / paths，
// 这里保留一段等待（可通过 extendDelay 覆盖），避免扩展脚本解析失败。
const EXTEND_LOAD_DELAY = 300

const LOADING_BLOCKS = [0, 1, 2, 3, 4]

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function LoadingPlaceholder(props) {
    return (
        <div className="full-screen" style={{ padding: 20, ...props.style }}>
            {LOADING_BLOCKS.map((item) => (
                <div key={item}>loading</div>
            ))}
        </div>
    )
}

/** 取出根 builder 上的 vm 容器，缺一个都给出可读报错而不是 TypeError */
function getRootVM(builder, adapterName) {
    const rootVM = builder?.get?.('vm')
    if (!rootVM) {
        console.log(`[error] ${adapterName}: builder.vm 不存在，请确认外层已使用 PageModelAdapter`)
    }
    return rootVM
}

export function PageModelAdapter(Com) {
    return forwardRef((props, ref) => {
        const devfabBuilder = devfab.builder
        const { ViewModel } = devfab.utils.models
        const [viewModel] = useState(() => {
            const vm = new ViewModel(props)
            vm._set_data('parentModel', props.vm)
            return vm
        })

        return <Com {...props} vm={viewModel} builder={devfabBuilder} />
    })
}

export function ExtendjsAdapter(Com) {
    return forwardRef((props, ref) => {
        const { vm } = props
        const [loadExtend, setLoadExtend] = useState(false)
        const billno = props.billno
        const extendjs = props.extendjs

        useEffect(() => {
            let cancelled = false
            const finish = () => {
                if (!cancelled) setLoadExtend(true)
            }

            const loadExtendScript = async () => {
                try {
                    if (!extendjs) {
                        console.log(`[info] ${billno} extendjs is not exist`)
                        finish()
                        return
                    }
                    const devfab = getRuntime()
                    if (typeof devfab.require !== 'function') {
                        // requirejs 未加载时直接跳过，避免整个页面卡在 loading
                        console.log(`[error] ${billno} devfab.require 不可用，跳过 ${extendjs}`)
                        finish()
                        return
                    }

                    await delay(props.extendDelay ?? EXTEND_LOAD_DELAY)
                    if (cancelled) return

                    console.log(`[info] ${billno} ${extendjs} load extend`)
                    devfab.require(
                        [extendjs],
                        function (extend) {
                            if (cancelled) return
                            console.log(`[info] ${billno} ${extendjs} load extend success`)
                            try {
                                extend?.init?.(vm)
                            } catch (err) {
                                console.log(`[error] ${billno} ${extendjs} error`, err)
                            }
                            finish()
                        },
                        function (error) {
                            if (cancelled) return
                            console.log(`[error] ${billno} ${extendjs} load extend error`, error)
                            finish()
                        }
                    )
                } catch (err) {
                    console.log(`[error] ${billno} ${extendjs} load extend error`, err)
                    finish()
                }
            }

            loadExtendScript()

            return () => {
                cancelled = true
            }
        }, [])

        return !loadExtend ? <LoadingPlaceholder style={{ position: 'relative' }} /> : <Com {...props} />
    })
}

export function BillListAdapter(Com) {
    return forwardRef((props, ref) => {
        const { children, ...rest } = props
        const _ref = useRef(null)
        const builder = props.builder
        const vm = props.vm

        useEffect(() => {
            const billno = props.billno
            console.log(`[info] ${billno} mount`)
            const rootVM = getRootVM(builder, 'BillListAdapter')
            rootVM?._set_data(billno, vm)
            vm._set_data('parentModel', rootVM)

            vm?.execute('afterMount')
            const filterModel = vm.get('filterModel')
            filterModel?.on('search', (params) => {
                vm.execute('loadData', params)
            })
            return () => {
                vm?.execute('afterUnMount')
                getRootVM(builder, 'BillListAdapter')?._del_data(billno)
            }
        }, [])

        return (
            <Com {...rest} ref={_ref}>
                {children}
            </Com>
        )
    })
}

export function BillAdapter(Com) {
    return forwardRef((props, ref) => {
        const { children, ...rest } = props
        const _ref = useRef(null)
        const builder = props.builder
        const vm = props.vm

        useEffect(() => {
            const billno = props.billno
            console.log(`[info] ${billno} mount`)
            getRootVM(builder, 'BillAdapter')?._set_data(billno, vm)

            vm?.execute('afterMount')
            return () => {
                vm?.execute('afterUnMount')
                getRootVM(builder, 'BillAdapter')?._del_data(billno)
            }
        }, [])

        return (
            <Com {...rest} ref={_ref}>
                {children}
            </Com>
        )
    })
}
