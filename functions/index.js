import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

initializeApp();

export const pushTaskUpdates = onDocumentWritten("hk_tasks_v19/{taskId}", async (event) => {
  const after = event.data.after.exists ? event.data.after.data() : null;
  const before = event.data.before.exists ? event.data.before.data() : null;
  if (!after || after.pushEnabled === false) return;

  const db = getFirestore();
  const tokenSnap = await db.collection("device_tokens").get();
  const docs = tokenSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  let tokens = [];
  let title = "มีงานอัปเดต";
  let body = `${after.title || "งาน"} • ${after.room || ""}`;

  const isNewFOTask = !before && after.status === "New from FO";
  if (isNewFOTask) {
    title = "มีงานใหม่จาก Front Office";
    body = `${after.title || "งานใหม่"} • ห้อง ${after.room || "-"}${after.priority ? " • " + after.priority : ""}`;
    tokens = docs.filter(d => d.role === "hk" && d.enabled !== false).map(d => d.id);
  } else if (before && after.status !== before.status) {
    title = "อัปเดตสถานะงาน";
    body = `${after.title || "งาน"} → ${after.status || ""}`;
    tokens = docs.filter(d => d.enabled !== false).map(d => d.id);
  } else {
    title = "มีการอัปเดตงาน";
    body = `${after.title || "งาน"} ถูกแก้ไขข้อมูล`;
    tokens = docs.filter(d => d.enabled !== false).map(d => d.id);
  }

  if (!tokens.length) return;

  await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    webpush: { notification: { title, body, icon: "/icon-192.png" } }
  });
});