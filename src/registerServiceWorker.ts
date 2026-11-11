export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('TrackWise PWA ServiceWorker registered with scope:', registration.scope);
        })
        .catch((error) => {
          console.error('TrackWise ServiceWorker registration failed:', error);
        });
    });
  }
}
