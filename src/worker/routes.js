
const { enviarJson } = require('../utils/http');  // permite responder con informacion en formato json
const requestLogger = require('./middlewares/requestLogger'); // registra inf sobre las solicitudes que llegan 
const saludController = require('./controllers/saludController');  //se encarga d comprobar si el servidor funciona 
const evidenciaController = require('./controllers/evidenciaController'); // se encarga de procesar las solicitudes para escribir evidencia 

// define que ruta acepta cada tipo de solicitud .
const rutas = {
  '/salud': { GET: saludController.salud }, // sirve para comprobar si el servidor esta funcionando
  '/escribir-evidencia': { POST: evidenciaController.escribirEvidencia }, // sirve para enviar informacion que el sistema debe procesar y guardar
};

function manejar(req, res) {  // es la funcion que recibe y dirige cada solicitud   //
  requestLogger(req, res);  // registra la solicitud recibida 

  const ruta = rutas[req.url.split('?')[0]];
  if (!ruta) {  // si la ruta no existe responde con un error 404
    return enviarJson(res, 404, { error: 'Ruta no encontrada' });
  }

  const controlador = ruta[req.method];
  if (!controlador) { // si la ruta existe pero el metodo no esta permitido responde con un error 405 
    res.setHeader('Allow', Object.keys(ruta).join(', '));
    return enviarJson(res, 405, { error: 'Método no permitido' });
  }

  controlador(req, res); // Ejecuta la función encargada de atender esa solicitud.
}

module.exports = { manejar };




/*routes.js
Decide qué función debe atender cada solicitud que llega al servidor. 
Es como una recepcionista: mira qué pide la persona y la deriva al lugar correcto.*/




/*- req: contiene la solicitud que llega al servidor.
  - res: permite enviar la respuesta al cliente.*/


  /*El archivo `routes.js` recibe las solicitudes y decide qué función debe atenderlas según la ruta 
  y el método HTTP. Tiene una ruta GET para comprobar el estado del servidor y una ruta POST 
  para escribir evidencia. Si la ruta no existe, responde con error 404; 
  si el método no está permitido, responde con error 405.*/



  /*- `req.url`: obtiene la dirección solicitada.
- `split('?')`: separa la ruta de los parámetros.
- `[0]`: selecciona la primera parte, antes del signo `?`.
- `req.method`: obtiene el método HTTP, como GET o POST.
- `ruta[req.method]`: busca la función asignada a ese método.
- `if (!controlador)`: comprueba si no existe una función para ese método.
- `Object.keys(ruta)`: obtiene los métodos permitidos.
- `join(', ')`: los une en un texto separado por comas.
- `setHeader('Allow', ...)`: informa qué métodos se permiten.
- `405`: la ruta existe, pero el método no está permitido.
- `404`: la ruta no existe.
- `return`: termina la función en ese punto.
- `controlador(req, res)`: ejecuta la función que atiende la solicitud.*/