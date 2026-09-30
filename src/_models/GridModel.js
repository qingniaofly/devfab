import BaseModel from './BaseModel'

export const DataStates = {
    Unchanged: '',
    Insert: 'Insert',
    Update: 'Update',
    Delete: 'Delete',
}

// 表格形态的控件写法（models/index.js 的工厂用）
export const GRID_TYPES = ['table', 'grid', 'vxegrid', 'vxe-grid']

const DEFAULT_PAGE_SIZE = 20

const isArray = Array.isArray
const isEmpty = (value) => value === undefined || value === null || value === ''
const isEmptyObject = (value) => !value || Object.keys(value).length === 0

function cloneDeep(value) {
    if (isArray(value)) return value.map(cloneDeep)
    if (value instanceof Date) return new Date(value.getTime())
    if (value && typeof value === 'object') {
        const result = {}
        for (const key in value) result[key] = cloneDeep(value[key])
        return result
    }
    return value
}

// ---------------- 列：数组 ↔ object map 归一 ----------------

/**
 * 列统一收敛成 object map（key = field），与中台一致。
 * 入参既接受数组（我们自己写 meta 的习惯），也接受后端下发的 map。
 */
function normalizeColumns(columns) {
    const map = {}
    const list = isArray(columns) ? columns : Object.keys(columns || {}).map((key) => ({ ...(columns[key] || {}), field: columns[key]?.field || key }))
    list.forEach((column, index) => {
        if (!column) return
        const field = column.field || column.cCaption || column.cFieldName || `col_${index}`
        map[field] = {
            ...column,
            field,
            // 中台里列有 fieldName / cCaption 两套命名，这里都兜住
            fieldName: column.fieldName || field,
            cCaption: column.cCaption || field,
            index: column.index === undefined ? index : column.index,
        }
    })
    return map
}

// ---------------- 响应体：从各种后端结构里取行与总数 ----------------

function resolveRowsData(res) {
    if (!res) return []
    if (isArray(res)) return res
    if (isArray(res.data)) return res.data
    if (isArray(res.records)) return res.records
    if (isArray(res.list)) return res.list
    if (isArray(res.rows)) return res.rows
    const nested = res.data && typeof res.data === 'object' ? res.data : res.result
    if (isArray(nested)) return nested
    if (nested && typeof nested === 'object') return nested.records || nested.list || nested.rows || nested.data || []
    return []
}

function resolveTotal(res, rows) {
    const holders = [res?.paging, res?.page, res?.data, res?.result, res]
    for (const holder of holders) {
        if (holder && typeof holder.total === 'number') return holder.total
        if (holder && typeof holder.totalCount === 'number') return holder.totalCount
        if (holder && typeof holder.recordCount === 'number') return holder.recordCount
    }
    return rows.length
}

/** 给行补内部 id（没有主键时用 rowId_ 前缀，与中台一致） */
function setIds(rows = []) {
    const idFlag = this.getIdFlag()
    const keyField = this.getRowKeyField()
    let seq = this._get_data('rowIdSeq') || 0
    rows.forEach((row) => {
        if (!row || row[idFlag] !== undefined) return
        const key = row[keyField]
        if (key !== undefined && key !== null && key !== '') {
            row[idFlag] = String(key)
        } else {
            seq += 1
            row[idFlag] = `rowId_${seq}`
        }
    })
    this._set_data('rowIdSeq', seq)
    return rows
}

// ---------------- 初始状态 ----------------

function createDefaultProps() {
    return {
        columns: {},
        dataSource: [],
        rows: [],
        readOnly: true,
        dataSourceMode: 'local',
        columnMode: 'local',
        editMode: 'cell',
        cellState: {},
        rowState: {},
        showCheckBox: true,
        multiple: true,
        showRowNo: true, // 默认显示序号
        pagination: true,
        pageInfo: {
            pageIndex: 1,
            pageSize: DEFAULT_PAGE_SIZE,
            pageCount: 0,
        },
        innerUsedAttrs: {
            id: '_id',
            selected: '_selected',
            status: '_status',
        },
        multiRowModel: false, // 表格多行模型
        editRowModels: {},
        // ---- 取数与加载态 ----
        loading: false,
        params: {},
        // ---- 脏数据 ----
        originalKeyMap: {},
        defaultRowDatas: new Map(),
    }
}

/**
 * 取数配置：中台叫 proxyConfig（{ load: fn|url }），这里兼容三种写法
 * - `proxyConfig: { load }`
 * - `dataSource: fn`（旧写法）
 * - `cUrl: '/xxx'`
 */
function resolveProxyConfig(props = {}) {
    const proxy = { ...(props.proxyConfig || {}) }
    if (typeof props.dataSource === 'function') proxy.load = proxy.load || props.dataSource
    if (typeof props.cUrl === 'string') proxy.load = proxy.load || props.cUrl
    if (!proxy.load && typeof props.url === 'string') proxy.load = props.url
    return proxy
}

function _getData(proxyConfig, queryParams, callback) {
    this.promiseExecute('beforeQuery', { proxyConfig, queryParams }, () => {
        const self = this
        const proxy = this.setProxy({ queryData: proxyConfig })
        const defaultParams = { page: { pageSize: this.getPageSize(), pageIndex: this.getPageIndex() } }
        const params = Object.assign(defaultParams, queryParams)
        this.setCache('proxyCache', { proxyConfig, params })
        let queryCount = 0
        const viewModel = this.getRootParent()
        const queryDataCallback = function (err, result, callBackMsg, errorDetail, ...args) {
            if (err) {
                return
            }
            this._set_data('dataSourceMode', 'remote') // 处理请求过程中被修改
            result = Object.assign({}, result)
            const data = resolveRowsData(result)

            callback?.call(this, data)
        }

        if (this.execute('beforeQueryData', params) === false) return
        const queryDataParams = _.cloneDeep(params)
        proxy.queryData(queryDataParams, queryDataCallback, self)
    })
}

function _setData(data) {
    if (!this.execute('beforeSetDataSource', data)) return
    const rowKeyField = this._get_data('rowKeyField')
    const keyMap = {}
    data.forEach(function (item) {
        keyMap[item[rowKeyField]] = item
    })
    this._set_data('keyMap', keyMap)
    this._set_data('dataSource', data, true)
    this.doPropertyChange('setDataSource')
    this.execute('afterSetDataSource', data)
}

// ============================================================

export class GridModel extends BaseModel {
    modelType = 'GridModel'
    constructor(props = {}) {
        const data = { ...createDefaultProps(), ...props }
        // `dataSource: fn` 是旧写法，含义是「取数函数」而不是「数据」，这里统一收敛掉
        if (!isArray(data.dataSource)) data.dataSource = []
        if (!isArray(data.rows)) data.rows = []
        const proxyConfig = resolveProxyConfig(props)
        data.proxyConfig = proxyConfig
        // 有取数配置就是服务端分页，否则按静态数据在前端分页
        data.dataSourceMode = props.dataSourceMode || (proxyConfig.load ? 'remote' : 'local')
        // 静态数据：cData / data 数组
        const seed = props.cData || (isArray(props.data) ? props.data : null)

        super(data)

        this.initPageInfo(props.cPage || props.page)
        this.initColumns(data.columns)
        this.initRowState()
        this.afterInit()
        if (seed) this.setDataSource(seed)
    }

    // 中台在 afterInit 里做主子表/行模型初始化，我们这里只留一个扩展点给业务继承
    afterInit() {
        if (this._get_data('parentRelation') === 'single') this._set_data('defaultSelectedRowIndexes', true)
    }

    initColumns(columns) {
        const map = normalizeColumns(columns)
        this._set_data('columns', map, true)
        return map
    }

    initPageInfo(page = {}) {
        const pageInfo = { ...this.getPageInfo() }
        pageInfo.pageIndex = page.pageNo || page.pageIndex || pageInfo.pageIndex || 1
        pageInfo.pageSize = page.pageSize || pageInfo.pageSize || DEFAULT_PAGE_SIZE
        // 中台习惯：不分页时把 pageSize 记成 -1
        if (this.get('pagination') === false) pageInfo.pageSize = -1
        this.applyPageInfo(pageInfo)
    }

    // 与 dataSource 同序的行状态，先铺平
    initRowState() {
        const source = this._get_data('dataSource')
        this._set_data(
            'rowsDataState',
            (isArray(source) ? source : []).map((row) => row?.[this.getStatusFlag()] || DataStates.Unchanged),
            true
        )
    }

    /* ========================= 内部字段 / 开关 ========================= */

    getInnerUsedAttrs() {
        return this._get_data('innerUsedAttrs')
    }

    getIdFlag() {
        return this.getInnerUsedAttrs().id
    }

    getSelectedFlag() {
        return this.getInnerUsedAttrs().selected
    }

    getStatusFlag() {
        return this.getInnerUsedAttrs().status
    }

    getRowKeyField() {
        return this._get_data('rowKeyField') || 'id'
    }

    getProxyConfig() {
        return this._get_data('proxyConfig') || {}
    }

    isRemote() {
        return this._get_data('dataSourceMode') === 'remote'
    }

    isPagination() {
        return !!this.get('pagination') && this.getPageSize() !== -1
    }

    getReadOnly() {
        return !!this._get_data('readOnly')
    }

    setReadOnly(readOnly) {
        this._applyState('readOnly', !!readOnly)
    }

    getParams() {
        return { ...(this.get('cParams') || {}), ...(this._get_data('params') || {}) }
    }

    setParams(params) {
        this._set_data('params', params || {})
    }

    setMeta(meta) {
        this._set_data('meta', meta)
    }

    /* ============================= 列 ============================= */

    /** 与中台一致：返回 object map（深拷贝），而不是数组 */
    getColumns(fields) {
        const columns = this._get_data('columns') || {}
        const result = {}
        const keys = fields ? (isArray(fields) ? fields : [fields]) : Object.getOwnPropertyNames(columns)
        keys.forEach((key) => {
            if (!columns[key]) return
            result[key] = { ...columns[key], fieldName: columns[key].fieldName || key }
        })
        return result
    }

    getColumn(field) {
        const column = this._get_data('columns')?.[field]
        return column ? { ...column, fieldName: column.fieldName || field } : undefined
    }

    hasColumn(field) {
        return !!(this._get_data('columns') || {})[field]
    }

    getColumnList(fields) {
        const columns = this.getColumns(fields)
        return Object.keys(columns)
            .sort((a, b) => (columns[a].index || 0) - (columns[b].index || 0))
            .map((key) => columns[key])
    }

    getVisibleColumns(fields) {
        return this.getColumnList(fields).filter((column) => column.bHidden !== true && column.bShowIt !== false)
    }

    setColumns(columns) {
        if (!columns) return
        this._applyState('columns', normalizeColumns(columns))
    }

    setColumnMode(mode) {
        this._set_data('columnMode', mode === 'remote' ? 'remote' : 'local', true)
    }

    addColumns(columns) {
        const map = normalizeColumns(columns)
        this._applyState('columns', { ...(this._get_data('columns') || {}), ...map })
    }

    resetColumns(columns) {
        this.setColumns(columns || this.get('cColumns'))
    }

    getColumnState(rowIndex, field, name) {
        const rowKey = this.getRowKey(rowIndex)
        return rowKey ? (this._get_data('cellState')?.[rowKey]?.[field] || {})[name] : undefined
    }

    setColumnState(rowIndex, field, name, value) {
        this.setCellState(rowIndex, field, name, value)
    }

    setColumnStates(states = []) {
        this.setCellStates(states.map((item) => ({ ...item, cellName: item.cellName || item.columnName })))
    }

    setColumnValue(field, name, value) {
        const columns = this._get_data('columns') || {}
        if (!columns[field]) return
        this._applyState('columns', { ...columns, [field]: { ...columns[field], [name]: value } })
    }

    /* ============================ 取数 ============================ */

    /* ======================= 数据写入 ======================= */

    setDataSource(proxyConfig, queryParams = {}, callback) {
        if (this._get_data('dataSourceMode') === 'local') {
            const data = cb.utils.isArray(proxyConfig) ? proxyConfig : []
            _setData(data)
        } else {
            if (!this.execute('beforeProxyLoad', queryParams)) return
            const pageInfo = this._get_data('pageInfo')
            pageInfo.pageIndex = 1
            this._set_data('proxyConfig', proxyConfig)
            this._set_data('queryParams', queryParams)
            this._set_data('loadDataCallback', callback)
            _getData.call(this, proxyConfig, queryParams, (data) => {
                _setData.call(this, data)
                callback?.call(this)
            })
        }
    }

    reload() {
        const proxy = this.getProxy()
        const proxyConfig = this._get_data('proxyConfig')
        const queryParams = this._get_data('queryParams')
        const callback = this._get_data('loadDataCallback')

        _getData.call(this, proxyConfig, queryParams, (data) => {
            _setData.call(this, data)
            callback?.call(this)
        })
    }

    /* ======================== 数据（两层） ======================== */

    getDataSource() {
        const source = this._get_data('dataSource') || []
        return source
    }

    /**
     * 数据出口，签名与中台一致，但语义容易踩坑，这里写清楚：
     * - `getData()`             → 全量 dataSource（提交/保存用，保留 _status，剔除 _selected）
     * - `getData(true)`         → 当前页 rows（视图用，剔除 _status / _selected）
     * - `getAllData()`          → 等于 getData(true)，仅为对齐中台签名而保留
     * - `getPageData()`         → 等于 getData(true)，语义更直白的别名
     */
    getData(view, realRows) {
        const rows = view || realRows ? this._get_data('rows') : this._get_data('dataSource')
        return this.collectRows(rows, view)
    }

    getAllData() {
        return this.getData(true)
    }

    getPageData() {
        return this.getData(true)
    }

    /** 有效数据：全量里剔除 Delete 状态的行 */
    getEffeData() {
        const source = this._get_data('dataSource') || []
        const rowsDataState = this._get_data('rowsDataState') || []
        return this.collectRows(
            source.filter((row, index) => rowsDataState[index] !== DataStates.Delete),
            false
        )
    }

    /** 当前页行（浅引用），isCopy=true 时返回深拷贝 */
    getRows(isCopy) {
        const rows = this._get_data('rows') || []
        return isCopy === false ? rows : rows.map((row) => cloneDeep(row))
    }

    collectRows(rows, view) {
        const columns = this._get_data('columns') || {}
        const statusFlag = this.getStatusFlag()
        const selectedFlag = this.getSelectedFlag()
        return (rows || []).map((rowData) => {
            const row = {}
            for (const attr in rowData) {
                // 视图数据不带 _status；提交数据不带 _selected
                if (view && attr === statusFlag) continue
                if (!view && attr === selectedFlag) continue
                if (columns[attr]?.needCollect === false) continue
                row[attr] = rowData[attr]
            }
            return row
        })
    }

    /** 展示文案副本（中台会把它推给组件；我们只作为工具方法保留） */
    getShowRows(rows) {
        return (rows || this._get_data('rows') || []).map((row) => ({ ...row }))
    }

    getRow(rowIndex, needGrandSon) {
        const row = this._get_data('rows')?.[rowIndex]
        if (!row) return undefined
        return needGrandSon === false ? row : cloneDeep(row)
    }

    getRowIndex(row) {
        if (!row) return -1
        const rows = this._get_data('rows') || []
        const rowKeyField = this.getRowKeyField()
        if (row[rowKeyField] !== undefined) {
            return rows.findIndex((item) => item[rowKeyField] === row[rowKeyField])
        }
        return rows.indexOf(row)
    }

    getRowIndexByRowId(rowId) {
        const rows = this._get_data('rows') || []
        return rows.findIndex((row) => row?.[this.getIdFlag()] === rowId)
    }

    getDataSourceIndexByRowId(rowId) {
        return (this._get_data('dataSource') || []).findIndex((row) => row?.[this.getIdFlag()] === rowId)
    }

    getRowKey(rowIndex) {
        return this._get_data('rows')?.[rowIndex]?.[this.getIdFlag()] ?? rowIndex
    }

    getRowKeys(rowData) {
        const list = rowData === undefined ? this.getRows() : isArray(rowData) ? rowData : [rowData]
        const keyField = this.getRowKeyField()
        return list.filter((row) => row && row[keyField] !== undefined).map((row) => row[keyField])
    }

    getRowsByIndexes(rowIndexes) {
        const rows = this._get_data('rows') || []
        return (isArray(rowIndexes) ? rowIndexes : [rowIndexes]).map((index) => rows[index]).filter(Boolean)
    }

    /* ==================== 单元格值 / 单元格状态 ==================== */

    getCellValue(rowIndex, cellName) {
        const row = rowIndex >= 0 ? this._get_data('rows')?.[rowIndex] : null
        if (!row || !cellName) return undefined
        return row[cellName]
    }

    setCellValue(rowIndex, cellName, value) {
        const rows = this._get_data('rows') || []
        const row = rows[rowIndex]
        if (!row || !cellName) return
        const oldValue = row[cellName]
        if (oldValue === value) return
        const data = { rowIndex, rowId: row[this.getIdFlag()], cellName, value, oldValue }
        if (!this.execute('beforeCellValueChange', data)) return
        row[cellName] = data.value
        this.markRowState(rowIndex, DataStates.Update)
        this.execute('afterCellValueChange', data)
        this.doPropertyChange('setCellValue', data)
    }

    setCellValues(values = []) {
        if (!isArray(values)) return
        values.forEach((item) => this.setCellValue(item.rowIndex, item.cellName || item.field, item.value))
    }

    getCellState(rowIndex, cellName, name) {
        const rowKey = this.getRowKey(rowIndex)
        const cell = rowKey ? this._get_data('cellState')?.[rowKey]?.[cellName] : null
        if (!cell) return undefined
        return cell[name]
    }

    setCellState(rowIndex, cellName, name, value) {
        const rowId = this._get_data('rows')?.[rowIndex]?.[this.getIdFlag()]
        const rowKey = rowId || rowIndex
        if (isEmpty(rowKey)) return
        const oldValue = this.getCellState(rowIndex, cellName, name)
        if (oldValue === value) return
        const data = { rowIndex, rowId, cellName, propertyName: name, value, oldValue }
        if (!this.execute('beforeCellStateChange', data)) return
        const cellState = { ...(this._get_data('cellState') || {}) }
        cellState[rowKey] = { ...(cellState[rowKey] || {}) }
        cellState[rowKey][cellName] = { ...(cellState[rowKey][cellName] || {}), [name]: value }
        this._applyState('cellState', cellState)
        this.execute('afterCellStateChange', data)
    }

    setCellStates(states = []) {
        if (!isArray(states)) return
        states.forEach((item) => this.setCellState(item.rowIndex, item.cellName, item.propertyName || item.name, item.value))
    }

    /* ==================== 行状态 / 脏数据 ==================== */

    /** 行数据状态（Insert / Update / Delete / 空），rowIndex 是 rows 的下标 */
    getRowDataState(rowIndex) {
        const indexInDS = this.getDataSourceIndexByRow(rowIndex)
        return this._get_data('rowsDataState')?.[indexInDS]
    }

    getDataSourceIndexByRow(rowIndex) {
        const rows = this._get_data('rows') || []
        const row = rows[rowIndex]
        if (!row) return -1
        const source = this._get_data('dataSource') || []
        const index = source.indexOf(row)
        if (index > -1) return index
        // 本地分页时 rows 是切片，引用一致；远程模式下 rows 与 dataSource 同源
        return source.findIndex((item) => item?.[this.getIdFlag()] === row?.[this.getIdFlag()])
    }

    setRowDataState(rowIndex, dataState) {
        const indexInDS = this.getDataSourceIndexByRow(rowIndex)
        if (indexInDS < 0) return
        const rowsDataState = [...(this._get_data('rowsDataState') || [])]
        rowsDataState[indexInDS] = dataState
        this._set_data('rowsDataState', rowsDataState, true)
    }

    // 只在「原状态是 Unchanged」时置为 Update，避免把 Insert 覆盖成 Update
    markRowState(rowIndex, dataState) {
        const current = this.getRowDataState(rowIndex)
        if (current === DataStates.Insert || current === dataState) return
        this.setRowDataState(rowIndex, dataState)
    }

    /** 单元格编辑由组件回灌时用：传行对象或行下标都可以 */
    markRowUpdate(rowOrIndex) {
        const rowIndex = typeof rowOrIndex === 'number' ? rowOrIndex : this.getRowIndex(rowOrIndex)
        if (rowIndex < 0) return
        this.markRowState(rowIndex, DataStates.Update)
    }

    getRowState(rowIndex, name) {
        const rowKey = this.getRowKey(rowIndex)
        const row = rowKey ? this._get_data('rowState')?.[rowKey] : null
        if (!row || !name) return undefined
        return row[name]
    }

    setRowState(rowIndex, name, value) {
        const row = this._get_data('rows')?.[rowIndex]
        if (!row || !name) return
        const rowKey = this.getRowKey(rowIndex)
        const oldValue = this.getRowState(rowIndex, name)
        if (oldValue === value) return
        const data = { rowIndex, rowId: row[this.getIdFlag()], propertyName: name, value, oldValue }
        if (!this.execute('beforeRowStateChange', data)) return
        const rowState = { ...(this._get_data('rowState') || {}) }
        rowState[rowKey] = { ...(rowState[rowKey] || {}), [name]: value }
        this._applyState('rowState', rowState)
        this.execute('afterRowStateChange', data)
    }

    setRowStates(states = []) {
        if (!isArray(states)) return
        states.forEach((item) => this.setRowState(item.rowIndex, item.propertyName || item.name, item.value))
    }

    /** 收集增删改过的行，用于提交；没有脏数据时返回 undefined（中台同款） */
    getDirtyData(necessary) {
        const source = this._get_data('dataSource') || []
        const rowsDataState = this._get_data('rowsDataState') || []
        const data = []
        source.forEach((row, index) => {
            const dataState = rowsDataState[index]
            if (!dataState) return
            const item = cloneDeep(row)
            item[this.getStatusFlag()] = dataState
            data.push(item)
        })
        return data.length ? data : undefined
    }

    getDirtyRowIndexes() {
        const rows = this._get_data('rows') || []
        return rows.map((row, index) => index).filter((index) => !!this.getRowDataState(index))
    }

    isDirty() {
        return !!this.getDirtyData()
    }

    // 备份 / 还原未提交的数据（取消编辑时用）
    backupState() {
        this._set_data('backupData', {
            dataSource: cloneDeep(this._get_data('dataSource') || []),
            rowsDataState: [...(this._get_data('rowsDataState') || [])],
        })
    }

    restoreState() {
        const backup = this._get_data('backupData')
        if (!backup) return
        this._set_data('dataSource', backup.dataSource, true)
        this._set_data('rowsDataState', [...backup.rowsDataState], true)
        this.showPage()
    }

    /* ======================= 增删改行 ======================= */

    /** 中台签名：insertRow(rowIndex, rowData, needCheckDefault, isCopy, extendParams) */
    insertRow(rowIndex, rowData = {}, needCheckDefault, isCopy, extendParams = {}) {
        const rows = this._get_data('rows') || []
        const index = Math.min(rows.length, Math.max(0, rowIndex === undefined ? rows.length : rowIndex))
        const data = { index, row: { ...rowData }, isCopy }
        if (!this.execute('beforeInsertRow', data)) return
        const row = data.row
        delete row[this.getIdFlag()]
        setIds.call(this, [row])
        const source = this._get_data('dataSource') || []
        const indexInDS = index < rows.length ? this.getDataSourceIndexByRow(index) : source.length
        source.splice(indexInDS < 0 ? source.length : indexInDS, 0, row)
        const rowsDataState = [...(this._get_data('rowsDataState') || [])]
        rowsDataState.splice(indexInDS < 0 ? rowsDataState.length : indexInDS, 0, DataStates.Insert)
        rows.splice(index, 0, row)
        this._set_data('rowsDataState', rowsDataState, true)
        this.setRows(rows)
        this.execute('afterInsertRow', { ...data, rowIndex: index })
        return row
    }

    insertRows(rowIndex, rowsData = []) {
        const result = []
        ;(isArray(rowsData) ? rowsData : [rowsData]).forEach((rowData, offset) => {
            result.push(this.insertRow(rowIndex + offset, rowData))
        })
        return result
    }

    appendRow(rowData = {}) {
        return this.insertRow(this.getRowsCount(), rowData)
    }

    updateRow(rowIndex, rowData = {}) {
        const row = this._get_data('rows')?.[rowIndex]
        if (!row) return
        if (!this.execute('beforeUpdateRow', { index: rowIndex, row: rowData })) return
        Object.assign(row, rowData)
        this.markRowState(rowIndex, DataStates.Update)
        this.setRows(this._get_data('rows'))
        this.execute('afterUpdateRow', { index: rowIndex, row })
    }

    updateRows(rowsData = []) {
        rowsData.forEach((item) => this.updateRow(item.rowIndex ?? item.index, item.rowData || item.row))
    }

    /** 删除行：有 id 的行标 Delete 保留占位，本地新增未保存的行直接丢弃（中台同款） */
    deleteRows(rowIndexes) {
        const indexes = (isArray(rowIndexes) ? rowIndexes : [rowIndexes]).filter((index) => index >= 0 && index < this.getRowsCount()).sort((a, b) => a - b)
        if (!indexes.length) return
        const rowsToDelete = this.getRowsByIndexes(indexes)
        if (!this.execute('beforeDeleteRows', rowsToDelete, indexes)) return

        const source = this._get_data('dataSource') || []
        const rowsDataState = [...(this._get_data('rowsDataState') || [])]
        const deletedIds = new Set()
        // 本地新增的行不需要保留占位，直接从数据源里抹掉
        const discardIds = new Set()
        rowsToDelete.forEach((row) => {
            const index = source.indexOf(row)
            if (index < 0) return
            const key = row[this.getIdFlag()]
            deletedIds.add(key)
            if (rowsDataState[index] === DataStates.Insert) discardIds.add(key)
        })

        const keptSource = []
        const keptState = []
        source.forEach((row, index) => {
            const key = row[this.getIdFlag()]
            if (!deletedIds.has(key)) {
                keptSource.push(row)
                keptState.push(rowsDataState[index])
                return
            }
            if (discardIds.has(key)) return
            keptSource.push(row)
            keptState.push(DataStates.Delete)
        })
        this._set_data('dataSource', keptSource, true)
        this._set_data('rowsDataState', keptState, true)
        // 本地模式下重新切片即可，删除行会自然消失在当前页
        this.showPage()
        this.execute('afterDeleteRows', { rowIndexes: indexes, rows: rowsToDelete })
    }

    deleteAllRows() {
        this.deleteRows(this.getRows().map((row, index) => index))
    }

    clear() {
        this._set_data('dataSource', [], true)
        this._set_data('rows', [], true)
        this._set_data('rowsDataState', [], true)
        this.clearSelection()
        this.applyPageInfo({ ...this.getPageInfo(), recordCount: 0, pageIndex: 1 })
        this.setDataSourceView()
    }

    /* ======================= 选中 ======================= */

    /**
     * 选中行
     * @param {Number|Array} rowIndexes rows 下标
     * @param {Boolean} all true = 替换选择（先清掉其他选中），默认 false = 追加
     */
    select(rowIndexes, all) {
        if (rowIndexes == null && all !== true) return
        if (all === true) this.unselectAll({ silent: true })
        let indexes = all === true ? this.getRows().map((row, index) => index) : isArray(rowIndexes) ? rowIndexes : [rowIndexes]
        indexes = indexes.filter((index) => index >= 0 && index < this.getRowsCount())
        const rows = this._get_data('rows') || []
        const selectedFlag = this.getSelectedFlag()
        const changed = indexes.filter((index) => !rows[index][selectedFlag])
        if (!changed.length) {
            if (all === true) this.flushSelection()
            return
        }
        const data = { rowIndexes: changed, rows: changed.map((index) => rows[index]) }
        if (!this.execute('beforeSelect', data)) return
        changed.forEach((index) => {
            rows[index][selectedFlag] = true
            this.cacheSelectedRow(rows[index], true)
        })
        this.flushSelection()
    }

    unselect(rowIndexes) {
        if (rowIndexes == null) return
        const indexes = isArray(rowIndexes) ? rowIndexes : [rowIndexes]
        const rows = this._get_data('rows') || []
        const selectedFlag = this.getSelectedFlag()
        const changed = indexes.filter((index) => rows[index]?.[selectedFlag])
        if (!changed.length) return
        if (!this.execute('beforeUnselect', changed)) return
        changed.forEach((index) => {
            rows[index][selectedFlag] = false
            this.cacheSelectedRow(rows[index], false)
        })
        this.flushSelection()
    }

    selectAll() {
        const rows = this._get_data('rows') || []
        const selectedFlag = this.getSelectedFlag()
        rows.forEach((row) => {
            row[selectedFlag] = true
            this.cacheSelectedRow(row, true)
        })
        this.flushSelection()
    }

    /**
     * 清空选中
     * @param {Object} options onlyPage=true 只清当前页（其他页的跨页缓存保留）；silent=true 不下发视图
     *
     * 注意要清 **dataSource** 上的行：`_selected` 记在行对象上，
     * 而本地分页时当前页的 rows 只是 dataSource 的切片，只清 rows 会让翻页回来的行「带着选中复活」。
     */
    unselectAll(options = {}) {
        const selectedFlag = this.getSelectedFlag()
        const targets = options.onlyPage ? this._get_data('rows') : this._get_data('dataSource')
        ;(targets || []).forEach((row) => {
            row[selectedFlag] = false
        })
        if (options.onlyPage) {
            // 只清当前页：把这些行从跨页缓存里摘掉即可
            ;(this._get_data('rows') || []).forEach((row) => this.cacheSelectedRow(row, false))
        } else {
            this._set_data('selectedKeys', [], true)
            this._set_data('selectedRowsMap', {}, true)
            this._set_data('selectedKeysSet', new Set(), true)
        }
        if (!options.silent) this.flushSelection()
    }

    clearSelection() {
        this.unselectAll()
    }

    /**
     * 以传入的行集合作为**当前页**的选中结果（表格选中变化回灌的入口）。
     * 其他页的跨页选中缓存不受影响 —— 表格的勾选状态只覆盖当前页，
     * 若在这里清空缓存，翻页就会把之前选的行丢掉。
     */
    setSelectedRows(rows = []) {
        const list = isArray(rows) ? rows : []
        const keyField = this.getRowKeyField()
        const keys = new Set(list.map((row) => String(row?.[keyField] ?? row)))
        const currentRows = this._get_data('rows') || []
        const selectedFlag = this.getSelectedFlag()
        currentRows.forEach((row) => {
            const selected = keys.has(String(row[keyField]))
            if (selected !== !!row[selectedFlag]) {
                row[selectedFlag] = selected
                this.cacheSelectedRow(row, selected)
            }
        })
        this.flushSelection()
    }

    /** 全量替换选中（含清掉其他页的缓存） */
    setSelection(rows = []) {
        this.unselectAll({ silent: true })
        this.setSelectedRows(rows)
    }

    getSelectedRows(rowIndexes) {
        const rows = this._get_data('rows') || []
        const selectedFlag = this.getSelectedFlag()
        const keys = rowIndexes && new Set(isArray(rowIndexes) ? rowIndexes : [rowIndexes])
        return rows.filter((row, index) => row[selectedFlag] && (!keys || keys.has(index)))
    }

    getSelectedRowIndexes() {
        const rows = this._get_data('rows') || []
        const selectedFlag = this.getSelectedFlag()
        const indexes = []
        rows.forEach((row, index) => {
            if (row[selectedFlag]) indexes.push(index)
        })
        return indexes
    }

    getSelectedKeys() {
        return this._get_data('selectedKeys') || []
    }

    /** 跨页选中的全部行（按选中顺序） */
    getAllCacheSelectedRows() {
        const keys = this._get_data('selectedKeys') || []
        const rowsMap = this._get_data('selectedRowsMap') || {}
        return keys.map((key) => rowsMap[key]).filter(Boolean)
    }

    selectByKeys(keys, selected = true) {
        const rowKeyField = this.getRowKeyField()
        const list = isArray(keys) ? keys : [keys]
        const rows = this._get_data('rows') || []
        const indexes = []
        list.forEach((key) => {
            const index = rows.findIndex((row) => String(row[rowKeyField]) === String(key))
            if (index > -1) indexes.push(index)
        })
        if (!indexes.length) return
        selected ? this.select(indexes) : this.unselect(indexes)
    }

    getSelectedNodes() {
        return this.getAllCacheSelectedRows()
    }

    cacheSelectedRow(row, selected) {
        const key = String(row?.[this.getRowKeyField()])
        const keys = (this._get_data('selectedKeys') || []).filter((item) => item !== key)
        const rowsMap = { ...(this._get_data('selectedRowsMap') || {}) }
        if (selected) keys.push(key)
        if (selected) rowsMap[key] = row
        else delete rowsMap[key]
        this._set_data('selectedKeys', keys, true)
        this._set_data('selectedRowsMap', rowsMap, true)
        this._set_data('selectedKeysSet', new Set(keys), true)
    }

    // 选中变化统一在这里下发视图（组件侧用同步开关挡住回灌死循环）
    flushSelection() {
        this._applyState('selectedRows', this.getSelectedRows())
        this.execute('selectionChange', {
            value: this.getSelectedRows(),
            keys: this.getSelectedKeys(),
            indexes: this.getSelectedRowIndexes(),
        })
    }

    // 重新取数后把跨页选中的标记补回当前页的行上
    restoreSelectedFlags() {
        if (!this.get('cacheSelectedRows')) return
        const keysSet = this._get_data('selectedKeysSet') || new Set()
        if (!keysSet.size) return
        const rowKeyField = this.getRowKeyField()
        const selectedFlag = this.getSelectedFlag()
        ;(this.getRows() || []).forEach((row) => {
            row[selectedFlag] = keysSet.has(String(row[rowKeyField]))
        })
    }

    /* ======================= 分页 ======================= */

    setPagination(value) {
        this._applyState('pagination', !!value)
        this.showPage()
    }

    getPageInfo() {
        return this._get_data('pageInfo') || createDefaults().pageInfo
    }

    getPageIndex() {
        return this.getPageInfo().pageIndex
    }

    getPageSize() {
        return this.getPageInfo().pageSize
    }

    getTotalCount() {
        return this.getPageInfo().recordCount
    }

    setPageInfo(pageInfo) {
        this.applyPageInfo({ ...this.getPageInfo(), ...pageInfo }, { refresh: true })
    }

    setPageIndex(pageIndex, refresh = true) {
        if (typeof pageIndex !== 'number') return
        this.applyPageInfo({ ...this.getPageInfo(), pageIndex: Math.max(1, pageIndex) }, { refresh })
    }

    setPageSize(pageSize, refresh = true) {
        if (typeof pageSize !== 'number') return
        // 与中台一致：pageSize = -1 表示不分页
        this.applyPageInfo({ ...this.getPageInfo(), pageSize: Math.max(-1, pageSize), pageIndex: 1 }, { refresh })
    }

    setRecordCount(recordCount) {
        this.applyPageInfo({ ...this.getPageInfo(), recordCount: recordCount || 0 })
    }

    /**
     * 统一的分页写入：算 pageCount / 记录 begin~end、切片、下发视图
     * @param {Object} options silent=true 时不通知视图（组件自己的翻页动作走这里）
     */
    applyPageInfo(pageInfo, options = {}) {
        const next = { ...(pageInfo || {}) }
        const pageSize = next.pageSize === -1 ? -1 : next.pageSize || DEFAULT_PAGE_SIZE
        const recordCount = next.recordCount || 0
        // recordCount 还没取到时不要按 pageCount 夹 pageIndex，否则「跳第 N 页」会被压回第 1 页
        const known = recordCount > 0
        next.pageSize = pageSize
        next.recordCount = recordCount
        next.pageCount = pageSize > 0 ? Math.max(1, Math.ceil(recordCount / pageSize)) : 1
        next.pageIndex = pageSize > 0 ? Math.max(1, known ? Math.min(next.pageIndex || 1, next.pageCount) : next.pageIndex || 1) : 1
        next.beginPageIndex = pageSize > 0 ? (next.pageIndex - 1) * pageSize + 1 : 1
        next.endPageIndex = pageSize > 0 ? Math.min(next.pageIndex * pageSize, recordCount) : recordCount
        this._set_data('pageInfo', next, true)
        if (options.silent) return next
        this._applyState('pageInfo', next)
        if (!this.isRemote()) this.showPage()
        if (options.refresh && this.isRemote()) this.refresh()
        return next
    }

    /** 本地分页：按 pageInfo 从 dataSource 切出当前页 rows */
    showPage() {
        const source = this._get_data('dataSource') || []
        if (this.isRemote() || !this.isPagination()) {
            this.setRows(source)
            return
        }
        const { pageIndex, pageSize } = this.getPageInfo()
        const start = (pageIndex - 1) * pageSize
        this.setRows(source.slice(start, start + pageSize))
    }

    /** 只换当前页 rows（中台 setRows） */
    setRows(rows) {
        const list = isArray(rows) ? rows : []
        this._set_data('rows', list, true)
        this.setRowsIdMap()
        // 注意：这里推的是原始行对象，而不是中台的 getShowRows() 展示副本 —— 否则
        // 选中回灌、单元格编辑会落到副本上，模型与视图的数据对不上
        this._applyState('data', list)
    }

    setDataSourceView() {
        this._applyState('data', this._get_data('rows') || [])
    }

    setRowsIdMap() {
        const map = {}
        ;(this._get_data('rows') || []).forEach((row) => {
            if (row?.[this.getIdFlag()] !== undefined) map[row[this.getIdFlag()]] = row
        })
        this._set_data('rowsIdMap', map)
    }

    getRowIdMap() {
        return this._get_data('rowsIdMap') || {}
    }

    /* ======================= 校验 ======================= */

    /**
     * 必输校验（中台会把校验委托给 editRowModel，我们这层没有行模型，只做列级必输）
     * @returns {Boolean} 通过返回 true，不通过返回 false，并把消息推给视图（validate 事件）
     */
    validate(cancel, paramsRowsIndex) {
        if (cancel) {
            this.doPropertyChange('validate', { type: '', message: '', errors: [] })
            this._set_data('validateErrors', [])
            return false
        }
        this.deleteNotModifiedRows()
        const columns = this._get_data('columns') || {}
        const rows = paramsRowsIndex ? this.getRowsByIndexes(paramsRowsIndex) : this.getRows()
        const errors = []
        rows.forEach((row, index) => {
            for (const field in columns) {
                const column = columns[field]
                if (!this.isRequiredColumn(column)) continue
                const value = row[field]
                const empty = isEmpty(value) || (isArray(value) && !value.length) || isEmptyObject(value)
                if (!empty) continue
                const caption = column.cShowCaption || column.cCaption || column.cCaption || column.title || field
                errors.push({
                    rowIndex: index,
                    rowId: row[this.getIdFlag()],
                    cellName: field,
                    message: `${caption}不能为空`,
                })
                this.setCellState(index, field, 'msg', '不能为空')
            }
        })
        this._set_data('validateErrors', errors)
        const message = errors.length ? errors[0].message : ''
        this.doPropertyChange('validate', { type: errors.length ? 'error' : '', message, errors })
        this.execute('afterValidate', { valid: !errors.length, errors })
        return !errors.length
    }
}

export default GridModel
