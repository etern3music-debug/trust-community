const { supabase } = require('../config/supabase');
const { sendTelegramMessage, sendTelegramDirectMessage } = require('../telegram/sendMessage');

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

  if (userExists.status !== 'verified') {
    return res.status(403).json({
      error: 'Solo gli utenti verificati possono creare richieste'
    });
  }

  if (!userExists.payment_link || !String(userExists.payment_link).trim()) {
    return res.status(400).json({
      error: 'Devi salvare un payment link nel profilo prima di creare una richiesta'
    });
  }

    let levelMaxAmount = 50;

  if (userExists.level >= 4) {
    levelMaxAmount = 500;
  } else if (userExists.level === 3) {
    levelMaxAmount = 200;
  } else if (userExists.level === 2) {
    levelMaxAmount = 100;
  }

  if (Number(target_amount) > levelMaxAmount) {
    return res.status(400).json({
      error: `Il tuo livello (${userExists.level}) consente richieste fino a ${levelMaxAmount}€`
    });
  }

  const { data: existingActiveRequest, error: activeRequestError } = await supabase
    .from('requests')
    .select('*')
    .eq('user_id', user_id)
    .in('status', ['pending', 'approved'])
    .limit(1);

  if (activeRequestError) {
    return res.status(500).json({ error: activeRequestError.message });
  }

  if (existingActiveRequest && existingActiveRequest.length > 0) {
    return res.status(400).json({
      error: 'Hai già una richiesta attiva o in attesa di approvazione'
    });
  }

    const { data: latestRequest, error: latestRequestError } = await supabase
    .from('requests')
    .select('*')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (latestRequestError) {
    return res.status(500).json({ error: latestRequestError.message });
  }

  if (latestRequest && latestRequest.length > 0) {
    const lastCreatedAt = new Date(latestRequest[0].created_at).getTime();
    const now = Date.now();
    const diffMs = now - lastCreatedAt;

    const cooldownMs = 24 * 60 * 60 * 1000; // 24 ore

    if (diffMs < cooldownMs) {
      const remainingMs = cooldownMs - diffMs;
      const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));

      return res.status(400).json({
        error: `Devi attendere ancora circa ${remainingHours} ore prima di creare una nuova richiesta`
      });
    }
  }

  const { data, error } = await supabase
    .from('requests')
    .insert([
      {
        user_id,
        title,
        description,
        target_amount,
        status: 'pending'
      },
    ])
    .select();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json(data);
}

// SOLO REQUEST APPROVATE PER MINIAPP / PUBBLICO
async function getRequests(req, res) {
  const { data, error } = await supabase
    .from('requests')
    .select(`
      id,
      title,
      description,
      target_amount,
      current_amount,
      user_id,
      telegram_message_id,
      status,
      users (
        id,
        username,
        display_name,
        payment_link
      )
    `)
    .eq('status', 'approved')
    .order('id', { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const formatted = data.map((request) => {
    const progress = buildProgressBar(
      request.current_amount || 0,
      request.target_amount || 0
    );

    return {
      id: request.id,
      user_id: request.user_id,
      title: request.title,
      description: request.description,
      target_amount: request.target_amount,
      current_amount: request.current_amount,
      telegram_message_id: request.telegram_message_id,
      status: request.status,

      progress_percent: progress.percent,
      progress_bar: progress.bar,

      creator_name: request.users?.display_name || 'Utente',
      creator_username: request.users?.username || null,
      payment_link: request.users?.payment_link || null
    };
  });

  return res.json(formatted);
}

// RICHIESTE PENDING PER ADMIN
async function getPendingRequests(req, res) {
  const { data, error } = await supabase
    .from('requests')
    .select(`
      id,
      title,
      description,
      target_amount,
      current_amount,
      status,
      user_id,
      users (
        id,
        username,
        display_name
      )
    `)
    .eq('status', 'pending')
    .order('id', { ascending: true });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json(data);
}

// APPROVA REQUEST E PUBBLICA NEL CANALE + NOTIFICA UTENTE
async function approveRequest(req, res) {
  const { request_id } = req.body;

  if (!request_id) {
    return res.status(400).json({ error: 'request_id obbligatorio' });
  }

  const { data: requestData, error: requestError } = await supabase
    .from('requests')
    .select('*')
    .eq('id', request_id)
    .single();

  if (requestError || !requestData) {
    return res.status(404).json({ error: 'Richiesta non trovata' });
  }

  const { data: userData } = await supabase
    .from('users')
    .select('*')
    .eq('id', requestData.user_id)
    .single();

  const { data: updatedRequest, error: updateError } = await supabase
    .from('requests')
    .update({ status: 'approved' })
    .eq('id', request_id)
    .select()
    .single();

  if (updateError) {
    return res.status(500).json({ error: updateError.message });
  }

  const progress = buildProgressBar(
    updatedRequest.current_amount || 0,
    updatedRequest.target_amount || 0
  );

  const message =
`📢 Nuova richiesta #${updatedRequest.id}

👤 User ID: ${updatedRequest.user_id}
📝 Titolo: ${updatedRequest.title}
📄 Descrizione: ${updatedRequest.description || 'Nessuna descrizione'}
💰 Raccolti: ${updatedRequest.current_amount || 0}€ / ${updatedRequest.target_amount}€
📊 Progresso: ${progress.percent}%
${progress.bar}`;

  try {
    const telegramMsg = await sendTelegramMessage(message);

    await supabase
      .from('requests')
      .update({
        telegram_message_id: telegramMsg.message_id
      })
      .eq('id', updatedRequest.id);
  } catch (telegramError) {
    console.error(
      'Errore Telegram canale:',
      telegramError.response?.data || telegramError.message
    );
  }

  try {
    if (userData?.telegram_user_id) {
      await sendTelegramDirectMessage(
        userData.telegram_user_id,
        `✅ La tua richiesta è stata approvata.\n\nTitolo: ${updatedRequest.title}`
      );
    }
  } catch (telegramError) {
    console.error(
      'Errore notifica approvazione richiesta:',
      telegramError.response?.data || telegramError.message
    );
  }

  return res.json(updatedRequest);
}

// RIFIUTA REQUEST + NOTIFICA UTENTE
async function rejectRequest(req, res) {
  const { request_id } = req.body;

  if (!request_id) {
    return res.status(400).json({ error: 'request_id obbligatorio' });
  }

  const { data: requestData, error: requestError } = await supabase
    .from('requests')
    .select('*')
    .eq('id', request_id)
    .single();

  if (requestError || !requestData) {
    return res.status(404).json({ error: 'Richiesta non trovata' });
  }

  const { data: userData } = await supabase
    .from('users')
    .select('*')
    .eq('id', requestData.user_id)
    .single();

  const { data, error } = await supabase
    .from('requests')
    .update({ status: 'rejected' })
    .eq('id', request_id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  try {
    if (userData?.telegram_user_id) {
      await sendTelegramDirectMessage(
        userData.telegram_user_id,
        `❌ La tua richiesta è stata rifiutata.\n\nTitolo: ${data.title}`
      );
    }
  } catch (telegramError) {
    console.error(
      'Errore notifica rifiuto richiesta:',
      telegramError.response?.data || telegramError.message
    );
  }

  return res.json(data);
}

module.exports = {
  createRequest,
  getRequests,
  getPendingRequests,
  approveRequest,
  rejectRequest
};