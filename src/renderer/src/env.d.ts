import type { HuddleApi } from '../../shared/types'
declare global {
  interface Window {
    huddle?: HuddleApi
  }
}
export {}
