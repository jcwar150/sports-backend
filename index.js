const https = require("https");

function fetchStatistics(eventId, home, away) {
  const options = {
    method: "GET",
    hostname: "sportscore1.p.rapidapi.com",
    path: `/events/${eventId}/statistics`,
    headers: {
      "x-rapidapi-key": process.env.FOOTBALL_API_KEY,
      "x-rapidapi-host": "sportscore1.p.rapidapi.com"
    }
  };

  const req = https.request(options, res => {
    let data = "";
    res.on("data", chunk => data += chunk);
    res.on("end", () => {
      const stats = JSON.parse(data).data || [];
      stats.forEach(stat => {
        if (["corners", "yellow_cards", "red_cards"].includes(stat.name)) {
          console.log(`📊 ${home} vs ${away} | ${stat.name}: Home ${stat.home} - Away ${stat.away}`);
        }
      });
    });
  });

  req.end();
}

function fetchLiveEvents() {
  const options = {
    method: "GET",
    hostname: "sportscore1.p.rapidapi.com",
    path: "/sports/1/events/live",
    headers: {
      "x-rapidapi-key": process.env.FOOTBALL_API_KEY,
      "x-rapidapi-host": "sportscore1.p.rapidapi.com"
    }
  };

  const req = https.request(options, res => {
    let data = "";
    res.on("data", chunk => data += chunk);
    res.on("end", () => {
      const json = JSON.parse(data);
      json.data.forEach(event => {
        const home = event.home_team?.name || "Home";
        const away = event.away_team?.name || "Away";
        fetchStatistics(event.id, home, away);
      });
    });
  });

  req.end();
}

fetchLiveEvents();









  










