import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import pool from "./db.js";

dotenv.config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const ADMIN_ID = process.env.ADMIN_ID;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;

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


// START
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


// BALANCE
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


// DEPOSIT REQUEST
bot.onText(/💳 Pul qo‘shish/, (msg) => {

  bot.sendMessage(msg.chat.id,
`💳 Balansni to‘ldirish

Iltimos summani kiriting
Masalan: 100000`
);

  bot.once("message", async (m) => {

    const amount = parseInt(m.text);
    if(isNaN(amount)) return;

    const userId = m.from.id;
    const name = m.from.first_name;

    // send to admin
    bot.sendMessage(ADMIN_ID,
`💳 Yangi to‘lov so‘rovi

Foydalanuvchi: ${name}
Telegram ID: ${userId}

Summa: ${amount} so'm`
);

    // send user admin contact
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
});
  });
});


// ADMIN ADD BALANCE
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
