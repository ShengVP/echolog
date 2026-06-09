// preload —— 通过 contextBridge 把白名单 IPC 暴露给 renderer
// 安全约定：renderer (React) 只能调这里列出来的 channel，不能直接 require node 模块
import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // 日记 / vault
  listDates: (): Promise<string[]> => ipcRenderer.invoke('vault:listDates'),
  readDay: (date: string): Promise<{
    rawLogs: string | null;
    diaries: { version: number; file: string; content: string; mtime: number }[];
    assets: string[];
  }> => ipcRenderer.invoke('vault:readDay', date),
  // 任意文件转 data URL（给 React 的 <img> 用，因为 file:// 协议被 sandbox 拦了）
  readAssetDataUrl: (relPath: string): Promise<string | null> =>
    ipcRenderer.invoke('vault:readAssetDataUrl', relPath),

  // 选题 / drafts
  listNotes: (): Promise<NoteSummary[]> => ipcRenderer.invoke('drafts:listNotes'),
  listDrafts: (): Promise<DraftSummary[]> => ipcRenderer.invoke('drafts:listDrafts'),
  readNote: (filename: string): Promise<string | null> => ipcRenderer.invoke('drafts:readNote', filename),
  readDraft: (filename: string): Promise<string | null> => ipcRenderer.invoke('drafts:readDraft', filename),

  // 配置
  readEnv: (): Promise<Record<string, string>> => ipcRenderer.invoke('config:readEnv'),
  writeEnv: (values: Record<string, string>): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('config:writeEnv', values),
  listPromptVersions: (name: string): Promise<string[]> =>
    ipcRenderer.invoke('config:listPromptVersions', name),
  readPrompt: (name: string, version: string): Promise<string | null> =>
    ipcRenderer.invoke('config:readPrompt', name, version),

  // 状态
  getBotStatus: (): Promise<BotStatus> => ipcRenderer.invoke('status:getBotStatus'),
  runDoctor: (): Promise<{ stdout: string; stderr: string; code: number }> =>
    ipcRenderer.invoke('status:runDoctor'),
  getRatings: (): Promise<RatingsSummary> => ipcRenderer.invoke('status:getRatings'),
  getIndexStats: (): Promise<IndexStats> => ipcRenderer.invoke('status:getIndexStats'),

  // 搜索
  searchKeyword: (query: string, opts?: { includeDiaries?: boolean }): Promise<SearchHit[]> =>
    ipcRenderer.invoke('search:keyword', query, opts),
  searchSemantic: (query: string, opts?: { topK?: number; minScore?: number }): Promise<{ ok: boolean; error?: string; hits: SemanticHit[] }> =>
    ipcRenderer.invoke('search:semantic', query, opts),

  // Prompt 编辑
  writePrompt: (name: string, version: string, content: string): Promise<{ ok: boolean; error?: string; file?: string }> =>
    ipcRenderer.invoke('config:writePrompt', name, version, content),
  listPromptRegistry: (): Promise<PromptRegistryEntry[]> => ipcRenderer.invoke('config:listPromptRegistry'),

  // Bot 控制
  botStart: (): Promise<{ ok: boolean; output: string; error?: string }> => ipcRenderer.invoke('bot:start'),
  botStop: (): Promise<{ ok: boolean; output: string; error?: string }> => ipcRenderer.invoke('bot:stop'),
  botRestart: (): Promise<{ ok: boolean; output: string; error?: string }> => ipcRenderer.invoke('bot:restart'),
  tailLog: (lines?: number): Promise<string> => ipcRenderer.invoke('bot:tailLog', lines),
  triggerCommand: (command: 'diary' | 'week', date?: string): Promise<{ ok: boolean; error?: string; triggered?: string }> =>
    ipcRenderer.invoke('bot:triggerCommand', command, date),

  // LLM 连通性
  pingLlm: (): Promise<LlmPingResult> => ipcRenderer.invoke('llm:ping'),

  // 元信息
  getProjectRoot: (): Promise<string> => ipcRenderer.invoke('meta:getProjectRoot'),
  openInFinder: (relPath: string): Promise<void> => ipcRenderer.invoke('meta:openInFinder', relPath),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('meta:openExternal', url),

  // 在线更新
  checkUpdates: (): Promise<{ ok: boolean; info?: any; error?: string }> => ipcRenderer.invoke('updater:check'),
  installUpdate: (): Promise<void> => ipcRenderer.invoke('updater:install'),
  appVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
};

contextBridge.exposeInMainWorld('api', api);

// 主菜单 → 渲染端导航事件转发 + 更新器事件转发
contextBridge.exposeInMainWorld('appEvents', {
  onNavigate: (cb: (view: string) => void) => {
    const handler = (_e: any, view: string) => cb(view);
    ipcRenderer.on('menu:navigate', handler);
    return () => ipcRenderer.removeListener('menu:navigate', handler);
  },
  onUpdaterEvent: (cb: (event: 'available' | 'not-available' | 'error' | 'progress' | 'downloaded', payload: any) => void) => {
    const channels: Array<['available' | 'not-available' | 'error' | 'progress' | 'downloaded', string]> = [
      ['available', 'updater:available'],
      ['not-available', 'updater:not-available'],
      ['error', 'updater:error'],
      ['progress', 'updater:progress'],
      ['downloaded', 'updater:downloaded'],
    ];
    const wrappers: Array<[string, any]> = [];
    for (const [event, channel] of channels) {
      const h = (_e: any, payload: any) => cb(event, payload);
      ipcRenderer.on(channel, h);
      wrappers.push([channel, h]);
    }
    return () => { for (const [c, h] of wrappers) ipcRenderer.removeListener(c, h); };
  },
});

// 给 TS 用的类型
export type Api = typeof api;
export interface NoteSummary {
  filename: string;
  title: string;
  maturity: string;
  category: string;
  created: string;
}
export interface DraftSummary {
  filename: string;
  format: string;
  sourceTitle: string;
  sourceDate: string;
  generatedAt: string;
  charCount: number;
}
export interface BotStatus {
  running: boolean;
  pid?: number;
  memMB?: number;
  logFile?: string;
}
export interface RatingsSummary {
  total: number;
  avg: string;
  byScore: Record<string, number>;
  recent: { date: string; version: string; score: number; comment?: string }[];
}
export interface IndexStats {
  model: string;
  totalChunks: number;
  days: number;
  earliest: string | null;
  latest: string | null;
}
export interface SearchHit {
  date: string;
  type: 'raw' | 'diary';
  file: string;
  snippets: string[];
}
export interface SemanticHit {
  date: string;
  time: string;
  text: string;
  score: number;
}
export interface LlmPingResult {
  ok: boolean;
  provider?: string;
  model?: string;
  reply?: string;
  durationSec?: string;
  error?: string;
}
export interface PromptRegistryEntry {
  name: string;
  label: string;
  description: string;
  envKey: string;
  defaultVersion: string;
  versions: string[];
}
