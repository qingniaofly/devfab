import React, { useState, useEffect, forwardRef, useRef, useImperativeHandle } from 'react'

export default function DataSourceModelAdapter(Com) {
    return forwardRef((props, ref) => {
        const { children, vm, ...rest } = props
        const _ref = useRef(null)

        function beforeSearch(params) {
            vm?.execute('beforeSearch', params)
        }

        function beforeSetData(data) {
            vm?.execute('beforeSearch', data)
        }
        function afterSetData(data) {
            vm?.execute('beforeSearch', data)
        }

        function handleLoadData(param) {
            _ref.current?.loadData(param)
        }

        useEffect(() => {
            vm.on('loadData', handleLoadData)

            return () => {
                vm.un('loadData', handleLoadData)
            }
        }, [])

        const parentModel = vm.get('parentModel')
        const api = Object.assign(parentModel?.get('api')?.bill || {}, props.api || {})
        return (
            <Com
                {...rest}
                ref={_ref}
                api={api}
                beforeSearch={beforeSearch} //
                beforeSetData={beforeSetData}
                afterSetData={afterSetData}
            >
                {children}
            </Com>
        )
    })
}
