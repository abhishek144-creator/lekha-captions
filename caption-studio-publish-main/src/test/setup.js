import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Unmount rendered components between tests (automatic only with globals).
afterEach(() => cleanup())
