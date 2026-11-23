require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");
const Database = require("better-sqlite3");
const { Telegraf, Markup } = require("telegraf");

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = String(process.env.ADMIN_ID || "");
const WEBAPP_URL = process.env.WEBAPP_URL;
const PORT = Number(process.env.PORT || 3000);

if (!BOT_TOKEN || !ADMIN_ID || !WEBAPP_URL) {
  console.error("XATO: .env faylida BOT_TOKEN, ADMIN_ID va WEBAPP_URL qiymatlarini kiriting.");
  process.exit(1);
}

const app = express();
const bot = new Telegraf(BOT_TOKEN);

const dataDir = path.join(__dirname, "data");
const uploadDir = path.join(__dirname, "uploads");
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

const db = new Database(path.join(dataDir, "bezmakler.sqlite"));
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    district TEXT NOT NULL,
    address TEXT DEFAULT '',
    rooms INTEGER NOT NULL,
    price INTEGER NOT NULL,
    audience TEXT NOT NULL,
    phone TEXT NOT NULL,
    description TEXT DEFAULT '',
    photo TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

app.use(express.json());
app.use("/uploads", express.static(uploadDir));
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/app.js", (req, res) => {
  res.sendFile(path.join(__dirname, "app.js"));
});

app.get("/style.css", (req, res) => {
  res.sendFile(path.join(__dirname, "style.css"));
});
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      return cb(new Error("Faqat JPG, PNG yoki WEBP rasmlar yuklash mumkin."));
    }
    cb(null, true);
  }
});

// Telegram Mini App initData imzosini tekshirish.
// Bu tekshiruv soxta user_id yuborilishining oldini oladi.
function verifyTelegramInitData(initData) {
  if (!initData) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(BOT_TOKEN)
    .digest();

  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const a = Buffer.from(calculatedHash, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate || Date.now() / 1000 - authDate > 86400) return null;

  try {
    const user = JSON.parse(params.get("user") || "{}");
    if (!user.id) return null;
    return user;
  } catch {
    return null;
  }
}

function requireTelegramUser(req, res, next) {
  const initData = req.get("X-Telegram-Init-Data");
  const user = verifyTelegramInitData(initData);
  if (!user) {
    return res.status(401).json({
      error: "Telegram orqali oching. Foydalanuvchi tasdiqlanmadi."
    });
  }
  req.telegramUser = user;
  next();
}

function isAdmin(user) {
  return String(user.id) === ADMIN_ID;
}

function publicListing(row) {
  return {
    id: row.id,
    title: row.title,
    district: row.district,
    address: row.address,
    rooms: row.rooms,
    price: row.price,
    audience: row.audience,
    phone: row.phone,
    description: row.description,
    photo: row.photo,
    createdAt: row.created_at
  };
}

// Faqat tasdiqlangan e'lonlar hammaga ko'rinadi.
app.get("/api/listings", (_req, res) => {
  const rows = db.prepare(
    "SELECT * FROM listings WHERE status = 'approved' ORDER BY id DESC"
  ).all();
  res.json(rows.map(publicListing));
});

// Yangi e'lon yuborish: dastlab pending holatida saqlanadi.
app.post("/api/listings", requireTelegramUser, upload.single("photo"), async (req, res) => {
  try {
    const { title, district, address, rooms, price, audience, phone, description } = req.body;

    if (!title || !district || !rooms || !price || !audience || !phone) {
      return res.status(400).json({ error: "Majburiy maydonlarni to'ldiring." });
    }

    const roomCount = Number(rooms);
    const amount = Number(price);
    if (!Number.isInteger(roomCount) || roomCount < 1 || roomCount > 20 ||
        !Number.isSafeInteger(amount) || amount < 1) {
      return res.status(400).json({ error: "Xona soni yoki narx noto'g'ri." });
    }

    const photo = req.file ? `/uploads/${req.file.filename}` : "";
    const result = db.prepare(`
      INSERT INTO listings
      (user_id, title, district, address, rooms, price, audience, phone, description, photo, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      String(req.telegramUser.id),
      String(title).slice(0, 100),
      String(district).slice(0, 80),
      String(address || "").slice(0, 150),
      roomCount,
      amount,
      String(audience).slice(0, 30),
      String(phone).slice(0, 30),
      String(description || "").slice(0, 1000),
      photo
    );

    const id = result.lastInsertRowid;
    const userLabel = [req.telegramUser.first_name, req.telegramUser.last_name].filter(Boolean).join(" ");
    const adminText =
      `🆕 YANGI IJARA E'LONI #${id}\n\n` +
      `🏠 ${title}\n📍 ${district}\n📌 ${address || "Ko'rsatilmagan"}\n` +
      `🚪 ${roomCount} xona\n💰 ${amount.toLocaleString("uz-UZ")} so'm\n` +
      `👥 ${audience}\n📞 ${phone}\n` +
      `📝 ${description || "Izoh yo'q"}\n\n` +
      `👤 Yuboruvchi: ${userLabel || "Telegram foydalanuvchisi"}\n🆔 ID: ${req.telegramUser.id}`;

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback("✅ Tasdiqlash", `listing:approve:${id}`),
        Markup.button.callback("❌ Rad etish", `listing:reject:${id}`)
      ]
    ]);

    await bot.telegram.sendMessage(ADMIN_ID, adminText, keyboard);
    if (photo) {
      await bot.telegram.sendPhoto(ADMIN_ID, { source: path.join(uploadDir, path.basename(photo)) }, {
        caption: `E'lon #${id} rasmi`
      });
    }

    res.status(201).json({ ok: true, message: "E'lon adminga tekshirish uchun yuborildi." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "E'lonni yuborishda xatolik yuz berdi." });
  }
});

// Admin e'lonni tasdiqlaydi yoki rad etadi.
bot.action(/^listing:(approve|reject):(\d+)$/, async (ctx) => {
  if (String(ctx.from.id) !== ADMIN_ID) {
    return ctx.answerCbQuery("Bu amal faqat admin uchun.", { show_alert: true });
  }

  const action = ctx.match[1];
  const id = Number(ctx.match[2]);
  const status = action === "approve" ? "approved" : "rejected";
  const listing = db.prepare("SELECT * FROM listings WHERE id = ?").get(id);

  if (!listing) {
    return ctx.answerCbQuery("E'lon topilmadi.", { show_alert: true });
  }

  db.prepare("UPDATE listings SET status = ? WHERE id = ?").run(status, id);

  try {
    await bot.telegram.sendMessage(
      listing.user_id,
      action === "approve"
        ? `✅ Sizning #${id} raqamli e'loningiz tasdiqlandi va Mini App'da ko'rinadi.`
        : `❌ Sizning #${id} raqamli e'loningiz admin tomonidan rad etildi.`
    );
  } catch (e) {
    console.log("Foydalanuvchiga xabar yuborilmadi:", e.message);
  }

  await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
  await ctx.answerCbQuery(action === "approve" ? "E'lon tasdiqlandi." : "E'lon rad etildi.");
  await ctx.reply(action === "approve" ? `✅ #${id} tasdiqlandi.` : `❌ #${id} rad etildi.`);
});

bot.start(async (ctx) => {
  await ctx.reply(
    "🏠 BEZMAKLER KVARTIRALAR\n\nToshkent bo'ylab maklersiz ijara uylarini toping yoki o'zingiz e'lon joylashtiring.",
    Markup.inlineKeyboard([
      [Markup.button.webApp("🏡 Mini App'ni ochish", WEBAPP_URL)]
    ])
  );
});

bot.command("admin", async (ctx) => {
  if (String(ctx.from.id) !== ADMIN_ID) return ctx.reply("Sizda admin huquqi yo'q.");
  const pending = db.prepare(
    "SELECT id, title, district, price FROM listings WHERE status = 'pending' ORDER BY id DESC"
  ).all();

  if (!pending.length) return ctx.reply("Tekshirish uchun yangi e'lon yo'q.");
  const text = pending.map(x =>
    `#${x.id} — ${x.title}\n📍 ${x.district}\n💰 ${x.price.toLocaleString("uz-UZ")} so'm`
  ).join("\n\n");
  return ctx.reply("⏳ KUTILAYOTGAN E'LONLAR:\n\n" + text);
});

app.get("/api/me", requireTelegramUser, (req, res) => {
  res.json({
    id: req.telegramUser.id,
    firstName: req.telegramUser.first_name || "",
    username: req.telegramUser.username || "",
    isAdmin: isAdmin(req.telegramUser)
  });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(400).json({ error: err.message || "So'rov xatosi." });
});

async function start() {
  app.listen(PORT, () => console.log(`Web server ${PORT}-portda ishga tushdi`));
  await bot.telegram.setChatMenuButton({
    menuButton: {
      type: "web_app",
      text: "Kvartiralar",
      web_app: { url: WEBAPP_URL }
    }
  });
  await bot.launch();
  console.log("Telegram bot ishga tushdi");
}

start().catch(err => {
  console.error("Ishga tushirish xatosi:", err);
  process.exit(1);
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
