
const { enviarJson } = require('../../utils/http'); // Importa la función que envía respuestas JSON

// GET /salud: comprueba que el servicio funciona y qué Worker responde.
function salud(req, res) { // Recibe la solicitud y prepara la respuesta
  enviarJson(res, 200, { status: 'ok', pid: process.pid, timestamp: Date.now() }); // Envía HTTP 200, el estado, el ID del proceso y la fecha en milisegundos
}

module.exports = { salud }; // Permite que otros archivos utilicen la función


/*Acordate de estas tres cosas:
- 200: la solicitud se atendió correctamente.
- process.pid: identifica el proceso que respondió; sirve para reconocer qué Worker atendió.
- Date.now(): devuelve la fecha y hora actual en milisegundos desde el 1 de enero de 1970.
Esta función no guarda evidencias: solo comprueba que el servicio responde.*/