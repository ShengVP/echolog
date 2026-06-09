// renderer 端类型 —— 跟 preload 的 Api 接口对齐
import type { Api, NoteSummary, DraftSummary, BotStatus, RatingsSummary, IndexStats, SearchHit, SemanticHit, LlmPingResult, PromptRegistryEntry } from '../electron/preload';

export type UpdaterEvent = 'available' | 'not-available' | 'error' | 'progress' | 'downloaded';

declare global {
  interface Window {
    api: Api;
    appEvents?: {
      onNavigate: (cb: (view: string) => void) => () => void;
      onUpdaterEvent?: (cb: (event: UpdaterEvent, payload: any) => void) => () => void;
    };
  }
}

export type { NoteSummary, DraftSummary, BotStatus, RatingsSummary, IndexStats, SearchHit, SemanticHit, LlmPingResult, PromptRegistryEntry };

export type ViewName = 'diary' | 'drafts' | 'search' | 'prompts' | 'config' | 'status';

export interface NavItem {
  id: ViewName;
  label: string;
  iconName: string; // lucide-react icon name
}
