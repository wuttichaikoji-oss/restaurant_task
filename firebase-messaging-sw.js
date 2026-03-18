importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyD41u8RkhLuCGd9JVCfn_sqSMLBjGbNn2c",
  authDomain: "hk-task-12b10.firebaseapp.com",
  projectId: "hk-task-12b10",
  storageBucket: "hk-task-12b10.firebasestorage.app",
  messagingSenderId: "50951010152",
  appId: "1:50951010152:web:5d7e6fdbb39f16a5e988dd",
  measurementId: "G-WV53WB0FKH"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || 'HK x FO Task';
  const options = {
    body: payload?.notification?.body || 'มีอัปเดตงานใหม่',
    icon: './icon-192.png'
  };
  self.registration.showNotification(title, options);
});
