import { useRef, forwardRef, useImperativeHandle } from 'react'
import { View, StyleSheet } from 'react-native'
import Text from '@/components/common/Text'

// import music from '@/utils/musicSdk'

// import InsetShadow from 'react-native-inset-shadow'
import SourceSelector, {
  type SourceSelectorType as _SourceSelectorType,
  type SourceSelectorProps as _SourceSelectorProps,
} from '@/components/SourceSelector'
import SearchInput, { type SearchInputType, type SearchInputProps } from './SearchInput'
import { useTheme } from '@/store/theme/hook'
import { type Source as MusicSource } from '@/store/search/music/state'
import { type Source as SonglistSource } from '@/store/search/songlist/state'

type Sources = Readonly<Array<MusicSource | SonglistSource>>
type SourceSelectorProps = _SourceSelectorProps<Sources>
type SourceSelectorType = _SourceSelectorType<Sources>

export interface HeaderBarProps {
  onSourceChange: SourceSelectorProps['onSourceChange']
  onTipSearch: SearchInputProps['onChangeText']
  onSearch: SearchInputProps['onSubmit']
  onHideTipList: SearchInputProps['onBlur']
  onShowTipList: SearchInputProps['onTouchStart']
}

export interface HeaderBarType {
  setSourceList: SourceSelectorType['setSourceList']
  setText: SearchInputType['setText']
  blur: SearchInputType['blur']
}

export default forwardRef<HeaderBarType, HeaderBarProps>(
  ({ onSourceChange, onTipSearch, onSearch, onHideTipList, onShowTipList }, ref) => {
    const sourceSelectorRef = useRef<SourceSelectorType>(null)
    const searchInputRef = useRef<SearchInputType>(null)
    const theme = useTheme()

    useImperativeHandle(
      ref,
      () => ({
        setSourceList(list, source) {
          sourceSelectorRef.current?.setSourceList(list, source)
        },
        setText(text) {
          searchInputRef.current?.setText(text)
        },
        blur() {
          searchInputRef.current?.blur()
        },
      }),
      []
    )

    return (
      <View style={styles.searchBar}>
        <View style={styles.inputRow}>
          <SearchInput
            ref={searchInputRef}
            onChangeText={onTipSearch}
            onSubmit={onSearch}
            onBlur={onHideTipList}
            onTouchStart={onShowTipList}
          />
        </View>
        <View style={styles.filterRow}>
          <Text size={13} color={theme['c-font-label']}>音源</Text>
          <View style={[styles.selector, { backgroundColor: theme['c-button-background'], borderColor: theme['c-border-background'] }]}>
            <SourceSelector ref={sourceSelectorRef} onSourceChange={onSourceChange} center />
          </View>
        </View>
      </View>
    )
  }
)

const styles = StyleSheet.create({
  searchBar: { zIndex: 2, paddingHorizontal: 16, paddingTop: 12 },
  inputRow: { flexDirection: 'row' },
  filterRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 },
  selector: { height: 48, minWidth: 96, borderRadius: 24 },
})
