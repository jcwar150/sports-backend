const https = require('https');

const options = {
  method: 'GET',
  hostname: 'sportapi7.p.rapidapi.com',
  port: null,
  path: '/api/v1/sport/football/events/live', // usando el nombre del deporte
  headers: {
    'x-rapidapi-key': process.env.FOOTBALL_API_KEY, // tu API key
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

      const games = json.data || json.events || [];
      if (games.length === 0) {
        console.log("⚠️ No se encontraron partidos en vivo de Fútbol.");
      } else {
        games.forEach(game => {
          const home = game.homeTeam?.name || game.teams?.home?.name;
          const away = game.awayTeam?.name || game.teams?.away?.name;
          const homeScore = game.homeScore?.current ?? game.scores?.home ?? 0;
          const awayScore = game.awayScore?.current ?? game.scores?.away ?? 0;
          const league = game.league?.name || game.competition?.name || "Liga desconocida";
          const country = game.country?.name || "País desconocido";
          const status = game.status?.type || game.status?.short || "live";

          console.log(
            `🏟️ Fútbol - ${league} (${country}):\n` +
            `   ${home} ${homeScore} - ${awayScore} ${away} | Estado: ${status}`
          );
        });
      }
    } catch (err) {
      console.error("❌ Error parseando respuesta:", err.message);
    }
  });
});

req.on('error', err => console.error("❌ Error en la petición:", err.message));
req.end();

