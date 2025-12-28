require('dotenv').config();
const axios = require('axios');

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;
const API_KEY = process.env.FOOTBALL_API_KEY; // misma clave para fútbol y basket

let lastEventSent = null;

async function getLiveFootball() {
  try {
    const res = await axios.get("https://v3.football.api-sports.io/fixtures", {
      params: { live: "all" },
      headers: { "x-apisports-key": API_KEY }
    });
    if (!res.data.response || res.data.response.length === 0) return null;
    return res.data.response[0];
  } catch (err) {
    console.error("❌ Error Football API:", err.response?.data || err.message);
    return null;
  }
}

async function getLiveBasketball() {
  try {
    const res = await axios.get("https://v1.basketball.api-sports.io/games", {
      params: { live: "all" },
      headers: { "x-apisports-key": API_KEY }
    });
    if (!res.data.response || res.data.response.length === 0) return null;
    return res.data.response[0];
  } catch (err) {
    console.error("❌ Error Basketball API:", err.response?.data || err.message);
    return null;
  }
}

async function sendNotification(title, message) {
  try {
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
  } catch (err) {
    console.error("❌ Error OneSignal:", err.response?.data || err.message);
  }
}

async function main() {
  // ⚽ Fútbol
  const match = await getLiveFootball();
  if (match) {
    const home = match.teams.home.name;
    const away = match.teams.away.name;

    // 1️⃣ Corners en primer tiempo
    if (match.statistics) {
      const homeCorners = match.statistics[0]?.statistics.find(s => s.type === "Corners")?.value || 0;
      const awayCorners = match.statistics[1]?.statistics.find(s => s.type === "Corners")?.value || 0;
      const totalCorners = homeCorners + awayCorners;

      if (match.fixture.status.short === "1H" && totalCorners <= 1 && lastEventSent !== "corner") {
        await sendNotification("⚽ Corner Alert", `${home} vs ${away}: solo ${totalCorners} corner en el primer tiempo`);
        lastEventSent = "corner";
      }
    }

    // 2️⃣ Tarjeta roja
    if (match.events) {
      const redCard = match.events.find(e => e.type === "Card" && e.detail === "Red Card");
      if (redCard) {
        const playerName = redCard.player?.name || "Jugador desconocido";
        const teamName = redCard.team?.name || "Equipo desconocido";
        const eventKey = `red-${playerName}-${teamName}`;
        if (lastEventSent !== eventKey) {
          await sendNotification("🟥 Tarjeta Roja", `${playerName} (${teamName}) recibió roja en ${home} vs ${away}`);
          lastEventSent = eventKey;
        }
      }
    }

    // 3️⃣ Prórroga
    if (match.fixture.status.short === "ET" && lastEventSent !== "extra-time") {
      await sendNotification("⏱️ Prórroga", `${home} vs ${away} entró en tiempo extra`);
      lastEventSent = "extra-time";
    }
  }

  // 🏀 Baloncesto
  const game = await getLiveBasketball();
  if (game) {
    const home = game.teams.home.name;
    const away = game.teams.away.name;
    const score = `${game.scores.home.points} - ${game.scores.away.points}`;

    if (game.status.short === "OT" || game.status.short === "AOT") {
      const eventKey = `basketball-overtime-${game.id}`;
      if (lastEventSent !== eventKey) {
        await sendNotification("🏀 Prórroga en baloncesto", `${home} vs ${away} está en prórroga (${score})`);
        lastEventSent = eventKey;
      }
    }
  }
}

// Ejecutar cada minuto
setInterval(main, 60 * 1000);
console.log("✅ Worker iniciado: verificando fútbol y baloncesto cada minuto...");











