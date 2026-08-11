/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import App from './App';

function mockLocalStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, String(v));
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
    },
  });
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
      clear: () => undefined,
    },
  });
}

describe('App smoke', () => {
  beforeEach(() => {
    mockLocalStorage();
    document.body.innerHTML = '';
  });

  it('renders without crashing', () => {
    const rootEl = document.createElement('div');
    rootEl.id = 'root';
    document.body.appendChild(rootEl);
    const root = createRoot(rootEl);
    act(() => {
      root.render(createElement(App));
    });
    expect(rootEl.innerHTML.length).toBeGreaterThan(0);
    expect(rootEl.textContent).toContain('灵焰');
  });
});
