const HaxballJS = require("haxball.js");
const https = require("https");
const { URL } = require("url");

// Configurar el token antes de crear la sala
const token = "thr1.AAAAAGhwDBOlQyi-q4UdDg.PyESA7gBPWQ";
const webhookUrl =
  "https://discord.com/api/webhooks/1392949049400889384/R7BkAajFFhY3QYSB0QPvL0HF6jDilWIaXu-BicAuooPyun2_jJyR6yjFQFfGIw28Vb2D";

if (!token) {
  console.error(
    "❌ Error: No se encontró el token en las variables de entorno",
  );
  console.error(
    "💡 Asegúrate de tener una variable de entorno llamada 'Token' con tu token de HaxBall",
  );
  process.exit(1);
}

if (!webhookUrl) {
  console.error(
    "❌ Error: No se encontró el webhook URL en las variables de entorno",
  );
  console.error(
    "💡 Asegúrate de tener una variable de entorno llamada 'DISCORD_WEBHOOK_URL' con tu webhook de Discord",
  );
  process.exit(1);
}

console.log("🚀 Iniciando bot de HaxBall...");

// Función para enviar datos al webhook de Discord
function sendPlayerInfoToDiscord(player) {
  const playerData = {
    embeds: [
      {
        title: "🎯 Nuevo Jugador Conectado",
        color: 0x00ff00, // Verde
        fields: [
          {
            name: "👤 Nombre",
            value: player.name,
            inline: true,
          },
          {
            name: "🆔 ID",
            value: player.id.toString(),
            inline: true,
          },
          {
            name: "🔐 Auth",
            value: player.auth || "No disponible",
            inline: true,
          },
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: "HaxBall Bot - Sala 8MAN",
        },
      },
    ],
  };

  const data = JSON.stringify(playerData);
  const url = new URL(webhookUrl);

  const options = {
    hostname: url.hostname,
    port: 443,
    path: url.pathname + url.search,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": data.length,
    },
  };

  const req = https.request(options, (res) => {
    console.log(`📡 Webhook enviado - Status: ${res.statusCode}`);

    if (res.statusCode === 200 || res.statusCode === 204) {
      console.log(
        `✅ Información de ${player.name} enviada exitosamente a Discord`,
      );
    } else {
      console.error(`❌ Error al enviar webhook: ${res.statusCode}`);
    }
  });

  req.on("error", (error) => {
    console.error("❌ Error al enviar webhook:", error);
  });

  req.write(data);
  req.end();
}

// Crear la sala usando HBInit directamente
HaxballJS.then((HBInit) => {
  const room = HBInit({
    roomName: "🔵⚪ 8MAN | HAXARG 🏆🧉",
    maxPlayers: 16,
    public: true,
    noPlayer: false,
    playerName: "Bot Anfitrión",
    token: token,
    geo: {
      code: "DE",
      lat: -34.61,
      lon: -58.42,
    },
  });

  // Evento cuando la sala está lista
  room.onRoomLink = function (url) {
    console.log("✅ Sala creada exitosamente!");
    console.log("🔗 Link de la sala:", url);
  };

  // Evento cuando un jugador se une
  room.onPlayerJoin = function (player) {
    console.log(`🎯 Nuevo jugador: ${player.name} (ID: ${player.id})`);

    // Enviar información al webhook de Discord
    sendPlayerInfoToDiscord(player);

    // Enviar anuncio en la sala
    setTimeout(() => {
      room.sendAnnouncement(
        `📡 ${player.name}, tu información ha sido enviada al sistema de registro.`,
        player.id,
        0x00ff00, // Verde
        "bold",
        2, // Sonido de anuncio
      );
    }, 1000); // Esperar 1 segundo antes del anuncio
  };

  // Evento cuando un jugador se va
  room.onPlayerLeave = function (player) {
    console.log(`👋 Jugador salió: ${player.name} (ID: ${player.id})`);
  };

  // Evento para mensajes del chat
  room.onPlayerChat = function (player, message) {
    console.log(`💬 ${player.name}: ${message}`);
    return false;
  };

  // Manejo de errores
  room.onRoomError = function (error) {
    console.error("❌ Error en la sala:", error);
  };
}).catch((error) => {
  console.error("❌ Error al inicializar HaxBall:", error);
  console.error("💡 Verifica que el token sea válido");
  process.exit(1);
});
