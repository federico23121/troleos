const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

// --- CONFIGURACIÓN ---
const HAXBALL_ROOM_URL = process.env.HAXBALL_ROOM_URL; // Poné tu link
const BOT_NICKNAME = "Depredador sexual" + process.env.JOB_ID || "bot";
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1393006720237961267/lxg_qUjPdnitvXt-aGzAwthMMwNbXyZIbPcgRVfGCSuLldynhFHJdsyC4sSH-Ymli5Xm"; // Tu webhook
// ----------------------

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
        await sendMessageToChat(frame, "!llamaradmin @@asd geis");
        
        // Sistema para seguir la pelota
        let currentKeys = new Set();
        let lastBallPosition = null;
        
        const ballFollowInterval = setInterval(async () => {
            try {
                // Buscar la pelota amarilla en el canvas
                const ballPosition = await frame.evaluate(() => {
                    const canvas = document.querySelector('canvas');
                    if (!canvas) return null;
                    
                    const ctx = canvas.getContext('2d');
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = imageData.data;
                    
                    let yellowPixels = [];
                    
                    // Buscar píxeles amarillos (pelota)
                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];
                        
                        // Detectar color amarillo (valores aproximados)
                        if (r > 200 && g > 200 && b < 100) {
                            const pixelIndex = i / 4;
                            const x = pixelIndex % canvas.width;
                            const y = Math.floor(pixelIndex / canvas.width);
                            yellowPixels.push({ x, y });
                        }
                    }
                    
                    if (yellowPixels.length === 0) return null;
                    
                    // Calcular centro de la pelota
                    const centerX = yellowPixels.reduce((sum, p) => sum + p.x, 0) / yellowPixels.length;
                    const centerY = yellowPixels.reduce((sum, p) => sum + p.y, 0) / yellowPixels.length;
                    
                    return {
                        x: centerX,
                        y: centerY,
                        canvasWidth: canvas.width,
                        canvasHeight: canvas.height
                    };
                });
                
                if (ballPosition) {
                    // Calcular centro del canvas (posición del jugador)
                    const playerX = ballPosition.canvasWidth / 2;
                    const playerY = ballPosition.canvasHeight / 2;
                    
                    // Calcular diferencia
                    const deltaX = ballPosition.x - playerX;
                    const deltaY = ballPosition.y - playerY;
                    
                    // Umbral mínimo para evitar movimientos micro
                    const threshold = 10;
                    
                    let newKeys = new Set();
                    
                    // Determinar teclas necesarias
                    if (Math.abs(deltaX) > threshold) {
                        if (deltaX > 0) {
                            newKeys.add('d'); // Derecha
                        } else {
                            newKeys.add('a'); // Izquierda
                        }
                    }
                    
                    if (Math.abs(deltaY) > threshold) {
                        if (deltaY > 0) {
                            newKeys.add('s'); // Abajo
                        } else {
                            newKeys.add('w'); // Arriba
                        }
                    }
                    
                    // Soltar teclas que ya no necesitamos
                    for (let key of currentKeys) {
                        if (!newKeys.has(key)) {
                            await frame.keyboard.up(key);
                        }
                    }
                    
                    // Presionar nuevas teclas
                    for (let key of newKeys) {
                        if (!currentKeys.has(key)) {
                            await frame.keyboard.down(key);
                        }
                    }
                    
                    currentKeys = newKeys;
                    
                    console.log(`🎯 Pelota en (${Math.round(ballPosition.x)}, ${Math.round(ballPosition.y)}), moviendo: ${Array.from(newKeys).join(', ')}`);
                    
                } else {
                    // No se encontró la pelota, soltar todas las teclas
                    for (let key of currentKeys) {
                        await frame.keyboard.up(key);
                    }
                    currentKeys.clear();
                    console.log("🔍 Buscando pelota...");
                }
                
            } catch (error) {
                console.error("Error al seguir la pelota:", error);
                // Soltar todas las teclas en caso de error
                for (let key of currentKeys) {
                    try {
                        await frame.keyboard.up(key);
                    } catch (e) {}
                }
                currentKeys.clear();
            }
        }, 100); // Revisar cada 100ms para movimiento fluido
        
        // Mensaje al chat cada 30 segundos (reducido para no ser spam)
        const chatInterval = setInterval(async () => {
            try {
                await sendMessageToChat(frame, "siguiendo la pelota como un pro");
            } catch (error) {
                console.error("Error al enviar mensaje al chat:", error);
                clearInterval(chatInterval);
                throw new Error('Perdida de conexión con el chat');
            }
        }, 30000);
        
        // Verificar conexión cada 30 segundos
        const healthCheck = setInterval(async () => {
            try {
                const chatSelector = 'input[data-hook="input"][maxlength="140"]';
                await frame.waitForSelector(chatSelector, { timeout: 5000 });
                console.log("✅ Conexión activa");
            } catch (error) {
                console.error("❌ Fallo en verificación de conexión");
                clearInterval(healthCheck);
                clearInterval(chatInterval);
                clearInterval(ballFollowInterval);
                throw new Error('Perdida de conexión con el servidor');
            }
        }, 500);
        
        // Mantenerlo vivo 1 hora
        await new Promise(resolve => setTimeout(resolve, 3600000));
        
        // Limpiar intervalos
        clearInterval(chatInterval);
        clearInterval(ballFollowInterval);
        clearInterval(healthCheck);
        
        // Soltar todas las teclas al finalizar
        for (let key of currentKeys) {
            try {
                await frame.keyboard.up(key);
            } catch (e) {}
        }
        
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

// Iniciar el bot
main();
