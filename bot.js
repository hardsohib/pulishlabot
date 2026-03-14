// bot.js
import TelegramBot from "node-telegram-bot-api";
import express from "express";
import dotenv from "dotenv";
import pool from "./db.js";

dotenv.config();

// --- Setup ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const RENDER_URL = process.env.RENDER_URL; // e.g., https://your-bot.onrender.com

if (!BOT_TOKEN || !ADMIN_ID || !ADMIN_USERNAME || !RENDER_URL) {
  console.error("❌ Missing environment variables!");
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN);
const app = express();
app.use(express.json());

// --- Webhook setup ---
bot.setWebHook(`${RENDER_URL}/${BOT_TOKEN}`);

// Endpoint to receive Telegram updates
app.post(`/${BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Optional root endpoint
app.get("/", (req, res) => res.send("Bot is running"));

// --- Menu ---
const menu = {
  reply_markup: {
    keyboard: [
      ["💰 Balans"],
      ["📋 Vazifalar"],
      ["📢 Reklama berish"],
      ["💳 Pul qo‘shish"],
      ["💸 Pul yechish"]
    ],
    resize_keyboard: true
  }
};

// --- START Command ---
bot.onText(/\/start/, async (msg) => {
  const userId = msg.from.id;
  const name = msg.from.first_name;

  await pool.query(
    `INSERT INTO users (telegram_id,name)
     VALUES ($1,$2)
     ON CONFLICT (telegram_id) DO NOTHING`,
    [userId, name]
  );

  bot.sendMessage(userId,
`Assalomu alaykum ${name}

Botga xush kelibsiz.`,
  menu
  );
});

// --- BALANCE Command ---
bot.onText(/💰 Balans/, async (msg) => {
  const userId = msg.from.id;

  const res = await pool.query(
    "SELECT balance FROM users WHERE telegram_id=$1",
    [userId]
  );

  const balance = res.rows[0]?.balance || 0;

  bot.sendMessage(userId,
`💰 Sizning balansingiz

${balance} so'm`
  );
});

// --- DEPOSIT REQUEST ---
bot.onText(/💳 Pul qo‘shish/, (msg) => {
  bot.sendMessage(msg.chat.id,
`💳 Balansni to‘ldirish

Iltimos summani kiriting
Masalan: 100000`
  );

  bot.once("message", async (m) => {
    const amount = parseInt(m.text);
    if (isNaN(amount)) return;

    const userId = m.from.id;
    const name = m.from.first_name;

    // Send request to admin
    bot.sendMessage(ADMIN_ID,
`💳 Yangi to‘lov so‘rovi

Foydalanuvchi: ${name}
Telegram ID: ${userId}

Summa: ${amount} so'm`
    );

    // Send user admin contact
    bot.sendMessage(userId,
`💳 So‘rovingiz adminga yuborildi.

To‘lov qilish uchun admin bilan bog‘laning.`,
      {
        reply_markup:{
          inline_keyboard:[
            [
              {
                text:"👤 Admin bilan bog‘lanish",
                url:`https://t.me/${ADMIN_USERNAME}`
              }
            ]
          ]
        }
      }
    );
  });
});

// --- ADMIN ADD BALANCE ---
bot.onText(/\/addbalance (.+) (.+)/, async (msg, match) => {
  if(msg.from.id != ADMIN_ID) return;

  const userId = match[1];
  const amount = parseInt(match[2]);

  await pool.query(
    "UPDATE users SET balance = balance + $1 WHERE telegram_id=$2",
    [amount, userId]
  );

  bot.sendMessage(userId,
`✅ Balansingiz ${amount} so'mga to‘ldirildi`
  );

  bot.sendMessage(msg.chat.id,"Balance added");
});

// --- Start Express server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Bot listening on port ${PORT}`);
});
