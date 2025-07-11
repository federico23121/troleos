const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

// --- CONFIGURACIÓN ---
const HAXBALL_ROOM_URL = process.env.HAXBALL_ROOM_URL; // Poné tu link
const BOT_NICKNAME = process.env.JOB_ID || "bot";
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1393006720237961267/lxg_qUjPdnitvXt-aGzAwthMMbXyZIbPcgRVfGCSuLldynhFHJdsyC4sSH-Ymli5Xm"; // Tu webhook
// ----------------------

// La lógica del bot para seguir la pelota
// NOTA: Esta lógica está diseñada para node-haxball. Su ejecución directa en el navegador
// es experimental y depende de la estructura interna del juego web.
const BOT_LOGIC_RAW = `
    module.exports = function(e){e.OperationType;var a=e.VariableType,t=(e.ConnectionState,e.AllowFlags),n=(e.Direction,e.CollisionFlags,e.CameraFollow,e.BackgroundType,e.GamePlayState,e.BanEntryType,e.Callback,e.Utils),Plugin=(e.Room,e.Replay,e.Query,e.Library,e.RoomConfig,e.Plugin);e.Renderer,e.Errors,e.Language,e.EventFactory,e.Impl;Object.setPrototypeOf(this,Plugin.prototype),Plugin.call(this,"autoPlay_followBall",!0,{version:"0.4",author:"abc",description:"This is an auto-playing bot that always follows the ball blindly, and kicks it whenever it is nearby without any direction checking. This bot uses real events and controls real players.",allowFlags:t.CreateRoom|t.JoinRoom}),this.defineVariable({name:"minCoordAlignDelta",description:"Minimum delta value for coordinate alignment",type:a.Number,value:.5,range:{min:0,max:10,step:.5}}),this.defineVariable({name:"minKickDistance",description:"Minimum distance between ball and bot player for the bot player to start kicking the ball",type:a.Number,value:8,range:{min:0,max:15,step:.5}});var o=this;this.onGameTick=function(e){var a;o.room.extrapolate();var t=o.room.currentPlayer,r=null==t||null===(a=t.disc)||void 0===a?void 0:a.ext;if(r){var i=o.room,s=(i.state,i.gameState),l=(s=i.gameStateExt||s).physicsState.discs[0],c=(null==l?void 0:l.pos)||{},d=c.x,u=c.y;if(null!=d&&!isNaN(d)&&isFinite(d)&&null!=u&&!isNaN(u)&&isFinite(u)){var m,h,p,f=d-r.pos.x,y=u-r.pos.y;m=Math.abs(f)<o.minCoordAlignDelta?0:Math.sign(f),h=Math.abs(y)<o.minCoordAlignDelta?0:Math.sign(y),p=f*f+y*y<(r.radius+l.radius+o.minKickDistance)*(r.radius+l.radius+o.minKickDistance),o.room.setKeyState(n.keyState(m,h,p))}}}}
`;

// Función para manejar errores críticos y cancelar el job
function handleCriticalError(error, context = '') {
    console.error(`❌ ERROR CRÍTICO ${context}:`, error);
    notifyDiscord(`🔴 **ERROR CRÍTICO** - Bot ${BOT_NICKNAME} cancelado. ${context}: ${error.message}`);
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
    console.log("🤖 Iniciando el bot de Haxball con Puppeteer...");

    let browser;
    let page;

    try {
        browser = await Promise.race([
            puppeteer.launch({
                headless: true, // true para ejecutar sin interfaz gráfica, false para ver el navegador
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1000,800'] // Tamaño de ventana para depuración
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout al lanzar el navegador')), 30000))
        ]);

        page = await browser.newPage();
        await page.setViewport({ width: 1000, height: 800 }); // Asegura un viewport para la simulación

        await Promise.race([
            page.goto(HAXBALL_ROOM_URL, { waitUntil: 'networkidle2' }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout al cargar la página')), 45000)) // Aumentado el timeout
        ]);

        await page.waitForSelector('iframe', { timeout: 20000 });
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
            throw new Error(`No se pudo escribir el nickname (selector: ${nickSelector}): ${error.message}`);
        }

        // Hacer clic en "Join" con timeout
        console.log("Haciendo clic en 'Join'...");
        const joinButtonSelector = 'button[data-hook="ok"]';

        try {
            await frame.waitForSelector(joinButtonSelector, { timeout: 15000 });
            await frame.click(joinButtonSelector);
        } catch (error) {
            throw new Error(`No se pudo hacer clic en Join (selector: ${joinButtonSelector}): ${error.message}`);
        }

        // Esperar un poco a que cargue la sala y se inicialice el juego
        console.log("Esperando a que se cargue la sala y el juego...");
        await new Promise(resolve => setTimeout(resolve, 7000)); // Espera un poco más para la inicialización

        // Verificar que estamos en la sala (el chat es un buen indicador)
        try {
            const chatSelector = 'input[data-hook="input"][maxlength="140"]';
            await frame.waitForSelector(chatSelector, { timeout: 15000 });
            console.log("✅ ¡Bot dentro de la sala!");
            await notifyDiscord(`🟢 El bot **${BOT_NICKNAME}** ha entrado a la sala.`);
        } catch (error) {
            throw new Error('No se pudo verificar el acceso a la sala (chat input no encontrado)');
        }

        // Enviar mensaje inicial
        await sendMessageToChat(frame, "!");
        await new Promise(resolve => setTimeout(resolve, 1000)); // Pequeña pausa

        // --- INYECCIÓN Y ACTIVACIÓN DEL BOT DE SEGUIMIENTO DE PELOTA (EXPERIMENTAL) ---
        console.log("Intentando inyectar y activar la lógica del bot de seguimiento de pelota...");

        await frame.evaluate((botCodeRaw, botNickname) => {
            try {
                // Desempaca la función del plugin
                const createBotPlugin = new Function('e', botCodeRaw.split('module.exports = ')[1]);

                let internalRoom = null;
                let internalRoomPlugin = null; // Assuming there's a base Plugin class/object
                let internalVariableType = null;
                let internalAllowFlags = null;
                let internalDirection = null; // For keyState
                let keyStateFunction = null; // To store n.keyState if found

                // --- Estrategia para encontrar el objeto 'room' de Haxball ---
                // Iterar a través de las propiedades de 'window' para encontrar algo que parezca una sala de Haxball
                // Esto es altamente especulativo y dependiente de la implementación interna de Haxball.
                for (const prop in window) {
                    try {
                        const obj = window[prop];
                        if (obj && typeof obj === 'object' && obj.hasOwnProperty('startGame') && obj.hasOwnProperty('onGameTick')) {
                            // Esto podría ser el objeto 'room' o 'game' principal
                            internalRoom = obj;
                            console.log("🎲 Posible objeto de sala de Haxball encontrado:", prop);

                            // Intentar encontrar otros objetos necesarios del 'e' que el plugin espera
                            // Esto es aún más especulativo
                            if (obj.HBInit) { // If HBInit is exposed, it might give us the other parts
                                const dummyEnv = {};
                                obj.HBInit(dummyEnv); // Calling it with dummy might populate other props
                                internalRoomPlugin = dummyEnv.Plugin || null;
                                internalVariableType = dummyEnv.VariableType || null;
                                internalAllowFlags = dummyEnv.AllowFlags || null;
                                internalDirection = dummyEnv.Direction || null;
                                // Need to find n.keyState
                                if (dummyEnv.Utils && typeof dummyEnv.Utils.keyState === 'function') {
                                    keyStateFunction = dummyEnv.Utils.keyState;
                                } else { // Fallback to try to find it somewhere else, or define a basic one
                                    // Extremely basic fallback if keyState is not found:
                                    console.warn("Could not find Haxball's keyState function. The bot might not move.");
                                    keyStateFunction = (x, y, kick) => ({ x, y, kick }); // Dummy
                                }
                            } else {
                                // Fallback for very basic necessary components if HBInit isn't found
                                internalRoomPlugin = (function(){ this.defineVariable = () => {}; return function(){}; })(); // Simple mock
                                internalVariableType = { Number: 0, String: 1, Boolean: 2 };
                                internalAllowFlags = { CreateRoom: 1, JoinRoom: 2 };
                                internalDirection = { }; // Placeholder
                                console.warn("HBInit not found. Using mocked plugin environment.");

                                // Attempt to find keyState from the internalRoom itself if possible
                                if (internalRoom.setKeyState && typeof internalRoom.setKeyState === 'function') {
                                    // We need the `n.keyState` specifically as used in the plugin.
                                    // This is very hard to guess without Haxball's source.
                                    // As a last resort, if `setKeyState` is the ultimate method,
                                    // we can try to wrap it.
                                    keyStateFunction = (x, y, kick) => ({ x, y, kick }); // Define a format that setKeyState might understand
                                } else {
                                     console.warn("Could not find Haxball's keyState function. Bot movement will likely fail.");
                                }
                            }
                            break; // Found a likely candidate, stop searching
                        }
                    } catch (e) {
                        // Ignore errors from accessing window properties that might throw
                    }
                }

                if (!internalRoom) {
                    console.error("🔴 No se pudo encontrar el objeto de sala de Haxball interno.");
                    return;
                }

                // Crea el objeto 'e' que el plugin espera
                const envForPlugin = {
                    Room: internalRoom, // El objeto de sala real
                    Plugin: internalRoomPlugin, // Clase/Función base para plugins
                    VariableType: internalVariableType,
                    AllowFlags: internalAllowFlags,
                    Direction: internalDirection,
                    // n.keyState is used in the original code. We need to provide it.
                    // This is where it gets highly specific to Haxball's internal JS.
                    // We'll try to provide a 'n' object with a 'keyState' function.
                    n: {
                        keyState: keyStateFunction || ((x, y, kick) => ({ x, y, kick })) // Fallback if not found
                    },
                    // Pasamos el objeto de sala también como 'room' para `o.room`
                    room: internalRoom
                    // Other properties from the original 'e' object are less critical for this specific bot's logic,
                    // but could be placeholders if needed for `plugin.call` or `defineVariable`.
                    // We are omitting most of the unused ones for brevity and to avoid errors.
                };

                // Instancia el plugin
                const botPluginInstance = new createBotPlugin(envForPlugin);

                // --- Bucle de juego para llamar a onGameTick ---
                // Haxball tiene su propio bucle de juego. Intentaremos engancharnos a él.
                // Si `internalRoom.onGameTick` existe como un evento o un callback, usarlo.
                // De lo contrario, haremos un setInterval.

                if (typeof internalRoom.onGameTick === 'function') {
                    // If onGameTick is a method on the room object, we can try to wrap it
                    // or add our own logic to it. This is highly unlikely for a public game.
                    console.warn("Haxball's internal onGameTick found as a function, direct hook not possible without overwriting.");
                    // Fallback to setInterval
                    const gameTickInterval = setInterval(() => {
                        try {
                            // Pass a dummy event object if onGameTick expects one
                            botPluginInstance.onGameTick({});
                        } catch (tickError) {
                            console.error("Error en onGameTick del bot:", tickError);
                            clearInterval(gameTickInterval);
                        }
                    }, 1000 / 60); // Aproximadamente 60 FPS
                } else {
                    // Most likely scenario: no direct public hook. Create our own interval.
                    const gameTickInterval = setInterval(() => {
                        try {
                            // Pass a dummy event object if onGameTick expects one
                            botPluginInstance.onGameTick({});
                        } catch (tickError) {
                            console.error("Error en onGameTick del bot:", tickError);
                            clearInterval(gameTickInterval);
                        }
                    }, 1000 / 60); // Aproximadamente 60 FPS
                    console.log("⏲️  Iniciando bucle de juego para el bot de seguimiento de pelota.");
                }

                console.log("✅ Lógica del bot de seguimiento de pelota inyectada y activada.");

            } catch (e) {
                console.error("❌ Error crítico al inyectar o ejecutar el bot de seguimiento de pelota en el navegador:", e);
            }
        }, BOT_LOGIC_RAW, BOT_NICKNAME);
        // --- FIN DE LA INYECCIÓN DEL BOT ---

        // Elimina el movimiento anti-AFK ya que el bot debería controlar al jugador
        // y para evitar conflictos.
        // clearInterval(moveInterval);

        // La verificación de conexión (healthCheck) es útil para saber si la página está activa
        const healthCheck = setInterval(async () => {
            try {
                // Intenta interactuar con el iframe para asegurar que sigue vivo
                await frame.evaluate(() => {
                    if (!document.body) throw new Error('Body not found');
                });
                console.log("✅ Conexión activa (iframe presente)");
            } catch (error) {
                console.error("❌ Fallo en verificación de conexión con el iframe:", error.message);
                clearInterval(healthCheck);
                throw new Error('Perdida de conexión con el juego o iframe inaccesible');
            }
        }, 30000); // Cada 30 segundos

        // Mantenerlo vivo indefinidamente (o hasta un tiempo límite si lo deseas)
        await new Promise(resolve => setTimeout(resolve, 3600000 * 4)); // Mantener activo por 4 horas

        // Limpiar intervalos antes de cerrar
        clearInterval(healthCheck);

    } catch (error) {
        console.error("❌ Error durante la ejecución principal del bot Puppeteer:", error);
        await notifyDiscord(`🔴 Error al intentar conectar el bot **${BOT_NICKNAME}**. Causa: ${error.message}`);
        if (browser) {
            try {
                await browser.close();
            } catch (e) {
                console.error("Error al cerrar el navegador después de un fallo:", e);
            }
        }
        process.exit(1);
    } finally {
        console.log("Cerrando el bot.");
        if (browser) {
            try {
                await browser.close();
            } catch (e) {
                console.error("Error al cerrar el navegador en finally:", e);
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
        throw e;
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
            break;
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
