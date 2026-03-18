importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyD41u8RkhLuCGd9JVCfn_sqSMLBjGbNn2c",
  authDomain: "hk-task-12b10.firebaseapp.com",
  projectId: "hk-task-12b10",
  storageBucket: "hk-task-12b10.firebasestorage.app",
  messagingSenderId: "50951010152",
  appId: "1:50951010152:web:5d7e6fdbb39f16a5e988dd"
});

var messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  var title = 'HK x FO Task';
  var body = 'มีอัปเดตงานใหม่';

  if (payload && payload.notification) {
    if (payload.notification.title) {
      title = payload.notification.title;
    }
    if (payload.notification.body) {
      body = payload.notification.body;
    }
  }

  self.registration.showNotification(title, {
    body: body,
    icon: './icon-192.png'
  });
});
