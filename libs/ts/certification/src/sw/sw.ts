import { handleRequest } from './http_request';

declare const self: ServiceWorkerGlobalScope;
// declare const self: any;

const DEBUG = true;

// Always install updated SW immediately
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Intercept and proxy all fetch requests made by the browser or DOM on this scope.
self.addEventListener('fetch', (event: any) => {
  try {
    const response = handleRequest(event.request);
    response.then(r => {
      console.log('!!!', r);
      return r;
    });
    event.respondWith(response);
  } catch (e: any) {
    console.error(e.message || e.toString());
    if (DEBUG) {
      return event.respondWith(
        new Response(e.message || e.toString(), {
          status: 501,
        })
      );
    }
    event.respondWith(new Response('Internal Error', { status: 502 }));
  }
});
