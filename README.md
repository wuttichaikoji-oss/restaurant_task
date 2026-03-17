
# Housekeeping × Front Office Task App v1.7

เวอร์ชันนี้เพิ่ม:
- แยกข้อมูลพื้นที่แบบละเอียด: Outlet / ตึก / ชั้น / เลขห้อง
- บอร์ดรวมมีตัวกรองตาม Outlet / ตึก / ชั้น / สถานะ / ห้อง
- รองรับ Push Notification จริงผ่าน Firebase Cloud Messaging (FCM)
- มี functions/ สำหรับส่งแจ้งเตือนทุกเครื่องเมื่อมีงานใหม่หรือสถานะเปลี่ยน
- มี firebase-messaging-sw.js สำหรับแจ้งเตือนตอนแอพอยู่เบื้องหลัง

## วิธีเปิดใช้งาน Push Notification จริง
1. สร้าง Firebase Project
2. เปิด Firestore Database
3. เปิด Cloud Messaging
4. สร้าง Web Push certificate แล้วเอา VAPID public key มาใส่ใน firebase-config.js
5. ใส่ค่า Firebase config ทั้งใน firebase-config.js และ firebase-config-sw.js
6. ติดตั้ง Firebase CLI
7. รัน:
   firebase login
   firebase use --add
   firebase deploy --only hosting,functions
8. เปิดเว็บผ่าน HTTPS / Firebase Hosting
9. ล็อกอิน แล้วกดปุ่ม เปิดแจ้งเตือน

หมายเหตุ:
- เวอร์ชันนี้มีโครง push notification จริงพร้อมไฟล์ deploy แล้ว
- ก่อนใช้งานจริงต้องใส่ค่า Firebase / VAPID key เอง
- firestore.rules ในชุดนี้เปิดกว้างเพื่อทดสอบ ควรปรับให้ปลอดภัยก่อนใช้งานจริง


## ปรับเพิ่มใน v1.7.1
- หน้าหัวหน้ามีปุ่มไป `หน้าบอร์ดรวม`
- ตึก D รองรับถึง 7 ชั้น
- `ผู้รับผิดชอบ` เปลี่ยนเป็นช่องพิมพ์เอง
- แผนกเหลือ 2 แผนก: `HouseKeeping` และ `Front Office`
