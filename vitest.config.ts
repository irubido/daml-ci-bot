import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'lib/',
        'coverage/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/fixtures/**',
      ],
    },
  },
});