// --- CONFIGURACIÓN ---
const HAXBALL_ROOM_TOKEN = process.env.HAXBALL_ROOM_TOKEN; // Get this from Haxball.com/headless
const BOT_NICKNAME = process.env.JOB_ID || "bot";
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1393006720237961267/lxg_qUjPdnitvXt-aGzAwthMMmNbXyZIbPcgRVfGCSuLldynhFHJdsyC4sSH-Ymli5Xm"; // Tu webhook
// ----------------------

// Importa la librería haxball.js
const HaxballJS = require('haxball.js');

// La lógica del bot para seguir la pelota (tu código)
const AutoPlayFollowBallPlugin = function(e) {
    e.OperationType;
    var a = e.VariableType,
        t = (e.ConnectionState, e.AllowFlags),
        n = (e.Direction, e.CollisionFlags, e.CameraFollow, e.BackgroundType, e.GamePlayState, e.BanEntryType, e.Callback, e.Utils),
        Plugin = (e.Room, e.Replay, e.Query, e.Library, e.RoomConfig, e.Plugin);
    e.Renderer, e.Errors, e.Language, e.EventFactory, e.Impl;
    Object.setPrototypeOf(this, Plugin.prototype);
    Plugin.call(this, "autoPlay_followBall", !0, {
        version: "0.4",
        author: "abc",
        description: "This is an auto-playing bot that always follows the ball blindly, and kicks it whenever it is nearby without any direction checking. This bot uses real events and controls real players.",
        allowFlags: t.CreateRoom | t.JoinRoom
    });
    this.defineVariable({
        name: "minCoordAlignDelta",
        description: "Minimum delta value for coordinate alignment",
        type: a.Number,
        value: .5,
        range: {
            min: 0,
            max: 10,
            step: .5
        }
    });
    this.defineVariable({
        name: "minKickDistance",
        description: "Minimum distance between ball and bot player for the bot player to start kicking the ball",
        type: a.Number,
        value: 8,
        range: {
            min: 0,
            max: 15,
            step: .5
        }
    });
    var o = this;
    this.onGameTick = function(e) {
        var a;
        o.room.extrapolate();
        var t = o.room.currentPlayer,
            r = null == t || null === (a = t.disc) || void 0 === a ? void 0 : a.ext;
        if (r) {
            var i = o.room,
                s = (i.state, i.gameState),
                l = (s = i.gameStateExt || s).physicsState.discs[0],
                c = (null == l ? void 0 : l.pos) || {},
                d = c.x,
                u = c.y;
            if (null != d && !isNaN(d) && isFinite(d) && null != u && !isNaN(u) && isFinite(u)) {
                var m, h, p, f = d - r.pos.x,
                    y = u - r.pos.y;
                m = Math.abs(f) < o.minCoordAlignDelta ? 0 : Math.sign(f), h = Math.abs(y) < o.minCoordAlignDelta ? 0 : Math.sign(y), p = f * f + y * y < (r.radius + l.radius + o.minKickDistance) * (r.radius + l.radius + o.minKickDistance), o.room.setKeyState(n.keyState(m, h, p))
            }
        }
    }
};

// Función para manejar errores críticos y cancelar el job
function handleCriticalError(error, context = '') {
    console.error(`❌ ERROR CRÍTICO ${context}:`, error);
    notifyDiscord(`🔴 **ERROR CRÍTICO** - Bot ${BOT_NICKNAME} cancelado. ${context}: ${error.message}`);
    process.exit(1);
}

process.on('uncaughtException', (error) => {
    handleCriticalError(error, 'Excepción no capturada');
});

process.on('unhandledRejection', (reason, promise) => {
    handleCriticalError(new Error(reason), 'Promesa rechazada');
});

async function main() {
    console.log("🤖 Iniciando el bot de Haxball con node-haxball...");

    try {
        // Inicializa HaxballJS
        const HBInit = await HaxballJS;

        // Crea o une la sala
        // Si tienes un token de sala para una sala existente:
        const room = HBInit({
            roomName: "Mi Sala de Bot", // Nombre de la sala
            playerName: BOT_NICKNAME,
            maxPlayers: 16,
            public: true,
            token: HAXBALL_ROOM_TOKEN || undefined, // Usa tu token si lo tienes, sino creará una nueva
            noPlayer: false // Set to false so the bot is a player in the room
        });

        // Evento cuando el bot se conecta a la sala
        room.onRoomLink = (link) => {
            console.log(`🔗 Sala creada/unida: ${link}`);
            notifyDiscord(`🟢 El bot **${BOT_NICKNAME}** ha entrado a la sala: ${link}`);
        };

        // Evento cuando se une un jugador (incluido el bot)
        room.onPlayerJoin = (player) => {
            console.log(`👤 ${player.name} (${player.id}) se ha unido.`);
            if (player.name === BOT_NICKNAME) {
                // Una vez que el bot se ha unido como jugador, podemos activar su lógica.
                console.log("Iniciando lógica del bot de seguimiento de pelota...");
                try {
                    // Inicializa tu plugin con el objeto 'room' de node-haxball
                    // La estructura del plugin asume que 'e' contiene 'Room', 'Plugin', etc.
                    // node-haxball debería proveer estos objetos a través de su API global o dentro del callback.
                    
                    // Simula el objeto 'e' que tu plugin espera, utilizando la API de node-haxball
                    const envForPlugin = {
                        Room: room, // Pasa la instancia real de la sala de node-haxball
                        Plugin: room.Plugin, // Asumiendo que room.Plugin es la base para plugins
                        VariableType: room.VariableType,
                        AllowFlags: room.AllowFlags,
                        Direction: room.Direction,
                        CollisionFlags: room.CollisionFlags,
                        CameraFollow: room.CameraFollow,
                        BackgroundType: room.BackgroundType,
                        GamePlayState: room.GamePlayState,
                        BanEntryType: room.BanEntryType,
                        Callback: room.Callback,
                        Utils: room.Utils,
                        Replay: room.Replay, // Add other necessary components if the plugin needs them
                        Query: room.Query,
                        Library: room.Library,
                        RoomConfig: room.RoomConfig,
                        Renderer: room.Renderer,
                        Errors: room.Errors,
                        Language: room.Language,
                        EventFactory: room.EventFactory,
                        Impl: room.Impl,
                        // Make sure to pass the 'room' object itself if the plugin uses `o.room` directly
                        room: room 
                    };

                    const botPluginInstance = new AutoPlayFollowBallPlugin(envForPlugin);

                    // node-haxball tiene un evento onGameTick al que puedes suscribirte
                    room.onGameTick = (state) => {
                        // El plugin tiene un método onGameTick, llámalo aquí.
                        // El 'state' pasado a onGameTick puede variar, ajusta según lo que tu plugin espera.
                        botPluginInstance.onGameTick(state);
                    };

                    console.log("✅ Bot de seguimiento de pelota activo.");

                } catch (pluginError) {
                    throw new Error(`Error al inicializar el plugin del bot: ${pluginError.message}`);
                }
            }
        };

        // Evento cuando el bot es retirado de la sala
        room.onRoomClose = () => {
            console.log("🔌 El bot ha sido desconectado de la sala.");
            notifyDiscord(`🔴 El bot **${BOT_NICKNAME}** ha sido desconectado de la sala.`);
            process.exit(0); // Exit gracefully
        };

        // Puedes agregar más lógica aquí, como comandos de chat
        room.onPlayerChat = (player, message) => {
            console.log(`[${player.name}] ${message}`);
            if (message === "!ping") {
                room.sendChat(`Pong! ${player.name}`);
            }
            if (message === "!exit" && player.admin) { // Solo si es admin
                room.sendChat("Cerrando el bot...");
                room.close(); // Cierra la sala
            }
        };

        // Mantener el proceso vivo (el bot seguirá funcionando hasta que se cierre la sala o haya un error)
        // Puedes agregar un timeout general si quieres que el bot se apague después de un tiempo.
        // Por ejemplo, para 4 horas:
        // await new Promise(resolve => setTimeout(resolve, 4 * 60 * 60 * 1000));
        // room.close(); // Cierra la sala después del tiempo
        
        console.log("Bot en funcionamiento. Esperando eventos...");

    } catch (error) {
        console.error("❌ Error durante la ejecución del bot:", error);
        await notifyDiscord(`🔴 Error al intentar conectar el bot **${BOT_NICKNAME}**. Causa: ${error.message}`);
        process.exit(1);
    }
}

// Enviar mensaje a Discord
async function notifyDiscord(message) {
    if (!DISCORD_WEBHOOK_URL) return;

    try {
        await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: message }),
        });
    } catch (e) {
        console.error("Error al enviar notificación a Discord:", e);
    }
}

let intentos = 0;
const MAX_INTENTOS = 3;

async function iniciarBotConReintentos() {
    while (intentos < MAX_INTENTOS) {
        try {
            intentos++;
            console.log(`🔁 Intento ${intentos} de ${MAX_INTENTOS}`);
            await main();
            break; // Si main termina exitosamente, salimos del bucle
        } catch (error) {
            console.error(`❌ Intento ${intentos} fallido:`, error.message);

            await notifyDiscord(`🔴 Fallo en intento ${intentos} para el bot **${BOT_NICKNAME}**. Error: ${error.message}`);

            if (intentos >= MAX_INTENTOS) {
                console.error("🚫 Máximo de intentos alcanzado. Abortando.");
                await notifyDiscord(`❌ El bot **${BOT_NICKNAME}** falló tras ${MAX_INTENTOS} intentos.`);
                process.exit(1);
            }

            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

// Iniciar con reintentos
iniciarBotConReintentos();
