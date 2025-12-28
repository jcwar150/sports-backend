require('dotenv').config();
const axios = require('axios');

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;

async function sendMatchNotification() {
  try {
    // 1. Obtener datos de un partido (ejemplo Premier League)
    const matchRes = await axios.get("https://api.football-data.org/v4/matches", {
      headers: { "X-Auth-Token": FOOTBALL_API_KEY }
    });

    const match = matchRes.data.matches[0]; // toma el primer partido
    const home = match.homeTeam.name;
    const away = match.awayTeam.name;
    const score = `${match.score.fullTime.home} - ${match.score.fullTime.away}`;

    // 2. Enviar notificación a OneSignal
    const res = await axios.post("https://onesignal.com/api/v1/notifications", {
      app_id: ONESIGNAL_APP_ID,
      included_segments: ["All"],
      headings: { en: "⚽ Resultado en vivo" },
      contents: { en: `${home} vs ${away}: ${score}` }
    }, {
      headers: {
        "Authorization": `Basic ${ONESIGNAL_API_KEY}`,
        "Content-Type": "application/json"
      }
    });

    console.log("✅ Notificación enviada:", res.data);
  } catch (err) {
    console.error("❌ Error:", err.response?.data || err.message);
  }
}

sendMatchNotification();










