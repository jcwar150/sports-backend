function getEventStatistics(eventId, home, away) {
  const options = {
    method: "GET",
    hostname: "sportscore1.p.rapidapi.com",
    path: `/events/${eventId}/statistics`,
    headers: {
      "x-rapidapi-key": RAPIDAPI_KEY,
      "x-rapidapi-host": "sportscore1.p.rapidapi.com"
    }
  };

  const req = https.request(options, res => {
    let data = "";
    res.on("data", chunk => (data += chunk));
    res.on("end", () => {
      try {
        const stats = JSON.parse(data).data || {};
        console.log("📋 Statistics crudo para", home, "vs", away, ":", JSON.stringify(stats, null, 2));
      } catch (err) {
        console.error("❌ Error parseando statistics:", err.message);
      }
    });
  });

  req.on("error", err => console.error("❌ Error en la petición statistics:", err.message));
  req.end();
}

function getLiveEvents(sportId) {
  const options = {
    method: "GET",
    hostname: "sportscore1.p.rapidapi.com",
    path: `/sports/${sportId}/events/live`,
    headers: {
      "x-rapidapi-key": RAPIDAPI_KEY,
      "x-rapidapi-host": "sportscore1.p.rapidapi.com"
    }
  };

  const req = https.request(options, res => {
    let data = "";
    res.on("data", chunk => (data += chunk));
    res.on("end", () => {
      try {
        const json = JSON.parse(data);

        json.data.forEach(event => {
          const home = event.home_team?.name || "Home";
          const away = event.away_team?.name || "Away";
          const score = `${event.home_score?.current || 0} - ${event.away_score?.current || 0}`;
          const status = event.status_more || "";

          console.log("📊 Partido:", home, "vs", away, "| Estado:", status, "| Marcador:", score);

          // Mostrar todo el objeto statistics si existe
          console.log("📋 Statistics crudo (live):", JSON.stringify(event.statistics, null, 2));

          // Mostrar incidents crudos si existen
          if (event.incidents) {
            console.log("📋 Incidents crudos (live):", JSON.stringify(event.incidents, null, 2));
          } else {
            console.log("📋 No hay incidents en este snapshot.");
          }

          // Llamada al endpoint de statistics para este partido
          getEventStatistics(event.id, home, away);
        });
      } catch (err) {
        console.error("❌ Error parseando respuesta live:", err.message);
      }
    });
  });

  req.on("error", err => console.error("❌ Error en la petición live:", err.message));
  req.end();
}

// --- Loop cada 5 minutos ---
setInterval(() => {
  console.log("🔄 Buscando partidos en vivo...");
  getLiveEvents(1); // ⚽ Fútbol
  getLiveEvents(2); // 🏀 Básquet
}, 5 * 60 * 1000);









  










