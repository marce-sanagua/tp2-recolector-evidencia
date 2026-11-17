
// Helper para responder siempre en JSON con el código de estado correcto.
function enviarJson(res, status, cuerpo) { // Recibe la respuesta, el código HTTP y los datos
  res.writeHead(status, { 'Content-Type': 'application/json' }); // Indica el código HTTP y que la respuesta será JSON
  res.end(JSON.stringify(cuerpo)); // Convierte los datos a texto JSON y envía la respuesta
}

module.exports = { enviarJson }; // Permite usar esta función desde otros archivos
/*o importante para estudiar
- res: es la respuesta que el servidor le envía al cliente.
- status: es el código HTTP, por ejemplo, 200 (correcto), 201 (creado) o 400 (solicitud incorrecta).
- JSON.stringify(): convierte los datos de JavaScript en texto JSON.
- res.end(): termina y envía la respuesta.
¿Para qué sirve este archivo? Para que los controladores puedan responder al cliente en formato JSON
 sin repetir el mismo código en cada respuesta.*/