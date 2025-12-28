const axios = require("axios");

async function testNotification() {
  try {
    const res = await axios.post("https://onesignal.com/api/v1/notifications", {
      app_id: process.env.ONESIGNAL_APP_ID,
      included_segments: ["All"],
      contents: { en: "Prueba con API Key ✅" }
    }, {
      headers: {
        "Authorization": `Basic ${process.env.ONESIGNAL_API_KEY}`,
        "Content-Type": "application/json"
      }
    });

    console.log("✅ Notificación enviada:", res.data);
  } catch (err) {
    console.error("❌ Error:", err.response?.data || err.message);
  }
}

testNotification();









