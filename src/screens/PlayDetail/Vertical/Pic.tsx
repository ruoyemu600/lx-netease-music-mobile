import { memo, useEffect, useMemo, useRef, useCallback, useState } from 'react';
import { View, Animated, Easing, TouchableWithoutFeedback, StyleSheet } from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { useIsPlay, usePlayMusicInfo, usePlayerMusicInfo } from '@/store/player/hook';
import { useWindowSize } from '@/utils/hooks';
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant';
import { HEADER_HEIGHT } from './components/Header';
import { defaultHeaders } from '@/components/common/Image';
import Text from '@/components/common/Text';
import { Icon } from '@/components/common/Icon';
import { useTheme } from '@/store/theme/hook';
import { useStatusbarHeight } from '@/store/common/hook';
import { useSettingValue } from '@/store/setting/hook';
import { toast, requestStoragePermission } from '@/utils/tools';
import Menu, { type MenuType, type Menus } from '@/components/common/Menu';
import { addTask } from '@/core/download';
import RNFetchBlob from 'rn-fetch-blob';
import { getPicUrl } from '@/core/music/online';
import { getFileExtensionFromUrl } from '@/screens/Home/Views/Mylist/MusicList/download/utils';
import settingState from '@/store/setting/state';


export default memo(({ componentId }: { componentId: string }) => {
  const musicInfo = usePlayMusicInfo();
  const resolvedMusic = usePlayerMusicInfo();
  const theme = useTheme();
  const track = musicInfo.musicInfo;
  const song = track && ('progress' in track ? track.metadata.musicInfo : track);
  // Resolved artwork includes downloaded/local covers and asynchronous source updates.
  const coverUrl = (resolvedMusic.id === track?.id ? resolvedMusic.pic : null) || song?.meta.picUrl;
  const uri = coverUrl?.startsWith('/') ? `file://${coverUrl}` : coverUrl;
  const latestUri = useRef(uri);
  latestUri.current = uri;
  const [imageState, setImageState] = useState<{ uri: typeof uri; status: 'loading' | 'loaded' | 'error' }>({ uri, status: 'loading' });
  const imageStatus = imageState.uri === uri ? imageState.status : 'loading';
  const { width: winWidth, height: winHeight } = useWindowSize();
  const statusBarHeight = useStatusbarHeight();
  const isPlay = useIsPlay();
  const isCoverSpin = useSettingValue('playDetail.isCoverSpin');
  const spinValue = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const isAnimating = useRef(false);
  const menuRef = useRef<MenuType>(null);
  const coverRef = useRef<View>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [availableHeight, setAvailableHeight] = useState<number | null>(null);

  const createAnimation = useCallback((value: number) => {
    return Animated.timing(spinValue, {
      toValue: 1,
      duration: 25000 * (1 - value),
      easing: Easing.linear,
      useNativeDriver: true,
    });
  }, [spinValue]);

  const startAnimation = useCallback(() => {
    if (isAnimating.current || !isCoverSpin) return;
    isAnimating.current = true;
    spinValue.stopAnimation(value => {
      animationRef.current = createAnimation(value);
      animationRef.current.start(({ finished }) => {
        if (finished && isAnimating.current) {
          spinValue.setValue(0);
          isAnimating.current = false;
          startAnimation();
        }
      });
    });
  }, [spinValue, createAnimation, isCoverSpin]);

  const stopAnimation = useCallback(() => {
    if (!isAnimating.current) return;
    isAnimating.current = false;
    animationRef.current?.stop();
    animationRef.current = null;
    spinValue.stopAnimation();
  }, [spinValue]);

  useEffect(() => {
    if (isPlay && isCoverSpin) {
      startAnimation();
    } else {
      stopAnimation();
    }
  }, [isPlay, isCoverSpin, startAnimation, stopAnimation]);

  useEffect(() => {
    stopAnimation();
    if (isPlay && isCoverSpin) {
      startAnimation();
    }
  }, [musicInfo.musicInfo?.id, isCoverSpin, startAnimation, stopAnimation]);

  useEffect(() => () => stopAnimation(), [stopAnimation]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const imageContainerStyle = useMemo(() => {
    const imgWidth = Math.max(48, Math.min(winWidth * 0.83, availableHeight == null
      ? (winHeight - statusBarHeight - HEADER_HEIGHT) * 0.48
      : availableHeight - 16));
    return {
      width: imgWidth,
      height: imgWidth,
      borderRadius: 28,
      elevation: 2,
    };
  }, [statusBarHeight, winHeight, winWidth, availableHeight]);

  const imageStyle = useMemo(() => ({
    width: '100%',
    height: '100%',
    borderRadius: imageContainerStyle.borderRadius,
  } as any), [imageContainerStyle.borderRadius]);

  const menus = useMemo((): Menus => [
    { action: 'download_song', label: '下载歌曲' },
    { action: 'download_pic', label: '下载封面' },
  ], []);

  const handleLongPress = () => {
    if (!coverRef.current) return;
    coverRef.current.measure((x, y, w, h, px, py) => {
      setMenuVisible(true);
      requestAnimationFrame(() => {
        menuRef.current?.show({ x: px, y: py, w, h });
      });
    });
  };

  const handleMenuPress = ({ action }: typeof menus[number]) => {
    switch (action) {
      case 'download_song':
        if (musicInfo.musicInfo) {
          const quality = settingState.setting['player.playQuality'];
          if (song) addTask(song, quality);
        }
        break;
      case 'download_pic':
        if (musicInfo.musicInfo) {
          void (async () => {
            try {
              const isGranted = await requestStoragePermission();
              if (isGranted === false) {
                toast('没有存储权限，无法下载', 'short');
                return;
              }

              toast('正在下载封面...', 'short');
              const picUrl = coverUrl || await getPicUrl({ musicInfo: song as LX.Music.MusicInfoOnline, isRefresh: true });
              const extension = getFileExtensionFromUrl(picUrl);
              const picBaseDir = RNFetchBlob.fs.dirs.PictureDir || RNFetchBlob.fs.dirs.DownloadDir;
              const downloadDir = `${picBaseDir}/LX-N-Music`;
              const mInfo = song!;
              const fileName = `${mInfo.name}_${mInfo.singer}.${extension}`.replace(/[\\/:*?"<>|]/g, '_');
              const filePath = `${downloadDir}/${fileName}`;

              const exists = await RNFetchBlob.fs.exists(downloadDir);
              if (!exists) {
                try {
                  await RNFetchBlob.fs.mkdir(downloadDir);
                } catch (e) {
                  console.warn('mkdir failed');
                }
              }

              const targetPath = (await RNFetchBlob.fs.exists(downloadDir)) ? filePath : `${picBaseDir}/${fileName}`;

              if (picUrl.startsWith('/') || picUrl.startsWith('file://')) {
                await RNFetchBlob.fs.cp(picUrl.replace(/^file:\/\//, ''), targetPath);
              } else {
                await RNFetchBlob.config({ path: targetPath }).fetch('GET', picUrl);
              }
              await RNFetchBlob.fs.scanFile([{ path: targetPath }]);
              toast(`封面已保存到: ${targetPath}`, 'long');
            } catch (err: any) {
              toast(`下载封面失败: ${err.message}`, 'long');
            }
          })();
        }
        break;
    }
  };

  return (
    <View style={styles.container} onLayout={({ nativeEvent }) => {
      // PagerView may report a transient zero while attaching a native page.
      if (nativeEvent.layout.height > 16) setAvailableHeight(nativeEvent.layout.height);
    }}>
      <TouchableWithoutFeedback onLongPress={handleLongPress} accessibilityLabel="专辑封面，长按下载">
        <View ref={coverRef} collapsable={false} style={[styles.content, imageContainerStyle, { backgroundColor: theme['c-content-background'] }]}>
          <View style={[styles.placeholder, { opacity: imageStatus === 'loaded' && uri ? 0 : 1 }]} accessibilityLiveRegion="polite">
            <Icon name="album" rawSize={Math.min(64, imageContainerStyle.width * 0.22)} color={theme['c-primary']} />
            <Text size={12} color={theme['c-font-label']} style={{ marginTop: 12 }}>
              {!uri ? '暂无封面' : imageStatus === 'error' ? '封面加载失败' : '正在加载封面'}
            </Text>
          </View>
          {!!uri && imageStatus !== 'error' && (
            <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [{ rotate: isCoverSpin ? spin : '0deg' }], opacity: imageStatus === 'loaded' ? 1 : 0 }]}>
              <FastImage
                key={uri}
                source={{ uri, headers: defaultHeaders }}
                nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_pic}
                style={imageStyle}
                onLoad={() => { if (latestUri.current === uri) setImageState({ uri, status: 'loaded' }); }}
                onError={() => { if (latestUri.current === uri) setImageState({ uri, status: 'error' }); }}
                resizeMode={FastImage.resizeMode.cover}
              />
            </Animated.View>
          )}
        </View>
      </TouchableWithoutFeedback>
      {menuVisible && <Menu ref={menuRef} menus={menus} onPress={handleMenuPress} onHide={() => setMenuVisible(false)} />}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  content: {
    overflow: 'hidden',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
