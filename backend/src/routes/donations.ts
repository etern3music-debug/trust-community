const { supabase } = require('../config/supabase');
const { editTelegramMessage } = require('../telegram/editMessage');
const { sendTelegramDirectMessage } = require('../telegram/sendMessage');

function calculateLevel(score) {
  if (score >= 100) return 4;
  if (score >= 80) return 3;
  if (score >= 60) return 2;
  return 1;
}

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

async function ensureBadge(userId, badgeName) {
  const { data: existing, error: existingError } = await supabase
    .from('badges')
    .select('*')
    .eq('user_id', userId)
    .eq('badge', badgeName);

  if (existingError) throw new Error(existingError.message);
  if (existing && existing.length > 0) return;

  const { error: insertError } = await supabase
    .from('badges')
    .insert([{ user_id: userId, badge: badgeName }]);

  if (insertError) throw new Error(insertError.message);
}

// 1) DONATORE REGISTRA "HO PAGATO"
async function createDonation(req, res) {
  const { request_id, donor_user_id, amount } = req.body;

  if (!request_id || !donor_user_id || !amount) {
    return res.status(400).json({
      error: 'Campi obbligatori mancanti: request_id, donor_user_id, amount'
    });
  }

  if (Number(amount) <= 0) {
    return res.status(400).json({
      error: 'amount deve essere maggiore di 0'
    });
  }

  if (Number(amount) > 200) {
    return res.status(400).json({
      error: 'amount troppo alto. Limite attuale: 200'
    });
  }

  const { data: requestData, error: requestError } = await supabase
    .from('requests')
    .select('*')
    .eq('id', request_id)
    .single();

  if (requestError || !requestData) {
    return res.status(404).json({ error: 'Richiesta non trovata' });
  }

  if (requestData.user_id === donor_user_id) {
    return res.status(400).json({
      error: 'Non puoi donare alla tua stessa richiesta'
    });
  }

  if ((requestData.current_amount || 0) >= requestData.target_amount) {
    return res.status(400).json({
      error: 'Questa richiesta è già stata completata'
    });
  }

  const remainingAmount = requestData.target_amount - (requestData.current_amount || 0);
  const safeDonationAmount = Math.min(Number(amount), remainingAmount);

  const { data: donorData, error: donorError } = await supabase
    .from('users')
    .select('*')
    .eq('id', donor_user_id)
    .single();

  if (donorError || !donorData) {
    return res.status(404).json({ error: 'Donatore non trovato' });
  }

  const { data: receiverData, error: receiverError } = await supabase
    .from('users')
    .select('*')
    .eq('id', requestData.user_id)
    .single();

  if (receiverError || !receiverData) {
    return res.status(404).json({ error: 'Ricevente non trovato' });
  }

  // crea donation ma NON aggiorna ancora request/score
  const { data: donationData, error: donationError } = await supabase
    .from('donations')
    .insert([
      {
        request_id,
        donor_user_id,
        amount: safeDonationAmount,
        status: 'pending_receiver_confirmation'
      },
    ])
    .select()
    .single();

  if (donationError) {
    return res.status(500).json({ error: donationError.message });
  }

  // notifica il ricevente
  try {
    if (receiverData.telegram_user_id) {
      await sendTelegramDirectMessage(
        receiverData.telegram_user_id,
        `💸 Un utente ha dichiarato di averti inviato un pagamento.

Donation ID: ${donationData.id}
Importo: ${safeDonationAmount}€
Richiesta: ${requestData.title}

Se hai ricevuto davvero il pagamento, usa:
 /confirm_receipt ${donationData.id}`
      );
    }
  } catch (telegramError) {
    console.error(
      'Errore notifica ricevente:',
      telegramError.response?.data || telegramError.message
    );
  }

  return res.json({
    donation: donationData,
    actual_donated_amount: safeDonationAmount,
    status: donationData.status,
    message: 'Pagamento segnalato. In attesa di conferma del ricevente.'
  });
}

// 2) RICEVENTE CONFERMA E SOLO QUI SI CHIUDE DAVVERO
async function confirmDonationReceipt(req, res) {
  const { donation_id, receiver_telegram_user_id } = req.body;

  if (!donation_id || !receiver_telegram_user_id) {
    return res.status(400).json({
      error: 'donation_id e receiver_telegram_user_id obbligatori'
    });
  }

  const { data: donationData, error: donationError } = await supabase
    .from('donations')
    .select('*')
    .eq('id', donation_id)
    .single();

  if (donationError || !donationData) {
    return res.status(404).json({ error: 'Donation non trovata' });
  }

  if (donationData.status === 'confirmed') {
    return res.status(400).json({ error: 'Donation già confermata' });
  }

  const { data: requestData, error: requestError } = await supabase
    .from('requests')
    .select('*')
    .eq('id', donationData.request_id)
    .single();

  if (requestError || !requestData) {
    return res.status(404).json({ error: 'Richiesta non trovata' });
  }

  const { data: receiverData, error: receiverError } = await supabase
    .from('users')
    .select('*')
    .eq('id', requestData.user_id)
    .single();

  if (receiverError || !receiverData) {
    return res.status(404).json({ error: 'Ricevente non trovato' });
  }

  if (String(receiverData.telegram_user_id) !== String(receiver_telegram_user_id)) {
    return res.status(403).json({ error: 'Solo il ricevente può confermare questa donation' });
  }

  const { data: donorData, error: donorError } = await supabase
    .from('users')
    .select('*')
    .eq('id', donationData.donor_user_id)
    .single();

  if (donorError || !donorData) {
    return res.status(404).json({ error: 'Donatore non trovato' });
  }

  // conferma donation
  const { error: confirmError } = await supabase
    .from('donations')
    .update({ status: 'confirmed' })
    .eq('id', donation_id);

  if (confirmError) {
    return res.status(500).json({ error: confirmError.message });
  }

  // aggiorna request
  const newAmount = (requestData.current_amount || 0) + donationData.amount;

  const { error: updateRequestError } = await supabase
    .from('requests')
    .update({ current_amount: newAmount })
    .eq('id', requestData.id);

  if (updateRequestError) {
    return res.status(500).json({ error: updateRequestError.message });
  }

  // aggiorna score/livello donatore
  const newScore = (donorData.score || 0) + 5;
  const newLevel = calculateLevel(newScore);

  const { error: updateUserError } = await supabase
    .from('users')
    .update({
      score: newScore,
      level: newLevel
    })
    .eq('id', donorData.id);

  if (updateUserError) {
    return res.status(500).json({ error: updateUserError.message });
  }

  try {
    await ensureBadge(donorData.id, 'contributor');
    if (newLevel >= 2) await ensureBadge(donorData.id, 'trusted_plus');
    if (newLevel >= 4) await ensureBadge(donorData.id, 'elite');
  } catch (badgeError) {
    return res.status(500).json({ error: badgeError.message });
  }

  // aggiorna messaggio canale
  try {
    const progress = buildProgressBar(newAmount, requestData.target_amount || 0);

    const updatedMessage =
`📢 Richiesta #${requestData.id}

👤 User ID: ${requestData.user_id}
📝 Titolo: ${requestData.title}
📄 Descrizione: ${requestData.description || 'Nessuna descrizione'}
💰 Raccolti: ${newAmount}€ / ${requestData.target_amount}€
📊 Progresso: ${progress.percent}%
${progress.bar}`;

    if (requestData.telegram_message_id) {
      await editTelegramMessage(requestData.telegram_message_id, updatedMessage);
    }
  } catch (telegramError) {
    console.error(
      'Errore update Telegram:',
      telegramError.response?.data || telegramError.message
    );
  }

  // notifica donatore
  try {
    if (donorData.telegram_user_id) {
      await sendTelegramDirectMessage(
        donorData.telegram_user_id,
        `✅ Il ricevente ha confermato la tua donation.

Donation ID: ${donation_id}
Importo confermato: ${donationData.amount}€`
      );
    }
  } catch (telegramError) {
    console.error(
      'Errore notifica donatore:',
      telegramError.response?.data || telegramError.message
    );
  }

  const { data: badgesData } = await supabase
    .from('badges')
    .select('*')
    .eq('user_id', donorData.id);

  return res.json({
    message: 'Donation confermata con successo',
    donation_id,
    confirmed_amount: donationData.amount,
    updated_current_amount: newAmount,
    donor_new_score: newScore,
    donor_new_level: newLevel,
    donor_badges: badgesData || []
  });
}

async function getDonations(req, res) {
  const { data, error } = await supabase
    .from('donations')
    .select('*');

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json(data);
}

module.exports = {
  createDonation,
  confirmDonationReceipt,
  getDonations
};