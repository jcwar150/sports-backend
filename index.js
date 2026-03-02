const https = require("https");

function fetchLiveEvents(sportId, sportName) {
  const options = {
    method: "GET",
    hostname: "sportapi7.p.rapidapi.com",
    port: null,
    path: `/api/v1/sport/${sportId}/events/live`,
    headers: {
      "x-rapidapi-key": process.env.FOOTBALL_API_KEY,
      "x-rapidapi-host": "sportapi7.p.rapidapi.com"
    }
  };

  const req = https.request(options, res => {
    let data = "";
    res.on("data", chunk => (data += chunk));
    res.on("end", () => {
      try {
        const json = JSON.parse(data);
        console.log(`🔍 Respuesta completa ${sportName}:`, JSON.stringify(json, null, 2));

        const games = json.data || json.events || [];
        if (games.length === 0) {
          console.log(`⚠️ No se encontraron partidos en vivo de ${sportName}.`);
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
              `🏟️ ${sportName} - ${league} (${country}):\n` +
              `   ${home} ${homeScore} - ${awayScore} ${away} | Estado: ${status}`
            );
          });
        }
      } catch (err) {
        console.error("❌ Error parseando respuesta:", err.message);
      }
    });
  });

  req.on("error", err => console.error("❌ Error en la petición:", err.message));
  req.end();
}

// --- Prueba inmediata ---
fetchLiveEvents(1, "Fútbol");
fetchLiveEvents(3, "Básquet");
fetchLiveEvents(4, "Hockey");


