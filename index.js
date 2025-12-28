await axios.post("https://onesignal.com/api/v1/notifications", {
  app_id: ONESIGNAL_APP_ID,
  included_segments: ["All"],
  headings: { en: "⚽ Gol en vivo!" },
  contents: { en: `${home} vs ${away}: ${score}` }
}, {
  headers: {
    "Authorization": `Basic ${os_v2_app_rbx3owc6cncn7b6uh42zbyiushx6e7xyddzutk4aadjbrpwcax7atzbi2odlv5jyrliu5nbqohwm6lj4bbramgct4bck6klklkxbxny}`, // aquí va la REST API Key
    "Content-Type": "application/json"
  }
});







