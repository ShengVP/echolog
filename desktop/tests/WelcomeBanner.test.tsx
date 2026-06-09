import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { WelcomeBanner } from '../src/components/WelcomeBanner';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('WelcomeBanner', () => {
  it('shows banner when FEISHU_APP_ID missing', async () => {
    vi.spyOn(window.api, 'readEnv').mockResolvedValue({} as any);
    render(<WelcomeBanner onNavigate={() => {}} />);
    await waitFor(() => expect(screen.getByText(/欢迎使用 echolog/)).toBeInTheDocument());
    expect(screen.getByText(/FEISHU_APP_ID/)).toBeInTheDocument();
  });

  it('shows banner when FEISHU_APP_ID is placeholder', async () => {
    vi.spyOn(window.api, 'readEnv').mockResolvedValue({
      FEISHU_APP_ID: 'cli_xxxxxxxxxxxxxxxx',
      FEISHU_APP_SECRET: 'something_real',
    } as any);
    render(<WelcomeBanner onNavigate={() => {}} />);
    await waitFor(() => expect(screen.getByText(/欢迎使用/)).toBeInTheDocument());
  });

  it('does not show when all required keys present', async () => {
    vi.spyOn(window.api, 'readEnv').mockResolvedValue({
      FEISHU_APP_ID: 'cli_real_value',
      FEISHU_APP_SECRET: 'real_secret_value',
    } as any);
    const { container } = render(<WelcomeBanner onNavigate={() => {}} />);
    await waitFor(() => expect(screen.queryByText(/欢迎使用/)).not.toBeInTheDocument());
    // Banner 完全不渲染
    expect(container.firstChild).toBeNull();
  });
});
