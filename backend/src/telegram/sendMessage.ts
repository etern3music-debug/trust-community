const axios = require('axios');

async function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHANNEL_ID;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const response = await axios.post(url, {
    chat_id: chatId,
    text: text,
  });

  return response.data.result;
}

async function sendTelegramDirectMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const response = await axios.post(url, {
    chat_id: chatId,
    text: text,
  });

  return response.data.result;
}

module.exports = { sendTelegramMessage, sendTelegramDirectMessage };