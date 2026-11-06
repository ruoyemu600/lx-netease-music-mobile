import { memo, useEffect, useRef, useState } from 'react'
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native'
import Image from '@/components/common/Image'
import { Icon } from '@/components/common/Icon'
import { setNavActiveId } from '@/core/common'
import { useMyList } from '@/store/list/hook'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useWyFollowedArtists, useWySubscribedAlbums } from '@/store/user/hook'
import { usePlayerMusicInfo } from '@/store/player/hook'
import AlbumItem from '../SubscribedAlbums/ListItem'
import ArtistItem from '../FollowedArtists/ListItem'
import { Destination, Empty, Label, PlaylistTile, ScreenHeader, Section } from '../MaterialHome/components'
import { openMaterialDownloads, playMaterialTracks, useMaterialLocalMusic } from '../materialData'

const categories = [
  { id: 'playlists', name: '歌单' },
  { id: 'songs', name: '歌曲' },
  { id: 'albums', name: '专辑' },
  { id: 'artists', name: '歌手' },
] as const
type Category = (typeof categories)[number]['id']

export default memo(function MaterialLibrary() {
  const theme = useTheme()
  const [category, setCategory] = useState<Category>('playlists')
  const lists = useMyList()
  const albums = useWySubscribedAlbums()
  const artists = useWyFollowedArtists()
  const cookie = useSettingValue('common.wy_cookie')
  const music = usePlayerMusicInfo()
  const { entries, status, reload } = useMaterialLocalMusic(category === 'songs')
  const playbackLock = useRef(false)
  const mounted = useRef(true)
  const [busy, setBusy] = useState(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const playLocal = async (index: number) => {
    if (playbackLock.current) return
    playbackLock.current = true
    setBusy(true)
    try { await playMaterialTracks('local_music', entries.map(item => item.musicInfo), index) }
    finally { playbackLock.current = false; if (mounted.current) setBusy(false) }
  }

  const accountEmpty = <Empty title="让收藏在这里相遇" detail="设置网易云 Cookie 后，即可查看收藏专辑与关注歌手。本地歌单与歌曲无需账户。" action="前往账户设置" onPress={() => setNavActiveId('nav_setting')} />
  const header = <>
    <ScreenHeader title="音乐库" subtitle="喜欢的，都在这里">
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="搜索音乐" onPress={() => setNavActiveId('nav_search')} style={[styles.search, { backgroundColor: theme['c-theme'] }]}>
        <Icon name="search-2" rawSize={22} color={theme['c-primary']} />
      </TouchableOpacity>
    </ScreenHeader>
    <View accessibilityRole="tablist" style={styles.categories}>
      {categories.map(item => {
        const active = item.id === category
        return <TouchableOpacity key={item.id} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => setCategory(item.id)} style={[styles.chip, { backgroundColor: active ? theme['c-primary'] : theme['c-theme'] }]}>
          <Label style={[styles.chipLabel, { color: active ? theme['c-button-font-selected'] : theme['c-font-label'] }]}>{item.name}</Label>
        </TouchableOpacity>
      })}
    </View>
    <Section title={category === 'playlists' ? '本机歌单' : category === 'songs' ? '本地歌曲' : category === 'albums' ? '收藏专辑' : '关注歌手'}
      action={category === 'playlists' ? '管理' : category === 'songs' ? '扫描与目录' : '查看与同步'}
      onPress={() => setNavActiveId(category === 'playlists' ? 'nav_love' : category === 'songs' ? 'nav_local_music' : category === 'albums' ? 'nav_subscribed_albums' : 'nav_followed_artists')} />
    {category === 'songs' && <Label style={[styles.note, { color: theme['c-font-label'] }]}>{status === 'loading' ? '正在读取本地音乐…' : status === 'permission' ? '首次扫描请打开「扫描与目录」授予音频访问权限。' : status === 'error' ? '部分目录未能读取，可在「扫描与目录」检查路径与权限。' : `${entries.length} 首 · 来自下载目录与已添加的音乐文件夹`}</Label>}
    {(category === 'albums' || category === 'artists') && cookie && <Label style={[styles.note, { color: theme['c-font-label'] }]}>来自网易云账户 · 进入「查看与同步」可刷新收藏</Label>}
  </>
  const footer = <View style={styles.footer}>
    <Section title="更多音乐来源" />
    <Destination title="网易云歌单" subtitle="查看创建和收藏的云端歌单" icon="album" nav="nav_my_playlist" />
    <Destination title="本地音乐" subtitle="扫描音频文件，管理音乐文件夹" icon="sd-card" nav="nav_local_music" />
    <Destination title="下载管理" subtitle="查看真实下载任务与已完成的音乐" icon="download-2" onPress={openMaterialDownloads} />
    <Destination title="OneDrive" subtitle="浏览与播放云端音乐文件" icon="add_folder" nav="nav_onedrive" />
    <Destination title="播放历史" subtitle="按日期回到听过的音乐" icon="music_time" nav="nav_play_history" />
  </View>
  const base = { ListHeaderComponent: header, ListFooterComponent: footer, contentContainerStyle: styles.content, style: { flex: 1, backgroundColor: theme['c-main-background'] } }

  // Each category owns a single FlatList, never a list inside a ScrollView/another FlatList.
  if (category === 'playlists') return <FlatList {...base} testID="material-library-playlists" key="playlists" data={lists} numColumns={2} columnWrapperStyle={styles.columns} keyExtractor={item => item.id}
    renderItem={({ item }) => <PlaylistTile item={item} />}
    ListEmptyComponent={<Empty title="为喜欢的歌安个家" detail="你创建或导入的本机歌单会显示在这里。" action="管理歌单" onPress={() => setNavActiveId('nav_love')} />} />

  if (category === 'songs') return <FlatList {...base} testID="material-library-songs" key="songs" data={entries} keyExtractor={item => item.musicInfo.id} refreshing={status === 'loading'} onRefresh={reload}
    renderItem={({ item, index }) => <TouchableOpacity accessibilityRole="button" accessibilityLabel={`播放 ${item.musicInfo.name}`} disabled={busy} onPress={() => { void playLocal(index) }} style={[styles.song, { backgroundColor: theme['c-theme'] }]}>
      <Image url={item.musicInfo.meta.picUrl} style={styles.songArt} />
      <View style={styles.songInfo}><Label numberOfLines={1} style={{ fontWeight: '600', color: music.id === item.musicInfo.id ? theme['c-primary'] : theme['c-font'] }}>{item.musicInfo.name}</Label><Label numberOfLines={1} style={[styles.songDetail, { color: theme['c-font-label'] }]}>{item.musicInfo.singer || '未知歌手'}{item.musicInfo.interval ? ` · ${item.musicInfo.interval}` : ''}</Label></View>
      <Icon name="play-outline" rawSize={23} color={theme['c-primary']} />
    </TouchableOpacity>}
    ListEmptyComponent={<Empty title={status === 'loading' ? '正在发现本地音乐…' : status === 'permission' ? '连接你的本地音乐' : '这里还没有本地歌曲'} detail={status === 'permission' ? '前往本地音乐页面完成权限设置，然后扫描下载目录或添加其他音乐文件夹。' : '在本地音乐中添加存放歌曲的文件夹，扫描后即可在这里播放。'} action="打开本地音乐" onPress={() => setNavActiveId('nav_local_music')} />} />

  if (category === 'albums') return <FlatList {...base} testID="material-library-albums" key="albums" data={cookie ? albums : []} keyExtractor={item => String(item.id)}
    renderItem={({ item }) => <View style={[styles.businessRow, { backgroundColor: theme['c-theme'] }]}><AlbumItem item={item} /></View>}
    ListEmptyComponent={cookie ? <Empty title="等待你的专辑收藏" detail="你已连接网易云账户。前往收藏专辑页面同步，或在专辑详情中收藏喜欢的作品。" action="查看收藏专辑" onPress={() => setNavActiveId('nav_subscribed_albums')} /> : accountEmpty} />

  return <FlatList {...base} testID="material-library-artists" key="artists" data={cookie ? artists : []} keyExtractor={item => String(item.id)}
    renderItem={({ item }) => <View style={[styles.businessRow, { backgroundColor: theme['c-theme'] }]}><ArtistItem artist={item} /></View>}
    ListEmptyComponent={cookie ? <Empty title="与你喜欢的歌手保持连接" detail="前往关注歌手页面下拉刷新账户关注，或从搜索中发现喜欢的歌手。" action="查看关注歌手" onPress={() => setNavActiveId('nav_followed_artists')} /> : accountEmpty} />
})

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 28 },
  search: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  categories: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', paddingBottom: 4 },
  chip: { minHeight: 48, flexGrow: 1, paddingHorizontal: 14, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  chipLabel: { fontSize: 14, lineHeight: 22, fontWeight: '600' },
  columns: { gap: 12 },
  note: { fontSize: 12, lineHeight: 20, marginBottom: 14 },
  footer: { paddingTop: 8 },
  song: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 8, minHeight: 76, borderRadius: 22 },
  songArt: { width: 50, height: 50, borderRadius: 14 },
  songInfo: { flex: 1, minWidth: 0 },
  songDetail: { fontSize: 12, lineHeight: 19, marginTop: 3 },
  businessRow: { borderRadius: 22, overflow: 'hidden', marginBottom: 10 },
})
