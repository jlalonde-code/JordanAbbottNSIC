const express = require('express');
const app = express();

// Use the port Render provides
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello world!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
