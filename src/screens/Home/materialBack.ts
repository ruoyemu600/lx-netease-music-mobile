import type { NAV_ID_Type } from '@/config/constant'

// One Home hardware-back owner dispatches only to the visible route. Cached
// pages must not register competing native listeners or depend on mount order.
const handlers = new Map<NAV_ID_Type, () => boolean>()

export const registerMaterialBackHandler = (id: NAV_ID_Type, handler: () => boolean) => {
  handlers.set(id, handler)
  return () => {
    if (handlers.get(id) === handler) handlers.delete(id)
  }
}

export const handleMaterialBack = (id: NAV_ID_Type): boolean => handlers.get(id)?.() ?? false
