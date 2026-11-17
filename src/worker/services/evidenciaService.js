'use strict'; // Activa el modo estricto de JavaScript

const fs = require('fs'); // Permite trabajar con archivos
const path = require('path'); // Permite construir rutas de archivos
const config = require('../../config'); // Importa la configuración del proyecto
const logger = require('../../utils/logger'); // Importa el sistema de registro de errores

fs.mkdirSync(config.DATA_DIR, { recursive: true }); // Crea la carpeta de datos si no existe
const archivoEvidencias = path.join(config.DATA_DIR, 'evidencias.log'); // Define dónde se guardan las evidencias

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms)); // Espera la cantidad de milisegundos indicada sin bloquear el Event Loop

// Simula una escritura que tarda y después guarda el registro en disco.
async function persistir(registro) { // Recibe los datos que se van a guardar
  await esperar(config.IO_DELAY_MS); // Espera el tiempo configurado (3000 ms)
  await fs.promises.appendFile(archivoEvidencias, JSON.stringify(registro) + '\n'); // Agrega el registro al archivo, convertido a texto JSON, y termina con un salto de línea
}

// Simula un fallo después de guardar la evidencia y antes de responder.
function simularAnomalia(id) { // Recibe el ID de la evidencia
  if (Math.random() < config.FAIL_PROB) { // Decide al azar si ocurre el fallo según la probabilidad configurada
    logger.errorSync(`Anomalía simulada tras escribir la evidencia ${id}: process.exit(1) antes de responder`); // Registra el error
    process.exit(1); // Termina el proceso con código 1 (fallo)
  }
}

module.exports = { persistir, simularAnomalia }; // Permite que otros archivos utilicen estas funciones



/*Tres cosas importantes para recordar:
- appendFile: agrega información al archivo sin borrar lo que ya tenía.
- JSON.stringify(registro): convierte el objeto en texto para poder guardarlo.
- process.exit(1): termina el Worker de forma inmediata por un fallo.
¿Cómo se conecta con el archivo anterior? evidenciaController.js llama primero a persistir() 
para guardar los datos y después a simularAnomalia(), 
que puede cerrar el Worker antes de que responda a Postman.*/