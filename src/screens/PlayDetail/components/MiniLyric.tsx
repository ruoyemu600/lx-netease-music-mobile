// src/screens/PlayDetail/components/MiniLyric.tsx

import { memo, useMemo } from 'react';
import { TouchableOpacity } from 'react-native';
import { useLrcPlay, useLrcSet } from '@/plugins/lyric';
import { createStyle } from '@/utils/tools';
import { useTheme } from '@/store/theme/hook';
import Text from '@/components/common/Text';
import { useSettingValue } from '@/store/setting/hook';

const MiniLyric = ({ onPress, style }: { onPress?: () => void, style?: any }) => {
  const theme = useTheme();
  const { line: activeLine } = useLrcPlay();
  const lyricLines = useLrcSet();
  const textAlign = useSettingValue('playDetail.style.align');

  const { currentLine, translationLine } = useMemo(() => {
    if (activeLine < 0 || lyricLines.length <= activeLine) {
      return { currentLine: null, translationLine: null };
    }
    const line = lyricLines[activeLine];
    return {
      currentLine: line.text,
      translationLine: line.extendedLyrics.length > 0 ? line.extendedLyrics[0] : null,
    };
  }, [activeLine, lyricLines]);

  const activeColor = theme.isDark ? theme['c-font'] : theme['c-primary'];
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="查看完整歌词" onPress={onPress} activeOpacity={0.7} style={[styles.container, style]}>
      {currentLine ? (
        <>
          <Text
            size={13}
            color={activeColor}
            style={{ textAlign }}
            numberOfLines={1}
          >
            {currentLine}
          </Text>
          {translationLine && (
            <Text
              size={13}
              color={activeColor}
              style={{ textAlign, marginTop: 4 }}
              numberOfLines={1}
            >
              {translationLine}
            </Text>
          )}
        </>
      ) : (
        <Text size={13} color={theme['c-font-label']} style={{ textAlign }}>
          ...
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = createStyle({
  container: {
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: 10,
    alignItems: 'flex-start',
    width: '100%',
  },
});

export default memo(MiniLyric);
