'use strict'; // Activa el modo estricto de JavaScript

const config = require('../config'); // Importa la configuración
const logger = require('../utils/logger'); // Importa el sistema de registro

let cerrando = false; // Indica si el servidor ya está cerrándose

function apagar(server) { // Recibe el servidor que se va a cerrar
  if (cerrando) return; // Si ya se está cerrando, no repite el proceso
  cerrando = true; // Marca que comenzó el cierre
  logger.info('Shutdown recibido: no se aceptan conexiones nuevas, se terminan las pendientes'); // Registra el inicio del cierre

  // Si tarda demasiado, fuerza el cierre.
  const guardia = setTimeout(() => { // Programa un temporizador de seguridad
    logger.errorSync(`Timeout de ${config.SHUTDOWN_TIMEOUT_MS} ms: se fuerza el cierre`); // Registra que se agotó el tiempo
    process.exit(1); // Termina el proceso con código de error
  }, config.SHUTDOWN_TIMEOUT_MS); // Usa el tiempo configurado: 10 segundos
  guardia.unref(); // Evita que el temporizador por sí solo mantenga vivo el proceso

  server.close((err) => { // Deja de aceptar conexiones nuevas y espera las pendientes
    clearTimeout(guardia); // Cancela el temporizador si el cierre terminó
    logger.infoSync('Cierre limpio completado'); // Registra que terminó el cierre
    process.exit(err ? 1 : 0); // Termina con 1 si hubo error o con 0 si salió bien
  });
  server.closeIdleConnections(); // Cierra conexiones que están inactivas
}

// Escucha la instrucción 'shutdown' que envía el master.
function instalarShutdown(server) { // Configura cómo recibirá la orden de cierre
  process.on('message', (msg) => { // Escucha mensajes enviados al proceso
    if (msg && msg.type === 'shutdown') apagar(server); // Si recibe shutdown, inicia el cierre
  });

   process.on('SIGINT', () => apagar(server)); // Ctrl+C también llega a los Workers: cierran con elegancia
  process.on('SIGTERM', () => apagar(server)); // Lo mismo si el sistema pide terminar el proceso
}

module.exports = { instalarShutdown }; // Permite instalar este mecanismo desde otro archivo



/*Lo más importante de este archivo:
- shutdown: es la orden para cerrar el Worker.
- server.close(): deja de aceptar nuevas conexiones y espera las que siguen trabajando.
- setTimeout(): establece el límite de 10 segundos.
- process.exit(0): termina correctamente.
- process.exit(1): termina indicando un error.
¿Cómo se conecta con el resto? El master envía la orden shutdown; 
este archivo la recibe y cierra el servidor de forma ordenada. 
Si tarda más de 10 segundos, fuerza la salida.*/