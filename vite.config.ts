import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({base:'/escritorio-personal/',plugins:[react()],test:{environment:'jsdom',setupFiles:'./src/test-setup.ts',exclude:['tests/**','node_modules/**']}});
