const { Telegraf } = require('telegraf');

// Replace with your bot token
const bot = new Telegraf('7640815198:AAEDOxnSNjU3G_SrRAkc3oFu86Dc0lSCpIU');

bot.on('message', (ctx) => {
  console.log('Your Telegram ID:', ctx.from.id);
  ctx.reply(`Your Telegram ID is: ${ctx.from.id}`);
});

bot.launch();
