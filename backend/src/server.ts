const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const { router } = require('./routes');

console.log('ENABLE_BOT =', process.env.ENABLE_BOT);

if (process.env.ENABLE_BOT === 'true') {
  require('./telegram/bot');
}

const app = express();

app.use(cors({
  origin: '*'
}));

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Backend funzionante');
});

app.use('/api', router);

const port = process.env.PORT || 3001;

app.listen(port, '0.0.0.0', () => {
  console.log(`Server attivo su porta ${port}`);
});