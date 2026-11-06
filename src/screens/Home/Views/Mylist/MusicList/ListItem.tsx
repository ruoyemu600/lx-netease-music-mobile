import { memo, useRef } from 'react'
import { View, TouchableOpacity, StyleSheet } from 'react-native'
import { Icon } from '@/components/common/Icon'
import { type RowInfo } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useAssertApiSupport } from '@/store/common/hook'
import { scaleSizeH } from '@/utils/pixelRatio'
import Text from '@/components/common/Text'
import Badge, { type BadgeType } from '@/components/common/Badge'
import Image from '@/components/common/Image'
import PlayingIcon from '@/components/common/PlayingIcon'
import { useI18n } from '@/lang'

// Shared by the virtualized list and local music; never shrink below 72dp.
export const ITEM_HEIGHT = Math.max(72, scaleSizeH(72))

const useQualityTag = (musicInfo: LX.Music.MusicInfo) => {
  const t = useI18n()
  let info: { type: BadgeType | null; text: string } = { type: null, text: '' }
  // 本地歌曲不读取在线音质字段，保持 Hook 调用顺序一致。
  if (musicInfo.source === 'local') return info
  // 同步和旧版记录可能没有音质信息，不能因此阻断歌单渲染。
  const qualitys = musicInfo.meta._qualitys ?? {}
  if (qualitys.hires) {
    info.type = 'secondary'
    info.text = t('quality_lossless_24bit')
  } else if (qualitys.flac) {
    info.type = 'sq'
    info.text = t('quality_lossless')
  } else if (qualitys['320k']) {
    info.type = 'hq'
    info.text = t('quality_high_quality')
  }
  return info
}

export default memo(
  ({
    item,
    index,
    activeIndex,
    onPress,
    onShowMenu,
    onLongPress,
    selectedList,
    rowInfo,
    isShowAlbumName,
    isShowInterval,
    showCover,
    hideMenu = false,
    showSource = true,
    qualityTag,
  }: {
    item: LX.Music.MusicInfo
    index: number
    activeIndex: number
    onPress: (item: LX.Music.MusicInfo, index: number) => void
    onLongPress?: (item: LX.Music.MusicInfo, index: number) => void
    onShowMenu?: (
      item: LX.Music.MusicInfo,
      index: number,
      position: { x: number; y: number; w: number; h: number }
    ) => void
    selectedList: LX.Music.MusicInfo[]
    rowInfo: RowInfo
    isShowAlbumName: boolean
    isShowInterval: boolean
    showCover: boolean
    // 本地音乐复用歌单行，只展示音质并隐藏操作入口。
    hideMenu?: boolean
    showSource?: boolean
    qualityTag?: { type: BadgeType, text: string }
  }) => {
    const theme = useTheme()
    const isSelected = selectedList.includes(item)
    const selectedBackground = theme['c-primary-background-active']
    const isSupported = useAssertApiSupport(item.source)
    const moreButtonRef = useRef<TouchableOpacity>(null)

    // 优先使用本地文件解析的音质，在线歌曲沿用原有标签。
    const onlineTag = useQualityTag(item)
    const tagInfo = qualityTag ?? onlineTag

    const handleShowMenu = () => {
      if (moreButtonRef.current?.measure) {
        moreButtonRef.current.measure((fx, fy, width, height, px, py) => {
          onShowMenu?.(item, index, {
            x: Math.ceil(px),
            y: Math.ceil(py),
            w: Math.ceil(width),
            h: Math.ceil(height),
          })
        })
      }
    }

    const active = activeIndex == index
    const singer = `${item.singer}${isShowAlbumName && item.meta.albumName ? `·${item.meta.albumName}` : ''}`

    return (
      <View
        style={{
          ...styles.listItem,
          // 无菜单的本地行也保留相同尾部空间，让时长与歌单对齐。
          paddingRight: hideMenu ? 52 : 4,
          width: rowInfo.rowWidth,
          height: ITEM_HEIGHT,
          backgroundColor: isSelected ? selectedBackground : active ? theme['c-primary-background-hover'] : undefined,
          opacity: isSupported ? 1 : 0.5,
        }}
      >
        <TouchableOpacity
          style={styles.listItemLeft}
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected }}
          onPress={() => {
            onPress(item, index)
          }}
          onLongPress={() => {
            onLongPress?.(item, index)
          }}
        >



          <View style={showCover ? styles.sn : styles.snIndex}>
            {showCover ? (
              <Image url={item.meta.picUrl} style={styles.albumArt} />
            ) : active ? (
              <PlayingIcon />
            ) : (
              <Text color={theme['c-font']} size={12}>
                {index + 1}
              </Text>
            )}
          </View>
          <View style={styles.itemInfo}>
            {/* <View style={styles.listItemTitle}> */}
            <Text style={styles.title} size={15} color={active || isSelected ? theme['c-primary-font'] : theme['c-font']} numberOfLines={1}>
              {item.name}
              {item.alias ? <Text color={theme['c-font-label']}> ({item.alias})</Text> : null}
            </Text>
            {/* </View> */}
            <View style={styles.listItemSingle}>
              {showSource ? <Badge>{item.source.toUpperCase()}</Badge> : null}
              {tagInfo.type ? <Badge type={tagInfo.type}>{tagInfo.text}</Badge> : null}
              {item.source !== 'local' && (item as LX.Music.MusicInfoOnline).meta.fee === 1 ? <Badge type="vip">VIP</Badge> : null}
              {item.source === 'wy' && (item as LX.Music.MusicInfoOnline).meta.originCoverType === 2 ? <Badge type="normal">cover</Badge> : null}
              <Text
                style={styles.listItemSingleText}
                size={12}
                color={theme['c-font-label']}
                numberOfLines={1}
              >
                {singer}
              </Text>
            </View>
          </View>
          {isShowInterval ? (
            <Text
              style={styles.interval}
              size={11}
              color={theme['c-font-label']}
              numberOfLines={1}
            >
              {item.interval}
            </Text>
          ) : null}
        </TouchableOpacity>
        {/* <View style={styles.listItemRight}> */}
        {!hideMenu && <TouchableOpacity accessibilityRole="button" onPress={handleShowMenu} ref={moreButtonRef} style={styles.moreButton}>
          <Icon name="dots-vertical" color={theme['c-font-label']} size={20} />
        </TouchableOpacity>}
        {/* </View> */}
      </View>
    )
  },
  (prevProps, nextProps) => {
    return !!(
      prevProps.item === nextProps.item &&
      prevProps.hideMenu === nextProps.hideMenu &&
      prevProps.showSource === nextProps.showSource &&
      prevProps.qualityTag === nextProps.qualityTag &&
      prevProps.onPress === nextProps.onPress &&
      prevProps.index === nextProps.index &&
      prevProps.isShowAlbumName === nextProps.isShowAlbumName &&
      prevProps.isShowInterval === nextProps.isShowInterval &&
      prevProps.activeIndex != nextProps.index &&
      nextProps.activeIndex != nextProps.index &&
      nextProps.selectedList.includes(nextProps.item) ==
      prevProps.selectedList.includes(nextProps.item) &&
      prevProps.showCover === nextProps.showCover
    )
  }
)

// Native dp dimensions match the online row and retain a minimum 48dp menu target.
const styles = StyleSheet.create({
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listItemLeft: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  sn: {
    width: 78,
    justifyContent: 'center',
    alignItems: 'center',
  },
  snIndex: {
    width: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumArt: {
    width: 50,
    height: 50,
    borderRadius: 12,
  },
  itemInfo: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  title: {
    fontWeight: '500',
  },
  listItemSingle: {
    paddingTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  listItemSingleText: {
    flexShrink: 1,
    fontWeight: '400',
  },
  interval: {
    marginLeft: 4,
    fontVariant: ['tabular-nums'],
  },
  moreButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
