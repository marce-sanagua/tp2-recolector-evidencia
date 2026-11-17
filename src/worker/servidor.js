'use strict';

const http = require('http');  // importa herramienta de node.js para crear un servidor HTTP 
const config = require('../config');  // Obtiene la configuración, por ejemplo, el puerto 8090.
const logger = require('../utils/logger'); // Permite registrar mensajes y errores.
const { manejar } = require('./routes'); // Importa la función que decide cómo atender cada solicitud.
const { instalarShutdown } = require('./shutdown');  //  Importa la función que prepara el cierre ordenado.

function iniciar() {    // define la funcion quew pone en marcha el servidor
  // Cualquier error no capturado se registra y el worker sale con código 1,
  // para que el master lo detecte y lo reviva (self-healing).
  process.on('uncaughtException', (err) => {  //  detecta un error que no fuecapturado
    logger.errorSync(`Excepción no capturada: ${err.stack}`);
    process.exit(1);
  });
  process.on('unhandledRejection', (motivo) => {   // detecta una promesa rechazada que no fue manejada 
    logger.errorSync(`Promesa rechazada sin capturar: ${motivo}`);
    process.exit(1); // termina el worker indicando que hubo un error 
  });

  const server = http.createServer(manejar); // Crea el servidor y le indica qué función atiende las solicitudes.
  server.listen(config.PORT, () => { // Hace que el servidor empiece a escuchar en el puerto configurado.
    logger.info(`Escuchando en el puerto ${config.PORT}`);
  });
  instalarShutdown(server); // Prepara el mecanismo para cerrar el servidor ordenadamente.
}

module.exports = { iniciar }; //Permite que otro archivo utilice la función iniciar. 





//Se encarga de iniciar el servidor, escuchar las solicitudes y 
// preparar el cierre ordenado. También registra los errores graves 
// que pueden hacer que un Worker termine.




/* Master
Crea y supervisa los Workers

Worker → servidor.js
Inicia el servidor y recibe solicitudes

routes.js
Decide qué hacer con cada solicitud*/





/*El archivo `servidor.js` se encarga de iniciar el servidor HTTP y escuchar en el puerto configurado.
 Utiliza `routes.js` para atender las solicitudes y `shutdown.js` para preparar el cierre ordenado. 
 También registra ciertos errores graves y finaliza el Worker con código 1 para 
 que el Master pueda detectar el fallo y reiniciarlo.*/

 /*El Master supervisa los procesos y se encarga de recuperarlos cuando fallan.
 Los Workers son los que atienden las solicitudes del servidor”.
 
 
 
 Crea el servidor HTTP, escucha en el puerto 
 y atrapa errores graves para salir con exit(1).*/