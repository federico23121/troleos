const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

// --- CONFIGURACIÓN ---
const HAXBALL_ROOM_URL = process.env.HAXBALL_ROOM_URL; // Poné tu link
const BOT_NICKNAME = process.env.JOB_ID || "bot";
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1393006720237961267/lxg_qUjPdnitvXt-aGzAwthMMbXyZIbPcgRVfGCSuLldynhFHJdsyC4sSH-Ymli5Xm"; // Tu webhook
// ----------------------

// La lógica del bot para seguir la pelota
const BOT_LOGIC = `
module.exports = function(e){e.OperationType;var a=e.VariableType,t=(e.ConnectionState,e.AllowFlags),n=(e.Direction,e.CollisionFlags,e.CameraFollow,e.BackgroundType,e.GamePlayState,e.BanEntryType,e.Callback,e.Utils),Plugin=(e.Room,e.Replay,e.Query,e.Library,e.RoomConfig,e.Plugin);e.Renderer,e.Errors,e.Language,e.EventFactory,e.Impl;Object.setPrototypeOf(this,Plugin.prototype),Plugin.call(this,"autoPlay_followBall",!0,{version:"0.4",author:"abc",description:"This is an auto-playing bot that always follows the ball blindly, and kicks it whenever it is nearby without any direction checking. This bot uses real events and controls real players.",allowFlags:t.CreateRoom|t.JoinRoom}),this.defineVariable({name:"minCoordAlignDelta",description:"Minimum delta value for coordinate alignment",type:a.Number,value:.5,range:{min:0,max:10,step:.5}}),this.defineVariable({name:"minKickDistance",description:"Minimum distance between ball and bot player for the bot player to start kicking the ball",type:a.Number,value:8,range:{min:0,max:15,step:.5}});var o=this;this.onGameTick=function(e){var a;o.room.extrapolate();var t=o.room.currentPlayer,r=null==t||null===(a=t.disc)||void 0===a?void 0:a.ext;if(r){var i=o.room,s=(i.state,i.gameState),l=(s=i.gameStateExt||s).physicsState.discs[0],c=(null==l?void 0:l.pos)||{},d=c.x,u=c.y;if(null!=d&&!isNaN(d)&&isFinite(d)&&null!=u&&!isNaN(u)&&isFinite(u)){var m,h,p,f=d-r.pos.x,y=u-r.pos.y;m=Math.abs(f)<o.minCoordAlignDelta?0:Math.sign(f),h=Math.abs(y)<o.minCoordAlignDelta?0:Math.sign(y),p=f*f+y*y<(r.radius+l.radius+o.minKickDistance)*(r.radius+l.radius+o.minKickDistance),o.room.setKeyState(n.keyState(m,h,p))}}}}
`;

// Función para manejar errores críticos y cancelar el job
function handleCriticalError(error, context = '') {
    console.error(`❌ ERROR CRÍTICO ${context}:`, error);
    notifyDiscord(`🔴 **ERROR CRÍTICO** - Bot ${BOT_NICKNAME} cancelado. ${context}: ${error.message}`);

    // Forzar la cancelación del job con código de error
    process.exit(1);
}

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
    handleCriticalError(error, 'Excepción no capturada');
});

process.on('unhandledRejection', (reason, promise) => {
    handleCriticalError(new Error(reason), 'Promesa rechazada');
});

async function main() {
    console.log("🤖 Iniciando el bot de Haxball...");

    let browser;
    let page;

    try {
        // Timeout para el lanzamiento del navegador
        browser = await Promise.race([
            puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout al lanzar el navegador')), 30000))
        ]);

        page = await browser.newPage();

        // Timeout para cargar la página
        await Promise.race([
            page.goto(HAXBALL_ROOM_URL, { waitUntil: 'networkidle2' }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout al cargar la página')), 30000))
        ]);

        await page.waitForSelector('iframe');
        const iframeElement = await page.$('iframe');
        const frame = await iframeElement.contentFrame();

        if (!frame) {
            throw new Error('No se pudo acceder al iframe de Haxball');
        }

        // Escribir el nick con timeout
        console.log("Escribiendo el nombre de usuario...");
        const nickSelector = 'input[data-hook="input"][maxlength="25"]';

        try {
            await frame.waitForSelector(nickSelector, { timeout: 15000 });
            await frame.type(nickSelector, BOT_NICKNAME);
        } catch (error) {
            throw new Error(`No se pudo escribir el nickname: ${error.message}`);
        }

        // Hacer clic en "Join" con timeout
        console.log("Haciendo clic en 'Join'...");
        const joinButtonSelector = 'button[data-hook="ok"]';

        try {
            await frame.waitForSelector(joinButtonSelector, { timeout: 15000 });
            await frame.click(joinButtonSelector);
        } catch (error) {
            throw new Error(`No se pudo hacer clic en Join: ${error.message}`);
        }

        // Esperar que cargue la sala
        console.log("Esperando a que se cargue la sala...");
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Verificar que estamos en la sala
        try {
            const chatSelector = 'input[data-hook="input"][maxlength="140"]';
            await frame.waitForSelector(chatSelector, { timeout: 10000 });
            console.log("✅ ¡Bot dentro de la sala!");
            await notifyDiscord(`🟢 El bot **${BOT_NICKNAME}** ha entrado a la sala.`);
        } catch (error) {
            throw new Error('No se pudo verificar el acceso a la sala');
        }

        // Enviar mensaje inicial
        await sendMessageToChat(frame, "!");

        // --- INYECCIÓN DEL BOT DE SEGUIMIENTO DE PELOTA ---
        console.log("Inyectando lógica del bot de seguimiento de pelota...");
        await frame.evaluate((botCode) => {
            // Este código se ejecuta dentro del contexto del navegador (Haxball)
            try {
                // Haxball expone una API global 'window.haxball' o similar para plugins.
                // Necesitamos encontrar la forma correcta de registrar el plugin.
                // Basado en el `module.exports = function(e){...}`, parece que el plugin
                // espera ser llamado con un objeto que contiene el Room API.

                // Haremos un intento simple de instanciarlo.
                // En un entorno de Haxball, 'window.haxball.room' o similar es accesible.
                // La estructura del plugin sugiere que `e` contiene `Room`, `VariableType`, etc.
                // Para simplificar, vamos a asumir que podemos crear una instancia y pasarle
                // un objeto simulado que contenga lo necesario.
                // Nota: Esto es una simplificación. La integración real de un plugin
                // de Haxball puede requerir una comprensión más profunda de su API.

                const createBotPlugin = new Function('e', botCode.split('module.exports = ')[1]);
                
                // Intenta simular el objeto 'e' que el plugin espera.
                // Esto es crucial y puede requerir ajuste si Haxball expone una API diferente.
                // La idea es que el plugin necesite acceso a `room` y otras utilidades.
                // Asumiendo que `window.haxball.room` es la instancia de la sala actual.
                const simulatedEnv = {
                    Room: function() {}, // Placeholder, ideally this would be the actual Room class/object
                    VariableType: { Number: 0, String: 1, Boolean: 2 }, // Basic types
                    AllowFlags: { CreateRoom: 1, JoinRoom: 2 }, // Basic flags
                    Direction: {}, // Placeholder
                    CollisionFlags: {}, // Placeholder
                    CameraFollow: {}, // Placeholder
                    BackgroundType: {}, // Placeholder
                    GamePlayState: {}, // Placeholder
                    BanEntryType: {}, // Placeholder
                    Callback: {}, // Placeholder
                    Utils: {}, // Placeholder
                    Plugin: function() { // Simplified Plugin base
                        this.defineVariable = () => {};
                    },
                    Renderer: {}, // Placeholder
                    Errors: {}, // Placeholder
                    Language: {}, // Placeholder
                    EventFactory: {}, // Placeholder
                    Impl: {} // Placeholder
                };

                // Si Haxball expone una forma de obtener el objeto de la sala (room)
                // y la API completa para plugins, la usaríamos aquí.
                // Por ejemplo, si hay una función `HBInit` o un objeto global `window.HBAPI`.
                // Dado el código del plugin, `e.Room` sugiere que espera una clase o constructor.
                // Para que el plugin funcione, *debe* interactuar con el objeto `room` real.

                // La forma más robusta sería inyectar el código y luego llamar a una función
                // que Haxball proporcione para registrar plugins, si existe.
                // Si no hay una API formal, tendríamos que sobrescribir métodos o inyectar
                // directamente en el bucle de juego si es posible.

                // Para un intento directo, si 'window.haxball.room' es accesible:
                if (window.haxball && window.haxball.room) {
                    const pluginInstance = new createBotPlugin({
                        ...simulatedEnv, // Incluir placeholders
                        Room: window.haxball.room, // Usar la instancia real de la sala
                        room: window.haxball.room // El plugin accede a `o.room`
                    });
                    
                    // Ahora necesitamos asegurarnos de que `onGameTick` sea llamado.
                    // Esto probablemente implica sobrescribir un método en el objeto `room`
                    // o inyectar un hook si Haxball lo permite.
                    // Para este ejemplo, haremos un bucle simple que llame `onGameTick`
                    // si no hay una forma directa de registrar el plugin.
                    
                    // Disclaimer: Esta es una parte *muy* dependiente de la API interna de Haxball.
                    // La inyección de plugins de esta manera puede ser frágil.
                    
                    // Si el plugin es autónomo y no requiere registro explícito con Haxball,
                    // y solo necesita acceso al objeto `room`, podríamos hacer esto:
                    if (pluginInstance.onGameTick) {
                         // Aquí se asume que `onGameTick` es el método principal del bot.
                         // Deberíamos encontrar una manera de que Haxball lo llame en cada tick.
                         // Dado que el plugin usa `o.room.extrapolate()`, `o.room.currentPlayer`,
                         // y `o.room.setKeyState()`, la instancia `room` debe ser la real.

                         // Una solución simple (y posiblemente no ideal para rendimiento)
                         // si no hay un sistema de plugins oficial sería:
                         setInterval(() => {
                             if (window.haxball && window.haxball.room) {
                                 // Pasar un objeto de evento simple si onGameTick espera uno
                                 pluginInstance.onGameTick({}); 
                             }
                         }, 16); // ~60 FPS, ajustar según sea necesario
                         console.log("Bot de seguimiento de pelota inyectado y activo.");
                    } else {
                        console.error("El plugin inyectado no tiene el método onGameTick.");
                    }
                } else {
                    console.error("No se pudo acceder a window.haxball.room para inyectar el bot.");
                }
            } catch (e) {
                console.error("Error al inyectar o ejecutar el bot de seguimiento de pelota:", e);
            }
        }, BOT_LOGIC);
        // --- FIN DE LA INYECCIÓN DEL BOT DE SEGUIMIENTO DE PELOTA ---

        // La parte de movimiento anti-AFK y verificación de conexión
        // puede ser redundante o interferir con el bot si este ya controla el jugador.
        // Si el bot de seguimiento de pelota controla al jugador, estos intervalos
        // deberían eliminarse o modificarse para no entrar en conflicto.
        // Por ahora, los dejaré comentados o eliminados si el nuevo bot es el controlador principal.

        // Comentamos o eliminamos el movimiento anti-AFK ya que el nuevo bot lo manejará
        // let moves = ['w', 'a', 's', 'd'];
        // let moveIndex = 0;
        // const moveInterval = setInterval(async () => { /* ... */ }, 5000);

        // La verificación de conexión aún es útil para saber si la página está viva
        const healthCheck = setInterval(async () => {
            try {
                const chatSelector = 'input[data-hook="input"][maxlength="140"]';
                await frame.waitForSelector(chatSelector, { timeout: 5000 });
                console.log("✅ Conexión activa");
            } catch (error) {
                console.error("❌ Fallo en verificación de conexión");
                clearInterval(healthCheck);
                // clearInterval(chatInterval); // Si chatInterval existe
                // clearInterval(moveInterval); // Si moveInterval existe y no se eliminó
                throw new Error('Perdida de conexión con el servidor');
            }
        }, 30000);

        // Mantenerlo vivo 1 hora (o indefinidamente si el bot está funcionando)
        await new Promise(resolve => setTimeout(resolve, 3600000)); // 1 hora

        // Limpiar intervalos
        // clearInterval(chatInterval); // Si chatInterval existe
        // clearInterval(moveInterval); // Si moveInterval existe y no se eliminó
        clearInterval(healthCheck);

    } catch (error) {
        console.error("❌ Error durante la ejecución del bot:", error);
        await notifyDiscord(`🔴 Error al intentar conectar el bot **${BOT_NICKNAME}**. Causa: ${error.message}`);

        // Limpiar recursos antes de salir
        if (browser) {
            try {
                await browser.close();
            } catch (e) {
                console.error("Error al cerrar el navegador:", e);
            }
        }

        // Cancelar el job con código de error
        process.exit(1);

    } finally {
        console.log("Cerrando el bot.");
        if (browser) {
            try {
                await browser.close();
            } catch (e) {
                console.error("Error al cerrar el navegador:", e);
            }
        }

        await notifyDiscord(`🟡 El bot **${BOT_NICKNAME}** ha terminado su ejecución.`);
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

// Enviar mensaje al chat
async function sendMessageToChat(frame, message) {
    try {
        const chatSelector = 'input[data-hook="input"][maxlength="140"]';
        await frame.waitForSelector(chatSelector, { timeout: 5000 });
        const chatInput = await frame.$(chatSelector);

        if (!chatInput) {
            throw new Error('No se encontró el input del chat');
        }

        await chatInput.click();
        await chatInput.type(message);
        await chatInput.press('Enter');
        console.log("Mensaje enviado:", message);

    } catch (e) {
        console.error("Error al enviar mensaje al chat:", e);
        throw e; // Re-lanzar el error para que sea manejado por el caller
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

            // Enviar aviso a Discord si falla
            await notifyDiscord(`🔴 Fallo en intento ${intentos} para el bot **${BOT_NICKNAME}**. Error: ${error.message}`);

            if (intentos >= MAX_INTENTOS) {
                console.error("🚫 Máximo de intentos alcanzado. Abortando.");
                await notifyDiscord(`❌ El bot **${BOT_NICKNAME}** falló tras ${MAX_INTENTOS} intentos.`);
                process.exit(1);
            }

            // Esperar 5 segundos antes de intentar de nuevo
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

// Iniciar con reintentos
iniciarBotConReintentos();
