
const os = require('os'); //consulta inf del sistema operativo.

// Toda la configuración en un solo lugar. Se puede cambiar con variables de entorno.
module.exports = {
  PORT: Number(process.env.PORT) || 8090,//process.env  permite modificar algunos valores desde el entorno sin cambiar el codigo 
  NUM_WORKERS: Number(process.env.NUM_WORKERS) || Math.min(os.cpus().length, 4),//decide cuantos workers se crean , usa hasta 4 segun los proceadores disponibles 
  SHUTDOWN_TIMEOUT_MS: 10000, // tiempo máximo para un cierre elegante , espera hasta 10 segundos para que un proceso se cierre correctamente 
  LOG_DIR: process.env.LOG_DIR || 'logs', //indica donde se guardan los registros de actividad
  DATA_DIR: process.env.DATA_DIR || 'data', //indica donde seguardan los datos 

  // Simulación de /escribir-evidencia
  IO_DELAY_MS: Number(process.env.IO_DELAY_MS) || 3000,  // I/O pesado simulado, simula una operacion que tarda 3 segundos 
  FAIL_PROB: process.env.FAIL_PROB !== undefined ? Number(process.env.FAIL_PROB) : 0.5, // anomalía post-escritura,    establece una probabilidad de fallo del 50%
  HASH_ITERACIONES: Number(process.env.HASH_ITERACIONES) || 200000, // cómputo pesado (hilo aparte)  ,  define la cantidad de iteraciones para un calculo que se procesa en otro hilo 
  MAX_BODY_BYTES: 10 * 1024, // limita el tamaño el contenido recibido a 10kB 
};



//El archivo `config.js` centraliza la configuración del sistema.
//  Define el puerto del servidor, la cantidad de Workers, el tiempo máximo de cierre,
//  las carpetas de registros y datos, el tiempo de espera de la operación simulada y 
// la probabilidad de fallo. Los demás archivos utilizan estos valores para 
// que sea más fácil configurar el programa desde un solo lugar.

/*Toda la configuración en un lugar: puerto 8090, cantidad de workers, 
timeout de 10 s, 3000 ms de I/O, 50% de falla, iteraciones del hash.*/