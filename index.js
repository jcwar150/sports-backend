const OneSignal = require("onesignal-node");

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

const client = new OneSignal.Client(ONESIGNAL_APP_ID, ONESIGNAL_API_KEY);

async function sendNotification() {
  try {
    await client.createNotification({
      contents: { en: "🚀 Notificación de prueba desde Node.js" },
      included_segments: ["All"]
    });
    console.log("✅ Notificación enviada correctamente");
  } catch (err) {
    console.error("❌ Error enviando notificación:", err.response?.data || err.message);
  }
}

sendNotification();





  










