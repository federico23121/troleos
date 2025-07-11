const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

// --- CONFIGURACIÓN ---
const NODE_HAXBALL_URL = "https://node-haxball.onrender.com/";
const HAXBALL_ROOM_URL = process.env.HAXBALL_ROOM_URL; // Poné tu link de la sala
const BOT_NICKNAME = process.env.JOB_ID || "bot";
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1393006720237961267/lxg_qUjPdnitvXt-aGzAwthMMwNbXyZIbPcgRVfGCSuLldynhFHJdsyC4sSH-Ymli5Xm";

// Código del addon que se va a pegar - DEFINIR AQUÍ
const ADDON_CODE = `module.exports = function(e){e.OperationType;var a=e.VariableType,t=(e.ConnectionState,e.AllowFlags),n=(e.Direction,e.CollisionFlags,e.CameraFollow,e.BackgroundType,e.GamePlayState,e.BanEntryType,e.Callback,e.Utils),Plugin=(e.Room,e.Replay,e.Query,e.Library,e.RoomConfig,e.Plugin);e.Renderer,e.Errors,e.Language,e.EventFactory,e.Impl;Object.setPrototypeOf(this,Plugin.prototype),Plugin.call(this,"autoPlay_followBall",!0,{version:"0.4",author:"abc",description:"This is an auto-playing bot that always follows the ball blindly, and kicks it whenever it is nearby without any direction checking. This bot uses real events and controls real players.",allowFlags:t.CreateRoom|t.JoinRoom}),this.defineVariable({name:"minCoordAlignDelta",description:"Minimum delta value for coordinate alignment",type:a.Number,value:.5,range:{min:0,max:10,step:.5}}),this.defineVariable({name:"minKickDistance",description:"Minimum distance between ball and bot player for the bot player to start kicking the ball",type:a.Number,value:8,range:{min:0,max:15,step:.5}});var o=this;this.onGameTick=function(e){var a;o.room.extrapolate();var t=o.room.currentPlayer,r=null==t||null===(a=t.disc)||void 0===a?void 0:a.ext;if(r){var i=o.room,s=(i.state,i.gameState),l=(s=i.gameStateExt||s).physicsState.discs[0],c=(null==l?void 0:l.pos)||{},d=c.x,u=c.y;if(null!=d&&!isNaN(d)&&isFinite(d)&&null!=u&&!isNaN(u)&&isFinite(u)){var m,h,p,f=d-r.pos.x,y=u-r.pos.y;m=Math.abs(f)<o.minCoordAlignDelta?0:Math.sign(f),h=Math.abs(y)<o.minCoordAlignDelta?0:Math.sign(y),p=f*f+y*y<(r.radius+l.radius+o.minKickDistance)*(r.radius+l.radius+o.minKickDistance),o.room.setKeyState(n.keyState(m,h,p))}}}}`;

// ----------------------

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

// Función auxiliar para encontrar y hacer clic en elementos de forma más robusta
async function findAndClick(page, selectors, description, timeout = 10000) {
    console.log(`🔍 Buscando ${description}...`);
    
    for (const selector of selectors) {
        try {
            await page.waitForSelector(selector, { timeout: timeout / selectors.length });
            await page.click(selector);
            console.log(`✅ ${description} encontrado y clickeado con selector: ${selector}`);
            return true;
        } catch (error) {
            console.log(`⚠️ No se encontró ${description} con selector: ${selector}`);
            continue;
        }
    }
    
    // Si no funciona ningún selector, intentar con evaluación de JavaScript
    try {
        const found = await page.evaluate((desc) => {
            // Buscar por texto del botón
            const buttons = Array.from(document.querySelectorAll('button'));
            let target = null;
            
            if (desc.includes('OK')) {
                target = buttons.find(btn => btn.textContent.trim() === 'OK');
            } else if (desc.includes('nick')) {
                const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
                target = inputs.find(input => input.placeholder && input.placeholder.toLowerCase().includes('nick'));
                if (!target) {
                    target = inputs[0]; // Tomar el primer input de texto
                }
            }
            
            if (target) {
                target.click();
                return true;
            }
            return false;
        }, description);
        
        if (found) {
            console.log(`✅ ${description} encontrado por evaluación de JavaScript`);
            return true;
        }
    } catch (error) {
        console.log(`⚠️ Error en evaluación de JavaScript para ${description}`);
    }
    
    throw new Error(`No se pudo encontrar ${description} con ningún método`);
}

// Función para escribir texto de forma robusta
async function typeText(page, selectors, text, description, timeout = 10000) {
    console.log(`✍️ Escribiendo ${description}: "${text}"...`);
    
    for (const selector of selectors) {
        try {
            await page.waitForSelector(selector, { timeout: timeout / selectors.length });
            
            // Hacer clic en el input para asegurar que está activo
            await page.click(selector);
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Limpiar el campo completamente
            await page.keyboard.down('Control');
            await page.keyboard.press('KeyA');
            await page.keyboard.up('Control');
            await page.keyboard.press('Delete');
            
            // Escribir el texto
            await page.type(selector, text, { delay: 100 });
            
            // Verificar que el texto se escribió correctamente
            const value = await page.$eval(selector, el => el.value);
            if (value === text) {
                console.log(`✅ ${description} escrito correctamente: "${value}" con selector: ${selector}`);
                return true;
            } else {
                console.log(`⚠️ Texto no coincide. Esperado: "${text}", Actual: "${value}"`);
            }
        } catch (error) {
            console.log(`⚠️ No se pudo escribir ${description} con selector: ${selector}`);
            continue;
        }
    }
    
    // Método alternativo con evaluación JavaScript
    try {
        const success = await page.evaluate((txt, desc) => {
            const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
            let target = null;
            
            if (desc.includes('nick')) {
                target = inputs.find(input => input.placeholder && input.placeholder.toLowerCase().includes('nick'));
                if (!target) {
                    target = inputs[0]; // Tomar el primer input de texto
                }
            }
            
            if (target) {
                target.focus();
                target.select();
                target.value = '';
                target.value = txt;
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));
                return target.value === txt;
            }
            return false;
        }, text, description);
        
        if (success) {
            console.log(`✅ ${description} escrito correctamente por evaluación de JavaScript: "${text}"`);
            return true;
        }
    } catch (error) {
        console.log(`⚠️ Error en evaluación de JavaScript para escribir ${description}`);
    }
    
    throw new Error(`No se pudo escribir ${description} con ningún método`);
}

async function main() {
    console.log("🤖 Iniciando el bot de Haxball...");
    
    let browser;
    let page;
    
    try {
        // Lanzar navegador
        browser = await Promise.race([
            puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout al lanzar el navegador')), 30000))
        ]);
        
        page = await browser.newPage();
        
        // PASO 1: Ir a node-haxball.onrender.com
        console.log("📍 Yendo a node-haxball.onrender.com...");
        await Promise.race([
            page.goto(NODE_HAXBALL_URL, { waitUntil: 'networkidle2' }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout al cargar node-haxball')), 30000))
        ]);
        
// --- Inside your main() function ---

// PASO 2: Cambiar nick
console.log("🔧 Cambiando nick...");

// Wait for the popup to be visible. We can target its unique title.
const popupTitleSelector = 'h1.c-eXwJve:contains("Elegir nick")';
try {
    await page.waitForSelector(popupTitleSelector, { timeout: 15000 });
    console.log("✅ Popup 'Elegir nick' encontrado.");
} catch (error) {
    throw new Error("No se encontró el popup para elegir nick a tiempo.");
}

// Selectors within the popup context
const nickInputSelector = 'div.c-eVIWsa input[type="text"]';
const okButtonSelector = 'button.c-iQrRSZ:contains("OK")';

// PRIMERO: Escribir el nick en el popup
try {
    await typeText(page, [nickInputSelector], BOT_NICKNAME, 'nick en popup', 10000);
    console.log(`✅ Nick escrito en popup: ${BOT_NICKNAME}`);
} catch (error) {
    throw new Error(`No se pudo escribir el nick en el popup: ${error.message}`);
}

// SEGUNDO: Hacer clic en el botón OK para confirmar
try {
    await findAndClick(page, [okButtonSelector], 'botón OK en popup', 10000);
    console.log(`✅ Nick confirmado: ${BOT_NICKNAME}`);
} catch (error) {
    throw new Error(`No se pudo hacer clic en el botón OK del popup: ${error.message}`);
}

// ... rest of your code        
        // PASO 3: Ir a la sala
        console.log("🚪 Yendo a la sala...");
        await Promise.race([
            page.goto(HAXBALL_ROOM_URL, { waitUntil: 'networkidle2' }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout al cargar la sala')), 30000))
        ]);
        
        // Buscar el iframe de Haxball
        await page.waitForSelector('iframe', { timeout: 15000 });
        const iframeElement = await page.$('iframe');
        const frame = await iframeElement.contentFrame();
        
        if (!frame) {
            throw new Error('No se pudo acceder al iframe de Haxball');
        }
        
        // Escribir el nick en el iframe (por si acaso)
        console.log("✍️ Escribiendo nick en la sala...");
        const nickSelector = 'input[data-hook="input"][maxlength="25"]';
        try {
            await frame.waitForSelector(nickSelector, { timeout: 10000 });
            await frame.click(nickSelector);
            await frame.keyboard.down('Control');
            await frame.keyboard.press('KeyA');
            await frame.keyboard.up('Control');
            await frame.type(nickSelector, BOT_NICKNAME);
        } catch (error) {
            console.log("ℹ️ No se encontró selector de nick en iframe o ya está configurado");
        }
        
        // Hacer clic en "Join"
        console.log("🚪 Haciendo clic en 'Join'...");
        const joinButtonSelector = 'button[data-hook="ok"]';
        try {
            await frame.waitForSelector(joinButtonSelector, { timeout: 10000 });
            await frame.click(joinButtonSelector);
        } catch (error) {
            console.log("ℹ️ No se encontró botón Join o ya está en la sala");
        }
        
        // Esperar que cargue la sala y verificar que estamos dentro
        console.log("⏳ Esperando a que se cargue la sala...");
        await new Promise(resolve => setTimeout(resolve, 8000));
        
        // Verificar que estamos en la sala
        try {
            const chatSelector = 'input[data-hook="input"][maxlength="140"]';
            await frame.waitForSelector(chatSelector, { timeout: 10000 });
            console.log("✅ ¡Bot dentro de la sala!");
        } catch (error) {
            throw new Error('No se pudo verificar el acceso a la sala');
        }
        
        // PASO 4: Configurar addon
        console.log("⚙️ Configurando addon...");
        
        // Hacer clic en el botón "Addons"
        const addonsButtonSelector = 'button[data-tooltip-content="Addons"]';
        try {
            await page.waitForSelector(addonsButtonSelector, { timeout: 15000 });
            await page.click(addonsButtonSelector);
            console.log("✅ Botón 'Addons' clickeado");
        } catch (error) {
            throw new Error(`No se pudo hacer clic en Addons: ${error.message}`);
        }
        
        // Esperar a que cargue el panel de addons
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Hacer clic en el botón "empty"
        const emptyButtonSelector = 'button[data-tooltip-content="Show the properties panel for this addon"]';
        try {
            await page.waitForSelector(emptyButtonSelector, { timeout: 10000 });
            await page.click(emptyButtonSelector);
            console.log("✅ Botón 'empty' clickeado");
        } catch (error) {
            throw new Error(`No se pudo hacer clic en empty: ${error.message}`);
        }
        
        // Esperar a que cargue
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Hacer clic en el botón "Edit"
        const editButtonSelector = 'button[data-tooltip-content="Live-edit this addon\'s codes"]';
        try {
            await page.waitForSelector(editButtonSelector, { timeout: 10000 });
            await page.click(editButtonSelector);
            console.log("✅ Botón 'Edit' clickeado");
        } catch (error) {
            throw new Error(`No se pudo hacer clic en Edit: ${error.message}`);
        }
        
        // Esperar a que se abra la nueva pestaña
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Obtener todas las páginas (pestañas)
        const pages = await browser.pages();
        let editorPage = null;
        
        // Encontrar la página del editor (la nueva pestaña)
        for (let i = pages.length - 1; i >= 0; i--) {
            const url = pages[i].url();
            if (url.includes('editor') || url !== NODE_HAXBALL_URL && url !== HAXBALL_ROOM_URL) {
                editorPage = pages[i];
                break;
            }
        }
        
        if (!editorPage) {
            throw new Error('No se pudo encontrar la página del editor');
        }
        
        console.log("📝 Página del editor encontrada");
        
        // Cambiar a la página del editor
        await editorPage.bringToFront();
        
        // Esperar a que cargue el editor
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Buscar el área de texto del editor (puede ser un textarea o un div contenteditable)
        const textAreaSelector = 'textarea.ace_text-input';
        try {
            await editorPage.waitForSelector(textAreaSelector, { timeout: 10000 });
            
            // Seleccionar todo el texto existente y reemplazarlo
            await editorPage.click(textAreaSelector);
            // Seleccionar todo con Ctrl+A
            await editorPage.keyboard.down('Control');
            await editorPage.keyboard.press('KeyA');
            await editorPage.keyboard.up('Control');
            await editorPage.keyboard.type(ADDON_CODE);
            
            console.log("✅ Código del addon pegado");
        } catch (error) {
            throw new Error(`No se pudo pegar el código: ${error.message}`);
        }
        
        // Hacer clic en el botón "Save"
        try {
            // Buscar el botón Save específicamente
            const saveButton = await editorPage.evaluateHandle(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                return buttons.find(btn => btn.textContent.trim() === 'Save');
            });
            
            if (saveButton) {
                await saveButton.click();
                console.log("✅ Código guardado");
            } else {
                throw new Error('No se encontró el botón Save');
            }
        } catch (error) {
            throw new Error(`No se pudo guardar el código: ${error.message}`);
        }
        
        // Volver a la página principal de la sala
        await page.bringToFront();
        
        console.log("🎉 Configuración completada! Bot activo en la sala.");
        await notifyDiscord(`🟢 El bot **${BOT_NICKNAME}** ha entrado a la sala y configurado el addon.`);
        
        // PASO 5: Mantener el bot activo con movimiento anti-AFK
        console.log("🔄 Iniciando sistema anti-AFK...");
        
        // Movimiento anti-AFK
        let moves = ['w', 'a', 's', 'd'];
        let moveIndex = 0;
        
        const moveInterval = setInterval(async () => {
            try {
                const key = moves[moveIndex % moves.length];
                console.log(`🎮 Presionando tecla: ${key}`);
                await page.keyboard.press(key);
                moveIndex++;
            } catch (error) {
                console.error("❌ Error al presionar tecla:", error);
                clearInterval(moveInterval);
                throw new Error('Perdida de conexión con el juego');
            }
        }, 5000);
        
        // Verificar conexión cada 30 segundos
        const healthCheck = setInterval(async () => {
            try {
                // Verificar que todavía estamos en la sala
                const currentUrl = page.url();
                if (!currentUrl.includes('haxball')) {
                    throw new Error('No estamos en la sala de Haxball');
                }
                console.log("✅ Conexión activa");
            } catch (error) {
                console.error("❌ Fallo en verificación de conexión");
                clearInterval(healthCheck);
                clearInterval(moveInterval);
                throw new Error('Perdida de conexión con el servidor');
            }
        }, 30000);
        
        // Mantenerlo vivo 1 hora
        await new Promise(resolve => setTimeout(resolve, 3600000));
        
        // Limpiar intervalos
        clearInterval(moveInterval);
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
        
        process.exit(1);
        
    } finally {
        console.log("🔚 Cerrando el bot.");
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

// Sistema de reintentos
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
