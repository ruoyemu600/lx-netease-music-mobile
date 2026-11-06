import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import { useNavActiveId, useStatusbarHeight } from '@/store/common/hook'
import { useI18n } from '@/lang'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import StatusBar from '@/components/common/StatusBar'
import { setNavActiveId } from '@/core/common'
import commonState from '@/store/common/state'
import { getRootTab, isRootTab } from '../materialNavigation'
import { handleMaterialBack } from '../materialBack'

export default () => {
  const theme = useTheme()
  const t = useI18n()
  const id = useNavActiveId()
  const inset = useStatusbarHeight()
  const root = isRootTab(id)
  const openMenu = () => global.app_event.changeMenuVisible(true)
  const back = () => {
    if (handleMaterialBack(id)) return
    setNavActiveId(id === 'nav_setting' ? commonState.lastNavActiveId : getRootTab(id))
  }
  return (
    <View style={{ paddingTop: inset, backgroundColor: theme['c-main-background'] }}>
      <StatusBar />
      <View style={styles.row}>
        {root ? (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="更多音乐功能" style={styles.brand} onPress={openMenu}>
            <Icon name="logo" rawSize={20} color={theme['c-primary']} />
            <Text size={13} style={styles.brandText}>LX-N</Text>
            <Text size={9} color={theme['c-font-label']} style={styles.edition}>MATERIAL</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.heading}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="返回" style={styles.button} onPress={back}>
              <Icon name="chevron-left" rawSize={22} color={theme['c-font']} />
            </TouchableOpacity>
            <Text size={20} numberOfLines={1} style={styles.title}>{t(id)}</Text>
          </View>
        )}
        {!root ? (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('nav_search')} style={styles.button} onPress={() => setNavActiveId('nav_search')}>
            <Icon name="search-2" rawSize={22} color={theme['c-font-label']} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="更多音乐功能" style={styles.button} onPress={openMenu}>
          <Icon name="menu" rawSize={21} color={theme['c-font-label']} />
        </TouchableOpacity>
        {root ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('nav_setting')}
            style={[styles.button, styles.settings, { backgroundColor: theme['c-content-background'] }]}
            onPress={() => setNavActiveId('nav_setting')}
          >
            <Icon name="setting" rawSize={22} color={theme['c-primary']} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { minHeight: 56, paddingHorizontal: 12, paddingVertical: 4, flexDirection: 'row', alignItems: 'center' },
  brand: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingLeft: 8, gap: 9 },
  brandText: { fontWeight: '600', letterSpacing: 1.5 },
  edition: { letterSpacing: 1.2 },
  heading: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, marginLeft: 4, fontWeight: '500' },
  button: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  settings: { marginLeft: 4 },
})
