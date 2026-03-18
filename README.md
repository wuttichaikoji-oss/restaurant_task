
# HOUSEKEEPING TASK v1.9

เวอร์ชันนี้ปรับ workflow ให้ง่ายขึ้นตามคอนเซปต์ใช้งานจริงในโรงแรม

## Workflow ใหม่
- `New from FO`
- `In Progress`
- `Done by HK`
- `Close job by FO` → ย้ายการ์ดออกจากบอร์ดไปเก็บใน `LOG / Report`

## หน้าหลัก
- `index.html` = ล็อกอิน
- `fo.html` = Front Office เปิดงาน / ปิดงาน
- `hk.html` = HouseKeeping รับงาน / ทำงาน / ส่งงานเสร็จ
- `board.html` = บอร์ดรวมเฉพาะงาน active
- `log.html` = ประวัติงานที่ปิดแล้ว + Report
- `supervisor.html` = หน้าภาพรวม

## สิ่งที่เพิ่มใน v1.9
- ตัดขั้น `Accepted by HK` ออก
- HK กด `In Progress` ได้เลย
- FO ปิดงานแล้วงานจะถูกย้ายออกจากบอร์ดทันที
- มีหน้า `LOG / Report`
- มีตัวเลข report เบื้องต้น:
  - จำนวนงานปิดแล้ว
  - เวลาเฉลี่ย
  - จำนวนงานที่ปิดวันนี้
  - งานเร่งด่วนที่ปิดแล้ว

## รหัสทดลอง
- FO A = 1001
- FO B = 1002
- HK A = 2001
- HK B = 2002
- Supervisor = 9000

## หมายเหตุ
- ถ้ายังไม่เชื่อม Firebase ระบบจะใช้ Local Demo Mode
- ถ้าเชื่อม Firebase สำเร็จ จะ sync งานและ log ข้ามเครื่องแบบ realtime


## แก้ไขใน v1.9.1
- เพิ่มตัวตรวจสอบว่าเว็บเชื่อม Firebase ได้หรือยัง
- แต่ละหน้าจะแสดงสถานะ เช่น
  - เชื่อม Firebase สำเร็จ
  - พบ config แล้ว แต่ Firebase ยังไม่พร้อม
  - กำลังใช้ Local Mode
  - Firebase มีปัญหา
- ถ้าเชื่อมสำเร็จ จะแสดงจำนวน Tasks / Logs ที่อ่านได้จาก Firebase


## แก้ไขใน v1.9.2
- จัดตำแหน่งสถานะ Firebase ใหม่ ไม่ให้ลอยกลางจอ
- ปรับหน้า HK ให้ดูสมดุลขึ้น มี KPI ย่อยด้านบน
- ล็อกปุ่มตามสถานะงานจริง
- ปรับหน้า FO / Board / Log / Supervisor ให้แสดงสถานะ Firebase แบบเนียนขึ้น
