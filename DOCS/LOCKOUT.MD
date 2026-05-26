# ระบบ Lockout (การล็อก/บล็อกผู้ใช้)

## ภาพรวม

ระบบ lockout จะติดตามจำนวนครั้งที่ login ผิด แล้วล็อกหรือบล็อกผู้ใช้อัตโนมัติ  
ข้อมูลถูกเก็บในตาราง `tb_login_attempts` ใน DB `csc_focus_test`

---

## ตาราง `tb_login_attempts`

| Column | Type | Default | คำอธิบาย |
|---|---|---|---|
| `id` | INT (PK, auto) | — | Primary key |
| `usercode` | VARCHAR(100) UNIQUE | — | รหัสผู้ใช้ |
| `attempts` | INT | 0 | จำนวนครั้งที่ login ผิด (สะสม) |
| `locked_until` | TIMESTAMP | NULL | ล็อกชั่วคราวจนถึงเวลานี้ |
| `is_blocked` | BOOLEAN | false | บล็อกถาวร |
| `block_count` | INT | 0 | จำนวนครั้งที่ถูก block (ไม่ reset เมื่อ unlock) |
| `last_attempt` | TIMESTAMP | NULL | เวลา login ผิดล่าสุด |
| `unlocked_by` | VARCHAR(100) | NULL | Admin ที่ทำการ unlock |
| `unlocked_at` | TIMESTAMP | NULL | เวลาที่ admin ทำการ unlock |

> **หมายเหตุ:** `unlocked_by` และ `unlocked_at` มีอยู่ใน DB แต่ยังไม่ได้เพิ่มใน `prisma/schema.prisma` ของโปรเจกต์นี้  
> SQL ที่ต้อง run ก่อน:
> ```sql
> ALTER TABLE tb_login_attempts ADD COLUMN IF NOT EXISTS unlocked_by VARCHAR(100);
> ALTER TABLE tb_login_attempts ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMP(6);
> ```

---

## ไฟล์ที่เกี่ยวข้อง (booking-meeting-room-api)

| ไฟล์ | หน้าที่ |
|---|---|
| `src/app/service/authService.ts` | Logic ตรวจสอบ / นับ attempts / lock / block |
| `prisma/schema.prisma` | model `tb_login_attempts` |
| `src/app/constant/message.constant.ts` | ข้อความ error AUTH_MSG |

---

## การตั้งค่า (authService.ts)

```typescript
const MAX_ATTEMPTS   = 5;   // ผิด 5 ครั้ง → lock ชั่วคราว
const BLOCK_ATTEMPTS = 10;  // ผิด 10 ครั้ง (สะสม) → block ถาวร
const LOCK_MINUTES   = 5;  // lock ชั่วคราว 15 นาที
```

> เวลาทั้งหมดใช้ timezone **Asia/Vientiane** ผ่าน `localNow()` helper

---

## Flow การ Login

```
POST /auth/login
│
├─ ผู้ใช้ไม่อยู่ใน DB → 401 INVALID_CREDENTIALS
│
├─ is_blocked = true → 403 ACCOUNT_BLOCKED
│
├─ locked_until > ปัจจุบัน → 403 ACCOUNT_LOCKED(นาทีที่เหลือ)
│
├─ รหัสผ่านถูก:
│   └─ updateMany: attempts=0, locked_until=null, is_blocked=false
│      (block_count ยังคงไว้)
│      → 200 + JWT token
│
└─ รหัสผ่านผิด: currentAttempts = record.attempts + 1
    │
    ├─ currentAttempts >= 10 → upsert: is_blocked=true, block_count+1
    │   → 403 ACCOUNT_BLOCKED
    │
    ├─ currentAttempts == 5 → upsert: locked_until = ปัจจุบัน + 15 นาที
    │   → 403 ACCOUNT_LOCKED(15)
    │
    └─ อื่นๆ (1-4, 6-9) → upsert: attempts++
        ├─ attempts 1-4: remaining = 5 - attempts  (จนถึง lock)
        └─ attempts 6-9: remaining = 10 - attempts (จนถึง block)
        → 401 ATTEMPTS_REMAINING(remaining)
```

### ตารางสรุป attempts

| attempts | สถานะ | ข้อความ |
|---|---|---|
| 1 | ผิด | รหัสผ่านผิด เหลือโอกาสอีก 4 ครั้ง |
| 2 | ผิด | รหัสผ่านผิด เหลือโอกาสอีก 3 ครั้ง |
| 3 | ผิด | รหัสผ่านผิด เหลือโอกาสอีก 2 ครั้ง |
| 4 | ผิด | รหัสผ่านผิด เหลือโอกาสอีก 1 ครั้ง |
| 5 | **LOCK ชั่วคราว** | บัญชีถูกล็อกชั่วคราว กรุณาลองใหม่ใน 15 นาที |
| 6 | ผิด (หลัง unlock หรือ lock หมด) | รหัสผ่านผิด เหลือโอกาสอีก 4 ครั้ง |
| 7 | ผิด | รหัสผ่านผิด เหลือโอกาสอีก 3 ครั้ง |
| 8 | ผิด | รหัสผ่านผิด เหลือโอกาสอีก 2 ครั้ง |
| 9 | ผิด | รหัสผ่านผิด เหลือโอกาสอีก 1 ครั้ง |
| 10 | **BLOCK ถาวร** | บัญชีถูกบล็อกถาวร กรุณาติดต่อผู้ดูแลระบบ |

---

## ระบบ Admin Unlock — csc-unlock-user-api

โปรเจกต์แยก port **7011** สำหรับ admin จัดการ lockout ในทุกโปรเจกต์ที่ใช้ DB `csc_focus_test`  
Authentication ด้วย header `x-admin-key` (ไม่ใช้ JWT)

### Endpoints

#### GET `/lockout/status?usercode=xxx`
ดึงสถานะ lockout ของผู้ใช้คนเดียว

```json
{
  "status": 200,
  "data": {
    "usercode": "U001",
    "status": "blocked",
    "attempts": 10,
    "block_count": 2,
    "locked_until": null,
    "last_attempt": "2025-05-22T10:30:00.000Z",
    "unlocked_by": "admin01",
    "unlocked_at": "2025-05-22T09:00:00.000Z"
  }
}
```

`status` มี 3 ค่า: `normal` | `locked` | `blocked`

#### GET `/lockout/list`
ดึงรายการผู้ใช้ทั้งหมดที่มี record ใน `tb_login_attempts`

#### POST `/lockout/unlock`
Unlock ผู้ใช้ (ล็อกชั่วคราว หรือ บล็อกถาวร)

```json
{
  "usercode": "U001",
  "unlocked_by": "admin01"
}
```

**สิ่งที่ reset:**
- `is_blocked` → `false`
- `locked_until` → `null`
- `attempts` → `0`

**สิ่งที่ยังคงไว้:**
- `block_count` — ประวัติจำนวนครั้งที่ถูก block ทั้งหมด
- `last_attempt` — เวลา login ผิดล่าสุด

**Header ที่ต้องส่ง:**
```
x-admin-key: <ADMIN_SECRET>
```

---

## สร้าง ADMIN_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## สิ่งที่ยัง Pending

- [ ] Run SQL เพิ่ม column `unlocked_by`, `unlocked_at` ใน DB (ทำครั้งเดียว)
- [ ] เพิ่ม field ทั้ง 2 ใน `prisma/schema.prisma` ของ booking-meeting-room-api แล้ว `npx prisma generate`
- [ ] ตรวจ `LOCK_MINUTES` ใน `authService.ts` — ต้องเป็น `15` สำหรับ production
