const { supabase } = require('../config/supabase');
const { sendTelegramMessage } = require('../telegram/sendMessage');

function buildProgressBar(current, target) {
  const safeTarget = target > 0 ? target : 1;
  const percent = Math.min(100, Math.round((current / safeTarget) * 100));
  const filledBlocks = Math.round(percent / 10);
  const emptyBlocks = 10 - filledBlocks;
  const bar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);

  return {
    percent,
    bar,
  };
}

// CREA REQUEST
async function createRequest(req, res) {
  const { user_id, title, description, target_amount } = req.body;

  const { data, error } = await supabase
    .from('requests')
    .insert([
      {
        user_id,
        title,
        description,
        target_amount,
      },
    ])
    .select();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const createdRequest = data[0];

  const progress = buildProgressBar(
    createdRequest.current_amount || 0,
    createdRequest.target_amount || 0
  );

  const message =
`📢 Nuova richiesta #${createdRequest.id}

👤 User ID: ${createdRequest.user_id}
📝 Titolo: ${createdRequest.title}
📄 Descrizione: ${createdRequest.description || 'Nessuna descrizione'}
💰 Raccolti: ${createdRequest.current_amount || 0}€ / ${createdRequest.target_amount}€
📊 Progresso: ${progress.percent}%
${progress.bar}`;

  try {
    const telegramMsg = await sendTelegramMessage(message);

    await supabase
      .from('requests')
      .update({
        telegram_message_id: telegramMsg.message_id
      })
      .eq('id', createdRequest.id);
  } catch (telegramError) {
    console.error(
      'Errore Telegram:',
      telegramError.response?.data || telegramError.message
    );
  }

  return res.json(data);
}

// PRENDE TUTTE LE REQUEST + BARRA
async function getRequests(req, res) {
  const { data, error } = await supabase
    .from('requests')
    .select('*');

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const enriched = data.map((request) => {
    const progress = buildProgressBar(
      request.current_amount || 0,
      request.target_amount || 0
    );

    return {
      ...request,
      progress_percent: progress.percent,
      progress_bar: progress.bar,
    };
  });

  return res.json(enriched);
}

module.exports = { createRequest, getRequests };