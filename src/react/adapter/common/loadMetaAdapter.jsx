import React, { useState, useEffect, forwardRef, useRef } from 'react'

export default function LoadMetaAdapter(Com) {
    return forwardRef((props, ref) => {
        const { children, getViewMeta, ...rest } = props
        const [loadMeta, setLoadMeta] = useState(false)
        const [meta, setMeta] = useState(undefined)
        useEffect(() => {
            if (typeof getViewMeta !== 'function') {
                console.log('[error] getViewMeta is not function', getViewMeta)
                return
            }
            const billno = props.billno
            console.log(`[info] ${billno} load meta`)
            getViewMeta(billno)
                ?.then((res) => {
                    setLoadMeta(true)
                    setMeta(res)
                    console.log(`[info] ${billno} load meta success`, res)
                })
                .catch((err) => {
                    console.log(`[error] ${billno} load meta error`, err)
                })
        }, [])

        return !loadMeta ? (
            <div className="full-screen" style={{ padding: 20 }}>
                {[1, 2, 3, 4, 5].map((item, index) => {
                    return <div>loading</div>
                })}
            </div>
        ) : (
            <Com {...rest} {...meta} ref={ref}>
                {children}
            </Com>
        )
    })
}
