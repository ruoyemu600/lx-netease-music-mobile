'use strict'
// Component/callback mocks, not Android rendering or device navigation tests.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const read = p => fs.readFileSync(path.join(root, p), 'utf8')
const compile = (file, stubs = {}) => {
  const module = { exports: {} }
  const js = ts.transpileModule(read(file), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    fileName: file,
  }).outputText
  vm.runInNewContext(js, {
    module, exports: module.exports,
    global: { lx: {} },
    require: p => {
      if (p in stubs) return stubs[p]
      if (p.startsWith('../Views/')) return { __esModule: true, default: p }
      throw Error(`Missing stub ${p} in ${file}`)
    },
  })
  return module.exports
}
const check = (name, fn) => { fn(); console.log(`PASS ${name}`) }
const navigation = compile('src/screens/Home/materialNavigation.ts')
const constants = compile('src/config/constant.ts')
check('three real primary route IDs and stable secondary grouping', () => {
  assert.equal(Array.from(navigation.ROOT_TABS).join(','), 'nav_home,nav_search,nav_library')
  assert.equal(navigation.getRootTab('nav_daily_rec'), 'nav_home')
  assert.equal(navigation.getRootTab('nav_top'), 'nav_home')
  for (const id of ['nav_love','nav_local_music','nav_my_playlist','nav_onedrive','nav_play_history']) assert.equal(navigation.getRootTab(id), 'nav_library')
  assert.equal(navigation.getRootTab('nav_search'), 'nav_search')
  assert.equal(navigation.isRootTab('nav_love'), false)
})
check('new root routes appear in navigation and all translations', () => {
  const ids = constants.NAV_MENUS.map(item => item.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const id of navigation.ROOT_TABS) {
    assert.ok(ids.includes(id))
    for (const lang of ['zh-cn', 'zh-tw', 'en-us']) assert.ok(JSON.parse(read(`src/lang/${lang}.json`))[id])
  }
  assert.equal(constants.DEFAULT_SETTING.viewPrevState.id, 'nav_home')
})
const listeners = new Map()
const common = { navActiveId: 'nav_home' }
const states = []
const effects = []
let cursor = 0, dismissals = 0
const jsx = (type, props, key) => ({ type, props, key })
// Execute the real component with a state-event aware sandbox.
const source = ts.transpileModule(read('src/screens/Home/Vertical/Main.tsx'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
}).outputText
const module2 = { exports: {} }
vm.runInNewContext(source, {
  module: module2, exports: module2.exports,
  global: { lx: {}, state_event: { on: (id, fn) => listeners.set(id, fn), off: (id, fn) => { if (listeners.get(id) === fn) listeners.delete(id) } } },
  require: p => {
    if (p === 'react') return {
      useState: initial => {
        const index = cursor++
        if (!(index in states)) states[index] = initial
        return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next }]
      },
      useEffect: effect => { if (!effects.length) effects.push(effect) },
    }
    if (p === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    if (p === 'react-native') return { Keyboard: { dismiss: () => dismissals++ }, StyleSheet: { create: o => o }, View: 'View' }
    if (p === '@/store/common/state') return { __esModule: true, default: common }
    if (p.startsWith('../Views/')) return { __esModule: true, default: p }
    throw Error(`Unexpected import ${p}`)
  },
})
let clean
const render = () => { cursor = 0; return module2.exports.default() }
let tree = render()
check('initial page mounts only the real homepage', () => {
  assert.equal(tree.props.children.length, 1)
  assert.equal(tree.props.children[0].key, 'nav_home')
  assert.equal(tree.props.children[0].props.children.type, '../Views/MaterialHome')
})
clean = effects[0]()
const move = id => { common.navActiveId = id; listeners.get('navActiveIdUpdated')(id); tree = render() }
check('search and library tabs mount actual pages and retain homepage', () => {
  move('nav_search')
  assert.equal(tree.props.children.length, 2)
  assert.equal(tree.props.children.find(n => n.key === 'nav_search').props.children.type, '../Views/Search')
  assert.equal(tree.props.children.find(n => n.key === 'nav_home').props.style[1].display, 'none')
  move('nav_library')
  assert.equal(tree.props.children.find(n => n.key === 'nav_library').props.children.type, '../Views/MaterialLibrary')
  assert.equal(tree.props.children.filter(n => n.props.style[1].display === 'flex').length, 1)
})
check('legacy routes remain reachable and cached without duplicates', () => {
  for (const item of constants.NAV_MENUS) move(item.id)
  const count = tree.props.children.length
  move('nav_home'); move('nav_search'); move('nav_library')
  assert.equal(tree.props.children.length, count)
  assert.equal(count, constants.NAV_MENUS.length)
  assert.ok(dismissals > 0)
})
check('hidden pages leave accessibility tree and listeners clean up', () => {
  for (const node of tree.props.children) {
    assert.equal(node.props.accessibilityElementsHidden, node.key !== 'nav_library')
  }
  clean()
  assert.equal(listeners.size, 0)
})
check('search category exists once per form factor and root keeps bottom nav', () => {
  assert.ok(!read('src/screens/Home/Vertical/Header.tsx').includes('SearchTypeSelector'))
  assert.ok(!read('src/screens/Home/Horizontal/Header.tsx').includes('SearchTypeSelector'))
  assert.ok(read('src/screens/Home/Views/Search/index.tsx').includes('<SearchTypeSelector'))
  assert.ok(read('src/screens/Home/Vertical/index.tsx').includes('<BottomNavigation'))
  assert.ok(!read('src/screens/Home/Vertical/index.tsx').includes('componentId={componentId} componentId='))
})
check('visible detail back dispatch is independent of page registration order', () => {
  const back = compile('src/screens/Home/materialBack.ts')
  let search = 0, hidden = 0
  const a = back.registerMaterialBackHandler('nav_search', () => { search++; return true })
  const b = back.registerMaterialBackHandler('nav_daily_rec', () => { hidden++; return true })
  assert.equal(back.handleMaterialBack('nav_search'), true)
  assert.equal(search, 1); assert.equal(hidden, 0)
  assert.equal(back.handleMaterialBack('nav_home'), false)
  b(); a()
  assert.equal(back.handleMaterialBack('nav_search'), false)
  const old = back.registerMaterialBackHandler('nav_search', () => false)
  const current = back.registerMaterialBackHandler('nav_search', () => true)
  old()
  assert.equal(back.handleMaterialBack('nav_search'), true)
  current()
  for (const [file, id] of [
    ['Search/index.tsx', 'nav_search'], ['DailyRec/index.tsx', 'nav_daily_rec'],
    ['SongList/Content.tsx', 'nav_songlist'], ['MyPlaylist/index.tsx', 'nav_my_playlist'],
  ]) {
    const code = read(`src/screens/Home/Views/${file}`)
    assert.ok(code.includes(`registerMaterialBackHandler('${id}', onBackPress)`))
    assert.ok(!code.includes("BackHandler.addEventListener('hardwareBackPress'"))
  }
  const home = read('src/screens/Home/index.tsx')
  assert.ok(home.indexOf('commonState.componentIds.length > 1') < home.indexOf('if (handleMaterialBack('))
  assert.ok(home.indexOf('if (handleMaterialBack(') < home.indexOf("commonState.navActiveId !== 'nav_home'"))
})
check('new icon literals resolve to packaged glyphs, not missing font symbols', () => {
  const glyphs = new Set(JSON.parse(read('src/resources/fonts/selection.json')).icons.map(icon => icon.properties.name))
  for (const file of [
    'src/screens/Home/Vertical/Header.tsx', 'src/screens/PlayDetail/Vertical/Pic.tsx',
    'src/screens/Home/Views/Search/HeaderBar/SearchInput.tsx',
    'src/screens/Home/Views/MaterialHome/index.tsx', 'src/screens/Home/Views/MaterialHome/components.tsx',
    'src/screens/Home/Views/MaterialLibrary/index.tsx',
  ]) {
    for (const match of read(file).matchAll(/<Icon\s+name="([^"]+)"/g)) assert.ok(glyphs.has(match[1]), `${file}: unknown ${match[1]}`)
  }
  for (const name of ['play', 'pause', 'search-2', 'album', 'love', 'love-filled', 'music_time', 'download-2', 'add_folder', 'sd-card']) assert.ok(glyphs.has(name), name)
})
console.log('Material shell callback tests passed; real-device layout and playback remain separate.')
