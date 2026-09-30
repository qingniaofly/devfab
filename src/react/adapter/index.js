import RefAdapter from './common/refAdapter'
import LabelAdapter from './common/labelAdapter'
import LoadMetaAdapter from './common/loadMetaAdapter'
import DataSourceAdapter from './common/dataSourceAdapter'

/* model适配 start */
import ModelAdapter from './model/modelAdapter'
import DataSourceModelAdapter from './model/dataSourceAdapter'
import { PageModelAdapter, BillListAdapter, BillAdapter, ExtendjsAdapter } from './model/pageAdapter'
import FilterAdapter from './model/filterAdapter'
/* model适配 end */

export default {
    RefAdapter,
    LabelAdapter, //
    LoadMetaAdapter,
    DataSourceAdapter,
    DataSourceModelAdapter,
    //
    PageModelAdapter,
    ExtendjsAdapter,
    BillListAdapter,
    ModelAdapter,
    BillAdapter,
    FilterAdapter,
}
