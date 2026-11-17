'use strict'; // Activa el modo estricto de JavaScript

const path = require('path'); // Permite construir rutas de archivos
const { Worker } = require('worker_threads'); // Permite crear hilos de trabajo
const config = require('../../config'); // Importa la configuración

// Calcula el hash en otro hilo y devuelve el resultado mediante una promesa.
function calcularHash(texto) { // Recibe el texto al que se le calculará el hash
  return new Promise((resolve, reject) => { // Crea una promesa: puede resolverse o rechazarse
    const hilo = new Worker(path.join(__dirname, '..', 'hilos', 'hashHilo.js'), { // Crea un hilo que ejecuta hashHilo.js
      workerData: { texto, iteraciones: config.HASH_ITERACIONES }, // Le pasa el texto y la cantidad de iteraciones
    });
    hilo.once('message', resolve); // Cuando el hilo envía el resultado, resuelve la promesa
    hilo.once('error', reject); // Si el hilo produce un error, rechaza la promesa
    hilo.once('exit', (codigo) => { // Cuando el hilo termina, comprueba su código de salida
      if (codigo !== 0) reject(new Error(`El hilo de hash terminó con código ${codigo}`)); // Si termina con error, rechaza la promesa
    });
  });
}

module.exports = { calcularHash }; // Permite que otros archivos utilicen la función


/*Recordá estas tres cosas:
- Hash: es un resultado calculado a partir de un texto; en este proyecto se usa para la evidencia.
- Worker: es un hilo separado que hace el cálculo para no bloquear el Event Loop principal.
- resolve y reject: resolve indica que la promesa se completó correctamente; reject, que falló.*/