import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AppSettingsProvider, useAppSettings } from '../src/components/AppSettings';

function Probe() {
  const s = useAppSettings();
  return (
    <div>
      <span data-testid="fs">{s.fontSize}</span>
      <button onClick={() => s.setFontSize('large')}>large</button>
      <button onClick={() => s.setFontSize('small')}>small</button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-font-size');
  document.documentElement.style.removeProperty('--app-base-font-size');
});

describe('AppSettings', () => {
  it('defaults to normal', () => {
    render(<AppSettingsProvider><Probe /></AppSettingsProvider>);
    expect(screen.getByTestId('fs').textContent).toBe('normal');
  });

  it('changes font size + persists + injects css var', () => {
    render(<AppSettingsProvider><Probe /></AppSettingsProvider>);
    act(() => { fireEvent.click(screen.getByText('large')); });
    expect(screen.getByTestId('fs').textContent).toBe('large');
    expect(document.documentElement.dataset.fontSize).toBe('large');
    expect(document.documentElement.style.getPropertyValue('--app-base-font-size')).toBe('16px');
    // 持久化
    expect(JSON.parse(localStorage.getItem('echolog.appSettings') || '{}').fontSize).toBe('large');
  });

  it('restores from localStorage', () => {
    localStorage.setItem('echolog.appSettings', JSON.stringify({ fontSize: 'small' }));
    render(<AppSettingsProvider><Probe /></AppSettingsProvider>);
    expect(screen.getByTestId('fs').textContent).toBe('small');
  });

  it('throws without provider', () => {
    expect(() => render(<Probe />)).toThrow();
  });
});
