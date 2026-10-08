import type { Plugin } from 'vite';

export const rewriteLegalRouteRequest = (
  requestUrl: string | undefined,
  method = 'GET',
): string | undefined => {
  if (!requestUrl || (method !== 'GET' && method !== 'HEAD')) {
    return requestUrl;
  }

  const [pathname, suffix = ''] = requestUrl.split(/(?=[?#])/u, 2);
  if (pathname !== '/legal' && pathname !== '/legal/') {
    return requestUrl;
  }

  return `/index.html${suffix}`;
};

export const legalRoutePlugin = (): Plugin => ({
  name: 'cherryplay-legal-route',
  configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      request.url = rewriteLegalRouteRequest(request.url, request.method);
      next();
    });
  },
});
