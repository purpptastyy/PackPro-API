const express = require('express');

const app = express();

const API_KEYS = process.env.API_KEYS ? process.env.API_KEYS.split(',') : [];
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ message: 'PackPro API' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, API_KEYS };
