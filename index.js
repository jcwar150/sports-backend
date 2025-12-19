require('dotenv').config();
const axios = require('axios');

// Variables de entorno (asegúrate de tenerlas en tu .env)
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID; // tu App ID de OneSignal
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY; // tu REST API Key de OneSignal
const FOOTBALL_API_KEY = "04d73dd17729e5edb6408c2e826009ab"; // tu API Key de fútbol

// Función para consultar partidos en vivo
async function checkLiveMatches() {
  try {
    const response = await axios.get("https://v3.football.api-sports.io/fixtures?live=all", {
      headers: { "x-apisports-key": FOOTBALL_API_KEY }
    });

    const matches = response.data.response;

    if (matches.length === 0) {
      console.log("⚽ No hay partidos en vivo ahora mismo.");
      return;
    }

    for (const match of matches) {
      const home = match.teams.home.name;
      const away = match.teams.away.name;
      const score = `${match.goals.home} - ${match.goals.away}`;

      console.log(`📊 ${home} vs ${away}: ${score}`);

      // Enviar notificación con OneSignal
      await axios.post("https://api.onesignal.com/notifications", {
        app_id: ONESIGNAL_APP_ID,
        included_segments: ["All"],
        headings: { en: "⚽ Gol en vivo!" },
        contents: { en: `${home} vs ${away}: ${score}` }
      }, {
        headers: {
          "Authorization": `Basic ${ONESIGNAL_API_KEY}`,
          "Content-Type": "application/json"
        }
      });

      console.log("✅ Notificación enviada a OneSignal");
    }
  } catch (err) {
    console.error("❌ Error:", err.response?.data || err.message);
  }
}

// Ejecutar cada minuto
setInterval(checkLiveMatches, 60 * 1000);

// También ejecutar inmediatamente al iniciar
checkLiveMatches();






