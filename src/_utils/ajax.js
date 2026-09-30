import { _appendUrl } from './string'

function _getUrl(_url, params) {
    const url = _url
    return url
}

function getAllResponseHeaders(payload) {
    const { xhr } = payload
    const headerString = xhr.getAllResponseHeaders()
    const headers = {}
    headerString.split('\r\n').map((header) => {
        const [key, value] = header.split(': ')
        headers[key] = value
    })
    return headers
}

const AjaxRequestManager = {
    _xhrs: [],
    _jsonps: { index: 0 },
    // eslint-disable-next-line object-shorthand
    doRequest: function (_options) {
        const { onBeforeRequest, _onAfterRequest, ...options } = _options || {}
        const method = options.method || 'GET'
        let url = _getUrl(options.url, options)

        let headers
        try {
            if (options?.requestHeaders) {
                headers = options.requestHeaders
                options.requestHeaders = undefined
                delete options.requestHeaders
            }
        } catch (e) {
            console.log('[ajax]: [doRequest]: options["requestHeaders"] ERR : ', e)
        }
        try {
            if (options.params && options.params.requestHeaders) {
                headers = options.params.requestHeaders
                options.params.requestHeaders = undefined
                delete options.params.requestHeaders
            }
        } catch (e) {
            console.log('[ajax]: [doRequest]: options.params["requestHeaders"] ERR : ', e)
        }

        let queryJson = null
        if (method.equalsIgnoreCase('get') || method.equalsIgnoreCase('delete')) {
            url = _appendUrl(url, options.params)
        } else if (method.equalsIgnoreCase('post') || method.equalsIgnoreCase('put')) {
            queryJson = JSON.stringify(options.params)
        }
        if (options.jsonp) {
            return this.getJsonp(url, options.callback)
        }
        const xhr = this.getXMLHttpRequest()
        if (!xhr) {
            return
        }
        xhr.open(method, url, options.async !== false)
        // cb.rest.handlePendingRequestsState({ type: 'add', options }) // 处理请求是否完成状态管理
        if (options.timeout) {
            xhr.timeout = options.timeout
            xhr.setRequestHeader('timeout', options.timeout)
            xhr.ontimeout = function () {
                AjaxRequestManager.onerror(this, options, 'timeout')
            }
        }
        if (options.contentType) {
            // 支持x-www-form-urlencode的方式
            xhr.setRequestHeader('Content-Type', options.contentType)
            if (options.contentType.indexOf('x-www-form-urlencoded') >= 0) {
                queryJson = new URLSearchParams(options.params)?.toString()
            }
        } else if (options.dateType) {
            // 因上传文件参数为file格式,不需要JSON.stringify转化(转化后为空对象),也不需要设置请求头
            queryJson = options.params
        } else {
            xhr.setRequestHeader('Content-Type', 'application/json;charset=utf-8')
        }
        if (options.domainKey) {
            xhr.setRequestHeader('Domain-Key', options.domainKey)
        }

        try {
            if (headers && Object.prototype.toString.call(headers) === '[object Object]') {
                for (const key in headers) {
                    xhr.setRequestHeader(key, headers[key])
                }
            }
        } catch (e) {
            console.log('[ajax]: [doRequest]: options.params["requestHeaders"] ERR : ', e)
        }
        // eslint-disable-next-line no-prototype-builtins
        xhr.withCredentials = options?.hasOwnProperty('withCredentials') ? options.withCredentials : true

        try {
            xhr.send(queryJson)
        } catch (e) {
            // 增加断网情况下的容错处理，返回固定error和请求相关信息
            return { error: 'NetWorkError', options }
        }
        if (options.async === false) {
            onBeforeRequest?.(options)
            return this.onreadystatechange(xhr, options)
            // eslint-disable-next-line no-else-return
        } else {
            xhr.onreadystatechange = function () {
                AjaxRequestManager.onreadystatechange(this, options)
            }
        }
        onBeforeRequest?.(options)
    },
    // eslint-disable-next-line object-shorthand
    beforeReadystatechange: function (xhr, options, callback) {
        callback?.()
    },
    // eslint-disable-next-line object-shorthand
    onreadystatechange: function (xhr, _options) {
        const { _onBeforeRequest, onAfterRequest, ...options } = _options || {}
        if (xhr.readyState !== 4) {
            return
        }
        onAfterRequest?.()
        if (xhr.status === 200) {
            // 兼容返回的数据不是json结构的错误处理
            let ajaxResult
            try {
                // 处理二进制文件返回值（暂时处理一种，后续需要其他类型再加）
                if (options.responseType === 'blob') {
                    const headers = getAllResponseHeaders({ xhr })
                    ajaxResult = { code: xhr.status, data: { data: xhr.response, headers } }
                } else {
                    ajaxResult = JSON.parse(xhr.responseText)
                }
            } catch {
                AjaxRequestManager.onerror(xhr, options, xhr.responseText)
            }
            if (options.async === false) {
                xhr.isBusy = false
                if (options.precallback) {
                    options.precallback(ajaxResult)
                }
                // AjaxRequestManager.pushError(options, ajaxResult?.code, ajaxResult?.message, true)
                return AjaxRequestManager.processAjaxResult(ajaxResult, false, null, null, options, xhr)
            }
            // AjaxRequestManager.pushError(options, ajaxResult?.code, ajaxResult?.message, true)
            AjaxRequestManager.processAjaxResult(ajaxResult, options.async, options.callback, options.context, options, xhr)
            if (options.precallback) {
                options.precallback(ajaxResult)
            }
        } else if (xhr.status === 0) {
            AjaxRequestManager.onerror(xhr, options, '网络连接已断开，请检查设备网络状态后重试')
        } else if (xhr.status === 502 || xhr.status === 504) {
            AjaxRequestManager.onerror(xhr, options, '服务出错了，请稍后再试')
        } else if (xhr.status === 401) {
            AjaxRequestManager.onerror(xhr, options, '登录信息失效，请重新登录或联系技术人员')
        } else {
            let messageObj = {}
            try {
                const message = JSON.parse(xhr.responseText)
                messageObj = message
            } catch {
                messageObj = {
                    code: xhr.status,
                    message: xhr.responseText,
                }
            }
            // AjaxRequestManager.pushError(options, messageObj.code, messageObj.message)
            return AjaxRequestManager.onerror(xhr, options, messageObj)
        }
        xhr.isBusy = false
    },
    // eslint-disable-next-line object-shorthand
    onerror: function (xhr, options, message) {
        const errorType = 'Error.E01000'
        const errorMessage = `[ajax]: [onerror]: 接口返回错误 \n    [状态码]: ${xhr.status} \n    [错误信息]: ${(typeof message === 'object' ? JSON.stringify(message) : message) || '空'} \n    [请求地址]: ${options.url} \n    [浏览器Token]: ${document.cookie}`
        console.log(errorType, errorMessage)
        const ajaxResult = typeof message === 'object' ? message : { code: 500, message }
        if (options.precallback) {
            options.precallback(ajaxResult)
        }
    },
    // eslint-disable-next-line object-shorthand
    getXMLHttpRequest: function () {
        return this.createXMLHttpRequest()
    },

    // eslint-disable-next-line object-shorthand
    createXMLHttpRequest: function () {
        const xhr = window.XMLHttpRequest ? new XMLHttpRequest() : window.ActiveXObject ? new window.ActiveXObject('Microsoft.XMLHTTP') : null
        return xhr
    },
    // eslint-disable-next-line object-shorthand
    getJsonp: function (_url, callback) {
        let url = _url
        // eslint-disable-next-line prefer-template
        const responseCallback = 'callback' + this._jsonps.index++
        const scriptDom = document.createElement('script')
        this._jsonps[responseCallback] = function (data) {
            try {
                callback(data)
            } finally {
                document.body.removeChild(scriptDom)
            }
        }
        // eslint-disable-next-line prefer-template
        url += url.indexOf('?') === -1 ? '?' : '&callback=cb.rest.AjaxRequestManager._jsonps.' + responseCallback
        scriptDom.src = url
        document.body.appendChild(scriptDom)
    },
    // eslint-disable-next-line object-shorthand
    processAjaxResult: function (ajaxResult, async, callback, context, options, xhr) {
        if (!ajaxResult) {
            return
        }
        if (!ajaxResult.code) {
            if (async === false) {
                return ajaxResult
            }
            if (callback) {
                callback.call(context, null, ajaxResult)
            }
            return
        }
        // eslint-disable-next-line eqeqeq
        if (ajaxResult.code == 200) {
            if (async === false) {
                return { result: ajaxResult.data }
            }
            if (callback) {
                callback.call(context, null, ajaxResult.data, ajaxResult.message, ajaxResult.errorDetail, ajaxResult.code, ajaxResult.displayCode && ajaxResult)
            }
        } else {
            if (async === false) {
                return { error: ajaxResult }
            }
            if (callback) {
                callback.call(context, ajaxResult)
            }
        }
    },
}

export default function ajax(url, options) {
    options.url = url
    // if (cb.rest.ajaxPreprocess && cb.rest.ajaxPreprocess(options) === false) return
    return AjaxRequestManager.doRequest(options)
}
