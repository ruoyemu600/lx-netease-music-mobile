import { type ReactNode } from 'react'
import { StyleSheet, Text, TouchableOpacity, View, type TextProps } from 'react-native'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { type NAV_ID_Type } from '@/config/constant'
import { setNavActiveId } from '@/core/common'
import { openMaterialList } from '../materialData'

export const Label = ({ style, ...props }: TextProps) => {
  const theme = useTheme()
  return <Text {...props} style={[{ color: theme['c-font'], fontSize: 15, lineHeight: 22 }, style]} />
}

export const Action = ({ title, onPress, icon = 'chevron-right' }: { title: string, onPress: () => void, icon?: string }) => {
  const theme = useTheme()
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={styles.action}>
    <Label style={{ color: theme['c-primary'], fontSize: 13, fontWeight: '600' }}>{title}</Label>
    <Icon name={icon} rawSize={16} color={theme['c-primary']} />
  </TouchableOpacity>
}

export const Section = ({ title, action, onPress }: { title: string, action?: string, onPress?: () => void }) => <View style={styles.section}>
  <Label accessibilityRole="header" style={styles.sectionTitle}>{title}</Label>
  {action && onPress && <Action title={action} onPress={onPress} />}
</View>

export const Empty = ({ title, detail, action, onPress }: { title: string, detail: string, action?: string, onPress?: () => void }) => {
  const theme = useTheme()
  return <View style={[styles.empty, { backgroundColor: theme['c-theme'] }]}>
    <Icon name="album" rawSize={28} color={theme['c-primary']} />
    <Label style={styles.emptyTitle}>{title}</Label>
    <Label style={[styles.detail, { color: theme['c-font-label'] }]}>{detail}</Label>
    {action && onPress && <Action title={action} onPress={onPress} />}
  </View>
}

export const Destination = ({ title, subtitle, icon, nav, onPress }: {
  title: string, subtitle?: string, icon: string, nav?: NAV_ID_Type, onPress?: () => void,
}) => {
  const theme = useTheme()
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={title} onPress={onPress ?? (() => nav && setNavActiveId(nav))} style={[styles.destination, { backgroundColor: theme['c-theme'] }]}>
    <View style={[styles.destinationIcon, { backgroundColor: theme['c-primary-background-active'] }]}><Icon name={icon} rawSize={21} color={theme['c-primary-font-active']} /></View>
    <View style={styles.grow}>
      <Label style={styles.destinationTitle}>{title}</Label>
      {!!subtitle && <Label numberOfLines={2} style={[styles.detail, { color: theme['c-font-label'] }]}>{subtitle}</Label>}
    </View>
    <Icon name="chevron-right" rawSize={18} color={theme['c-font-label']} />
  </TouchableOpacity>
}

export const PlaylistTile = ({ item, compact = false }: { item: { id: string, name: string }, compact?: boolean }) => {
  const theme = useTheme()
  const favorite = item.id === 'love'
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`打开歌单：${item.name}`} onPress={() => openMaterialList(item.id)} style={[styles.tile, compact && styles.compact, { backgroundColor: theme['c-theme'] }]}>
    <View style={[styles.tileArt, { backgroundColor: favorite ? theme['c-primary-background-active'] : theme['c-content-background'] }]}>
      <Icon name={favorite ? 'love-filled' : 'album'} rawSize={compact ? 30 : 38} color={favorite ? theme['c-primary-font-active'] : theme['c-primary']} />
    </View>
    <Label numberOfLines={2} style={styles.tileName}>{item.name}</Label>
    <Label style={[styles.detail, { color: theme['c-font-label'] }]}>{favorite ? '收藏歌单' : item.id === 'default' ? '试听列表' : '我的歌单'}</Label>
  </TouchableOpacity>
}

export const ScreenHeader = ({ title, subtitle, children }: { title: string, subtitle: string, children?: ReactNode }) => {
  const theme = useTheme()
  return <View style={styles.screenHeader}>
    <Label style={[styles.eyebrow, { color: theme['c-primary'] }]}>{subtitle}</Label>
    <View style={styles.titleRow}><Label accessibilityRole="header" style={styles.title}>{title}</Label>{children}</View>
  </View>
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  action: { minHeight: 48, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  section: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12 },
  sectionTitle: { fontSize: 21, lineHeight: 29, fontWeight: '700', flexShrink: 1 },
  empty: { borderRadius: 24, padding: 24, gap: 8, alignItems: 'flex-start' },
  emptyTitle: { fontSize: 18, lineHeight: 26, fontWeight: '600' },
  detail: { fontSize: 12, lineHeight: 19 },
  destination: { minHeight: 76, flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderRadius: 22, marginBottom: 10 },
  destinationIcon: { height: 44, width: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  destinationTitle: { fontSize: 15, lineHeight: 23, fontWeight: '600' },
  tile: { flex: 1, minWidth: 0, maxWidth: '50%', borderRadius: 24, padding: 12, marginBottom: 12 },
  compact: { width: '48%', flex: 0 },
  tileArt: { height: 112, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  tileName: { fontSize: 15, lineHeight: 22, fontWeight: '600', minHeight: 44 },
  screenHeader: { paddingTop: 26, paddingBottom: 18 },
  eyebrow: { fontSize: 12, lineHeight: 20, letterSpacing: 2, fontWeight: '600' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  title: { fontSize: 34, lineHeight: 44, fontWeight: '700', letterSpacing: -1, flex: 1 },
})
