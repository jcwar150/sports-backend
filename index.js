const https = require('https');

function fetchLiveEvents(sportSlug, sportName) {
  const options = {
    method: 'GET',
    hostname: 'sportapi7.p.rapidapi.com',
    port: null,
    path: `/api/v1/sport/${sportSlug}/events/live`,
    headers: {
      'x-rapidapi-key': process.env.FOOTBALL_API_KEY,
      'x-rapidapi-host': 'sportapi7.p.rapidapi.com'
    }
  };

  const req = https.request(options, function (res) {
    const chunks = [];

    res.on('data', chunk => chunks.push(chunk));

    res.on('end', function () {
      const body = Buffer.concat(chunks);
      try {
        const json = JSON.parse(body.toString());

        const games = json.data || json.events || [];
        if (games.length === 0) {
          console.log(`⚠️ No se encontraron partidos en vivo de ${sportName}.`);
        } else {
          games.forEach(game => {
            const home = game.homeTeam?.name;
            const away = game.awayTeam?.name;
            const homeScore = game.homeScore?.current ?? 0;
            const awayScore = game.awayScore?.current ?? 0;

            const league = game.uniqueTournament?.name || "Liga desconocida";
            const country = game.uniqueTournament?.category?.country?.name || "País desconocido";
            const status = game.status?.description || game.status?.type || "live";

            // Calcular minutos jugados
            let minutesPlayed = "";
            if (game.time?.currentPeriodStartTimestamp && game.startTimestamp) {
              const now = Math.floor(Date.now() / 1000); // tiempo actual en segundos
              const elapsed = Math.floor((now - game.startTimestamp) / 60); // minutos desde inicio
              minutesPlayed = `${elapsed}'`;
            }

            console.log(
              `🏟️ ${sportName} - ${league} (${country})\n` +
              `   ${home} ${homeScore} - ${awayScore} ${away} | ${status} ${minutesPlayed}`
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
}

// --- Prueba inmediata para los 3 deportes ---
fetchLiveEvents("football", "Fútbol");
fetchLiveEvents("basketball", "Básquet");
fetchLiveEvents("hockey", "Hockey");

