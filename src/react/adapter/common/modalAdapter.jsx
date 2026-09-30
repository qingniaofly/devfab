import React, { useState, useEffect, memo, forwardRef } from 'react'

const ModalAdapter = function (Modal, Com) {
    return forwardRef((props, ref) => {
        const { children, width = 800, visible = true, ...rest } = props
        const className = props.className || ''

        return (
            <Modal
                title={props.title}
                maskClosable={false}
                open={visible}
                onCancel={() => {
                    props?.onClose?.(props.menu)
                }}
                footer={null}
                destroyOnClose
                width={width}
                wrapClassName={className}
                {...rest}
                ref={ref}
            >
                <Com {...props} />
            </Modal>
        )
    })
}

export default ModalAdapter
