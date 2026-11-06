import { memo } from 'react'
import { ActivityIndicator, FlatList, Modal, SafeAreaView, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native'
import { formatListeningTime, type ListeningTrack } from '@/core/player/listeningStats'
import { useTheme } from '@/store/theme/hook'
import { Empty, Label, Section } from './components'
import { useListeningStats } from './ListeningStatsState'

function StatsButton({ title, onPress, disabled = false }: { title: string, onPress: () => void, disabled?: boolean }) {
  const theme = useTheme()
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.button, { backgroundColor: theme['c-primary-background-active'], opacity: disabled ? 0.6 : 1 }]}>
    <Label style={[styles.buttonText, { color: theme['c-primary-font-active'] }]}>{title}</Label>
  </TouchableOpacity>
}

function TrackRow({ item, rank }: { item: ListeningTrack, rank: number }) {
  const theme = useTheme()
  const { fontScale } = useWindowDimensions()
  return <View style={[styles.track, fontScale > 1.3 && styles.trackLarge]}>
    <View style={styles.trackInfo}>
      <Label numberOfLines={2} style={styles.trackTitle}>{rank}. {item.name || '未知歌曲'}</Label>
      <Label numberOfLines={1} style={[styles.detail, { color: theme['c-font-label'] }]}>{item.singer || '未知歌手'}</Label>
    </View>
    <Label style={[styles.trackTime, fontScale > 1.3 && styles.trackTimeLarge, { color: theme['c-primary'] }]}>{formatListeningTime(item.listenedMs)}</Label>
  </View>
}

/** Place as the final child of MaterialHome's ScrollView. The only FlatList lives in a native Modal. */
export default memo(function ListeningStats() {
  const theme = useTheme()
  const stats = useListeningStats()
  const snapshot = stats.snapshot
  return <View testID="listening-stats" style={[styles.card, { backgroundColor: theme['c-theme'] }]}>
    <Section title="累计听歌" />
    {snapshot ? <>
      <Label accessibilityLabel={`累计听歌 ${formatListeningTime(snapshot.totalMs)}`} style={[styles.total, { color: theme['c-primary'] }]}>{formatListeningTime(snapshot.totalMs)}</Label>
      <Label style={[styles.detail, { color: theme['c-font-label'] }]}>已听 {snapshot.trackCount} 首歌</Label>
      {snapshot.trackCount === 0 ? <Empty title="从第一首歌开始积累" detail="实际播放音乐后，收听时长会记录在这里。" />
        : <View style={styles.preview}>{snapshot.tracks.slice(0, 3).map((item, index) => <TrackRow key={item.key} item={item} rank={index + 1} />)}</View>}
    </> : !stats.overviewError ? <View accessibilityLabel="正在读取收听统计" style={styles.loading}><ActivityIndicator color={theme['c-primary']} /><Label>正在读取收听统计…</Label></View> : null}
    {stats.overviewError && <Empty title="暂时没能读取收听统计" detail={snapshot ? '当前显示上次读取的统计；重新读取以更新。' : '统计接口暂未就绪或读取失败，请重新读取。'} action="重新读取统计" onPress={() => { void stats.refreshOverview() }} />}
    <Label style={[styles.note, { color: theme['c-font-label'] }]}>仅统计实际播放 · 从启用本功能开始记录</Label>
    <StatsButton title="每首歌收听时长" onPress={stats.show} />
    {stats.open && <Modal visible animationType="slide" onRequestClose={stats.close} presentationStyle="fullScreen">
      <SafeAreaView style={[styles.modal, { backgroundColor: theme['c-main-background'] }]}>
        <View style={styles.modalHeader}>
          <Label accessibilityRole="header" style={styles.modalTitle}>每首歌收听时长</Label>
          <View style={styles.controls}>
            <StatsButton title="刷新统计" onPress={stats.refresh} />
            <StatsButton title="关闭统计" onPress={stats.close} />
          </View>
          <Label style={[styles.detail, { color: theme['c-font-label'] }]}>按累计时长排序，播放中顺序可能变化，可刷新</Label>
        </View>
        <FlatList<ListeningTrack>
          testID="listening-stats-tracks"
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={stats.tracks}
          keyExtractor={item => item.key}
          renderItem={({ item, index }) => <TrackRow item={item} rank={index + 1} />}
          onEndReached={stats.loadMore}
          onEndReachedThreshold={0.3}
          refreshing={stats.loading && stats.tracks.length === 0}
          onRefresh={stats.refresh}
          ListEmptyComponent={!stats.loading && !stats.pageError ? <Empty title="还没有收听记录" detail="实际播放音乐后，每首歌的累计时长会显示在这里。" /> : null}
          ListFooterComponent={<View style={styles.footer}>
            {stats.loading && <View accessibilityLabel="正在读取歌曲统计" style={styles.loading}><ActivityIndicator color={theme['c-primary']} /><Label>正在读取…</Label></View>}
            {!!stats.pageError && <Empty title={stats.pageError} detail="已有收听记录会保留在本机。" action="重新读取歌曲统计" onPress={stats.hasMore ? stats.loadMore : stats.refresh} />}
            {!stats.loading && !stats.pageError && !!stats.tracks.length && <Label style={[styles.detail, { color: theme['c-font-label'] }]}>{stats.hasMore ? '继续向下查看' : '已显示全部记录'}</Label>}
          </View>}
        />
      </SafeAreaView>
    </Modal>}
  </View>
})

const styles = StyleSheet.create({
  card: { borderRadius: 28, padding: 20, marginTop: 20, gap: 12 },
  total: { fontSize: 30, lineHeight: 40, fontWeight: '700' },
  detail: { fontSize: 12, lineHeight: 20 },
  note: { fontSize: 12, lineHeight: 20, marginTop: 4 },
  preview: { marginTop: 4 },
  button: { minHeight: 48, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 14, lineHeight: 22, fontWeight: '600', textAlign: 'center' },
  track: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, paddingVertical: 12 },
  trackLarge: { flexDirection: 'column', alignItems: 'stretch', gap: 4 },
  trackInfo: { flex: 1, minWidth: 0 },
  trackTitle: { fontSize: 15, lineHeight: 23, fontWeight: '600' },
  trackTime: { flexShrink: 0, maxWidth: '48%', fontSize: 13, lineHeight: 22, fontWeight: '600', textAlign: 'right' },
  trackTimeLarge: { maxWidth: '100%', textAlign: 'left' },
  loading: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' },
  modal: { flex: 1 },
  modalHeader: { padding: 20, gap: 12 },
  modalTitle: { fontSize: 24, lineHeight: 34, fontWeight: '700' },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 28 },
  footer: { paddingVertical: 16 },
})
