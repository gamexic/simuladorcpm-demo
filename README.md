# Simulador de escenarios

Demo pública, independiente y educativa para explorar asignación de equipos,
puntajes ponderados y reservas de recursos. Todos los datos se escribieron desde
cero para esta demo: no contiene bases, nombres, archivos ni historia del
simulador privado.

## Ejecutar en local

Requisitos: Python 3 para servir archivos; Node 20+ para las pruebas. La app no
requiere npm install, dependencias de terceros ni una compilación.

```sh
npm start
```

Abrir [http://127.0.0.1:4173](http://127.0.0.1:4173). También puede ejecutarse
`python3 -m http.server 4173 --bind 127.0.0.1` directamente. Los módulos y el
Web Worker necesitan HTTP; no abrir el HTML con `file://`.

## Recorrido de prueba

1. Comparar Puerto Claro con “Mejor equipo”: ambas sociedades tienen equipos viables.
2. Elegir “Alcanzar una meta” e introducir 300. Se propone el menor PPP que alcanza
   la meta, con un máximo disponible separado de la selección por objetivo.
3. Probar 450: la demo informa que la meta no se alcanza y muestra el máximo.
4. Reservar Aurora y cambiar a Sierra Azul. Sus fechas se cruzan y sus alternativas
   se reducen; la otra sociedad conserva su disponibilidad.
5. Elegir Valle Norte: el personal reservado para enero/febrero puede volver a
   participar en marzo/abril; el presupuesto de experiencia sigue comprometido.
6. Deshacer reservas, reiniciarlas y exportar el escenario como JSON.
7. Probar teclado, tema oscuro y ancho de móvil. Los mensajes de validación viven
   junto al campo, y los cambios del cálculo se anuncian con un estado accesible.

## Modelo y límites

- Dos sociedades ficticias, 19 perfiles por sociedad y tres entidades ficticias.
- Se asigna exactamente la cantidad de personas de cada cargo exigida por entidad.
- Cada perfil cumple cargo, experiencia mínima y horas de ambas visitas. Los
  perfiles habilitados para dos cargos solo pueden ocupar uno en el mismo equipo.
- `PPP = Σ(puntaje individual × horas asignadas) / Σ(horas asignadas)`.
  Los expertos son necesarios pero se excluyen de ambas sumas.
- “Mejor equipo” maximiza PPP. “Alcanzar una meta” minimiza PPP sujeto a `PPP ≥ meta`;
  si no hay solución, muestra el máximo disponible e informa el incumplimiento.
- Las combinaciones teóricas son el producto de las combinaciones por cargo antes
  de verificar disponibilidad, experiencia y duplicación de personas. No son
  equipos viables ni probabilidades. Los expertos pueden generar varios equipos
  distintos con el mismo PPP.
- El motor recorre exactamente todas las asignaciones viables del pequeño conjunto
  público. Evita permutaciones redundantes dentro de cada cargo y devuelve un
  resultado determinista, incluso en empates. Se ejecuta en un Web Worker con
  alternativa en el hilo principal si el navegador no soporta workers de módulos.
- Una reserva bloquea a las personas para todo escenario que tenga alguna visita
  superpuesta; es una aproximación conservadora, sin calendario diario.
- Las unidades de experiencia de la sociedad son un presupuesto didáctico que se
  reserva por entidad. No significa que la experiencia profesional real se consuma.
- Las reservas sucesivas no optimizan globalmente toda una cartera de entidades.
- No se modelan reglas oficiales, documentación, sustituciones, consorcios ni
  propuesta económica. El PPP no es una probabilidad de ganar. Esta demo no valida
  ofertas ante la Contraloría ni está afiliada a ella.

## Archivos

- `data.js`: fixtures sintéticos originales y requisitos visibles.
- `engine.js`: búsqueda exacta, validación de reservas y cálculo del PPP.
- `worker.js`: ejecución del motor fuera del hilo de la interfaz.
- `app.js`: interacción, reservas en memoria y exportación.
- `index.html`, `styles.css`, `favicon.svg`: presentación accesible, responsive,
  temas claro/oscuro y barras de desplazamiento coherentes.
- `tests/engine.test.js`: pruebas del cálculo y las restricciones.

## Verificación

```sh
npm test
npm run check
```

Las pruebas incluyen un oráculo pequeño independiente, PPP ponderado, expertos,
conteo sin permutaciones, meta alcanzable e inalcanzable, cruces de visitas,
personas habilitadas para dos cargos, presupuesto, reservas obsoletas y liberación.
No se presenta un benchmark de esta demo como mejora medida del motor privado.

## Publicación

El runtime público se compone únicamente de:

```text
index.html
styles.css
app.js
data.js
engine.js
worker.js
favicon.svg
```

Puede servirse desde la raíz o una subcarpeta: todas sus importaciones son relativas.
La web personal lo integra en `/demos/escenarios/` copiando esa lista exacta dentro de
`public/demos/escenarios/`, sin marcos de terceros ni iframes. No se publican dependencias,
resultados de pruebas o archivos del proyecto privado. Al modificar la demo,
repetir las pruebas y sincronizar esos siete archivos con el portfolio.

## Privacidad

Ver [PRIVACIDAD.md](./PRIVACIDAD.md). La aplicación no solicita información real,
no hace peticiones de datos, no usa cookies ni analítica y no guarda reservas tras
recargar la página. El alojamiento estático puede conservar sus propios registros
normales de acceso web.
