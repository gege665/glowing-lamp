/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import App from './App';

describe('App smoke', () => {
  it('renders without crashing', () => {
    const rootEl = document.createElement('div');
    rootEl.id = 'root';
    document.body.appendChild(rootEl);
    const root = createRoot(rootEl);
    act(() => {
      root.render(createElement(App));
    });
    expect(rootEl.innerHTML.length).toBeGreaterThan(0);
    expect(rootEl.textContent).toContain('Soul');
  });
});
