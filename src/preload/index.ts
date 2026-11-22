import { contextBridge, ipcRenderer } from 'electron'
import type { Decision, HuddleApi, HuddleState } from '../shared/types'

const api: HuddleApi = {
  onState(cb) {
    const listener = (_: unknown, state: HuddleState) => cb(state)
    ipcRenderer.on('huddle:state', listener)
    return () => ipcRenderer.removeListener('huddle:state', listener)
  },
  decide: (pendingId: string, d: Decision) => ipcRenderer.send('huddle:decide', pendingId, d),
  jump: (sessionId: string) => ipcRenderer.send('huddle:jump', sessionId),
  dismiss: (sessionId: string) => ipcRenderer.send('huddle:dismiss', sessionId),
  setHeight: (px: number) => ipcRenderer.send('huddle:height', px),
  rename: (sessionId: string, title: string) => ipcRenderer.send('huddle:rename', sessionId, title),
  hide: () => ipcRenderer.send('huddle:hide')
}

contextBridge.exposeInMainWorld('huddle', api)
