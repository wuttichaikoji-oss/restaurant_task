
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js');
importScripts('./firebase-config-sw.js');
firebase.initializeApp(self.FIREBASE_SW_CONFIG || {});
const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'HK x FO Task';
  const options = { body: payload.notification?.body || 'มีอัปเดตงานใหม่', icon: '/icon-192.png' };
  self.registration.showNotification(title, options);
});
