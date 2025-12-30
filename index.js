// index.js
const axios = require("axios");
const OneSignal = require("onesignal-node");

// Variables de entorno
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY || "04d73dd17729e5edb6408c2e826009ab";

let lastNotified = {}; // objeto para guardar últimos marcadores por partido

// Inicializar cliente OneSignal
const client = new OneSignal.Client(ONESIGNAL_APP_ID, ONESIGNAL_API_KEY);

// Función para enviar notificación
async function sendNotification(message) {
  try {
    await client.createNotification({
      contents: { en: message },
      included_segments: ["All"]
    });
    console.log("✅ Notificación enviada:", message);
  } catch (err) {
    console.error("Error enviando notificación:", err.message);
  }
}

// Función para chequear partidos
async function checkMatches() {
  try {
    // ⚽ API de fútbol
    const footballRes = await axios.get("https://api-football-v1.p.rapidapi.com/v3/fixtures", {
      headers: { "X-RapidAPI-Key": FOOTBALL_API_KEY }
    });

    footballRes.data.response.forEach(match => {
      const goalsHome = match.goals.home || 0;
      const goalsAway = match.goals.away || 0;
      const totalGoals = goalsHome + goalsAway;
      const matchId = match.fixture.id;
      const score = `${goalsHome}-${goalsAway}`;

      if (totalGoals > 2) {
        if (lastNotified[matchId] !== score) {
          sendNotification(`⚽ Partido con más de 2 goles: ${match.teams.home.name} vs ${match.teams.away.name} (${score})`);
          lastNotified[matchId] = score;
        }
      }
    });

    // 🏀 API de basket
    const basketRes = await axios.get("https://api-basketball.p.rapidapi.com/games", {
      headers: { "X-RapidAPI-Key": FOOTBALL_API_KEY } // usa tu API key de basket si es distinta
    });

    basketRes.data.response.forEach(game => {
      const quarter = game.periods.current; // depende de la API, puede ser número o string
      const gameId = game.id;

      if (quarter >= 2) { // del medio tiempo en adelante
        if (!lastNotified[gameId]) {
          sendNotification(`🏀 Partido en progreso (desde halftime): ${game.teams.home.name} vs ${game.teams.away.name}, periodo ${quarter}`);
          lastNotified[gameId] = true;
        }
      }
    });

  } catch (err) {
    console.error("Error consultando APIs:", err.message);
  }
}

// Ejecutar cada cierto tiempo
setInterval(checkMatches, 60 * 1000); // cada minuto



  










