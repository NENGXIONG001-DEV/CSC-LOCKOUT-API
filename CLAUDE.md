# CSC Unlock User API — Project Context

## ภาพรวม

`csc-unlock-user-api` เป็น **standalone service** สำหรับจัดการระบบ Lockout ของ user  
แยกออกมาจาก `booking-meeting-room-api` เพื่อให้ทุกโปรเจคใน CSC ใช้งานร่วมกันได้

- **Port:** `7011`
- **Database:** `csc_focus_test` (PostgreSQL ที่ `192.168.1.57:5432`)
- **Auth:** ใช้ `x-admin-key` header แทน JWT token

---

## สถาปัตยกรรม

```
src/
├── app.ts                          # Express app + middleware registration
├── server.ts                       # Entry point + env validation + startup log
├── constants/
│   └── messages.ts                 # ข้อความ error/success ทั้งหมด
├── lib/
│   ├── prisma.ts                   # Prisma client (ใช้ PrismaPg adapter)
│   └── logger.ts                   # Winston logger (console + file)
├── middleware/
│   ├── adminKey.middleware.ts      # ตรวจสอบ x-admin-key header
│   └── requestLog.middleware.ts    # Log ทุก request พร้อม IP
├── service/
│   └── lockoutService.ts           # Business logic ทั้งหมด
├── controller/
│   └── lockoutController.ts        # รับ request ส่ง response
└── routes/
    └── lockout.routes.ts           # Route definitions
prisma/
└── schema.prisma                   # model tb_login_attempts
prisma.config.ts                    # Prisma v7 config (datasource URL)
logs/
└── app-YYYY-MM-DD.log              # Request log รายวัน (rotate ทุกวัน, เก็บถาวร)
```

---

## ตาราง `tb_login_attempts`

| Column | Type | คำอธิบาย |
|--------|------|-----------|
| `id` | Int (PK) | auto increment |
| `usercode` | String (unique) | รหัสพนักงาน |
| `attempts` | Int | จำนวนครั้งที่ login ผิด |
| `locked_until` | DateTime? | หมดอายุ lock ชั่วคราว |
| `is_blocked` | Boolean | block ถาวร |
| `block_count` | Int | นับว่าถูก block ถาวรกี่ครั้ง |
| `last_attempt` | DateTime? | เวลา login ผิดล่าสุด |
| `unlocked_by` | String? | รหัสพนักงานที่ทำการ unlock ครั้งล่าสุด |
| `unlocked_at` | DateTime? | เวลาที่ unlock ครั้งล่าสุด |

> ตารางนี้สร้างโดย `booking-meeting-room-api` — project นี้แค่ **อ่านและแก้ไข** ข้อมูลในตาราง  
> column `unlocked_by` และ `unlocked_at` เพิ่มโดย project นี้ผ่าน ALTER TABLE โดยตรง (ไม่ใช้ prisma migrate เพราะ shared database)

---

## API Endpoints

ทุก endpoint ต้องส่ง header:
```
x-admin-key: <ADMIN_SECRET จาก .env>
```

| Method | Path | คำอธิบาย |
|--------|------|-----------|
| `GET` | `/lockout/status?usercode=xxx` | ดูสถานะ lock ของ user คนเดียว |
| `GET` | `/lockout/list` | ดู list ทุก user ที่มี record |
| `POST` | `/lockout/unlock` | ปลด lock/block ของ user |

### Response `status` field

| ค่า | ความหมาย |
|-----|-----------|
| `normal` | ปกติ ไม่ถูก lock |
| `locked` | ถูก lock ชั่วคราว (`locked_until` ยังไม่หมด) |
| `blocked` | ถูก block ถาวร (`is_blocked = true`) |

### unlock — body

```json
{
  "usercode": "111999",
  "unlocked_by": "admin001"
}
```

unlock จะ reset: `is_blocked = false`, `locked_until = null`, `attempts = 0`  
บันทึก: `unlocked_by`, `unlocked_at = now()`  
คงไว้: `block_count`, `last_attempt`

---

## Lockout Logic (อยู่ใน `booking-meeting-room-api`)

ระบบ lockout ทำงานใน `authService.ts` ของ `booking-meeting-room-api`:

```
ผิด 1-4 ครั้ง  → แจ้ง "เหลืออีก N ครั้ง"
ผิดครั้งที่ 5   → lock 15 นาที (locked_until = now + 15min)
ผิด 6-9 ครั้ง  → แจ้ง "เหลืออีก N ครั้ง" (นับถึง block)
ผิดครั้งที่ 10  → block ถาวร (is_blocked = true, block_count++)
login สำเร็จ   → ไม่ลบ record (แก้ไขแล้วใน booking-meeting-room-api)
```

---

## Logging

ใช้ **Winston** + **winston-daily-rotate-file**

- log ออก terminal (colorized) และเขียนไฟล์ `logs/app-YYYY-MM-DD.log` พร้อมกัน
- rotate ทุกวัน, ไฟล์ละไม่เกิน 20MB, เก็บถาวรไม่มีลบ
- IP ที่ log คือ LAN IP ของเครื่องที่ยิง request มา

ตัวอย่าง log:
```
[2026-05-22 10:30:05] info: POST /lockout/unlock | IP: 192.168.1.10 | usercode=111999 | unlocked_by=admin001
```

---

## Environment Variables

```env
PORT=9121
DATABASE_URL="postgresql://postgres:<password>@192.168.1.57:5432/csc_focus_test"
ADMIN_SECRET=<random hex 32 bytes>
```

server จะ **exit ทันที** ถ้าไม่มี `DATABASE_URL` หรือ `ADMIN_SECRET`

สร้าง `ADMIN_SECRET` ใหม่ด้วย:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## การรัน

```bash
npm install
npx prisma generate
npm run dev
```

> **หมายเหตุ:** `src/generated/` ถูก generate จาก schema — ไม่ต้อง commit และไม่ต้อง copy ไป deploy  
> `npm run build` จะรัน `prisma generate` อัตโนมัติก่อน compile TypeScript

---

## Prisma v7 Notes

- ใช้ `@prisma/adapter-pg` + `pg` สำหรับ runtime connection (ไม่มี `url` ใน schema.prisma)
- `prisma.config.ts` อยู่ที่ root — ใช้โดย Prisma CLI สำหรับ migrate/introspect
- **ห้ามใช้ `prisma db push`** เพราะ database เป็น shared database — ใช้ ALTER TABLE โดยตรงแทน

---

## สิ่งที่ยังไม่ได้ทำ / ต่อยอดได้

- [ ] Swagger / API docs
- [ ] Rate limiting บน `/lockout/unlock`
- [ ] Webhook แจ้งเตือนเมื่อ user ถูก block
