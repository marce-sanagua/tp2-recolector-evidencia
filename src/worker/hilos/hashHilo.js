'use strict'; // Activa el modo estricto de JavaScript

// Este archivo calcula el hash en un hilo separado
const { parentPort, workerData } = require('worker_threads'); // Recibe datos y permite enviar el resultado al hilo principal
const crypto = require('crypto'); // Permite realizar cálculos criptográficos

let hash = workerData.texto; // Inicializa el hash con el texto recibido

for (let i = 0; i < workerData.iteraciones; i++) { // Repite el cálculo la cantidad de veces indicada
  hash = crypto.createHash('sha256').update(hash).digest('hex'); // Calcula el hash SHA-256 y lo convierte a texto hexadecimal
}

parentPort.postMessage(hash); // Envía el hash final al hilo principal



/*Tres cosas para recordar:
- for: repite las instrucciones mientras se cumpla la condición.
- i++: aumenta el contador en 1 en cada vuelta.
- parentPort.postMessage(hash): envía el resultado al archivo hashService.js.
¿Cómo se conectan los dos archivos? hashService.js crea este hilo y le pasa el texto y la cantidad de iteraciones. 
hashHilo.js calcula el hash y devuelve el resultado. Después,
el controlador continúa con el guardado de la evidencia.*/