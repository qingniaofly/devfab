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

function _initExtendJs(args) {
    const self = this
    if (window && window.__debugger_initExtendJs) {
        // eslint-disable-next-line no-debugger
        debugger
    }
    const {
        require: _require,
        extendFilePath,
        pageKey,
        enableExtendJs = true, // 是否启用拓展脚本
        extendJsPath = '_VM.Extend.js', // 拓展脚本格式
    } = args || {}
    if (!enableExtendJs) {
        self.execute('extendReady', self)
        return
    }
    const extendFile = `${pageKey}${extendJsPath}`
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
        extendFilePath,
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

const _extscripturls = async (result, vm) => {
    let { extscripturls: exturls = [] } = result
    // 支持注入单据级本地化扩展脚本
    exturls = (vm.getCache('localDynamicScripts') || []).concat(exturls)

    // 支持给全单据注入扩展脚本
    exturls = exturls.concat(window.__devfab__EXT_BILL_SCRIPTS__ || [])

    // 支持参数注入扩展脚本
    if (vm.getParams()?.initVMExtUrls) {
        exturls = exturls.concat([vm.getParams().initVMExtUrls])
    }

    // 预处理扩展脚本
    if (exturls?.length) {
        exturls = [...new Set(exturls)]
        exturls = await Promise.all(
            exturls.map(async (url) => {
                return url
            })
        )
    }
    // 加载扩展脚本
    result.extscripturls = exturls
    return new Promise((resolve, reject) => {
        _requireExtscripturls(result, vm, () => {
            resolve(true)
        })
    })
}

function _requireExtscripturls(result, vm, callback) {
    // 二开、客开的扩展脚本
    const { extscripturls: exturls = [] } = result
    if (exturls?.length) {
        try {
            // 使用 rest 参数替代 arguments，符合 prefer-rest-params 规则
            window.__devfab.requireInner(
                exturls,
                // eslint-disable-next-line prefer-arrow-callback
                function (...args) {
                    // cb.console.info('[exturls]: %c [extscript js] cb.requireInner success and doAction[init]', 'color:green')
                    let correct = true
                    if (args.length) {
                        for (let i = 0, len = args.length; i < len; i++) {
                            const external = args[i]
                            if (external) {
                                external.doAction('init', vm)
                            } else {
                                correct = false
                            }
                        }
                        if (correct) {
                            callback?.(result, vm)
                        }
                    } else {
                        correct = false
                    }
                    if (!correct) {
                        console.log('[error] [extendjs] 租户级扩展脚本有语法错误，请修改正确后刷新浏览器重试！')
                    }
                },
                // eslint-disable-next-line prefer-arrow-callback
                function (_error) {
                    // cb.console.info('[exturls]: %c [extscript js] cb.requireInner, but notFound', 'font-size:12pt;color:#860786')
                    callback?.(result, vm)
                }
            )
        } catch (e) {
            // cb.console.log('[exturls]: %c [extscript js] cb.requireInner exception', 'font-size:12pt;color:#860786', e)
            callback?.(result, vm)
        }
    } else {
        callback?.(result, vm)
    }
}
function _createViewModel(meta, params) {
    let _require = window.__devfab?.require
    const {
        extendFilePathField = 'domainKey',
        pageKeyField = 'billNo',
        modelNameField = 'cName', // 用于生成模型的字段
    } = params || {}
    if (params?.require) {
        _require = params?.require
    }
    const extendFilePath = meta[extendFilePathField] || ''
    const pageKey = meta[pageKeyField] || ''

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
            _initExtendJs.call(this, { ...params, require: _require, extendFilePath, pageKey })
        }
    }

    VM.prototype.modelType = 'ViewModel'
    return VM
}

function _initViewModel(meta, params) {
    const VM = _createViewModel(meta, params)
    const vm = new VM()
    vm.init(meta.models, meta)
    return vm
}

export function initViewModel(meta, params, callback) {
    let vm = _initViewModel(meta, params)
    vm.on('destroyVM', () => {
        vm?.destroyVM?.()
        vm = null
    })
    vm.on('extendReady', async () => {
        const promises = []
        // 加载二开脚本
        promises.push(_extscripturls(meta, vm))
        await Promise.all(promises)
        // console.info(`[initVM]: after vm init ${  moment().format('YYYY-MM-DD HH:mm:ss.SSS')}`)
        callback?.(vm, meta)
    })
    vm.initData()
    return vm
}

export { BaseModel, FilterModel, SimpleModel, ViewModel, GridModel }
export default {
    BaseModel,
    FilterModel,
    SimpleModel,
    GridModel,
    ViewModel,
    initViewModel,
}
