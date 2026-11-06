import type { NAV_ID_Type } from '@/config/constant'

export const ROOT_TABS = ['nav_home', 'nav_search', 'nav_library'] as const
export type RootTab = (typeof ROOT_TABS)[number]

/** Secondary pages keep their real route IDs, data and deep-link behavior. */
export const getRootTab = (id: NAV_ID_Type): RootTab => {
  if (id === 'nav_search') return 'nav_search'
  if (id === 'nav_home' || id === 'nav_songlist' || id === 'nav_top' || id === 'nav_daily_rec') return 'nav_home'
  return 'nav_library'
}

export const isRootTab = (id: NAV_ID_Type): id is RootTab =>
  (ROOT_TABS as readonly string[]).includes(id)
