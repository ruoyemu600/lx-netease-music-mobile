import { memo } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import Text from '@/components/common/Text'
import { setNavActiveId } from '@/core/common'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { useNavActiveId } from '@/store/common/hook'
import commonState from '@/store/common/state'
import { useKeyboard } from '@/utils/hooks'
import { getRootTab, ROOT_TABS, type RootTab } from '../materialNavigation'

const TabIcon = ({ id, color }: { id: RootTab; color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    {id === 'nav_home' ? <Path d="M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /> : null}
    {id === 'nav_search' ? <><Circle cx={10.5} cy={10.5} r={6.5} /><Path d="m16 16 5 5" /></> : null}
    {id === 'nav_library' ? <><Rect x={6} y={3} width={15} height={17} rx={2} /><Path d="M3 7v15h14M16 7v7l-4 1" /><Circle cx={11} cy={16} r={1.8} fill={color} stroke="none" /></> : null}
  </Svg>
)

export default memo(() => {
  const theme = useTheme()
  const t = useI18n()
  const id = useNavActiveId()
  const { keyboardShown } = useKeyboard()
  if (keyboardShown) return null
  const selected = getRootTab(id === 'nav_setting' ? commonState.lastNavActiveId : id)
  return (
    <View style={[styles.container, { backgroundColor: theme['c-main-background'] }]}>
      <View accessibilityRole="tablist" style={[styles.bar, { backgroundColor: theme['c-primary-light-1000'] }]}>
        {ROOT_TABS.map(tab => {
          const active = tab === selected
          const color = active ? theme['c-primary'] : theme['c-font-label']
          return (
            <TouchableOpacity
              key={tab}
              accessibilityRole="tab"
              accessibilityLabel={t(tab)}
              accessibilityState={{ selected: active }}
              style={styles.tab}
              activeOpacity={0.7}
              onPress={() => { global.app_event.changeMenuVisible(false); setNavActiveId(tab) }}
            >
              <View style={[styles.indicator, { backgroundColor: active ? theme['c-primary-background-active'] : 'transparent' }]}>
                <TabIcon id={tab} color={color} />
              </View>
              <Text size={11} color={color} style={active ? styles.selectedLabel : undefined}>{t(tab)}</Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  container: { paddingHorizontal: 12, paddingTop: 2, paddingBottom: 6 },
  bar: { flexDirection: 'row', borderRadius: 28, paddingVertical: 6 },
  tab: { flex: 1, minHeight: 60, alignItems: 'center', justifyContent: 'center', gap: 3 },
  indicator: { width: 64, height: 32, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  selectedLabel: { fontWeight: '600' },
})
