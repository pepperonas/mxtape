/**
 * Test Setup File
 * Configures the testing environment for Vitest + React Testing Library
 */

import '@testing-library/jest-dom'
import { expect, afterEach, vi, beforeAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import { MotionGlobalConfig } from 'motion/react'

// Cleanup after each test to prevent memory leaks
afterEach(() => {
  cleanup()
})

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString()
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    get length() {
      return Object.keys(store).length
    },
    key: vi.fn((index: number) => {
      const keys = Object.keys(store)
      return keys[index] || null
    })
  }
})()

global.localStorage = localStorageMock as any

// Motion: finish every animation instantly (exit animations still complete
// asynchronously — await removal with findBy*/waitForElementToBeRemoved)
MotionGlobalConfig.skipAnimations = true

// Tests flip prefers-reduced-motion via setReducedMotion() from src/test/motion.ts

// Mock matchMedia (for responsive components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? (window as { __mxReducedMotion?: boolean }).__mxReducedMotion === true : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Tests are written against the German texts: pin the language, also for code
// that detects it from the browser (jsdom reports en-US).
import { setCurrentLang } from '@/i18n/lang'
Object.defineProperty(window.navigator, 'languages', { value: ['de-DE', 'de'], configurable: true })
setCurrentLang('de')

// Fake mxtape API: an in-memory /api/data store per test file, so providers
// that sync with the server work without a network. Tests that need other
// answers stub fetch themselves (vi.stubGlobal).
import { fakeApiFetch, resetFakeApi } from './fakeApi'
globalThis.fetch = fakeApiFetch as typeof fetch
afterEach(() => resetFakeApi())

// Mock IntersectionObserver (for lazy loading components)
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as any

// Mock ResizeObserver (for responsive layouts)
// A class: browsers construct it with `new` (an arrow-function mock throws there)
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any

// Mock canvas-confetti (used in winner animations)
vi.mock('canvas-confetti', () => ({
  default: vi.fn(() => Promise.resolve()),
}))

// Mock Howler.js (audio playback)
vi.mock('howler', () => ({
  Howl: vi.fn().mockImplementation(() => ({
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    unload: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    volume: vi.fn(),
    seek: vi.fn(),
    duration: vi.fn(() => 30),
    playing: vi.fn(() => false),
    state: vi.fn(() => 'loaded'),
  })),
  Howler: {
    volume: vi.fn(),
    mute: vi.fn(),
    unload: vi.fn(),
  },
}))

// Suppress console warnings in tests (optional, can be removed if needed)
beforeAll(() => {
  // Store original console methods
  const originalWarn = console.warn
  const originalError = console.error

  // Filter out specific warnings
  console.warn = vi.fn((...args) => {
    const message = args[0]
    if (
      typeof message === 'string' &&
      (message.includes('React does not recognize') ||
        message.includes('componentWillReceiveProps'))
    ) {
      return
    }
    originalWarn(...args)
  })

  console.error = vi.fn((...args) => {
    const message = args[0]
    if (
      typeof message === 'string' &&
      (message.includes('Not implemented: HTMLFormElement.prototype.submit') ||
        message.includes('Not implemented: HTMLCanvasElement.prototype.getContext'))
    ) {
      return
    }
    originalError(...args)
  })
})

// Add custom matchers (if needed in the future)
expect.extend({
  // Example: toBeWithinRange(received, floor, ceiling)
})

// Global test utilities
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export const mockPlayer = (overrides = {}) => {
  return {
    name: 'Test Player',
    cards: 0,
    score: 0,
    timeline: [],
    ...overrides,
  }
}
