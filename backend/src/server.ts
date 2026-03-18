const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const { router } = require('./routes');
require('./telegram/bot');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Backend funzionante');
});

app.use('/api', router);

const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log(`Server attivo su porta ${port}`);
});