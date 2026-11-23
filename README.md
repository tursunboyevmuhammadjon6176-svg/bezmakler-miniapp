# BEZMAKLER KVARTIRALAR — Telegram Mini App

## 1. Kerak bo'ladigan narsalar
- Node.js 20 yoki undan yangi versiya
- Telegram bot tokeni
- Telegram numeric user ID (admin ID)
- HTTPS domen (Mini App Telegram ichida ochilishi uchun)

## 2. Bot yaratish
1. Telegramda @BotFather ni oching.
2. /newbot yuboring.
3. Bot nomi va username tanlang.
4. Berilgan tokenni nusxalang.
5. Admin ID'ingizni @userinfobot orqali aniqlang.

## 3. Loyihani sozlash
Terminalda loyiha papkasiga kiring:

```bash
npm install
```

`.env.example` faylidan nusxa olib `.env` deb nomlang. Ichini to'ldiring:

```env
BOT_TOKEN=BotFather bergan token
ADMIN_ID=raqamli_telegram_id
WEBAPP_URL=https://sizning-domeningiz.uz
PORT=3000
```

## 4. Ishga tushirish

```bash
npm start
```

Bot va web server birga ishga tushadi. Serveringizda 3000-port ochiq bo'lishi kerak.

## 5. HTTPS domen
Telegram Mini App uchun ommaviy HTTPS manzil kerak. VPS yoki Node.js qo'llaydigan hostingga loyihani joylashtiring, domen va SSL sertifikat ulang. So'ng `.env` ichidagi WEBAPP_URL ni haqiqiy HTTPS manzilga o'zgartiring va serverni qayta ishga tushiring.

## 6. Botdan foydalanish
- Foydalanuvchi /start yuboradi.
- Mini App'ni ochish tugmasini bosadi.
- E'lon formasini to'ldiradi.
- E'lon admin Telegramiga tasdiqlash/rad etish tugmalari bilan boradi.
- Admin tasdiqlasa, e'lon umumiy ro'yxatda ko'rinadi.
- Admin /admin buyrug'i bilan kutilayotgan e'lonlarni ko'rishi mumkin.

## 7. Muhim xavfsizlik
- `.env` faylini hech kimga yubormang.
- Bot tokenini GitHub'ga yuklamang.
- Mini App'ni faqat HTTPS orqali oching.
- Backend Telegram initData imzosini tekshiradi.
- Ishga tushirishdan oldin test e'lonlari bilan sinab ko'ring.

## 8. Hozirgi versiya chegaralari
Bu boshlang'ich MVP: e'lonlar, rasm, qidiruv, admin tasdig'i va telefon orqali aloqa bor. Keyingi bosqichda narx oralig'i, tumanlar ro'yxati, ko'p rasmli galereya, e'lon egasining shaxsiy kabineti, tahrirlash/o'chirish va moderatsiya tarixi qo'shilishi mumkin.
