# DrinkGo

Frontend และ Backend อยู่ใน Git repository เดียวกัน แต่ Angular workspace อยู่ในโฟลเดอร์ `frontend`.

## Run from the repository root

```bash
npm run start:frontend
npm run start:backend
```

ให้เปิดสอง terminal เมื่อต้องการรันทั้ง Frontend และ Backend พร้อมกัน

## Run inside each project

Frontend:

```bash
cd frontend
npm start
```

Backend:

```bash
cd backend
npm run dev
```

ไม่ควรรัน `ng serve` จาก repository root โดยตรง เพราะไฟล์ `angular.json` อยู่ใน `frontend`.
