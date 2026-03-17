const axios = require('axios');

async function editTelegramMessage(messageId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHANNEL_ID;

  const url = `https://api.telegram.org/bot${token}/editMessageText`;

  const response = await axios.post(url, {
    chat_id: chatId,
    message_id: messageId,
    text: text,
  });

  return response.data.result;
}

module.exports = { editTelegramMessage };