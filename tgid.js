const { Telegraf } = require('telegraf');

// Replace with your bot token
const bot = new Telegraf('Here');

bot.on('message', (ctx) => {
  console.log('Your Telegram ID:', ctx.from.id);
  ctx.reply(`Your Telegram ID is: ${ctx.from.id}`);
});

bot.launch();
