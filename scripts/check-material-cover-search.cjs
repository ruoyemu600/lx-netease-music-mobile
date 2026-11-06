'use strict'
// Real components transpiled with lightweight hook/native mocks; not Android rendering.
const assert = require('node:assert/strict')
const vm = require('node:vm')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const compile = file => ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
  fileName: file,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText
const code = compile('src/screens/PlayDetail/Vertical/Pic.tsx')
const jsx = (type, props) => ({ type, props })
function render({ track, resolved, width = 400, height = 800, available = null, status = 'loading' }) {
  let index = 0
  const writes = []
  const react = {
    memo: fn => fn, useEffect: () => {}, useMemo: fn => fn(), useCallback: fn => fn,
    useRef: value => ({ current: value }),
    useState: initial => {
      const n = index++
      return [n === 2 ? available : n === 0 ? { ...initial, status } : initial, value => writes.push([n, value])]
    },
  }
  const native = {
    View: 'View', TouchableWithoutFeedback: 'Touchable',
    StyleSheet: { create: o => o, absoluteFillObject: { position: 'absolute' } },
    Animated: { Value: class { interpolate() { return 0 } }, View: 'Animated' }, Easing: { linear: 0 },
  }
  const module = { exports: {} }
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require: name => {
      if (name === 'react') return react
      if (name === 'react-native') return native
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx }
      if (name === '@d11/react-native-fast-image') return { __esModule: true, default: { resizeMode: { cover: 'cover' } } }
      if (name.includes('store/player/hook')) return { usePlayMusicInfo: () => ({ musicInfo: track }), usePlayerMusicInfo: () => resolved, useIsPlay: () => false }
      if (name.includes('utils/hooks')) return { useWindowSize: () => ({ width, height }) }
      if (name.includes('store/common/hook')) return { useStatusbarHeight: () => 24 }
      if (name.includes('store/setting/hook')) return { useSettingValue: () => false }
      if (name.includes('store/theme/hook')) return { useTheme: () => new Proxy({}, { get: (_, key) => key }) }
      if (name.includes('config/constant')) return { NAV_SHEAR_NATIVE_IDS: { playDetail_pic: 'cover' } }
      if (name.includes('components/Header')) return { HEADER_HEIGHT: 56 }
      if (name.includes('common/Image')) return { defaultHeaders: {} }
      if (name.includes('common/Icon')) return { Icon: 'Icon' }
      return { __esModule: true, default: 'Component' }
    },
  })
  return { tree: module.exports.default({ componentId: 'test' }), writes }
}
const children = node => Array.isArray(node?.props?.children) ? node.props.children : [node?.props?.children]
function all(node, predicate, output = []) {
  if (node && typeof node === 'object') {
    if (predicate(node)) output.push(node)
    for (const child of children(node).flat(Infinity)) all(child, predicate, output)
  }
  return output
}
const song = { id: 'a', name: 'Song', singer: 'Singer', meta: { picUrl: 'https://raw/cover.jpg' } }
for (const [label, options, url, size] of [
  ['resolved remote', { track: song, resolved: { id: 'a', pic: 'https://resolved/cover.jpg' }, available: 500 }, 'https://resolved/cover.jpg', 332],
  ['short layout', { track: song, resolved: { id: 'a', pic: null }, available: 210 }, song.meta.picUrl, 194],
  ['download unwrap', { track: { id: 'download-a', progress: 1, metadata: { musicInfo: song } }, resolved: { id: 'download-a', pic: '/local/cover.jpg' }, available: 400 }, 'file:///local/cover.jpg', 332],
  ['stale resolved ignored', { track: song, resolved: { id: 'old', pic: 'wrong' }, available: 400 }, song.meta.picUrl, 332],
  ['first layout fallback', { track: song, resolved: { id: 'a', pic: null } }, song.meta.picUrl, 332],
]) {
  const { tree, writes } = render(options)
  const image = all(tree, node => node.props?.source)[0]
  assert.equal(image.props.source.uri, url)
  const cover = all(tree, node => Array.isArray(node.props?.style) && node.props.style[1]?.width)[0]
  assert.equal(cover.props.style[1].width, size)
  tree.props.onLayout({ nativeEvent: { layout: { height: 0 } } })
  assert.equal(writes.length, 0)
  image.props.onLoad(); assert.equal(writes.at(-1)[1].status, 'loaded')
  image.props.onError(); assert.equal(writes.at(-1)[1].status, 'error')
  console.log('PASS', label)
}
for (const [label, options, text] of [
  ['empty cover placeholder', { track: null, resolved: { id: null, pic: null }, available: 300 }, '暂无封面'],
  ['failed cover placeholder', { track: song, resolved: { id: 'a', pic: null }, available: 300, status: 'error' }, '封面加载失败'],
]) {
  const { tree } = render(options)
  assert.equal(all(tree, node => node.props?.source).length, 0)
  assert.ok(all(tree, node => children(node).includes(text)).length)
  console.log('PASS', label)
}
const source = compile('src/screens/Home/Views/Search/HeaderBar/SearchInput.tsx')
let text = '', api, focus = 0, blur = 0
const calls = []
const input = { current: { focus: () => focus++, blur: () => blur++ } }
const module2 = { exports: {} }
vm.runInNewContext(source, {
  module: module2, exports: module2.exports,
  require: name => {
    if (name === 'react') return { forwardRef: fn => fn, useCallback: fn => fn, useRef: () => input, useState: () => [text, value => { text = value }], useImperativeHandle: (_, fn) => { api = fn() } }
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    if (name === 'react-native') return { View: 'View', TextInput: 'Input', TouchableOpacity: 'Touchable', StyleSheet: { create: o => o } }
    if (name.includes('common/Icon')) return { Icon: 'Icon' }
    if (name.includes('store/theme/hook')) return { useTheme: () => new Proxy({}, { get: (_, key) => key }) }
    throw Error(name)
  },
})
const props = { onChangeText: value => calls.push(['change', value]), onSubmit: value => calls.push(['submit', value]), onBlur: () => calls.push(['blur']), onTouchStart: () => calls.push(['touch']) }
let tree = module2.exports.default(props, {})
let control = all(tree, node => node.type === 'Input')[0]
control.props.onChangeText('  music  ')
assert.deepEqual(calls.at(-1), ['change', 'music'])
control.props.onSubmitEditing({ nativeEvent: { text: 'keyboard' } })
assert.deepEqual(calls.at(-1), ['submit', 'keyboard'])
api.setText('updated'); tree = module2.exports.default(props, {})
control = all(tree, node => node.type === 'Input')[0]
assert.equal(control.props.value, 'updated')
all(tree, node => node.props?.accessibilityLabel === '搜索')[0].props.onPress()
assert.deepEqual(calls.at(-1), ['submit', 'updated'])
all(tree, node => node.props?.accessibilityLabel === '清空搜索')[0].props.onPress()
assert.equal(text, '')
assert.deepEqual(calls.slice(-2), [['change', ''], ['submit', '']])
api.focus(); api.blur(); assert.equal(focus, 1); assert.equal(blur, 1)
assert.equal(tree.props.style[0].minHeight, 56)
console.log('PASS search trim, keyboard/icon submit, clear, imperative API and touch sizing')
console.log('Cover/search mocked callbacks passed; real images and native layout need device checks.')
