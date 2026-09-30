import BaseModel from './BaseModel'

export default class FilterModel extends BaseModel {
    mounted() {
        const _conditions = this.get('conditions')
        const conditions = []
        const params = {}
        _conditions.forEach((r) => {
            const model = this.get(r.name)
            params[r.name] = r.defaultValue
            conditions.push(model)
        })
        this._set_data('params', params)
    }

    unmounted() {
        this._set_data('params', {})
        this._set_data('conditions', [])
    }

    getParams() {
        const params = {}
        const conditions = this.get('conditions')
        conditions.forEach((r) => {
            const model = this.get(r.name)
            params[r.name] = model?.getValue()
        })
        this._set_data('params', params)
        return params
    }

    search() {
        const params = this.getParams()
        this.execute('search', params)
    }
}
