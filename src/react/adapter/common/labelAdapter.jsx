import React, { memo, useCallback, useContext, useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import classnames from 'classnames'

const LabelAdapter = (Com) => {
    return forwardRef((props, ref) => {
        const { children, ...rest } = props
        return (
            <div className="mini-control-block">
                <div className="mini-control-item">
                    <div className="mini-control-item-label">
                        <label className={classnames({ 'mini-control-item-required': rest.required })}>{props.label || props.children}</label>
                    </div>
                    <div className="mini-control-item-ctl">
                        <Com {...rest} ref={ref}>
                            {props.children}
                        </Com>
                    </div>
                </div>
            </div>
        )
    })
}
export default LabelAdapter
