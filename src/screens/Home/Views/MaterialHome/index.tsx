import { memo, useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import Image from '@/components/common/Image'
import { Icon } from '@/components/common/Icon'
import { setNavActiveId } from '@/core/common'
import { togglePlay } from '@/core/player/player'
import { useIsPlay, usePlayerMusicInfo } from '@/store/player/hook'
import { useMyList } from '@/store/list/hook'
import { useTheme } from '@/store/theme/hook'
import { LIST_IDS } from '@/config/constant'
import { Action, Empty, Label, PlaylistTile, ScreenHeader, Section } from './components'
import { openMaterialDownloads, openMaterialList, playMaterialTracks, useMaterialHistory } from '../materialData'
import ListeningStats from './ListeningStats'

export default memo(function MaterialHome() {
  const theme = useTheme()
  const music = usePlayerMusicInfo()
  const isPlay = useIsPlay()
  const lists = useMyList()
  const { items: history, status, reload } = useMaterialHistory()
  const playbackLock = useRef(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const mounted = useRef(true)
  // Preview rows do not host their own virtualized list: the home has one scroll owner.
  const playRecent = async (index: number) => {
    if (playbackLock.current) return
    playbackLock.current = true
    setBusyId(history[index].id)
    try { await playMaterialTracks('material_home_history', history.map(item => item.musicInfo), index) }
    finally { playbackLock.current = false; if (mounted.current) setBusyId(null) }
  }
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  return <ScrollView testID="material-home" style={{ flex: 1, backgroundColor: theme['c-main-background'] }} contentContainerStyle={styles.content}>
    <ScreenHeader title="听见，日常" subtitle="为你的每一天">
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="搜索音乐" onPress={() => setNavActiveId('nav_search')} style={[styles.search, { backgroundColor: theme['c-theme'] }]}>
        <Icon name="search-2" rawSize={23} color={theme['c-primary']} />
      </TouchableOpacity>
    </ScreenHeader>

    <View style={[styles.continue, { backgroundColor: theme['c-primary-background-active'] }]}>
      <Label style={[styles.kicker, { color: theme['c-primary-font-active'] }]}>{music.id ? (isPlay ? '正在播放' : '继续播放') : '从一首喜欢的歌开始'}</Label>
      <View style={styles.continueRow}>
        <Image url={music.pic} style={styles.cover} />
        <View style={styles.trackInfo}>
          <Label numberOfLines={2} style={[styles.trackTitle, { color: theme['c-primary-font-active'] }]}>{music.id ? music.name : '今天，想听些什么？'}</Label>
          <Label numberOfLines={1} style={[styles.trackSinger, { color: theme['c-primary-font-active'] }]}>{music.id ? (music.singer || '未知歌手') : '搜索歌曲、歌手，发现下一首喜欢'}</Label>
        </View>
      </View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={music.id ? (isPlay ? '暂停当前歌曲' : '继续播放当前歌曲') : '去搜索音乐'} onPress={() => music.id ? togglePlay() : setNavActiveId('nav_search')} style={[styles.primaryButton, { backgroundColor: theme['c-primary'] }]}>
        <Icon name={music.id ? (isPlay ? 'pause' : 'play') : 'search-2'} rawSize={20} color={theme['c-button-font-selected']} />
        <Label style={[styles.buttonText, { color: theme['c-button-font-selected'] }]}>{music.id ? (isPlay ? '暂停播放' : '继续播放') : '去搜索'}</Label>
      </TouchableOpacity>
    </View>

    <TouchableOpacity accessibilityRole="button" accessibilityLabel="打开每日推荐" onPress={() => setNavActiveId('nav_daily_rec')} style={[styles.recommend, { backgroundColor: theme['c-theme'] }]}>
      <View style={[styles.dateBadge, { backgroundColor: theme['c-content-background'] }]}>
        <Label style={[styles.date, { color: theme['c-primary'] }]}>{new Date().getDate().toString().padStart(2, '0')}</Label>
        <Label style={[styles.day, { color: theme['c-font-label'] }]}>今日</Label>
      </View>
      <View style={styles.trackInfo}><Label style={styles.recTitle}>每日推荐</Label><Label style={[styles.smallText, { color: theme['c-font-label'] }]}>从网易云推荐中，寻找今天的共鸣</Label></View>
      <Icon name="chevron-right" rawSize={22} color={theme['c-primary']} />
    </TouchableOpacity>

    <View style={styles.shortcuts}>
      {[
        { title: '我的收藏', icon: 'love', onPress: () => openMaterialList(LIST_IDS.LOVE) },
        { title: '播放历史', icon: 'music_time', onPress: () => setNavActiveId('nav_play_history') },
        { title: '下载管理', icon: 'download-2', onPress: openMaterialDownloads },
      ].map(item => <TouchableOpacity key={item.title} accessibilityRole="button" onPress={item.onPress} style={[styles.shortcut, { backgroundColor: theme['c-theme'] }]}>
        <Icon name={item.icon} rawSize={24} color={theme['c-primary']} /><Label style={styles.shortcutLabel}>{item.title}</Label>
      </TouchableOpacity>)}
    </View>

    <Section title="我的歌单" action="管理歌单" onPress={() => setNavActiveId('nav_love')} />
    <View style={styles.grid}>{lists.slice(0, 4).map(item => <PlaylistTile key={item.id} item={item} compact />)}</View>
    {lists.length <= 2 && <Label style={[styles.hint, { color: theme['c-font-label'] }]}>收藏与试听列表已就绪，也可以在「管理歌单」中创建或导入自己的歌单。</Label>}

    <Section title="最近播放" action="全部历史" onPress={() => setNavActiveId('nav_play_history')} />
    {status === 'error' ? <Empty title="暂时没能读取播放记录" detail="已有记录会保留在本机，可以重新读取。" action="重新读取" onPress={reload} />
      : !history.length ? <Empty title={status === 'loading' ? '正在读取最近播放…' : '让第一首歌留下足迹'} detail="播放音乐后，你最近听过的歌曲会出现在这里。" action="去搜索音乐" onPress={() => setNavActiveId('nav_search')} />
        : <View style={[styles.history, { backgroundColor: theme['c-theme'] }]}>{history.map((item, index) => <TouchableOpacity key={item.id} accessibilityRole="button" accessibilityLabel={`播放 ${item.musicInfo.name}`} disabled={busyId !== null} onPress={() => { void playRecent(index) }} style={styles.historyRow}>
          <Image url={item.musicInfo.meta.picUrl} style={styles.historyCover} />
          <View style={styles.trackInfo}><Label numberOfLines={1} style={styles.historyName}>{item.musicInfo.name}</Label><Label numberOfLines={1} style={[styles.smallText, { color: theme['c-font-label'] }]}>{busyId === item.id ? '正在准备播放…' : item.musicInfo.singer || '未知歌手'}</Label></View>
          <Icon name="play-outline" rawSize={22} color={theme['c-primary']} />
        </TouchableOpacity>)}</View>}
    <Action title="发现更多歌单" onPress={() => setNavActiveId('nav_songlist')} />
    <ListeningStats />
  </ScrollView>
})

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 28 },
  search: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  continue: { borderRadius: 28, padding: 20 },
  kicker: { fontSize: 12, lineHeight: 20, fontWeight: '600', letterSpacing: 1.5 },
  continueRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 16, marginBottom: 20 },
  cover: { width: 88, height: 88, borderRadius: 20 },
  trackInfo: { flex: 1, minWidth: 0 },
  trackTitle: { fontSize: 22, lineHeight: 30, fontWeight: '700' },
  trackSinger: { fontSize: 12, lineHeight: 19, marginTop: 6 },
  primaryButton: { minHeight: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  buttonText: { fontSize: 14, lineHeight: 22, fontWeight: '700' },
  recommend: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14, borderRadius: 24, marginTop: 16 },
  dateBadge: { width: 60, height: 68, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  date: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  day: { fontSize: 10, lineHeight: 16 },
  recTitle: { fontSize: 19, lineHeight: 28, fontWeight: '700', marginBottom: 4 },
  smallText: { fontSize: 12, lineHeight: 19 },
  shortcuts: { flexDirection: 'row', gap: 10, marginTop: 16 },
  shortcut: { flex: 1, minHeight: 88, borderRadius: 22, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 4 },
  shortcutLabel: { fontSize: 12, lineHeight: 19, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  hint: { fontSize: 12, lineHeight: 20, marginTop: 2 },
  history: { borderRadius: 24, paddingHorizontal: 14, paddingVertical: 6 },
  historyRow: { flexDirection: 'row', alignItems: 'center', minHeight: 74, gap: 12, paddingVertical: 10 },
  historyCover: { width: 48, height: 48, borderRadius: 14 },
  historyName: { fontSize: 15, lineHeight: 23, fontWeight: '600' },
})
