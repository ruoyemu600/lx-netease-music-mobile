import { memo, useRef } from 'react'
import { View, TouchableOpacity, StyleSheet } from 'react-native'
import Text from '@/components/common/Text'
import Badge, { type BadgeType } from '@/components/common/Badge'
import { Icon } from '@/components/common/Icon'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { scaleSizeH } from '@/utils/pixelRatio'
import { type RowInfo } from '@/utils/tools'
import Image from '@/components/common/Image'
import PlayingIcon from '@/components/common/PlayingIcon'
import { useIsWyLiked } from '@/store/user/hook'
import { handleLikeMusic } from './listAction'

// Keep native dp targets comfortable on compact screens while honoring larger app text sizes.
export const ITEM_HEIGHT = Math.max(72, scaleSizeH(72))

const useQualityTag = (musicInfo: LX.Music.MusicInfoOnline) => {
  const t = useI18n()
  let info: { type: BadgeType | null; text: string } = { type: null, text: '' }
  const qualitys = (musicInfo.meta as LX.Music.MusicInfoMeta_online)._qualitys ?? {}
  // if (musicInfo.meta._qualitys.master) {
  //   info.type = 'secondary'
  //   info.text = t('quality_lossless_master')
  // } else if (musicInfo.meta._qualitys.atmos_plus) {
  //   info.type = 'secondary'
  //   info.text = t('quality_lossless_atmos_plus')
  // } else if (musicInfo.meta._qualitys.atmos) {
  //   info.type = 'secondary'
  //   info.text = t('quality_lossless_atmos')
  // } else
  if (qualitys.hires) {
    info.type = 'secondary'
    info.text = t('quality_lossless_24bit')
  } else if (qualitys.flac) {
    // info.type = 'secondary'
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
    showSource,
    onPress,
    onLongPress,
    onShowMenu,
    selectedList,
    rowInfo,
    isShowAlbumName,
    playingId,
    isShowInterval,
    listId,
    showCover = true,
    hideMenu = false,
  }: {
    item: LX.Music.MusicInfoOnline
    index: number
    showSource?: boolean
    onPress: (item: LX.Music.MusicInfoOnline, index: number) => void
    onLongPress: (item: LX.Music.MusicInfoOnline, index: number) => void
    onShowMenu: (
      item: LX.Music.MusicInfoOnline,
      index: number,
      position: { x: number; y: number; w: number; h: number }
    ) => void
    selectedList: LX.Music.MusicInfoOnline[]
    rowInfo: RowInfo
    isShowAlbumName: boolean
    isShowInterval: boolean
    playingId?: string | null;
    listId?: string
    showCover?: boolean
    hideMenu?: boolean
  }) => {
    const theme = useTheme()
    const isPlaying = playingId === item.id;
    const isSelected = selectedList.includes(item)
    const isLiked = useIsWyLiked(item.meta.songId)
    const selectedBackground = theme['c-primary-background-active']

    const moreButtonRef = useRef<TouchableOpacity>(null)
    const handleShowMenu = () => {
      if (moreButtonRef.current?.measure) {
        moreButtonRef.current.measure((fx, fy, width, height, px, py) => {
          onShowMenu(item, index, {
            x: Math.ceil(px),
            y: Math.ceil(py),
            w: Math.ceil(width),
            h: Math.ceil(height),
          })
        })
      }
    }

    const showLikeButton = item.source === 'wy'

    const handleLike = () => {
      handleLikeMusic(item)
    }

    const tagInfo = useQualityTag(item)
    const historySource = (item as LX.Music.MusicInfoOnline & { playHistorySource?: LX.Player.PlayHistorySource }).playHistorySource
    const singer = `${item.singer}${isShowAlbumName && item.meta.albumName ? `·${item.meta.albumName}` : ''}`

    return (
      <View
        style={{
          ...styles.listItem,
          width: rowInfo.rowWidth,
          height: ITEM_HEIGHT,
          backgroundColor: isSelected
            ? selectedBackground
            : isPlaying
              ? theme['c-primary-background-hover']
              : undefined,
        }}
      >
        <TouchableOpacity
          style={styles.listItemLeft}
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected }}
          onPress={() => onPress(item, index)}
          onLongPress={() => onLongPress(item, index)}
        >


          <View style={showCover ? styles.sn : styles.snIndex}>
            {showCover ? (
              <Image url={item.meta.picUrl} style={styles.albumArt} />
            ) : isPlaying ? (
              <PlayingIcon />
            ) : (
              <Text color={theme['c-font']} size={12}>
                {index + 1}
              </Text>
            )}
          </View>
          <View style={styles.itemInfo}>
            <Text style={styles.title} size={15} numberOfLines={1} color={isPlaying || isSelected ? theme['c-primary-font'] : theme['c-font']}>
              {item.name}
              {item.alias ? <Text color={theme['c-font-label']}> ({item.alias})</Text> : null}
            </Text>
            <View style={styles.listItemSingle}>
              {showSource ? <Badge type="tertiary">{item.source.toUpperCase()}</Badge> : null}
              {tagInfo.type ? <Badge type={tagInfo.type}>{tagInfo.text}</Badge> : null}
              {item.meta.fee === 1 ? <Badge type="vip">VIP</Badge> : null}
              {item.source === 'wy' && item.meta.originCoverType === 2 ? <Badge type="normal">cover</Badge> : null}
              {historySource ? <Badge type="normal">{historySource}</Badge> : null}
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
            <Text style={styles.interval} size={11} color={theme['c-font-label']} numberOfLines={1}>
              {item.interval}
            </Text>
          ) : null}
        </TouchableOpacity>

        {showLikeButton ? (
          <TouchableOpacity accessibilityRole="button" onPress={handleLike} style={styles.likeButton}>
            <Icon name={isLiked ? "love-filled" : "love"} size={16} color={isLiked ? theme['c-liked'] : theme['c-350']} />
          </TouchableOpacity>
        ) : null}

        {hideMenu ? null : (
          <TouchableOpacity accessibilityRole="button" onPress={handleShowMenu} ref={moreButtonRef} style={styles.moreButton}>
            <Icon name="dots-vertical" color={theme['c-font-label']} size={20} />
          </TouchableOpacity>
        )}
      </View>
    )
  },
  (prevProps, nextProps) => {
    return !!(
      prevProps.item === nextProps.item &&
      prevProps.index === nextProps.index &&
      prevProps.showSource === nextProps.showSource &&
      prevProps.isShowAlbumName === nextProps.isShowAlbumName &&
      prevProps.isShowInterval === nextProps.isShowInterval &&
      prevProps.listId === nextProps.listId &&
      prevProps.playingId === nextProps.playingId &&
      prevProps.hideMenu === nextProps.hideMenu &&
      (prevProps.item as any).playHistorySource === (nextProps.item as any).playHistorySource &&
      nextProps.selectedList.includes(nextProps.item) ==
      prevProps.selectedList.includes(nextProps.item) &&
      prevProps.showCover === nextProps.showCover
    )
  }
)

// Native dp dimensions keep artwork and action hit areas stable across screen sizes.
const styles = StyleSheet.create({
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
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
  likeButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
