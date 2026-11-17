
const crypto = require('crypto'); // genera un identificador unico si el cliente no envia uno
const { enviarJson } = require('../../utils/http'); // envia respuestas al cliente en formato json
const { leerJson } = require('../../utils/body'); // lee los datos que envio el cliente 
const logger = require('../../utils/logger'); // registra errores inesperados 
const hashService = require('../services/hashService');  // calcula el hash de la evidencia 
const evidenciaService = require('../services/evidenciaService');  // se ocupa de guardar la evidencia y simular el fallo 

// su trabajo es comprobar que la informacion recibida tenga el formato correcto antes de procesarla .
function validar(cuerpo) { // Función que recibe los datos para validarlos
  if (cuerpo === null || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) { // Comprueba que sea un objeto y no un arreglo ni null
    const err = new Error('El cuerpo debe ser un objeto JSON'); // Crea un mensaje de error
    err.status = 400; // Asigna el estado HTTP 400: solicitud incorrecta
    throw err; // Lanza el error y detiene la función
  }

  const id = cuerpo.id === undefined ? crypto.randomUUID() : cuerpo.id; // Si falta el ID, genera uno; si existe, lo usa
  const evidencia = cuerpo.evidencia === undefined ? '' : cuerpo.evidencia; // Si falta la evidencia, asigna texto vacío

  if (typeof id !== 'string' || id.length === 0 || id.length > 100) { // Comprueba que el ID sea texto de 1 a 100 caracteres
    const err = new Error('"id" debe ser un texto de 1 a 100 caracteres'); // Crea el error
    err.status = 400; // Asigna el estado HTTP 400
    throw err; // Lanza el error
  }

  if (typeof evidencia !== 'string' || evidencia.length > 1000) { // Comprueba que la evidencia sea texto de hasta 1000 caracteres
    const err = new Error('"evidencia" debe ser un texto de hasta 1000 caracteres'); // Crea el error
    err.status = 400; // Asigna el estado HTTP 400
    throw err; // Lanza el error
  }

  return { id, evidencia }; // Devuelve los datos validados
}

// POST /escribir-evidencia: ruta que recibe la solicitud para guardar evidencia
async function escribirEvidencia(req, res) { // Función asíncrona: recibe la solicitud y prepara la respuesta
  try { // Intenta ejecutar el código y permite capturar errores
    const { id, evidencia } = validar(await leerJson(req)); // Lee el cuerpo de la solicitud y valida los datos

    // 1) Cómputo pesado en un hilo aparte (no bloquea el Event Loop)
    const hash = await hashService.calcularHash(`${id}:${evidencia}`); // Calcula el hash de los datos y espera el resultado

    // 2) Persistencia simulada (3000 ms) + escritura real en disco
    await evidenciaService.persistir({ id, evidencia, hash, pid: process.pid, fecha: new Date().toISOString() }); // Guarda la evidencia con sus datos adicionales

    // 3) Anomalía post-escritura: 50% de morir antes de responder
    evidenciaService.simularAnomalia(id); // Simula un fallo después de guardar los datos

    enviarJson(res, 201, { id, hash, pid: process.pid }); // Si todo sale bien, responde HTTP 201 (creado)

  } catch (err) { // Captura los errores que se produzcan dentro del try
    if (err.status) return enviarJson(res, err.status, { error: err.message }); // Si tiene estado HTTP, devuelve ese estado y el mensaje
    logger.error(`Error inesperado en /escribir-evidencia: ${err.stack}`); // Registra los detalles del error inesperado
    enviarJson(res, 500, { error: 'Error interno' }); // Devuelve HTTP 500: error interno del servidor
  }
}

module.exports = { escribirEvidencia }; // Permite que otros archivos utilicen esta función



/*Recibe el pedido que viene de routes.js, comprueba que los datos sean correctos, 
calcula un hash, guarda la evidencia y simula un fallo. 
Si todo sale bien, responde al cliente.


Atiende /escribir-evidencia: valida los datos, 
calcula el hash, guarda la evidencia, 
simula la falla y responde 201.*/