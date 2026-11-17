'use strict'; // Activa el modo estricto de JavaScript

const logger = require('../../utils/logger'); // Importa el sistema de registro

// Middleware: registra cada petición, su estado y cuánto tardó.
function requestLogger(req, res) { // Recibe la solicitud y la respuesta
  const inicio = Date.now(); // Guarda la hora de inicio en milisegundos
  res.on('finish', () => { // Ejecuta esta función cuando termina de enviarse la respuesta
    logger.info(`${req.method} ${req.url} -> ${res.statusCode} (${Date.now() - inicio}ms)`); // Registra método, ruta, estado HTTP y duración
  });
}

module.exports = requestLogger; // Permite usar este middleware en otros archivos


/*Recordá:
- middleware: código que se ejecuta durante el procesamiento de una solicitud.
- res.on('finish', ...): espera a que termine de enviarse la respuesta.
- res.statusCode: indica el código HTTP, por ejemplo, 200 o 404.
- Date.now() - inicio: calcula cuánto tardó la solicitud.
Este archivo no responde ni guarda evidencias: registra información de cada petición para poder revisar qué pasó.*/