import { useEffect, useState, type ComponentType } from 'react'
import { Keyboard, StyleSheet, View } from 'react-native'
import { type NAV_ID_Type } from '@/config/constant'
import commonState from '@/store/common/state'
import MaterialHome from '../Views/MaterialHome'
import MaterialLibrary from '../Views/MaterialLibrary'
import Search from '../Views/Search'
import SongList from '../Views/SongList'
import Mylist from '../Views/Mylist'
import Leaderboard from '../Views/Leaderboard'
import Setting from '../Views/Setting'
import DailyRec from '../Views/DailyRec'
import MyPlaylist from '../Views/MyPlaylist'
import FollowedArtists from '../Views/FollowedArtists'
import SubscribedAlbums from '../Views/SubscribedAlbums'
import PlayHistory from '../Views/PlayHistory'
import OneDrive from '../Views/OneDrive'
import LocalMusic from '../Views/LocalMusic'

const routes: Record<NAV_ID_Type, ComponentType> = {
  nav_home: MaterialHome,
  nav_library: MaterialLibrary,
  nav_search: Search,
  nav_songlist: SongList,
  nav_top: Leaderboard,
  nav_love: Mylist,
  nav_daily_rec: DailyRec,
  nav_followed_artists: FollowedArtists,
  nav_subscribed_albums: SubscribedAlbums,
  nav_my_playlist: MyPlaylist,
  nav_play_history: PlayHistory,
  nav_onedrive: OneDrive,
  nav_local_music: LocalMusic,
  nav_setting: Setting,
}

/** Mount on first visit, preserve each page's search/scroll state on tab changes.
 * Bottom navigation replaces cross-page swiping; secondary routes keep all old APIs.
 */
export default () => {
  const [active, setActive] = useState(commonState.navActiveId)
  const [visited, setVisited] = useState<NAV_ID_Type[]>([commonState.navActiveId])
  useEffect(() => {
    global.lx.homePagerIdle = true
    const update = (id: NAV_ID_Type) => {
      Keyboard.dismiss()
      setVisited(previous => previous.includes(id) ? previous : [...previous, id])
      setActive(id)
    }
    global.state_event.on('navActiveIdUpdated', update)
    // Reconcile an event between initial render and subscription.
    update(commonState.navActiveId)
    return () => { global.state_event.off('navActiveIdUpdated', update) }
  }, [])
  return (
    <View style={styles.container}>
      {visited.map(id => {
        const Page = routes[id]
        if (!Page) return null
        return (
          <View
            key={id}
            style={[styles.page, { display: id === active ? 'flex' : 'none' }]}
            accessibilityElementsHidden={id !== active}
            importantForAccessibility={id === active ? 'auto' : 'no-hide-descendants'}
          >
            <Page />
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({ container: { flex: 1, minHeight: 0 }, page: { flex: 1, minHeight: 0 } })
