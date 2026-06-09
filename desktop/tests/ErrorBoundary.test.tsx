import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../src/components/ErrorBoundary';

function Boom(): any {
  throw new Error('test boom');
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(<ErrorBoundary><div>safe</div></ErrorBoundary>);
    expect(screen.getByText('safe')).toBeInTheDocument();
  });

  it('catches error + shows fallback UI', () => {
    // 关掉 console.error 减少噪音
    const orig = console.error;
    console.error = () => {};
    try {
      render(<ErrorBoundary><Boom /></ErrorBoundary>);
      expect(screen.getByText(/桌面应用发生异常/)).toBeInTheDocument();
      // 错误消息可能在 message + stack 两个位置出现，所以用 getAllByText
      expect(screen.getAllByText(/test boom/).length).toBeGreaterThan(0);
    } finally {
      console.error = orig;
    }
  });

  it('reset button clears error', () => {
    const orig = console.error;
    console.error = () => {};
    try {
      // 一开始 throw，按钮点了之后切到 safe child
      let shouldBoom = true;
      const Toggling = () => {
        if (shouldBoom) throw new Error('boom');
        return <div>recovered</div>;
      };
      const { rerender } = render(<ErrorBoundary><Toggling /></ErrorBoundary>);
      expect(screen.getByText(/桌面应用发生异常/)).toBeInTheDocument();
      shouldBoom = false;
      fireEvent.click(screen.getByText('重置 UI'));
      rerender(<ErrorBoundary><Toggling /></ErrorBoundary>);
      expect(screen.getByText('recovered')).toBeInTheDocument();
    } finally {
      console.error = orig;
    }
  });
});
