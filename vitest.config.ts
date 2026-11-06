import { defineConfig, mergeConfig } from 'vitest/config'
import base from './vite.config.ts'

// The simulation tests advance the study clock by months; give them room on slow machines.
export default mergeConfig(base, defineConfig({ test: { testTimeout: 60000 } }))
