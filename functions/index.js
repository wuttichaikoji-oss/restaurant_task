import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

initializeApp();

async function getEnabledTokensByRole(role) {
  const db = getFirestore();
  const snap = await db.collection("device_tokens").where("enabled", "!=", false).get();
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(d => !role || d.role === role)
    .map(d => d.id);
}

export const pushNewTaskToHK = onDocumentCreated("hk_tasks_v19/{taskId}", async (event) => {
  const task = event.data?.data();
  if (!task) return;
  if (task.pushEnabled === false) return;

  const tokens = await getEnabledTokensByRole("hk");
  if (!tokens.length) return;

  const title = "มีงานใหม่จาก Front Office";
  const body = `${task.title || "งานใหม่"} • ห้อง ${task.room || "-"}${task.priority ? " • " + task.priority : ""}`;

  await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    webpush: {
      notification: {
        title,
        body,
        icon: "/HK_task/icon-192.png"
      }
    }
  });
});

export const pushTaskStatusUpdate = onDocumentUpdated("hk_tasks_v19/{taskId}", async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!before || !after) return;
  if (before.status === after.status) return;
  if (after.pushEnabled === false) return;

  const tokens = await getEnabledTokensByRole("fo");
  if (!tokens.length) return;

  const title = "อัปเดตสถานะงาน";
  const body = `${after.title || "งาน"} → ${after.status || "-"}`;

  await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    webpush: {
      notification: {
        title,
        body,
        icon: "/HK_task/icon-192.png"
      }
    }
  });
});
