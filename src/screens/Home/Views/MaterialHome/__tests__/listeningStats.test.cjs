/* Run: node src/screens/Home/Views/MaterialHome/__tests__/listeningStats.test.cjs
 * Isolated TypeScript + hook/element mocks; no Metro, Gradle or new dependencies.
 */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const directory = path.resolve(__dirname, '..')
let owner, nav = 'nav_home', screen = 'home', provider, calls = [], listener, themeMode = 'light'
const timers = new Map()
let timerId = 0
const equal = (a, b) => a && b && a.length === b.length && a.every((v, i) => v === b[i])
const react = {
  memo: fn => fn,
  useState(initial) {
    const h = owner, i = h.cursor++
    if (!(i in h.values)) h.values[i] = typeof initial === 'function' ? initial() : initial
    return [h.values[i], next => { h.writes++; h.values[i] = typeof next === 'function' ? next(h.values[i]) : next }]
  },
  useRef(initial) { const h = owner, i = h.cursor++; return h.values[i] ??= { current: initial } },
  useCallback(fn, deps) { const h = owner, i = h.cursor++; if (!equal(h.values[i]?.deps, deps)) h.values[i] = { deps, fn }; return h.values[i].fn },
  useEffect(fn, deps) {
    const h = owner, i = h.cursor++
    if (!equal(h.values[i]?.deps, deps)) h.pending.push(() => { h.values[i]?.cleanup?.(); h.values[i] = { deps, cleanup: fn() } })
  },
}
const element = (type, props) => ({ type, props: props || {} })
const rn = {
  AppState: { currentState: 'active', addEventListener: (_, cb) => { listener = cb; return { remove: () => { listener = null } } } },
  StyleSheet: { create: styles => styles }, useWindowDimensions: () => ({ fontScale: 1 }),
  ...Object.fromEntries(['View', 'FlatList', 'Modal', 'SafeAreaView', 'TouchableOpacity', 'ActivityIndicator'].map(name => [name, name])),
}
const mocks = {
  react, 'react/jsx-runtime': { jsx: element, jsxs: element }, 'react-native': rn,
  '@/store/common/hook': { useNavActiveId: () => nav, useComponentIds: () => [{ name: screen }] },
  '@/config/constant': { COMPONENT_IDS: { home: 'home' } },
  '@/store/theme/hook': { useTheme: () => new Proxy({}, { get: (_, key) => `${themeMode}:${key}` }) },
  '@/core/player/listeningStats': { getListeningStats: (...args) => { calls.push(args); return provider(...args) }, formatListeningTime: ms => `${ms / 1000}秒` },
  './components': { Label: 'Label', Empty: 'Empty', Section: 'Section' },
}
function load(name) {
  const file = path.join(directory, name)
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const module = { exports: {} }
  vm.runInNewContext(output, { module, exports: module.exports, require: key => { assert.ok(key in mocks, key); return mocks[key] },
    setInterval: (fn, ms) => { assert.equal(ms, 5000); timers.set(++timerId, fn); return timerId }, clearInterval: id => timers.delete(id) })
  return module.exports
}
const { useListeningStats } = load('ListeningStatsState.ts')
function harness(fn = useListeningStats) {
  const h = { values: [], pending: [], cursor: 0, writes: 0 }
  return { h, render() { owner = h; h.cursor = 0; const result = fn(); h.pending.splice(0).forEach(run => run()); return result },
    destroy() { h.values.forEach(value => value?.cleanup?.()) } }
}
const settle = () => new Promise(resolve => setImmediate(resolve))
const track = (key, listenedMs = 1000) => ({ key, id: key, source: 'wy', name: `歌曲${key}`, singer: '歌手', listenedMs, lastPlayedAt: 1 })
const snapshot = (tracks = [], extra = {}) => ({ schemaVersion: 1, startedAt: 1, totalMs: 0, trackCount: tracks.length, tracks, offset: 0, hasMore: false, ...extra })
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
function nodes(value) {
  if (Array.isArray(value)) return value.flatMap(nodes)
  if (!value?.props) return []
  return [value, ...nodes(value.props.children), ...nodes(value.props.ListFooterComponent), ...nodes(value.props.ListEmptyComponent)]
}
async function main() {
  provider = async () => snapshot()
  const h = harness()
  let state = h.render()
  assert.equal(state.snapshot, null)
  await settle(); state = h.render()
  assert.equal(state.snapshot.trackCount, 0)
  assert.equal(timers.size, 1)
  assert.deepEqual(calls[0], [3, 0])
  console.log('PASS initial loading, empty native snapshot, foreground 5-second read-only timer')

  provider = async () => { throw Error('native unavailable') }
  await state.refreshOverview(); state = h.render()
  assert.equal(state.overviewError, true)
  provider = async () => snapshot([track('a')], { totalMs: 1000 })
  await state.refreshOverview(); state = h.render()
  assert.equal(state.overviewError, false)
  assert.equal(state.snapshot.totalMs, 1000)
  console.log('PASS native-unavailable failure and retry, real snapshot data')

  listener('background'); state = h.render()
  assert.equal(timers.size, 0)
  const before = calls.length
  await state.refreshOverview()
  assert.equal(calls.length, before)
  listener('active'); h.render(); await settle(); state = h.render()
  assert.equal(calls.length, before + 1)
  nav = 'nav_search'; h.render()
  assert.equal(timers.size, 0)
  nav = 'nav_home'; h.render(); await settle(); state = h.render()
  assert.equal(timers.size, 1)
  console.log('PASS background and tab leave stop polling; return immediately refreshes')
  screen = 'playDetail'; h.render()
  assert.equal(timers.size, 0)
  const coveredCalls = calls.length
  await state.refreshOverview()
  assert.equal(calls.length, coveredCalls)
  screen = 'home'; h.render(); await settle(); state = h.render()
  assert.equal(timers.size, 1)
  assert.equal(calls.length, coveredCalls + 1)
  console.log('PASS native screens covering Home stop reads; pop resumes fresh overview')

  provider = async (_limit, offset) => offset === 0 ? snapshot([track('a'), track('b')], { totalMs: 2000, hasMore: true })
    : snapshot([track('b'), track('c')], { totalMs: 3000, trackCount: 3, offset, hasMore: false })
  state.show(); await settle(); state = h.render()
  assert.equal(timers.size, 0)
  assert.equal(state.open, true)
  assert.deepEqual(calls.at(-1), [50, 0])
  state.loadMore(); state.loadMore(); await settle(); state = h.render()
  assert.deepEqual(Array.from(state.tracks, t => t.key), ['a', 'b', 'c'])
  assert.deepEqual(calls.at(-1), [50, 2])
  assert.equal(state.hasMore, false)
  console.log('PASS 50-row native pages, concurrent end-reached lock, changing totals and unique keys')

  provider = async () => snapshot([track('old')], { hasMore: true })
  state.refresh(); await settle(); state = h.render()
  const stale = deferred()
  provider = () => stale.promise
  state.loadMore()
  provider = async () => snapshot([track('fresh')])
  state.refresh(); await settle(); state = h.render()
  stale.resolve(snapshot([track('stale')], { offset: 1 })); await settle(); state = h.render()
  assert.deepEqual(Array.from(state.tracks, t => t.key), ['fresh'])
  const closing = deferred()
  provider = () => closing.promise
  state.refresh(); state.close(); state = h.render()
  closing.resolve(snapshot([track('closed')])); await settle(); state = h.render()
  assert.equal(state.open, false)
  assert.equal(state.tracks.length, 0)
  console.log('PASS manual refresh and close cancel stale pagination responses')

  provider = async () => { throw Error('native unavailable') }
  state.show(); await settle(); state = h.render()
  assert.ok(state.pageError)
  assert.equal(state.loading, false)
  provider = async () => snapshot([track('return')])
  state.refresh(); await settle(); state = h.render()
  assert.equal(state.pageError, '')
  assert.equal(state.tracks[0].key, 'return')
  const backgroundPage = deferred()
  provider = () => backgroundPage.promise
  state.refresh()
  listener('background'); h.render(); state = h.render()
  backgroundPage.resolve(snapshot([track('background-stale')])); await settle(); state = h.render()
  assert.equal(state.open, false)
  assert.equal(state.tracks.length, 0)
  listener('active'); h.render()
  provider = async () => snapshot([track('return')])
  state = h.render(); state.show(); await settle(); state = h.render()
  nav = 'nav_search'; h.render(); state = h.render()
  assert.equal(state.open, false)
  assert.equal(timers.size, 0)
  h.destroy()
  assert.equal(listener, null)
  assert.equal(timers.size, 0)
  console.log('PASS tab leave closes modal and removes timer/listener')

  nav = 'nav_home'
  const pending = deferred(); provider = () => pending.promise
  const cancelled = harness(); cancelled.render(); cancelled.destroy()
  const writes = cancelled.h.writes
  pending.resolve(snapshot()); await settle()
  assert.equal(cancelled.h.writes, writes)
  console.log('PASS unmounted overview promise never writes state')

  let mocked = { ...state, open: false, snapshot: null, overviewError: false }
  mocks['./ListeningStatsState'] = { useListeningStats: () => mocked }
  const Component = load('ListeningStats.tsx').default
  const ui = harness(Component)
  let tree = ui.render()
  assert.ok(nodes(tree).some(n => n.props.accessibilityLabel === '正在读取收听统计'))
  assert.equal(nodes(tree).filter(n => n.type === 'FlatList').length, 0)
  assert.ok(nodes(tree).some(n => n.props.title === '每首歌收听时长' && n.props.onPress === state.show))
  mocked = { ...mocked, snapshot: snapshot() }
  assert.ok(nodes(ui.render()).some(n => n.props.title === '从第一首歌开始积累'))
  mocked = { ...mocked, snapshot: snapshot([track('a')], { totalMs: 1000 }), overviewError: true }
  assert.ok(nodes(ui.render()).some(n => n.props.accessibilityLabel === '累计听歌 1秒'))
  assert.ok(nodes(ui.render()).some(n => n.props.action === '重新读取统计'))
  mocked = { ...mocked, open: true, tracks: [track('a')], loading: false, pageError: '读取失败' }
  tree = ui.render()
  const list = nodes(tree).find(n => n.type === 'FlatList')
  assert.ok(nodes(tree).some(n => n.type === 'Modal'))
  assert.equal(list.props.keyExtractor(track('stable')), 'stable')
  assert.equal(list.props.onEndReached, state.loadMore)
  assert.equal(list.props.onRefresh, state.refresh)
  assert.ok(nodes(tree).some(n => n.props.title === '关闭统计'))
  const rowElement = list.props.renderItem({ item: track('a'), index: 0 })
  rn.useWindowDimensions = () => ({ fontScale: 2 })
  mocks['react-native'].useWindowDimensions = rn.useWindowDimensions
  const row = rowElement.type(rowElement.props)
  assert.ok(row.props.style.some(style => style?.flexDirection === 'column'))
  for (const mode of ['light', 'dark']) {
    themeMode = mode
    assert.ok(ui.render().props.style.some(style => style?.backgroundColor === `${mode}:c-theme`))
  }
  console.log('PASS card loading/empty/data/error, modal entry/close/refresh/list, dark theme and large-font layout')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
