const https = require("https");

const options = {
  method: "GET",
  hostname: "sportapi7.p.rapidapi.com",
  port: null,
  path: "/api/v1/sport/1/events/live", // ⚽ Fútbol (ID=1)
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
      const games = json.data || json.events || json.response || [];

      if (games.length === 0) {
        console.log("⚠️ No se encontraron partidos en vivo.");
      } else {
        games.forEach(game => {
          const home = game.homeTeam?.name || game.teams?.home?.name;
          const away = game.awayTeam?.name || game.teams?.away?.name;
          const status = game.status?.type || game.status?.short || "live";
          console.log(`🏟️ ${home} vs ${away} | Estado: ${status}`);
        });
      }
    } catch (err) {
      console.error("❌ Error parseando respuesta:", err.message);
    }
  });
});

req.on("error", err => console.error("❌ Error en la petición:", err.message));
req.end();




