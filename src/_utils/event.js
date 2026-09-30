class EventUtil {
    constructor(args) {
        this._init(args)
    }

    _init(args) {
        this.__ASYNC_EXECUTE__ = args?.__ASYNC_EXECUTE__ ?? true
        this.events = new Map()
        this.firstevents = new Map()
    }

    on(name, callback, context) {
        let fnList = this.events.get(name)
        if (!Array.isArray(fnList)) {
            fnList = []
        }
        fnList.push({ callback, context })
        this.events.set(name, fnList)
    }

    onFirst(name, callback, context) {
        let fnList = this.firstevents.get(name)
        if (!Array.isArray(fnList)) {
            fnList = []
        }
        fnList.splice(0, 0, { callback, context })
        this.firstevents.set(name, fnList)
    }

    execute(name, ...args) {
        const events = this.events.get(name)
        const firstevents = this.firstevents.get(name)
        if (!events && !firstevents) {
            return true
        }
        let result = true
        const allEvents = [...(firstevents || []), ...(events || [])]
        allEvents.forEach((item) => {
            if (result === false) {
                return
            }
            const returnData = item.callback.apply(item.context || undefined, args)
            result = returnData === false ? false : result
        })
        return result
    }

    un(name, callback) {
        this._unEvents(name, callback, this.events)
        this._unEvents(name, callback, this.firstevents)
    }

    _unEvents(name, callback, events) {
        if (!name || !events.has(name)) {
            return
        }
        if (!callback) {
            events.delete(name)
        } else {
            const fnList = events.get(name)
            const index = fnList?.findIndex((item) => item.callback === callback)
            if (index !== -1) {
                fnList?.splice(index, 1)
            }
        }
    }

    hasEvent(name) {
        if (!name) {
            return 0
        }
        const eventsLen = this.events.get(name)?.length || 0
        const firsteventsLen = this.firstevents.get(name)?.length || 0
        return eventsLen + firsteventsLen
    }

    fireEvent(eventName, args) {
        if (!this.execute(`before${eventName}`, args)) {
            return
        }
        this.execute(eventName, args)
        this.execute(`after${eventName}`, args)
    }

    _asyncExecute(name, events, params) {
        const { resolve, reject, args } = params
        let result = true
        const allEvents = events || []
        let promiseResult = false
        for (let i = 0; i < allEvents.length; i++) {
            // if (i == allEvents.length - 1) {
            //   console.warn('最后一次啦', name)
            // }
            const event = allEvents[i]
            if (result === false) {
                break
            }
            if (promiseResult) {
                return
            }
            let returnData
            if (process.env.nodeEnv === 'development') {
                returnData = event.callback.apply(event.context || this, args)
            } else {
                try {
                    returnData = event.callback.apply(event.context || this, args)
                } catch (e) {
                    if (!e.isAddedMsg) {
                        e.message = `(领域扩展事件执行失败，请打开控制台查看详细错误信息并修复):${e.message}` // @notranslate
                    }
                    e.isAddedMsg = true
                    throw e
                }
            }
            if (returnData instanceof Promise) {
                promiseResult = true
                result = returnData
                result.callbacks &&
                    result.callbacks.push({
                        reject: () => {
                            result.reject()
                            if (i === allEvents.length - 1) {
                                reject?.()
                            }
                        },
                        resolve: (res) => {
                            if (i === allEvents.length - 1) {
                                args.length > 1 && (args[0] = res)
                                resolve?.(args)
                            } else {
                                this._asyncExecute(name, allEvents.slice(i + 1), { resolve, reject, args })
                            }
                        },
                    })
                // 这里是因为下面promiseExecute里历史代码判定如果是undefined也会认为是false，但是此时是阻断机制所以不能不返回内容
                // 但是这里有个额外的问题，就是如何让事件队列全结束才执行promiseExecutue的callback也就是then？
                // return result;
            } else {
                result = returnData === false ? false : result
                if (i === allEvents.length - 1) {
                    result ? resolve?.(args) : reject?.()
                }
            }
        }
        return result
    }
    _asyncPromiseExecute(name, resolve, reject, args) {
        const events = this.events.get(name)
        const firstevents = this.firstevents.get(name)
        if ((Array.isArray(events) ? !events.length : !events) && (Array.isArray(firstevents) ? !firstevents.length : !firstevents)) {
            return resolve?.()
        }
        const allEvents = [...(firstevents || []), ...(events || [])]
        return this._asyncExecute(name, allEvents, { resolve, reject, args })
    }

    promiseExecute(check, eventName, ...rest) {
        let name = check
        let sliceStart = 1
        if (typeof check === 'boolean') {
            name = eventName
            sliceStart = 2
        }
        if (!name) {
            return
        }
        // 使用 rest 参数替代 arguments，根据 sliceStart 构造参数数组，行为与原 slice.call(arguments, sliceStart) 一致
        const args = sliceStart === 2 ? rest : [eventName, ...rest]
        if (!args.length) {
            return
        }
        const callbackIndex = args.length - 1
        let callback = args[callbackIndex]
        let errCallBack
        if (typeof callback !== 'function') {
            if (typeof callback === 'object' && callback[0] && typeof callback[0] === 'function' && callback[1] && typeof callback[1] === 'function') {
                errCallBack = callback[1]
                callback = callback[0]
            } else {
                return
            }
        }
        const __ASYNC_EXECUTE__ = this.__ASYNC_EXECUTE__
        if (__ASYNC_EXECUTE__) {
            return this._asyncPromiseExecute(
                name,
                (args) => {
                    callback.apply(this, args)
                },
                () => {
                    if (errCallBack && typeof errCallBack === 'function') {
                        errCallBack()
                    }
                },
                args
            )
        }
        // 非__ASYNC_EXECUTE__的时候参数处理放下面
        args.splice(callbackIndex, 1)
        args.unshift(name)
        const returnData = this.execute.apply(this, args)
        if (returnData instanceof Promise) {
            const self = this
            /**
             * 背景参考下面的else注释，当第二次命中这里的时候，会在promise执行的时候直接then了，因为没有重新走一遍判定，这里直接执行了callback
             * 解决方案：想着是想办法把then里的代码作为callback传进去最后在执行，但是没想到方案
             */
            returnData.then(
                (...args) => {
                    callback.apply(self, args)
                },
                () => {
                    if (errCallBack && typeof errCallBack === 'function') {
                        errCallBack()
                    }
                }
            )
        } else {
            /*
      这里是因为历史代码没有考虑promise得情况 导致直接使用!returnData做结果判定，但是undefined也会命中false 导致后续执行阻断，不做callback了，所以会有问题，加了下面代码还是有问题，因为如果命中了promise得话没有返回值
      导致命中不了returnData === false 导致阻断，所以上面execute里promise的时候将整个results返回，但是加了还有另外的问题，就是如果有两个分开的promise 会导致第一次好使，第二次命中了上面的if
      */
            // if (window.__ASYNC_EXECUTE__ ? returnData === false : !returnData) {
            if (!returnData) {
                if (errCallBack && typeof errCallBack === 'function') {
                    errCallBack()
                }
                return
            }
        }
        // let name
        // let args
        // if (typeof check === 'boolean') {
        //     name = eventName
        //     args = restArgs
        // } else {
        //     name = check
        //     args = restArgs
        // }
        // if (!name) {
        //     return
        // }
        // if (!args.length) {
        //     return
        // }

        // const callbackIndex = args.length - 1
        // let callback = args[callbackIndex]
        // let errCallBack

        // if (typeof callback !== 'function') {
        //     if (Array.isArray(callback) && callback[0] && typeof callback[0] === 'function' && callback[1] && typeof callback[1] === 'function') {
        //         errCallBack = callback[1]
        //         callback = callback[0]
        //     } else {
        //         return
        //     }
        // }
        // args.splice(callbackIndex, 1)

        // const returnData = this.execute.apply(this, [name, ...args])
        // if (returnData instanceof Promise) {
        //     returnData.then(
        //         (...resultArgs) => {
        //             callback.apply(this, resultArgs)
        //         },
        //         () => {
        //             if (errCallBack && typeof errCallBack === 'function') {
        //                 errCallBack()
        //             }
        //         }
        //     )
        // } else {
        //     if (!returnData) {
        //         if (errCallBack && typeof errCallBack === 'function') {
        //             errCallBack()
        //         }
        //         return
        //     }
        //     callback.call(this)
        // }
    }

    clearEvents() {
        this.events.clear()
        this.firstevents.clear()
    }
}
export default EventUtil
