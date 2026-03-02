const https = require('https');

const options = {
  method: 'GET',
  hostname: 'sportapi7.p.rapidapi.com',
  port: null,
  path: '/api/v1/sport/football/events/live', // usando nombre
  headers: {
    'x-rapidapi-key': process.env.FOOTBALL_API_KEY,
    'x-rapidapi-host': 'sportapi7.p.rapidapi.com'
  }
};

const req = https.request(options, function (res) {
  const chunks = [];

  res.on('data', function (chunk) {
    chunks.push(chunk);
  });

  res.on('end', function () {
    const body = Buffer.concat(chunks);
    try {
      const json = JSON.parse(body.toString());
      console.log("🔍 Respuesta completa:", JSON.stringify(json, null, 2));
    } catch (err) {
      console.error("❌ Error parseando respuesta:", err.message);
    }
  });
});

req.on('error', err => console.error("❌ Error en la petición:", err.message));
req.end();


