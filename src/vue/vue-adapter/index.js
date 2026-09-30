/**
 * devfab 的 Vue 3 适配层入口
 *
 * 把 src/vue/vue-adapter 下的两个适配器收成统一出口：
 *  - defineClassComponent：用 React Class 组件的心智模型写 Vue 3 组件
 *  - defineFunctionComponent：用函数组件 + Hooks 的心智模型写 Vue 3 组件
 *
 * 产物：dist/vue/vue3-adapter.{js,esm.js}，由宿主显式 import / require 引用，
 * 不产出 UMD、不挂全局变量。
 * 内部使用 Vue 3 API（defineComponent / reactive / h），不兼容 Vue 2。
 */
import defineClassComponent, { VueComponent } from './class-adapter'
import defineFunctionComponent, { useState, useRef, useMemo, useCallback, useEffect, useLayoutEffect, useReducer, useContext, useProvide } from './function-adapter'

export { VueComponent, defineClassComponent, defineFunctionComponent, useState, useRef, useMemo, useCallback, useEffect, useLayoutEffect, useReducer, useContext, useProvide }

export default {
    defineClassComponent,
    defineFunctionComponent,
}
