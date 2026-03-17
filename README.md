
# Front Office → HouseKeeping Workflow v1.8

คอนเซปต์ของเวอร์ชันนี้คือ:

- **Front Office (FO)** = คนเปิดงาน / สั่งงาน / ติดตาม / ปิดงาน
- **HouseKeeping (HK)** = คนรับงาน / ทำงาน / ส่งงานกลับ
- **Supervisor** = ดูภาพรวมทั้งหมด

## หน้าใช้งาน
- `index.html` = หน้าเข้าสู่ระบบ
- `fo.html` = หน้า Front Office สำหรับเปิดงานให้ HK
- `hk.html` = หน้า HouseKeeping สำหรับรับงานและส่งงานกลับ
- `board.html` = บอร์ดรวมทุกงาน
- `supervisor.html` = หน้าดูภาพรวมสำหรับผู้ดูแล

## สถานะงานใหม่
- `New from FO`
- `Accepted by HK`
- `In Progress`
- `Done by HK`
- `Closed by FO`
- `Rejected / Rework`

## Logic การทำงาน
1. FO เปิดงานใหม่
2. HK รับงาน
3. HK เริ่มทำงาน
4. HK ส่งงานกลับเมื่อเสร็จ
5. FO ตรวจและปิดงาน หรือ ตีกลับ

## รหัสทดลอง
- FO A = 1001
- FO B = 1002
- HK A = 2001
- HK B = 2002
- Supervisor = 9000

## หมายเหตุ
- ตึก A/B/C ใช้ชั้น 1–5
- ตึก D ใช้ชั้น 1–7
- ถ้ายังไม่เชื่อม Firebase ระบบจะใช้ Local Demo Mode
- ถ้าเชื่อม Firebase สำเร็จ จะ sync งานข้ามเครื่องแบบ realtime


## แก้ไขใน v1.8.1
- แก้บัคหน้าบอร์ดรวมเข้าไม่ได้
- ทำเมนูบนบอร์ดรวมให้แสดงตามบทบาท FO / HK / Supervisor
