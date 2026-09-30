import adapter from './adapter'

const {
    RefAdapter,
    LabelAdapter, //
    ModelAdapter,
    BillAdapter,
    LoadMetaAdapter,
    PageModelAdapter,
    ExtendjsAdapter,
    BillListAdapter,
    DataSourceAdapter,
    DataSourceModelAdapter,
    FilterAdapter,
} = adapter

// 装饰器
// function decorator(adapter: any, o, args) {
//     if (args.beforeAdapter?.(o, o.adapterName) === false) {
//         return false
//     }
//     o.component = typeof adapter === 'function' ? adapter(o.component) : o.component
//     if (args.afterAdapter?.(o, o.adapterName) === false) {
//         return false
//     }
//     return true
// }

export default { adapter }
