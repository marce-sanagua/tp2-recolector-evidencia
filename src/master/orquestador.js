
const cluster = require('cluster'); // Permite crear y administrar procesos Worker
const readline = require('readline'); // Permite leer lo que se escribe en la terminal
const config = require('../config'); // Importa la configuración del proyecto , como el puerto y la cantidada de workers
const logger = require('../utils/logger'); // Importa el sistema que registar mensajes advertencias y errores 

let reiniciando = false; // Evita dos reinicios simultáneos
let apagando = false; // Indica si el Master se está cerrando

function crearWorker() { // Crea un Worker nuevo
  const worker = cluster.fork(); // Inicia un proceso Worker
  logger.info(`Worker ${worker.process.pid} creado`); // Registra su identificador de proceso
  worker.on('error', (err) => { // Captura errores del canal IPC con este Worker
    logger.warn(`Worker ${worker.process.pid}: error de comunicación IPC (${err.code})`); // registra una advertencia con el PID del worker y el codigo de comunicacion 
  });
  return worker; // Devuelve el Worker creado
}

// Espera a que el Worker nuevo empiece a escuchar el puerto.
function esperarListening(worker) {
  return new Promise((resolve, reject) => { // Crea una promesa que puede completarse o fallar
    const alEscuchar = () => { worker.off('exit', alSalir); resolve(); }; // Si empieza a escuchar, resuelve la promesa
    const alSalir = () => { worker.off('listening', alEscuchar); reject(new Error('el worker nuevo murió antes de escuchar')); }; // Si muere antes, rechaza la promesa
    worker.once('listening', alEscuchar); // Escucha el evento de inicio del servidor
    worker.once('exit', alSalir); // Escucha si el Worker termina antes
  });
}

// Solicita un cierre ordenado y fuerza la salida si tarda demasiado.
function detenerWorker(worker) {
  return new Promise((resolve) => { // Crea una promesa para esperar el cierre
    if (worker.isDead()) return resolve(); // Si ya murió, termina la espera

    worker.planificado = true; // Marca que la salida fue solicitada
    const guardia = setTimeout(() => { // Programa un límite de tiempo
      logger.warn(`Worker ${worker.process.pid} no cerró a tiempo, se fuerza con SIGKILL`); // Registra que tardó demasiado
      worker.process.kill('SIGKILL'); // Fuerza la terminación del proceso
    }, config.SHUTDOWN_TIMEOUT_MS + 2000); // Espera 12 segundos si el límite configurado es 10

    worker.once('exit', () => { clearTimeout(guardia); resolve(); }); // Al terminar, cancela el temporizador y resuelve la promesa
    if (worker.isConnected()) { // Solo envía si el canal IPC con el Worker sigue abierto
      worker.send({ type: 'shutdown' }, (err) => { // Envía la orden de cierre por IPC; el callback recibe el error si falla
        if (err) logger.warn(`Worker ${worker.process.pid}: no se pudo enviar shutdown (${err.code}), ya se estaba cerrando`); // Registra el fallo sin romper
      });
    }
  });
}

// Reinicia los Workers de a uno, manteniendo el servicio disponible.
async function rollingRestart() {
  if (reiniciando) { // Comprueba si ya hay un reinicio en curso
    logger.warn('Ya hay un rolling restart en curso, se ignora la señal'); // Registra que no iniciará otro
    return; // Termina esta llamada
  }
  reiniciando = true; // Marca el comienzo del reinicio
  logger.info('Rolling restart iniciado'); // Registra el inicio

  try { // Intenta ejecutar el reinicio
    const viejos = Object.values(cluster.workers); // Obtiene los Workers actuales
    for (const viejo of viejos) { // Recorre cada Worker
      const nuevo = crearWorker(); // Crea un Worker de reemplazo
      await esperarListening(nuevo); // Espera hasta que el nuevo esté escuchando
      await detenerWorker(viejo); // Después detiene el Worker anterior
      logger.info(`Worker ${viejo.process.pid} reemplazado por ${nuevo.process.pid}`); // Registra el reemplazo
    }
    logger.info('Rolling restart completado'); // Registra que terminó correctamente
  } catch (err) { // Captura errores durante el reinicio
    logger.error(`Rolling restart interrumpido: ${err.message}`); // Registra el motivo del error
  } finally {
    reiniciando = false; // Permite iniciar otro reinicio
  }
}

// Cierra todos los Workers cuando se cierra el Master.
async function apagarTodo(senal) {
  if (apagando) return; // Evita ejecutar el cierre dos veces
  apagando = true; // Marca que el Master está cerrándose
  logger.info(`${senal} recibido: cerrando todos los workers`); // Registra la señal recibida
  await Promise.all(Object.values(cluster.workers).map(detenerWorker)); // Solicita el cierre de todos y espera a que terminen
  logger.infoSync('Master finalizado'); // Registra que el Master terminó
  process.exit(0); // Finaliza correctamente
}

// Si un Worker muere inesperadamente, crea otro.
function alSalirWorker(worker, code, signal) {
  if (apagando || worker.planificado || code === 0) { // Salida esperada o terminó sin error (code 0): no se revive
    logger.info(`Worker ${worker.process.pid} salió de forma planificada (code ${code})`); // Registra la salida normal o solicitada
    return; // No crea un reemplazo
  }
  logger.error(`Worker ${worker.process.pid} colapsó (code ${code}, signal ${signal}). Reviviendo...`); // Registra la caída inesperada
  crearWorker(); // Crea un Worker de reemplazo
}

// En Windows, permite iniciar el rolling restart escribiendo "restart".
function habilitarComandoLocal() {
  const rl = readline.createInterface({ input: process.stdin }); // Lee lo que se escribe en la terminal
  rl.on('line', (linea) => { // Ejecuta esta función al presionar Enter
    if (linea.trim() === 'restart') rollingRestart(); // Si se escribió restart, inicia el reinicio
  });
  logger.info('Windows: escribí "restart" y Enter para disparar el rolling restart'); // Muestra la instrucción
}

function iniciar() {
  logger.info(`Master listo. Levantando ${config.NUM_WORKERS} workers en el puerto ${config.PORT}`); // Informa cuántos Workers creará
  for (let i = 0; i < config.NUM_WORKERS; i++) crearWorker(); // Crea la cantidad configurada de Workers

  cluster.on('exit', alSalirWorker); // Detecta cuándo termina un Worker

  if (process.platform === 'win32') { // Comprueba si el sistema operativo es Windows
    habilitarComandoLocal(); // Habilita el comando restart
  } else {
    process.on('SIGUSR2', rollingRestart); // En otros sistemas, permite iniciar el reinicio mediante SIGUSR2
  }
  process.on('SIGINT', () => apagarTodo('SIGINT')); // Cierra ordenadamente al presionar Ctrl+C
  process.on('SIGTERM', () => apagarTodo('SIGTERM')); // Cierra ordenadamente al recibir SIGTERM
}

module.exports = { iniciar }; // Permite que otro archivo inicie el Master


/*Lo fundamental para entender este archivo:
- Master: crea y supervisa los Workers.
- Self-healing: si un Worker muere inesperadamente, el Master crea otro.
- Rolling restart: crea un Worker nuevo, espera a que esté listo y recién entonces detiene el anterior.
- IPC: es el canal por el que el Master le manda al Worker el mensaje shutdown.
- SIGKILL: fuerza la terminación; no permite ejecutar un cierre ordenado.
Una aclaración importante: el Master espera hasta 12 segundos antes de forzar la salida,
 mientras que el Worker tiene un límite de 10 segundos.
 
 
 
 El jefe. Crea los workers, los revive si mueren (Self-Healing),
  hace el Rolling Restart (SIGUSR2 o restart en Windows)
   y les manda shutdown por IPC.*/