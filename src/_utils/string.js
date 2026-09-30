function QueryString(_url) {
    this.pathname = ''
    this.query = {}
    let url = _url

    this.init = function () {
        if (!url) {
            url = location.search
        }
        const index1 = url.indexOf('?')
        const index2 = url.indexOf('#')
        if (index1 >= 0) {
            this.pathname = url.substr(0, index1)
            url = index2 < 0 ? url.substr(index1 + 1) : url.substring(index1 + 1, index2)
            if (url.length > 0) {
                url = url.replace(/\+/g, ' ')
                const params = url.split('&')
                for (let i = 0, len = params.length; i < len; i++) {
                    const param = params[i] || ''
                    if (param) {
                        const index = param.indexOf('=')
                        let key = ''
                        let value = ''
                        if (index < 0) {
                            key = window.decode(param)
                            value = key
                        } else {
                            key = window.decode(param.substr(0, index))
                            value = window.decode(param.substr(index + 1))
                        }
                        this.query[key] = value
                    }
                }
            }
        } else {
            this.pathname = url
        }
    }

    this.set = function (key, value) {
        this.query[key] = value
    }

    this.get = function (key) {
        return this.query[key]
    }

    this.del = function (key) {
        delete this.query[key]
    }

    this.has = function (key) {
        return this.query[key] != null
    }

    this.toStr = function () {
        const items = ['?']
        for (const key in this.query) {
            items.push(encodeURIComponent(key))
            items.push('=')
            items.push(encodeURIComponent(this.query[key]))
            items.push('&')
        }
        if (items.length === 1) {
            return ''
        }
        items.splice(items.length - 1, 1)
        return items.join('')
    }

    this.init()
}
String.prototype['equalsIgnoreCase'] = function (str) {
    if (str == null) {
        return false
    }
    return this.toLowerCase() === str.toLowerCase()
}
export function _appendUrl(restUrl, params) {
    if (!params) {
        return restUrl
    }
    const queryStr = []
    const queryUrl = new QueryString(restUrl)
    for (const attr in params) {
        if (queryUrl.get(attr)) {
            continue
        }
        queryStr.push(`${attr}=${params[attr]}`)
    }
    if (!queryStr.length) {
        return restUrl
    }
    const queryString = queryStr.join('&')
    return restUrl.indexOf('?') >= 0 ? `${restUrl}&${queryString}` : `${restUrl}?${queryString}`
}

/**
 * 依据编码和名称生成uid
 * @param {*} code
 * @param {*} name
 * @returns
 */
export async function generateUID(code, name) {
    const data = { code, name }
    const stringData = JSON.stringify(data)
    const uint8 = new TextEncoder().encode(stringData)
    const hashBuffer = await crypto.subtle.digest('SHA-256', uint8)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
    return hashHex
}

export const base64 = {
    // 加密
    encode: (str) => {
        return window.btoa(str)
    },
    // 解密
    decode: (str) => {
        return window.atob(str)
    },
}
