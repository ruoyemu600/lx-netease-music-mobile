import { memo, useRef, useCallback, useMemo } from 'react'
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { pop, navigations } from '@/navigation'
import { useTheme } from '@/store/theme/hook'
import { usePlayMusicInfo } from '@/store/player/hook'
import Text from '@/components/common/Text'
import { scaleSizeH } from '@/utils/pixelRatio'
import { HEADER_HEIGHT as _HEADER_HEIGHT, NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import commonState from '@/store/common/state'
import SettingPopup, { type SettingPopupType } from '../../components/SettingPopup'
import { useStatusbarHeight } from '@/store/common/hook'
import Btn from './Btn'
import TimeoutExitBtn from './TimeoutExitBtn'
import Marquee from './Marquee'
import StatusBar from '@/components/common/StatusBar'

export const HEADER_HEIGHT = Math.max(56, scaleSizeH(_HEADER_HEIGHT))

export const Title = () => {
  const theme = useTheme()
  const playMusicInfo = usePlayMusicInfo()
  const musicInfo = playMusicInfo.musicInfo ? ('progress' in playMusicInfo.musicInfo ? playMusicInfo.musicInfo.metadata.musicInfo : playMusicInfo.musicInfo) : null

  const handleArtistPress = useCallback((artist: { id: string | number, name: string }) => {
    if (!musicInfo || musicInfo.source !== 'wy' || !artist.id) return
    navigations.pushArtistDetailScreen(commonState.componentIds[commonState.componentIds.length - 1]?.id!, { id: String(artist.id), name: artist.name })
  }, [musicInfo])

  const handleAlbumPress = useCallback(() => {
    if (!musicInfo || musicInfo.source !== 'wy' || !(musicInfo.meta as any).albumId) return
    navigations.pushAlbumDetailScreen(commonState.componentIds[commonState.componentIds.length - 1]?.id!, { id: String((musicInfo.meta as any).albumId), name: musicInfo.meta.albumName, source: musicInfo.source })
  }, [musicInfo])

  const singerRender = useMemo(() => {
    if (!musicInfo) return null
    const albumName = musicInfo.meta?.albumName
    const albumId = (musicInfo.meta as any)?.albumId

    if (!musicInfo.artists?.length || musicInfo.source == 'local') {
      return (
        <View style={styles.singerContainer}>
          <Text numberOfLines={1} size={14} color={theme['c-font-label']}>
            {musicInfo.singer}
          </Text>
          {albumName ? (
            <TouchableOpacity style={styles.artistButton} onPress={handleAlbumPress} disabled={musicInfo.source !== 'wy' || !albumId}>
              <Text numberOfLines={1} size={14} color={theme['c-font-label']}>
                {` · ${albumName}`}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )
    }

    return (
      <View style={styles.singerContainer}>
        {musicInfo.artists.map((artist, index) => (
          <TouchableOpacity style={styles.artistButton} key={artist.id || index} onPress={() => handleArtistPress(artist)}>
            <Text style={styles.singerText} size={14} color={theme['c-font-label']}>
              {artist.name}
              {(musicInfo.artists?.length ?? 0) > 0 && index < (musicInfo.artists?.length ?? 0) - 1 ? ' / ' : ''}
            </Text>
          </TouchableOpacity>
        ))}
        {albumName ? (
          <TouchableOpacity style={styles.artistButton} onPress={handleAlbumPress} disabled={musicInfo.source !== 'wy' || !albumId}>
            <Text numberOfLines={1} size={14} color={theme['c-font-label']}>
              {` · ${albumName}`}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    )
  }, [musicInfo, theme, handleArtistPress, handleAlbumPress])

  return (
    <View style={styles.titleContent}>
      {musicInfo ? (
        <>
          <View style={styles.titleLine}>
            <Marquee style={styles.title} size={24}>
              {musicInfo.name}
              {musicInfo.alias ? <Text color={theme['c-font-label']}> ({musicInfo.alias})</Text> : null}
            </Marquee>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.artistScroll}>
            {singerRender}
          </ScrollView>
        </>
      ) : null}
    </View>
  )
}


export default memo(() => {
  const popupRef = useRef<SettingPopupType>(null)
  const statusBarHeight = useStatusbarHeight()
  const back = () => {
    void pop(commonState.componentIds[commonState.componentIds.length - 1]?.id!)
  }
  const showSetting = () => {
    popupRef.current?.show()
  }
  return (
    <View
      style={{ height: HEADER_HEIGHT + statusBarHeight, paddingTop: statusBarHeight }}
      nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_header}
    >
      <StatusBar />
      <View style={styles.container}>
        <Btn icon="chevron-left" onPress={back} />
        <View style={styles.headerLabel}>
          <Text size={13}>正在播放</Text>
        </View>
        <TimeoutExitBtn />
        <Btn icon="slider" onPress={showSetting} />
      </View>
      <SettingPopup ref={popupRef} direction="vertical" />
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    // justifyContent: 'center',
    height: '100%',
  },
  headerLabel: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  titleContent: {
    width: '100%',
    marginBottom: 2,
  },
  titleLine: {
    minHeight: 36,
    paddingVertical: 2,
  },
  title: {
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  artistScroll: {
    flexGrow: 0,
    flexShrink: 0,
    minHeight: 48,
  },
  artistButton: {
    minHeight: 48,
    minWidth: 48,
    justifyContent: 'center',
    flexShrink: 1,
  },
  icon: {
    paddingLeft: 4,
    paddingRight: 4,
  },
  singerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  singerText: {
    paddingRight: 2,
  },
})
