import BaseModel from './BaseModel'
import GridModel from './GridModel'

export default class ViewModel extends BaseModel {
    getParams() {
        return this._get_data('params')
    }

    setParams(params) {
        this._set_data('params', params, true)
    }

    set(propertyName, value) {
        if (value instanceof BaseModel) {
            value.setParent(this)
            value.setName(propertyName)
        }
        this._set_data(propertyName, value, true)
    }

    setData(data) {
        for (const propertyName in data) {
            this.addProperty(propertyName, data[propertyName])
        }
    }

    addProperty(propertyName, value) {
        const property = this.get(propertyName)
        if (property?.setData) {
            property.setData(value)
        } else {
            this.set(propertyName, value)
        }
    }

    getData() {
        const propertyNames = this._get_data('propertyNames') || []
        const data = {}
        propertyNames.forEach((propertyName) => {
            const property = this.get(propertyName)
            if (property instanceof BaseModel && property._get_data('needCollect') !== false) {
                data[propertyName] = property.getData?.()
            }
        })
        return data
    }

    /**
     * 收集全部属性数据
     * @param withOutGrid 为 true 时跳过标记了 isGrid 的子模型（子表格）
     */
    getAllData(withOutGrid) {
        const propertyNames = this._get_data('propertyNames') || []
        const rawData = {}
        propertyNames.forEach((propertyName) => {
            const property = this.get(propertyName)
            if (!(property instanceof BaseModel) || property._get_data('needCollect') === false) {
                return
            }
            if (withOutGrid && property._get_data('isGrid')) {
                return
            }
            const value = property.getData?.()
            if (value !== undefined) {
                rawData[propertyName] = value
            }
        })
        return rawData
    }

    removeProperty(propertyName) {
        const propertyNames = this._get_data('propertyNames') || []
        const index = propertyNames.indexOf(propertyName)
        if (index !== -1) {
            propertyNames.splice(index, 1)
        }
        this._del_data(propertyName)
    }

    loadData(data) {
        this.setCache('isLoadData', true)
        this.clear()
        this.setData(data)
        this.setDirty(false)
        this.setCache('isLoadData', false)
    }

    clear(useDefault) {
        const propertyNames = this._get_data('propertyNames') || []
        propertyNames.forEach((propertyName) => {
            const property = this.get(propertyName)
            if (property instanceof BaseModel && property._get_data('needClear') !== false) {
                property.clear?.(useDefault)
            }
        })
    }

    setDirty(dirty) {
        if (dirty) {
            this._set_data('isDirty', true)
            return
        }
        this._del_data('isDirty')
        this._set_data('originalData', this.getData())
    }

    getGridModel(propertyName) {
        if (propertyName) {
            return this.get(propertyName)
        }
        let gridModel = this._get_data('gridModel')
        if (gridModel) {
            return gridModel
        }
        const masterGridModelName = this.getParams()?.masterGridModelName
        if (masterGridModelName) {
            return this.get(masterGridModelName)
        }
        const propertyNames = this._get_data('propertyNames')
        for (let i = 0, len = propertyNames.length; i < len; i++) {
            gridModel = this.get(propertyNames[i])
            const isGridModel = gridModel instanceof GridModel || gridModel.modelType == 'GridModel'
            if (isGridModel) {
                this._set_data('gridModel', gridModel)
                return gridModel
            }
        }
    }

    getGridModels() {
        const propertyNames = this._get_data('propertyNames')
        const gridModels = []
        for (let i = 0, len = propertyNames.length; i < len; i++) {
            const gridModel = this.get(propertyNames[i])
            const isGridModel = gridModel instanceof GridModel || gridModel.modelType == 'GridModel'
            if (isGridModel) {
                gridModels.push(gridModel)
            }
        }
        return gridModels
    }
}
