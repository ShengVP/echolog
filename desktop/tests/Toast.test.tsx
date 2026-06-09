import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../src/components/Toast';

function Probe({ onReady }: { onReady: (api: ReturnType<typeof useToast>) => void }) {
  const api = useToast();
  onReady(api);
  return null;
}

describe('Toast system', () => {
  it('throws when used outside provider', () => {
    expect(() => render(<Probe onReady={() => {}} />)).toThrow();
  });

  it('shows success message + auto-dismiss', async () => {
    let api: any;
    render(
      <ToastProvider>
        <Probe onReady={(a) => (api = a)} />
      </ToastProvider>
    );
    act(() => api.success('保存成功', 100));
    expect(screen.getByText('保存成功')).toBeInTheDocument();
    await new Promise(r => setTimeout(r, 200));
    expect(screen.queryByText('保存成功')).not.toBeInTheDocument();
  });

  it('shows all 4 kinds', async () => {
    let api: any;
    render(
      <ToastProvider>
        <Probe onReady={(a) => (api = a)} />
      </ToastProvider>
    );
    act(() => {
      api.success('s', 5000);
      api.error('e', 5000);
      api.info('i', 5000);
      api.warning('w', 5000);
    });
    expect(screen.getByText('s')).toBeInTheDocument();
    expect(screen.getByText('e')).toBeInTheDocument();
    expect(screen.getByText('i')).toBeInTheDocument();
    expect(screen.getByText('w')).toBeInTheDocument();
  });

  it('dismisses on close click', () => {
    let api: any;
    render(
      <ToastProvider>
        <Probe onReady={(a) => (api = a)} />
      </ToastProvider>
    );
    act(() => api.info('test msg', 9999));
    expect(screen.getByText('test msg')).toBeInTheDocument();
    // 找带 X 按钮的 close
    const btn = screen.getByText('test msg').parentElement?.querySelector('button');
    expect(btn).toBeTruthy();
    fireEvent.click(btn!);
    expect(screen.queryByText('test msg')).not.toBeInTheDocument();
  });
});
