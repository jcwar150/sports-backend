require('dotenv').config();
const axios = require('axios');

// Claves directas (no recomendado en producción)
const ONESIGNAL_APP_ID = "886fb758-5e13-44df-87d4-3f3590e11491"; // tu App ID real
const ONESIGNAL_API_KEY = "os_v2_app_rbx3owc6cncn7b6uh42zbyiuseszyllgidaewbuqyqwcylfwno6um5s5ir4mr6rd76mfouwl3rmyr7k4wpx3lyhzgxdiduchqcuzaey"; // tu nueva API Key
const FOOTBALL_API_KEY = "04d73dd17729e5edb6408c2e826009ab"; // tu API Key de fútbol

let lastNotified = {};

async function checkLiveMatches() {
  try {
    const response = await axios.get("https://v3.football.api-sports.io/fixtures?live=all", {
      headers: { "x-apisports-key": FOOTBALL_API_KEY }
    });

    const matches = response.data.response;

    if (!matches || matches.length === 0) {
      console.log("⚽ No hay partidos en vivo ahora mismo.");
      return;
    }

    for (const match of matches) {
      const home = match.teams.home.name;
      const away = match.teams.away.name;
      const score = `${match.goals.home} - ${match.goals.away}`;
      const matchId = match.fixture.id;

      console.log(`📊 ${home} vs ${away}: ${score}`);

      if (lastNotified[matchId] === score) continue;
      lastNotified[matchId] = score;

      await axios.post("https://onesignal.com/api/v1/notifications", {
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

setInterval(checkLiveMatches, 60 * 1000);
checkLiveMatches();
;






