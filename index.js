require('dotenv').config();
const axios = require('axios');

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;

let lastEventSent = null;

async function getLiveMatch() {
  const res = await axios.get("https://v3.football.api-sports.io/fixtures", {
    params: { live: "all" },
    headers: { "x-apisports-key": FOOTBALL_API_KEY }
  });

  if (!res.data.response || res.data.response.length === 0) return null;
  return res.data.response[0]; // primer partido en vivo
}

async function sendNotification(title, message) {
  await axios.post("https://onesignal.com/api/v1/notifications", {
    app_id: ONESIGNAL_APP_ID,
    included_segments: ["All"],
    headings: { en: title },
    contents: { en: message }
  }, {
    headers: {
      "Authorization": `Basic ${ONESIGNAL_API_KEY}`,
      "Content-Type": "application/json"
    }
  });
  console.log("✅ Notificación enviada:", title, message);
}

async function main() {
  const match = await getLiveMatch();
  if (!match) return;

  const home = match.teams.home.name;
  const away = match.teams.away.name;

  // 🔎 Detectar tarjeta roja
  if (match.events) {
    const redCard = match.events.find(e => e.type === "Card" && e.detail === "Red Card");
    if (redCard) {
      const playerName = redCard.player?.name || "Jugador desconocido";
      const teamName = redCard.team?.name || "Equipo desconocido";

      const eventKey = `red-${playerName}-${teamName}`;
      if (lastEventSent !== eventKey) {
        await sendNotification("🟥 Tarjeta Roja", `${playerName} (${teamName}) recibió roja en ${home} vs ${away}`);
        lastEventSent = eventKey;
      } else {
        console.log("⏸️ Tarjeta roja ya notificada, no se repite.");
      }
    }
  }
}

// Ejecutar cada minuto
setInterval(main, 60 * 1000);
console.log("✅ Worker iniciado: verificando eventos cada minuto...");
;










