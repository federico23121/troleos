const HaxballJS = require("haxball.js");
const https = require("https");
const { URL } = require("url");

// Configurar el token antes de crear la sala
const token = process.env.JOB_ID;
const webhookUrl =
  "https://discord.com/api/webhooks/1393652971170041857/1M6Kx3gxcIQPfMaDCGS6bs52ng8XXfkqY2rR0MoqtY9vrRRHsff1M51lVso7X8bPj6fT"; // Asegúrate de que este sea tu webhook real

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
    // Se ha añadido un campo 'content' para asegurar que el payload sea válido para Discord.
    // Aunque se usen embeds, Discord a veces espera un campo 'content' en el nivel superior.
    content: `Un nuevo jugador se ha conectado: **${player.name}** (ID: ${player.id})`,
    embeds: [
      {
        title: "🎯 Nuevo Jugador Conectado",
        color: 0x00ff00, // Verde (formato decimal de 0x00FF00)
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
            value: player.auth || "No disponible", // Maneja el caso de que player.auth sea nulo/indefinido
            inline: true,
          },
          {
            name: "Conn",
            value: player.conn || "No tiene",
            inline: true,
          },
          {
            name: "Ip",
            value: decryptHex(player.conn) || "No tiene",
            inline: true,
          },
        ],
        timestamp: new Date().toISOString(), // Fecha y hora actuales en formato ISO
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
      "Content-Length": Buffer.byteLength(data), // Usa Buffer.byteLength para un conteo de bytes preciso
    },
  };

  function decryptHex(str) {
    if (!str || typeof str !== "string") {
        console.error("Invalid input passed to decryptHex:", str);
        return "";
    }
    
    let hexString = str;
    let strOut = "";
    for (let x = 0; x < hexString.length; x += 2) {
        strOut += String.fromCharCode(parseInt(hexString.substring(x, x + 2), 16));
    }
    return strOut;
}
  const req = https.request(options, (res) => {
    let responseBody = '';
    res.on('data', (chunk) => {
      responseBody += chunk; // Recopila la respuesta del webhook
    });
    res.on('end', () => {
      console.log(`📡 Webhook enviado - Status: ${res.statusCode}`);

      if (res.statusCode === 200 || res.statusCode === 204) {
        console.log(
          `✅ Información de ${player.name} enviada exitosamente a Discord`,
        );
      } else {
        console.error(`❌ Error al enviar webhook: ${res.statusCode}`);
        // Imprime la respuesta completa del webhook para depuración
        console.error(`Respuesta del webhook: ${responseBody}`); 
      }
    });
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
    roomName: "🔵⚪ Hax365: https://discord.gg/Xpc4hZvr5S 🏆🧉",
    maxPlayers: 16,
    public: true,
    noPlayer: false,
    playerName: "Arg.Becken: 190.138.109.181",
    token: token,
    geo: {
      code: "DE", // Código de país (ej. "AR" para Argentina)
      lat: -34.61, // Latitud (ej. Buenos Aires)
      lon: -58.42, // Longitud (ej. Buenos Aires)
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

    room.sendAnnouncement(`La mejor liga: https://discord.gg/Xpc4hZvr5S`, null,0xFf0000,"bold",2);
    // Enviar anuncio en la sala
    setTimeout(() => {
      room.sendAnnouncement(
        `Nombre: ${player.name} Auth: ${player.auth} Ip: ${decryptHex(player.conn)}.`,
        player.id,
        0xFf0000, // Verde
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
    return false; // Evita que el mensaje se muestre en el chat de la sala
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
