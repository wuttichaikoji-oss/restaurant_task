window.FIREBASE_CONFIG = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME"
};
window.FIREBASE_TASKS_COLLECTION = "hk_tasks_v19";
window.FIREBASE_LOGS_COLLECTION = "hk_logs_v19";
window.FIREBASE_DEVICE_TOKENS_COLLECTION = "device_tokens";
window.FIREBASE_VAPID_KEY = "REPLACE_ME";
window.FIREBASE_ENABLED = (
  window.FIREBASE_CONFIG &&
  window.FIREBASE_CONFIG.projectId &&
  window.FIREBASE_CONFIG.projectId !== "REPLACE_ME"
);