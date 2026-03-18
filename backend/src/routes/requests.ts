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

  if (!user_id || !title || !target_amount) {
    return res.status(400).json({
      error: 'Campi obbligatori mancanti: user_id, title, target_amount'
    });
  }

  if (Number(target_amount) <= 0) {
    return res.status(400).json({
      error: 'target_amount deve essere maggiore di 0'
    });
  }

  if (Number(target_amount) > 500) {
    return res.status(400).json({
      error: 'target_amount troppo alto. Limite attuale: 500'
    });
  }

  const { data: userExists, error: userCheckError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user_id)
    .single();

  if (userCheckError || !userExists) {
    return res.status(404).json({
      error: 'Utente non trovato'
    });
  }

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