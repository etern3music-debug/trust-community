const { supabase } = require('../config/supabase');

async function testSupabase(req, res) {
  const { data, error } = await supabase
    .from('users')
    .select('*');

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json(data);
}

console.log('test.ts caricato');

module.exports = { testSupabase };