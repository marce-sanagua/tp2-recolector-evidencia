
const config = require('../config'); // Importa la configuración

// Lee el cuerpo de la solicitud y lo convierte de JSON a datos de JavaScript.
function leerJson(req) {
  return new Promise((resolve, reject) => { // Crea una promesa que devuelve los datos o un error
    let tamano = 0; // Cuenta el tamaño de los datos recibidos
    const partes = []; // Guarda los fragmentos del cuerpo recibido

    req.on('data', (chunk) => { // Se ejecuta cada vez que llegan datos
      tamano += chunk.length; // Suma el tamaño del fragmento recibido
      if (tamano > config.MAX_BODY_BYTES) { // Comprueba si supera el tamaño máximo permitido
        const err = new Error('Cuerpo demasiado grande'); // Crea un error
        err.status = 413; // Indica HTTP 413: contenido demasiado grande
        req.destroy(); // Cierra la solicitud
        return reject(err); // Rechaza la promesa con el error
      }
      partes.push(chunk); // Guarda el fragmento recibido
    });

    req.on('end', () => { // Se ejecuta cuando termina de llegar el cuerpo
      if (partes.length === 0) return resolve({}); // Si no llegaron datos, devuelve un objeto vacío
      try {
        resolve(JSON.parse(Buffer.concat(partes).toString('utf8'))); // Une los fragmentos, los convierte a texto y los interpreta como JSON
      } catch {
        const err = new Error('JSON inválido'); // Crea un error si el JSON está mal escrito
        err.status = 400; // Indica HTTP 400: solicitud incorrecta
        reject(err); // Rechaza la promesa
      }
    });

    req.on('error', reject); // Si ocurre un error al recibir los datos, rechaza la promesa
  });
}

module.exports = { leerJson }; // Permite utilizar la función desde otros archivos