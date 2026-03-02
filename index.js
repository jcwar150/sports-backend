const https = require("https");

function fetchLiveCategories(sportId, sportName) {
  const options = {
    method: "GET",
    hostname: "sportapi7.p.rapidapi.com",
    port: null,
    path: `/api/v1/sport/${sportId}/live-categories`,
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
        const categories = json.data || json.response || [];
        console.log(`📌 Categorías en vivo de ${sportName}:`, categories.map(c => c.name));

        categories.forEach(cat => {
          fetchLiveEventsByCategory(sportId, cat.id, sportName, cat.name, cat.country?.name);
        });
      } catch (err) {
        console.error("❌ Error parseando categorías:", err.message);
      }
    });
  });

  req.on("error", err => console.error("❌ Error petición categorías:", err.message));
  req.end();
}

function fetchLiveEventsByCategory(sportId, categoryId, sportName, categoryName, countryName) {
  const options = {
    method: "GET",
    hostname: "sportapi7.p.rapidapi.com",
    port: null,
    path: `/api/v1/sport/${sportId}/events/live?categoryId=${categoryId}`,
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
        const games = json.data || json.events || [];
        if (games.length === 0) {
          console.log(`⚠️ No se encontraron partidos en ${categoryName}`);
        } else {
          games.forEach(game => {
            const home = game.homeTeam?.name || game.teams?.home?.name;
            const away = game.awayTeam?.name || game.teams?.away?.name;
            const homeScore = game.homeScore?.current ?? game.scores?.home ?? 0;
            const awayScore = game.awayScore?.current ?? game.scores?.away ?? 0;
            const status = game.status?.type || game.status?.short || "live";

            console.log(
              `🏟️ ${sportName} - ${categoryName} (${countryName || "País desconocido"}):\n` +
              `   ${home} ${homeScore} - ${awayScore} ${away} | Estado: ${status}`
            );
          });
        }
      } catch (err) {
        console.error("❌ Error parseando partidos:", err.message);
      }
    });
  });

  req.on("error", err => console.error("❌ Error petición partidos:", err.message));
  req.end();
}

// --- Prueba inmediata ---
fetchLiveCategories(1, "Fútbol");
fetchLiveCategories(3, "Básquet");
fetchLiveCategories(4, "Hockey");

