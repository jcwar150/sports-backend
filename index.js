// index.js
const axios = require("axios");
const OneSignal = require("onesignal-node");

// Configuración OneSignal
const client = new OneSignal.Client("APP_ID", "REST_API_KEY");

// Función para enviar notificación
async function sendNotification(message) {
  await client.createNotification({
    contents: { en: message },
    included_segments: ["All"]
  });
}

// Función para chequear partidos
async function checkMatches() {
  try {
    // ⚽ API de fútbol
    const footballRes = await axios.get("https://api-football-v1.p.rapidapi.com/v3/fixtures", {
      headers: { "X-RapidAPI-Key": process.env.API_KEY }
    });

    footballRes.data.response.forEach(match => {
      const goalsHome = match.goals.home || 0;
      const goalsAway = match.goals.away || 0;
      const totalGoals = goalsHome + goalsAway;

      if (totalGoals > 2) {
        sendNotification(`⚽ Partido con más de 2 goles: ${match.teams.home.name} vs ${match.teams.away.name} (${goalsHome}-${goalsAway})`);
      }
    });

    // 🏀 API de basket
    const basketRes = await axios.get("https://api-basketball.p.rapidapi.com/games", {
      headers: { "X-RapidAPI-Key": process.env.API_KEY }
    });

    basketRes.data.response.forEach(game => {
      const quarter = game.periods.current; // depende de la API, puede ser "Q2", "Q3", etc.
      if (quarter >= 2) { // del medio tiempo en adelante
        sendNotification(`🏀 Partido en progreso (desde halftime): ${game.teams.home.name} vs ${game.teams.away.name}, periodo ${quarter}`);
      }
    });

  } catch (err) {
    console.error("Error consultando APIs:", err.message);
  }
}

// Ejecutar cada cierto tiempo
setInterval(checkMatches, 60 * 1000); // cada minuto












