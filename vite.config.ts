import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Populate process.env so local serverless handlers have VITE_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
  Object.assign(process.env, env);

  return {
    plugins: [
      react(),
      {
        name: 'dev-api-middleware',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (!req.url?.startsWith('/api/auth/')) {
              return next();
            }
            try {
              const urlPath = req.url.split('?')[0];
              if (urlPath === '/api/auth/exchange') {
                const { default: handler } = await server.ssrLoadModule('/api/auth/exchange.ts');
                return handler(req, res);
              }
              if (urlPath === '/api/auth/refresh') {
                const { default: handler } = await server.ssrLoadModule('/api/auth/refresh.ts');
                return handler(req, res);
              }
              if (urlPath === '/api/auth/logout') {
                const { default: handler } = await server.ssrLoadModule('/api/auth/logout.ts');
                return handler(req, res);
              }
              next();
            } catch (err) {
              console.error('[Vite Dev API] Error executing handler:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: String(err) }));
            }
          });
        },
      },
    ],
    server: {
      port: 5173,
      strictPort: true,
      open: true,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('recharts') || id.includes('d3')) {
                return 'vendor-charts';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              return 'vendor';
            }
          },
        },
      },
      chunkSizeWarningLimit: 900,
    },
  };
});
