class CacheUtil {
    constructor(args) {
        this._init(args)
    }
    _init(args) {
        this.cache = Object.assign({}, args)
    }
    set(key, value) {
        this.cache[key] = value
    }

    get(key) {
        return this.cache?.[key]
    }

    clear(key) {
        delete this.cache[key]
    }
}

export default CacheUtil
