
const fs = require('fs'); // Permite trabajar con archivos
const path = require('path'); // Permite construir rutas de archivos
const cluster = require('cluster'); // Permite identificar al Master y a los Workers
const config = require('../config'); // Importa la configuración

// El log se guarda en consola y en un archivo.
fs.mkdirSync(config.LOG_DIR, { recursive: true }); // Crea la carpeta de logs si no existe
const rutaArchivo = path.join(config.LOG_DIR, 'app.log'); // Define la ruta del archivo de registro
const archivo = fs.createWriteStream(rutaArchivo, { flags: 'a' }); // Abre el archivo para agregar registros sin borrar los anteriores

const rol = cluster.isPrimary ? 'MASTER' : 'WORKER'; // Identifica si el proceso es Master o Worker

function formatear(nivel, mensaje) { // Prepara el formato de cada registro
  return `${new Date().toISOString()} [${nivel}] [${rol} ${process.pid}] ${mensaje}`; // Agrega fecha, nivel, rol, PID y mensaje
}

function escribir(nivel, mensaje) { // Escribe un registro normalmente
  const linea = formatear(nivel, mensaje); // Prepara la línea
  console.log(linea); // Muestra el registro en la consola
  archivo.write(linea + '\n'); // Lo agrega al archivo app.log
}

// Se usa antes de process.exit() para intentar asegurar que la última línea quede guardada.
function escribirSync(nivel, mensaje) { // Escribe un registro de forma síncrona
  const linea = formatear(nivel, mensaje); // Prepara la línea
  console.log(linea); // La muestra en la consola
  fs.appendFileSync(rutaArchivo, linea + '\n'); // La guarda en el archivo antes de continuar
}

module.exports = {
  info: (m) => escribir('INFO', m), // Registra información normal
  warn: (m) => escribir('WARN', m), // Registra advertencias
  error: (m) => escribir('ERROR', m), // Registra errores
  infoSync: (m) => escribirSync('INFO', m), // Registra información de forma síncrona
  errorSync: (m) => escribirSync('ERROR', m), // Registra errores de forma síncrona
};

/*Lo importante para estudiar
- Log: es un registro de lo que sucede en el programa.
- app.log: archivo donde quedan guardados los registros.
- INFO: información normal.
- WARN: advertencia.
- ERROR: error.
- process.pid: identifica al proceso que escribió el registro.
- MASTER y WORKER: permiten saber qué proceso generó el mensaje.
- appendFileSync(): guarda la última línea de forma síncrona, algo importante antes de terminar el proceso.*/