import { defineConfig } from 'rollup';

export default defineConfig([
  {
    input: 'src/background.js',
    context: 'window',
    output: { file: 'dist/background.js', format: 'iife' },
  },
  {
    input: 'src/content/index.js',
    context: 'window',
    output: { file: 'dist/content.js', format: 'iife' },
  },
  {
    input: 'src/sidepanel/sidepanel.js',
    context: 'window',
    output: { file: 'dist/sidepanel.js', format: 'iife' },
  },
  {
    input: 'src/config/config.js',
    context: 'window',
    output: { file: 'dist/config.js', format: 'iife' },
  },
  {
    input: 'src/manual-select/manual-select.js',
    context: 'window',
    output: { file: 'dist/manual-select.js', format: 'iife' },
  },
  {
    input: 'src/question-bank/question-bank.js',
    context: 'window',
    output: { file: 'dist/question-bank.js', format: 'iife' },
  },
]);
