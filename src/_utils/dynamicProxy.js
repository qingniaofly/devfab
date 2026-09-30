import { _appendUrl } from './string'
import ajax from './ajax'

function DynamicProxy(config, query) {
    if (this.init) {
        this.init(config)
    }
    this.queryParams = query
}

DynamicProxy.create = function (config, query) {
    return new DynamicProxy(config, query)
}

DynamicProxy.prototype.init = function (config) {
    if (!config) {
        return
    }
    this.config = config
    for (const attr in this.config) {
        // eslint-disable-next-line wrap-iife
        this[attr] = (function (attr) {
            return function (data, callback, context) {
                return this.Do(attr, data, callback, null, context)
            }
        })(attr)
        // eslint-disable-next-line wrap-iife
        this[`${attr}Sync`] = (function (attr) {
            return function (data) {
                return this.Do(attr, data, null, false)
            }
        })(attr)
    }
}

DynamicProxy.prototype.Do = function (op, data, callback, async, context) {
    if (!this.config || !this.config[op] || !this.config[op].url) {
        return
    }
    const config = this.config[op]
    let url = config.url
    if (!this.queryParams) {
        this.queryParams = {}
    }
    if (config.options?.proxyServiceCode) {
        this.queryParams.serviceCode = config.options.proxyServiceCode
    }
    if (config.options?.billnum) {
        this.queryParams.billnum = config.options.billnum
    }
    if (this.queryParams?.serviceCode) {
        url = _appendUrl(url, this.queryParams)
    }
    const restUrl = url
    const options = Object.assign({}, config.options)
    options.method = config.method || 'GET'
    if (typeof data === 'function') {
        options.callback = data
        options.context = context || options.context || this
    } else {
        options.params = data
    }
    if (callback) {
        options.callback = callback
        options.context = context || options.context || this
    }
    if (async === false) {
        options.async = false
    }
    return this.ajax(restUrl, options)
}

DynamicProxy.prototype.ajax = function (url, options) {
    // if (!cb.events?.execute('beforeProxyRequest', { url, options })) {return}
    return ajax(url, options)
}

export default DynamicProxy
