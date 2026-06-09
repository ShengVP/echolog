// 完整 App + 视图集成 smoke tests
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import App from '../src/App';

beforeEach(() => {
  localStorage.clear();
});

describe('App shell', () => {
  it('renders all 6 sidebar items', () => {
    render(<App />);
    expect(screen.getByText('日记浏览')).toBeInTheDocument();
    expect(screen.getByText('选题 & 草稿')).toBeInTheDocument();
    expect(screen.getByText('搜索')).toBeInTheDocument();
    expect(screen.getByText('Prompt 编辑')).toBeInTheDocument();
    expect(screen.getByText('配置')).toBeInTheDocument();
    expect(screen.getByText('状态')).toBeInTheDocument();
  });

  it('shows date in DiaryView default', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('2026-05-27')).toBeInTheDocument());
  });

  it('persists view choice to localStorage', () => {
    render(<App />);
    fireEvent.click(screen.getByText('搜索'));
    expect(localStorage.getItem('echolog.view')).toBe('search');
  });

  it('restores view from localStorage on mount', async () => {
    localStorage.setItem('echolog.view', 'config');
    render(<App />);
    await waitFor(() => expect(screen.getByText('🧑 你是谁')).toBeInTheDocument());
  });

  it('Cmd+3 keyboard shortcut switches to search view', async () => {
    render(<App />);
    act(() => {
      fireEvent.keyDown(window, { key: '3', metaKey: true });
    });
    await waitFor(() => {
      expect(screen.getByText(/跨日搜索/)).toBeInTheDocument();
    });
  });
});

describe('SearchView', () => {
  it('renders keyword + semantic mode tabs', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('搜索'));
    await waitFor(() => expect(screen.getByText('跨日搜索')).toBeInTheDocument());
    expect(screen.getByText('关键词')).toBeInTheDocument();
    expect(screen.getByText('语义')).toBeInTheDocument();
  });

  it('runs keyword search on Enter', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('搜索'));
    const input = await screen.findByPlaceholderText(/输入关键词/);
    fireEvent.change(input, { target: { value: '飞书' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    // mock 返回空，但搜索应该跑过（不报错）
    await waitFor(() => expect(input).toBeInTheDocument());
  });
});

describe('PromptsView', () => {
  it('shows prompt type selector + version list', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Prompt 编辑'));
    // 等 registry 拉回来 + 默认打开 diary
    await waitFor(() => expect(screen.getByText('Prompt 类型')).toBeInTheDocument());
    expect(screen.getByText('版本')).toBeInTheDocument();
    // 版本列表里至少能看到 diary_v1.md 和 diary_v1_1.md
    await waitFor(() => expect(screen.getByText('diary_v1.md')).toBeInTheDocument());
    expect(screen.getByText('diary_v1_1.md')).toBeInTheDocument();
  });

  it('auto-opens latest version on mount', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Prompt 编辑'));
    await waitFor(() => {
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue('## SYSTEM\n\nsystem text\n\n## TEMPLATE\n\ntemplate text');
    });
  });
});

describe('ConfigView', () => {
  it('switches to config view + shows all 8 sections', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('配置'));
    await waitFor(() => expect(screen.getByText('🧑 你是谁')).toBeInTheDocument());
    expect(screen.getByText('💬 飞书')).toBeInTheDocument();
    expect(screen.getByText('🧠 LLM Provider')).toBeInTheDocument();
    expect(screen.getByText('📜 Prompt 版本')).toBeInTheDocument();
    expect(screen.getByText('🎛 功能开关')).toBeInTheDocument();
    expect(screen.getByText('📅 周报配置')).toBeInTheDocument();
    expect(screen.getByText('📋 滴答清单（可选）')).toBeInTheDocument();
    expect(screen.getByText('✈️ Telegram（可选）')).toBeInTheDocument();
  });

  it('shows LLM ping button + can trigger', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('配置'));
    const ping = await screen.findByText('测连通');
    fireEvent.click(ping);
    // ping 是 mocked success
    await waitFor(() => expect(screen.queryByText('测试中...')).not.toBeInTheDocument(), { timeout: 1000 });
  });
});

describe('StatusView', () => {
  it('shows bot + ratings + index sections', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('状态'));
    await waitFor(() => expect(screen.getByText('🤖 bot 进程')).toBeInTheDocument());
    expect(screen.getByText('⭐ /rate 评分')).toBeInTheDocument();
    expect(screen.getByText('🧠 跨日记忆索引')).toBeInTheDocument();
    expect(screen.getByText(/🩺 echolog doctor/)).toBeInTheDocument();
  });

  it('runs doctor + shows output', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('状态'));
    const btn = await screen.findByRole('button', { name: /跑$/ });
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByText('mock doctor output')).toBeInTheDocument());
  });

  it('can trigger bot start button', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('状态'));
    const startBtn = await screen.findByRole('button', { name: /启动$/ });
    expect(startBtn).not.toBeDisabled(); // bot not running per mock
    fireEvent.click(startBtn);
    await waitFor(() => expect(startBtn).toBeInTheDocument());
  });
});

describe('DraftsView', () => {
  it('shows note + draft tabs', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('选题 & 草稿'));
    await waitFor(() => {
      // ModeTab "选题" 和 "草稿" 都会出现
      const tabs = screen.getAllByText(/^选题$|^草稿$/);
      expect(tabs.length).toBeGreaterThan(0);
    });
  });
});
