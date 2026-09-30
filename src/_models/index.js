import BaseModel from './BaseModel'
import FilterModel from './FilterModel'
import SimpleModel from './SimpleModel'
import ViewModel from './ViewModel'
import GridModel from './GridModel'

function createModelFactory(props) {
    const cControlType = props.cControlType.toLowerCase()
    let model
    switch (cControlType) {
        case 'input':
            model = new SimpleModel(props)
            break
        default:
            break
    }
    return model
}
export function createViewModel(meta, params) {
    let _require = window.__devfab?.require
    const {
        domainKeyField = 'domainKey',
        billNoField = 'billNo',
        modelNameField = 'modelName',
        enableExtendjs = true, // 是否启用拓展脚本
    } = params || {}
    if (params?.require) {
        _require = params?.require
    }
    const domainKey = meta[domainKeyField] || ''
    const billno = meta[billNoField]

    class VM extends ViewModel {
        init(_models, meta) {
            const fields = this.createModels(_models, meta)
            this.setData(fields)
            this.setDirty(false)
        }

        createModels(_models, meta) {
            const fields = {}
            const models = Array.isArray(_models) ? _models : []
            models.forEach((m) => {
                let model = params?.createModelFactory?.(m)
                if (!model) {
                    model = createModelFactory(m)
                }
                const param = { model, field: m, meta }
                params?.onBeforeCreateModel?.(param)
                fields[m[modelNameField]] = param.model
            })
            return fields
        }

        initData() {
            this.initExtendJs()
        }

        initExtendJs() {
            if (window && window.__debugger_initExtendJs) {
                // eslint-disable-next-line no-debugger
                debugger
            }
            const self = this
            if (!enableExtendjs) {
                self.execute('extendReady', self)
                return
            }
            const extendFile = `${billno}_VM.Extend.js`
            const extendFiles = [extendFile]
            // if (self.getEnv && self.getEnv('everyCommonExtend')) {
            // 	extendFiles.push(self.getEnv('everyCommonExtend'))
            // }
            if (typeof _require !== 'function') {
                console.warn(`requirejs.js 未加载，跳过扩展脚本：${extendFile}`)
                self.execute('extendReady', self)
                return
            }
            _require(
                domainKey,
                extendFiles,
                (extend, everyCommonExtend) => {
                    if (extend && extend.doAction) {
                        // 处理扩展脚本异常导致渲染失败
                        try {
                            extend.doAction('init', self)
                            if (everyCommonExtend) {
                                everyCommonExtend.doAction('init', self)
                            }
                        } catch (err) {
                            console.error('扩展脚本异常：', err)
                        }
                    } else {
                        console.error(`${extendFile}扩展文件extend.*.min.js文件加载失败 或 未注册扩展脚本`)
                    }
                    self.execute('extendReady', self)
                },
                (err) => {
                    console.warn(`未找到扩展脚本：${extendFile}错误信息：`, err)
                    self.execute('extendReady', self)
                }
            )
        }
    }

    VM.prototype.modelType = 'ViewModel'
    return VM
}

export function initViewModel(meta, params) {
    const ContainerModel = createViewModel(meta, params)
    const vm = new ContainerModel()
    vm.init(meta.models, meta)
    return vm
}

export { BaseModel, FilterModel, SimpleModel, ViewModel, GridModel }
export default {
    BaseModel,
    FilterModel,
    SimpleModel,
    GridModel,
    ViewModel,
    createViewModel,
    initViewModel,
}
