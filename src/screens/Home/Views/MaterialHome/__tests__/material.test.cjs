/* Run from repository root: node src/screens/Home/Views/MaterialHome/__tests__/material.test.cjs
 * Lightweight hook/element mocks; no Metro, native runtime or package installation.
 */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '../../../../../..')
const sourceRoot = 'src/screens/Home/Views/'
let activeHooks
const element = (type, props) => ({ type, props: props || {} })
const react = {
  createElement: (type, props, ...children) => element(type, { ...props, ...(children.length ? { children } : {}) }),
  memo: fn => fn,
  useState: initial => {
    const owner = activeHooks
    const index = owner.cursor++
    if (!(index in owner.values)) owner.values[index] = typeof initial === 'function' ? initial() : initial
    return [owner.values[index], value => { owner.writes++; owner.values[index] = typeof value === 'function' ? value(owner.values[index]) : value }]
  },
  useRef: initial => {
    const index = activeHooks.cursor++
    if (!(index in activeHooks.values)) activeHooks.values[index] = { current: initial }
    return activeHooks.values[index]
  },
  useCallback: fn => fn,
  useEffect: fn => { activeHooks.effects.push(fn) },
}
const createHooks = (initial = []) => ({ values: initial, cursor: 0, effects: [], cleanups: [], writes: 0 })
const render = (hooks, callback) => { activeHooks = hooks; hooks.cursor = 0; hooks.effects = []; return callback() }
const mount = hooks => { hooks.cleanups = hooks.effects.map(effect => effect()).filter(Boolean) }
const unmount = hooks => hooks.cleanups.forEach(cleanup => cleanup())
const settle = () => new Promise(resolve => setImmediate(resolve))
const emitter = () => {
  const listeners = new Map()
  return {
    on: (event, fn) => { if (!listeners.has(event)) listeners.set(event, new Set()); listeners.get(event).add(fn) },
    off: (event, fn) => listeners.get(event)?.delete(fn),
    emit: event => listeners.get(event)?.forEach(fn => fn()),
    count: event => listeners.get(event)?.size || 0,
  }
}
const events = emitter()
const calls = []
const cache = { key: '', entries: [], errors: [] }
let historyProvider = async () => []
let permission = false
let scanProvider = async () => ({ entries: [], errors: [] })
let currentMusic = { id: null, name: '', singer: '', pic: null }
let cookie = ''
let lists = [{ id: 'default', name: '试听列表' }, { id: 'love', name: '我的收藏' }, { id: 'user-real', name: '真实用户歌单' }]
const commonState = { componentIds: [] }
const theme = new Proxy({}, { get: (_, key) => `semantic:${String(key)}` })
const local = { id: '/music/a.flac', source: 'local', name: '本机曲目', singer: '歌手', interval: '03:12', meta: { picUrl: '/music/a.jpg', filePath: '/music/a.flac', ext: 'flac' } }
const mocks = {
  react,
  'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'Fragment' },
  'react-native': { StyleSheet: { create: value => value }, View: 'View', Text: 'Text', ScrollView: 'ScrollView', TouchableOpacity: 'TouchableOpacity', FlatList: 'FlatList', Platform: { OS: 'android', Version: 33 }, PermissionsAndroid: { PERMISSIONS: { READ_EXTERNAL_STORAGE: 'legacy', READ_MEDIA_AUDIO: 'audio' }, check: async () => permission } },
  'rn-fetch-blob': { fs: { dirs: { MusicDir: '/music' } } },
  '@/core/common': { setNavActiveId: id => calls.push(['nav', id]) },
  '@/core/list': { setActiveList: id => calls.push(['activeList', id]), overwriteListMusics: async (id, tracks) => calls.push(['overwrite', id, tracks]) },
  '@/core/player/player': { playList: async (id, index) => calls.push(['play', id, index]), togglePlay: () => calls.push(['toggle']) },
  '@/core/player/playedList': { clearPlayedList: () => calls.push(['clearPlayed']) },
  '@/core/player/playHistory': { getPlayHistoryByRange: (...args) => historyProvider(...args) },
  '@/core/localMusic': { localMusicCache: cache, normalizeLocalPath: value => value.replace(/\/+$/, ''), parseLocalPaths: value => JSON.parse(value), getLocalMusicScanKey: (paths, tasks) => JSON.stringify([paths, tasks]), scanLocalMusic: (...args) => scanProvider(...args) },
  '@/store/common/state': commonState,
  '@/store/download/state': { tasks: [] },
  '@/store/list/action': { setTempListMeta: meta => calls.push(['meta', meta]) },
  '@/store/list/hook': { useMyList: () => lists },
  '@/store/setting/hook': { useSettingValue: key => key === 'common.wy_cookie' ? cookie : key === 'localMusic.paths' ? '[]' : '/music/downloads' },
  '@/store/player/hook': { usePlayerMusicInfo: () => currentMusic, useIsPlay: () => false },
  '@/store/user/hook': { useWyFollowedArtists: () => [], useWySubscribedAlbums: () => [] },
  '@/store/theme/hook': { useTheme: () => theme },
  '@/config/constant': { LIST_IDS: { TEMP: 'temp', LOVE: 'love' } },
  '@/navigation': { navigations: { pushDownloadManagerScreen: async id => calls.push(['download', id]) } },
  '@/utils/tools': { toast: message => calls.push(['toast', message]) },
  '@/components/common/Icon': { Icon: 'Icon' },
  '@/components/common/Image': 'Image',
}
const moduleCache = new Map()
function load(relative) {
  const filename = path.resolve(root, relative)
  if (moduleCache.has(filename)) return moduleCache.get(filename)
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText
  const module = { exports: {} }
  const requireMock = name => {
    if (name in mocks) return mocks[name]
    // Statistics has a dedicated suite; this suite tests the existing homepage actions.
    if (name === './ListeningStats') return 'ListeningStats'
    if (name.includes('SubscribedAlbums/ListItem')) return 'AlbumItem'
    if (name.includes('FollowedArtists/ListItem')) return 'ArtistItem'
    if (name.startsWith('.')) {
      const resolved = path.resolve(path.dirname(filename), name)
      const target = ['.ts', '.tsx', '/index.tsx'].map(ext => resolved + ext).find(file => fs.existsSync(file))
      assert.ok(target, `Missing local import ${name}`)
      return load(path.relative(root, target))
    }
    throw new Error(`Unexpected dependency: ${name}`)
  }
  vm.runInNewContext(output, { exports: module.exports, module, require: requireMock, global: { app_event: events }, console }, { filename })
  moduleCache.set(filename, module.exports)
  return module.exports
}
function nodes(value) {
  if (Array.isArray(value)) return value.flatMap(nodes)
  if (!value || typeof value !== 'object' || !value.props) return []
  return [value, ...nodes(value.props.children), ...nodes(value.props.ListHeaderComponent), ...nodes(value.props.ListFooterComponent), ...nodes(value.props.ListEmptyComponent)]
}
function hasText(tree, text) {
  return nodes(tree).some(node => node.props.children === text || node.props.title === text)
}

async function main() {
  const data = load(sourceRoot + 'materialData.ts')
  calls.length = 0
  data.openMaterialList('user-real')
  assert.deepEqual(calls, [['activeList', 'user-real'], ['nav', 'nav_love']])
  console.log('PASS playlist activation precedes navigation')

  calls.length = 0
  await data.playMaterialTracks('history_local', [local], 0)
  assert.equal(calls.find(call => call[0] === 'overwrite')[2][0].source, 'local')
  assert.deepEqual(calls.at(-1), ['play', 'temp', 0])
  console.log('PASS history/local playback preserves source and uses real player APIs')

  calls.length = 0
  data.openMaterialDownloads()
  assert.equal(calls[0][0], 'toast')
  commonState.componentIds = [{ id: 'native-home' }]
  data.openMaterialDownloads()
  await settle()
  assert.deepEqual(calls.at(-1), ['download', 'native-home'])
  console.log('PASS download uses current native component and handles missing screen')

  historyProvider = async () => [
    { id: 'old', playedAt: 1, musicInfo: local },
    { id: 'new', playedAt: 3, musicInfo: local },
    { id: 'other', playedAt: 2, musicInfo: { ...local, id: 'online', source: 'wy' } },
  ]
  const historyHooks = createHooks()
  render(historyHooks, data.useMaterialHistory)
  mount(historyHooks)
  await settle()
  const history = render(historyHooks, data.useMaterialHistory)
  assert.equal(history.items.length, 2)
  assert.equal(history.items[0].id, 'new')
  assert.equal(events.count('playHistoryUpdated'), 1)
  unmount(historyHooks)
  assert.equal(events.count('playHistoryUpdated'), 0)
  console.log('PASS history deduplicates latest tracks, sorts and removes event subscription')

  let resolveHistory
  historyProvider = () => new Promise(resolve => { resolveHistory = resolve })
  const cancelledHistory = createHooks()
  render(cancelledHistory, data.useMaterialHistory)
  mount(cancelledHistory)
  unmount(cancelledHistory)
  const historyWrites = cancelledHistory.writes
  resolveHistory([])
  await settle()
  assert.equal(cancelledHistory.writes, historyWrites)
  console.log('PASS history async completion does not write after unmount')

  let scans = 0
  scanProvider = async () => { scans++; return { entries: [{ musicInfo: local }], errors: [] } }
  const permissionHooks = createHooks()
  render(permissionHooks, () => data.useMaterialLocalMusic(true))
  mount(permissionHooks)
  await settle()
  assert.equal(render(permissionHooks, () => data.useMaterialLocalMusic(true)).status, 'permission')
  assert.equal(scans, 0)
  unmount(permissionHooks)
  permission = true
  const localHooks = createHooks()
  render(localHooks, () => data.useMaterialLocalMusic(true))
  mount(localHooks)
  await settle()
  const localData = render(localHooks, () => data.useMaterialLocalMusic(true))
  assert.equal(localData.entries[0].musicInfo.id, local.id)
  assert.equal(localData.status, 'ready')
  localData.reload()
  await settle()
  assert.equal(scans, 2, 'manual refresh bypasses the session cache')
  unmount(localHooks)
  assert.equal(events.count('download_status_update'), 0)
  console.log('PASS local music permission gating, real scanner result/cache and cleanup')

  cache.key = ''
  let resolveScan, isCancelled
  scanProvider = (_paths, _excluded, cancelled) => { isCancelled = cancelled; return new Promise(resolve => { resolveScan = resolve }) }
  const cancelledLocal = createHooks()
  render(cancelledLocal, () => data.useMaterialLocalMusic(true))
  mount(cancelledLocal)
  await settle()
  unmount(cancelledLocal)
  assert.equal(isCancelled(), true)
  const localWrites = cancelledLocal.writes
  resolveScan({ entries: [{ musicInfo: local }], errors: [] })
  await settle()
  assert.equal(cancelledLocal.writes, localWrites)
  assert.equal(cache.key, '')
  console.log('PASS scanner cancellation blocks stale cache/state writes')

  const Home = load(sourceRoot + 'MaterialHome/index.tsx').default
  let tree = render(createHooks(), () => Home())
  assert.equal(tree.type, 'ScrollView')
  const search = nodes(tree).find(node => node.props.accessibilityLabel === '去搜索音乐')
  assert.ok(search)
  search.props.onPress()
  assert.deepEqual(calls.at(-1), ['nav', 'nav_search'])
  assert.equal(nodes(tree).filter(node => node.type === 'FlatList').length, 0)
  currentMusic = { ...local, pic: local.meta.picUrl }
  tree = render(createHooks(), () => Home())
  assert.ok(hasText(tree, local.name))
  nodes(tree).find(node => node.props.accessibilityLabel === '继续播放当前歌曲').props.onPress()
  assert.deepEqual(calls.at(-1), ['toggle'])
  console.log('PASS home empty-search and real-track playback branches without nested lists')

  const Library = load(sourceRoot + 'MaterialLibrary/index.tsx').default
  tree = render(createHooks(), () => Library())
  assert.equal(tree.type, 'FlatList')
  assert.equal(tree.props.data, lists)
  assert.equal(tree.props.numColumns, 2)
  assert.equal(nodes(tree).filter(node => node.type === 'FlatList').length, 1)
  for (const category of ['songs', 'albums', 'artists']) {
    tree = render(createHooks([category]), () => Library())
    assert.equal(tree.type, 'FlatList')
    assert.equal(nodes(tree).filter(node => node.type === 'FlatList').length, 1)
    if (category !== 'songs') assert.ok(hasText(tree.props.ListEmptyComponent, '让收藏在这里相遇'))
  }
  assert.ok(nodes(tree).some(node => node.props.nav === 'nav_my_playlist'))
  assert.ok(nodes(tree).some(node => node.props.nav === 'nav_local_music'))
  assert.ok(nodes(tree).some(node => node.props.nav === 'nav_onedrive'))
  console.log('PASS library real allList grid, account empty states, categories and retained source routes')

  for (const file of ['MaterialHome/index.tsx', 'MaterialHome/components.tsx', 'MaterialLibrary/index.tsx']) {
    const source = fs.readFileSync(path.join(root, sourceRoot, file), 'utf8')
    assert.ok(source.includes('StyleSheet.create('))
    assert.ok(!source.includes('createStyle('))
    assert.ok(!source.includes('scaleSize'))
    assert.ok(!/#[0-9a-f]{3,8}\b/i.test(source))
  }
  console.log('PASS new layouts use native dp StyleSheet and semantic colors')
  console.log('All 10 material checks passed.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
