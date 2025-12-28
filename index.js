require('dotenv').config();
const axios = require('axios');

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;

console.log("=== VARIABLES DE ENTORNO ===");
console.log("ONESIGNAL_APP_ID:", ONESIGNAL_APP_ID || "MISSING");
console.log("ONESIGNAL_API_KEY:", ONESIGNAL_API_KEY ? ONESIGNAL_API_KEY.substring(0, 25) + "..." : "MISSING");
console.log("FOOTBALL_API_KEY:", FOOTBALL_API_KEY ? FOOTBALL_API_KEY.substring(0, 10) + "..." : "MISSING");
console.log("============================");

async function getLiveMatch() {
  try {
    // 1. Obtener partidos en vivo desde API-SPORTS
    const res = await axios.get("https://v3.football.api-sports.io/fixtures", {
      params: { live: "all" },
      headers: { "x-apisports-key": FOOTBALL_API_KEY }
    });

    if (!res.data.response || res.data.response.length === 0) {
      console.log("⚠️ No hay partidos en vivo ahora mismo.");
      return null;
    }

    // Tomar el primer partido en vivo
    const match = res.data.response[0];
    const home = match.teams.home.name;
    const away = match.teams.away.name;
    const score = `${match.goals.home} - ${match.goals.away}`;

    return { home, away, score };
  } catch (err) {
    console.error("❌ Error Football API:", err.response?.data || err.message);
    return null;
  }
}

async function sendNotification(match) {
  try {
    const res = await axios.post("https://onesignal.com/api/v1/notifications", {
      app_id: ONESIGNAL_APP_ID,
      included_segments: ["All"],
      headings: { en: "⚽ Resultado en vivo" },
      contents: { en: `${match.home} vs ${match.away}: ${match.score}` }
    }, {
      headers: {
        "Authorization": `Basic ${ONESIGNAL_API_KEY}`,
        "Content-Type": "application/json"
      }
    });

    console.log("✅ Notificación enviada:", res.data);
  } catch (err) {
    console.error("❌ Error OneSignal:", err.response?.data || err.message);
  }
}

async function main() {
  const match = await getLiveMatch();
  if (match) {
    await sendNotification(match);
  }
}

main();










