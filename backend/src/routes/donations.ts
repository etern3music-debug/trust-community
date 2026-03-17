const { supabase } = require('../config/supabase');
const { editTelegramMessage } = require('../telegram/editMessage');

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

  return { percent, bar };
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

async function createDonation(req, res) {
  console.log('>>> createDonation chiamata');
  const { request_id, donor_user_id, amount } = req.body;
  console.log('BODY:', req.body);

  const { data: donationData, error: donationError } = await supabase
    .from('donations')
    .insert([{ request_id, donor_user_id, amount }])
    .select();

  if (donationError) {
    return res.status(500).json({ error: donationError.message });
  }

  const { data: requestData, error: requestError } = await supabase
    .from('requests')
    .select('*')
    .eq('id', request_id)
    .single();

  if (requestError) {
    return res.status(500).json({ error: requestError.message });
  }

  console.log('REQUEST LETTA:', requestData);

  const newAmount = (requestData.current_amount || 0) + amount;

  const { error: updateRequestError } = await supabase
    .from('requests')
    .update({ current_amount: newAmount })
    .eq('id', request_id);

  if (updateRequestError) {
    return res.status(500).json({ error: updateRequestError.message });
  }

  const { data: donorData, error: donorError } = await supabase
    .from('users')
    .select('*')
    .eq('id', donor_user_id)
    .single();

  if (donorError) {
    return res.status(500).json({ error: donorError.message });
  }

  const newScore = (donorData.score || 0) + 5;
  const newLevel = calculateLevel(newScore);

  const { error: updateUserError } = await supabase
    .from('users')
    .update({
      score: newScore,
      level: newLevel
    })
    .eq('id', donor_user_id);

  if (updateUserError) {
    return res.status(500).json({ error: updateUserError.message });
  }

  try {
    await ensureBadge(donor_user_id, 'contributor');
    if (newLevel >= 2) await ensureBadge(donor_user_id, 'trusted_plus');
    if (newLevel >= 4) await ensureBadge(donor_user_id, 'elite');
  } catch (badgeError) {
    return res.status(500).json({ error: badgeError.message });
  }

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

    console.log('telegram_message_id:', requestData.telegram_message_id);

    if (requestData.telegram_message_id) {
      await editTelegramMessage(requestData.telegram_message_id, updatedMessage);
      console.log('>>> Messaggio Telegram modificato');
    } else {
      console.log('>>> Nessun telegram_message_id, quindi non posso modificare');
    }
  } catch (telegramError) {
    console.error(
      'Errore update Telegram:',
      telegramError.response?.data || telegramError.message
    );
  }

  const { data: badgesData, error: badgesError } = await supabase
    .from('badges')
    .select('*')
    .eq('user_id', donor_user_id);

  if (badgesError) {
    return res.status(500).json({ error: badgesError.message });
  }

  return res.json({
    donation: donationData,
    updated_current_amount: newAmount,
    donor_new_score: newScore,
    donor_new_level: newLevel,
    donor_badges: badgesData
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

module.exports = { createDonation, getDonations };