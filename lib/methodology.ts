// Metodología UDECA — base de conocimiento del coach (solo lectura).
// Generado a partir de la base de datos del CEO. Contenido privado del entrenador.

export type MethodBlockKind = 'heading' | 'text' | 'row';
export interface MethodBlock {
  kind: MethodBlockKind;
  text?: string;
  cells?: string[];
}
export interface MethodSection {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  blocks: MethodBlock[];
}

/** Orden de categorías en la biblioteca. */
export const METHOD_CATEGORIES: string[] = ["Metodología", "Fundamentos", "Planche", "Next Level Planche", "Front Lever", "Élite"];

export const METHODOLOGY: MethodSection[] = [
{
"id": "metodologia-programacion-metodos-base",
"category": "Metodología",
"title": "Programación (métodos base)",
"subtitle": "Metodologia propia del coach para disenar plannings. Formato de rutina y estructura semanal en la hoja \"Metodologia - Formato Rutina\".",
"blocks": [
{
"kind": "row",
"cells": [
"Concepto / Metodo",
"Descripcion"
]
},
{
"kind": "row",
"cells": [
"Evolucion binaria (ciclo permanente)",
"1) Acumular volumen y fuerza permitiendo forma imperfecta si hace falta. 2) Corregir la forma con la base de fuerza ganada. 3) Volver a descuidar la forma para subir un escalon mas de volumen. 4) Repetir indefinidamente, siempre un escalon mas arriba. Nunca sacrificar volumen total por forma en fase de acumulacion; la forma perfecta se trabaja al final de sesion o en sesiones tecnicas especificas."
]
},
{
"kind": "row",
"cells": [
"Submaximas (metodo principal de acumulacion)",
"60-75% del maximo de reps limpias, forma perfecta, sin fallo. Descanso 2-2.5 min. Progresion: +1 rep o +1 serie cada 1-2 semanas."
]
},
{
"kind": "row",
"cells": [
"GTG (Grease the Groove)",
"40-50% del maximo, 4-5 veces/semana, sin fatiga acumulada. Solo para elementos que el cliente esta aprendiendo."
]
},
{
"kind": "row",
"cells": [
"Combo method (Davai)",
"Encadena elementos de mas dificil a mas facil; la forma puede degradarse; alterna grupos musculares. Descanso 4-5 min entre combos."
]
},
{
"kind": "row",
"cells": [
"XXX (intermedio-avanzado)",
"3 variantes del mismo elemento encadenadas (push-press-hold o equivalente en tiron), maxima explosividad en la fase dinamica. Rotar el orden segun la variante debil: hold debil -> hold-push-press; press debil -> press-hold-push; push debil -> push-press-hold (orden estandar). 2-3 intentos, 7-10 min de descanso entre intentos."
]
},
{
"kind": "row",
"cells": [
"XXXX (avanzado, solo si el XXX se estanca)",
"Anade un cuarto elemento de mayor dificultad antes del XXX para generar fatiga previa, reduciendo la pausa cada 2 semanas."
]
},
{
"kind": "row",
"cells": [
"Goma elastica",
"Ligera, que simplifique el movimiento sin eliminar el esfuerzo real; se retira progresivamente con nudos ajustables."
]
},
{
"kind": "row",
"cells": [
"Spam",
"Series largas con forma decreciente. Solo en semanas 5-6 del bloque, dias de buenas sensaciones, y solo en elementos base ya consolidados."
]
},
{
"kind": "row",
"cells": [
"EMOM",
"Resistencia de fuerza; usar solo al final de sesion, maximo 10 minutos."
]
},
{
"kind": "row",
"cells": [
"Lastre (avanzado)",
"Solo en elementos base ya consolidados; reduce las repeticiones en proporcion al peso anadido."
]
},
{
"kind": "row",
"cells": [
"RIR (Reps in Reserve)",
"Cada ejercicio principal lleva un RIR objetivo: normalmente 1-2 en trabajo de fuerza/tecnica, 0-1 en el ejercicio mas accesorio del dia. El RIR sustituye a la exactitud absoluta de repeticiones: junto con un rango de reps/segundos, define la autorregulacion de la serie."
]
}
]
},
{
"id": "metodologia-estructura-semanal-y-bloques",
"category": "Metodología",
"title": "Estructura semanal y bloques",
"subtitle": "Intensidad siempre antes que volumen dentro de la semana. Usar esta plantilla de tabla para escribir cualquier rutina de cliente.",
"blocks": [
{
"kind": "row",
"cells": [
"Aspecto",
"Descripcion"
]
},
{
"kind": "row",
"cells": [
"Estructura semanal - 6 dias",
"Lunes: empuje intensidad/XXX/tecnico. Martes: tiron intensidad/XXX/tecnico. Miercoles: descanso. Jueves: empuje volumen submaximo. Viernes: tiron volumen submaximo. Sabado: sesion fuerte mixta. Domingo: GTG suave / feeling workout."
]
},
{
"kind": "row",
"cells": [
"Estructura semanal - 5 dias",
"Lunes: empuje intensidad. Martes: tiron intensidad. Miercoles: descanso. Jueves: empuje volumen. Viernes: tiron volumen. Fin de semana: 1 dia fuerte mixto + 1 descanso."
]
},
{
"kind": "row",
"cells": [
"Estructura semanal - 4 dias",
"Lunes: empuje intensidad/XXX. Martes: tiron intensidad/XXX. Jueves: empuje volumen + tecnico. Viernes: tiron volumen + tecnico."
]
},
{
"kind": "row",
"cells": [
"Estructura semanal - 3 dias",
"Dia A: mixto intensidad. Dia B: empuje volumen + tecnico. Dia C: tiron volumen + tecnico. Minimo 1 dia de descanso entre sesiones."
]
},
{
"kind": "row",
"cells": [
"Estructura de un bloque (8 semanas)",
"Semanas 1-2: cargas base (sensaciones y tecnica). Semanas 3-4: progresion (+1 rep/serie). Semanas 5-6: microciclo de fuerza bruta (Spam + EMOM en dias buenos). Semana 7: deload (50% volumen, sin intensidad). Semana 8: test general (maximas limpias, grabar y comparar con el inicio del bloque)."
]
},
{
"kind": "row",
"cells": [
"Adaptacion - Principiante",
"Sin XXX, XXXX ni lastre. Base: planche lean, tuck planche, tuck front lever. GTG para los primeros holds. Maximo 4 dias/semana. Submaximas como unico metodo de volumen. Handstand y L-sit como descanso activo. Error comun: ir demasiado rapido a variantes completas."
]
},
{
"kind": "row",
"cells": [
"Adaptacion - Intermedio",
"Submaximas como metodo principal. GTG para el siguiente nivel de cada cadena. XXX solo cuando tenga hold + push-up + press con buena forma en full planche. Combo method para subir volumen sin subir reps maximas. Error comun: no aislar el hold."
]
},
{
"kind": "row",
"cells": [
"Adaptacion - Avanzado",
"XXX como herramienta principal, rotando el orden. XXXX si el XXX se estanca 6-8 semanas. Lastre en elementos ya consolidados. GTG para elementos nuevos de la siguiente cadena. Error comun: no rotar el orden del XXX."
]
},
{
"kind": "row",
"cells": [
"Lesiones - lesion activa",
"El plan se disena completamente alrededor de la lesion; nunca forzarla."
]
},
{
"kind": "row",
"cells": [
"Lesiones - lesion pasada",
"Identificar si el movimiento agrava la lesion antigua y sustituir o modificar el ejercicio en consecuencia."
]
},
{
"kind": "row",
"cells": [
"Formato de rutina - encabezado",
"Cada dia se encabeza con el nombre del dia y una etiqueta corta de la sesion (ej. FRONT para tiron, PLANCHA para empuje, MIXTO, DESCANSO ACTIVO, ENTRENAMIENTO LIBRE, DESCANSO)."
]
},
{
"kind": "row",
"cells": [
"Formato de rutina - columnas de tabla",
"Usar siempre estas columnas exactas: EJERCICIO | SERIES | RANGO REPS / SEGUNDOS | RIR | DESCANSO."
]
},
{
"kind": "row",
"cells": [
"Formato de rutina - reglas",
"El rango de reps/segundos debe ser estrecho (maximo 4-5 de spread, ej. '4-8', '6-12'), nunca tan amplio que pierda sentido de prescripcion. El RIR siempre se indica como numero exacto (0, 1 o 2), nunca 'bajo' o 'alto'. El descanso baja a medida que el ejercicio es mas accesorio dentro del dia (el primero suele llevar 3-4 min; el ultimo accesorio, 1-2 min). Los ejercicios de hold + dinamica van primero (frescos); los accesorios de bombeo al final. Elementos de tiempo fijo sin series/reps variables (ej. 'Pino 5 min') se anotan en la fila de SERIES con la duracion total, dejando las demas columnas en blanco."
]
},
{
"kind": "text",
"text": "EJEMPLO REAL DE REFERENCIA (bloque de atleta intermedio-avanzado, sesion de tiron)"
},
{
"kind": "row",
"cells": [
"EJERCICIO",
"SERIES",
"RANGO REPS/SEG",
"RIR",
"DESCANSO"
]
},
{
"kind": "row",
"cells": [
"Hold front + 1 press",
"3",
"4-8",
"2",
"4 min"
]
},
{
"kind": "row",
"cells": [
"Pull-ups en tuck",
"3",
"3-8",
"2",
"4 min"
]
},
{
"kind": "row",
"cells": [
"Hold touch en tuck",
"3",
"5-8",
"2",
"3 min"
]
},
{
"kind": "row",
"cells": [
"Pull-ups en remo",
"2",
"6-12",
"1",
"1 min 30 s"
]
},
{
"kind": "text",
"text": "COMO ENCAJAR EL CONTENIDO EN CADA DIA (plantilla semanal - esqueleto por defecto, no obligacion)"
},
{
"kind": "row",
"cells": [
"Empuje intensidad",
"Ejercicios/combos del Step o modulo NLP del cliente, o una combinacion libre centrada en su debilidad o en su perfil de fuerza (equilibrado/muerta/empuje). Aqui va el XXX de empuje si el nivel lo permite."
]
},
{
"kind": "row",
"cells": [
"Empuje volumen",
"Combos largos del mismo Step, con banda si el Step aun la requiere (Steps II-IV la llevan por defecto)."
]
},
{
"kind": "row",
"cells": [
"Tiron intensidad",
"Metodo Combo o Dropset del catalogo Front Lever (solo uno de los dos por dia), del nivel correspondiente, o power moves si el cliente ya esta en Front Lever Nivel 2."
]
},
{
"kind": "row",
"cells": [
"Tiron volumen",
"Bloque de Fuerza (Muscle Strengthening) de Front Lever, al final de sesion tras 5-10 min de descanso del bloque principal."
]
},
{
"kind": "row",
"cells": [
"Sabado / sesion fuerte mixta",
"Un combo de empuje y uno de tiron del nivel del cliente, secuenciados (nunca mezclados dentro del mismo ejercicio)."
]
},
{
"kind": "row",
"cells": [
"Domingo GTG / feeling workout",
"Para clientes desde nivel intermedio en adelante, se sustituye por autorregulacion o por 'testeo de nuevas habilidades + refuerzo ligero'."
]
},
{
"kind": "text",
"text": "AUTORREGULACION - VERSION GENERAL (desde nivel intermedio: Steps III+ / Front Lever Normal+)"
},
{
"kind": "row",
"cells": [
"Como empezar la sesion",
"En cualquier sesion de progresion, empezar por el maximo del dia (hold, press o combo, no tiene por que ser un hold) para calibrar como llega el cliente, y elegir despues una de tres vias segun el resultado."
]
},
{
"kind": "row",
"cells": [
"Via: Baja intensidad",
"Cuando: lejos del rendimiento habitual, cansado fisica o mentalmente. Contenido: refuerzo con goma + trabajo de fuerza accesorio, sin buscar nada nuevo ese dia."
]
},
{
"kind": "row",
"cells": [
"Via: Intensidad media",
"Cuando: energia normal. Contenido: 3-5 ejercicios accesorios centrados en la debilidad actual del cliente."
]
},
{
"kind": "row",
"cells": [
"Via: Alta intensidad",
"Cuando: el maximo del dia salio bien / energia alta. Contenido: encadenar combinaciones para acumular volumen sobre elementos ya dominados."
]
},
{
"kind": "row",
"cells": [
"Alcance de la autorregulacion",
"No sustituye la plantilla semanal: decide el contenido del 50-100% de una sesion ya calendarizada, no si se entrena o no."
]
},
{
"kind": "text",
"text": "AUTORREGULACION - CRITERIOS DE DECISION SITUACIONAL (aplican a cualquier nivel)"
},
{
"kind": "row",
"cells": [
"2-3 sesiones seguidas de bajo rendimiento",
"Tomar 2-3 dias de descanso consecutivos, aunque no toque en la plantilla."
]
},
{
"kind": "row",
"cells": [
"Dolor persistente en una zona concreta",
"Sustituir el ejercicio o cambiar de agarre, nunca insistir; si el dolor no es puntual, tratarlo como lesion."
]
},
{
"kind": "row",
"cells": [
"Cliente estancado 6-8 semanas en el mismo XXX o Step/nivel",
"Introducir XXXX, cambiar el orden del XXX, o rotar hacia contenido personalizado en vez de repetir el mismo combo."
]
},
{
"kind": "row",
"cells": [
"Cliente con energia muy alta y buen historial reciente",
"Aprovechar para adelantar el test de subida de Step/nivel en vez de esperar a la semana 8."
]
},
{
"kind": "row",
"cells": [
"Cliente que entrena solo y pierde motivacion",
"Sugerir 1 sesion/semana en compania, sin que sustituya el resto de sesiones individuales."
]
},
{
"kind": "text",
"text": "AUTORREGULACION - VERSION AVANZADA (solo Next Level Planche / Front Lever Nivel 4 en adelante)"
},
{
"kind": "row",
"cells": [
"Estructura general",
"El bloque de volumen + control clasico pasa a ser el 50% de la sesion; el otro 50% se elige segun como llegue el cliente ese dia ('entrenar por sensacion')."
]
},
{
"kind": "row",
"cells": [
"Dia con FUERZA pero POCO CONTROL",
"Volumen XXX/XXXX + flexiones a press + max spam, luego combinaciones cortas probando agarres nuevos, cierre tecnico."
]
},
{
"kind": "row",
"cells": [
"Dia con CONTROL pero POCA FUERZA",
"Combinaciones cortas, trabajo de una transicion concreta + equilibrio, cierre con trabajo corto/deadstop y forma limpia con elastico."
]
},
{
"kind": "row",
"cells": [
"Nota",
"Esto no sustituye el diagnostico inicial: se usa solo para modular el dia a dia una vez que el bloque ya esta disenado."
]
}
]
},
{
"id": "metodologia-diagnostico-inicial",
"category": "Metodología",
"title": "Diagnóstico inicial",
"subtitle": "Base para toda prescripcion: diagnostico previo al cliente (cruzado con Steps de Planche y niveles de Front Lever), protocolo de calentamiento fijo (5 partes) y vocabulario tecnico basico.",
"blocks": [
{
"kind": "row",
"cells": [
"Aspecto",
"Descripcion"
]
},
{
"kind": "heading",
"text": "DIAGNOSTICO INICIAL DEL CLIENTE (antes de prescribir nada)"
},
{
"kind": "row",
"cells": [
"Regla previa",
"Si no se dispone de una ficha del cliente o los datos son insuficientes, no se asume un nivel por defecto. Se recopila primero: tiempo real de experiencia, marcas concretas en los elementos base de empuje y tiron, elementos ya dominados con forma limpia, dias/material disponibles y lesiones. No se prescribe nada hasta tener esta informacion."
]
},
{
"kind": "row",
"cells": [
"Nivel real",
"Se determina segun las marcas objetivas del cliente (ver 'Tabla de equivalencia de niveles' mas abajo), no segun lo que el atleta declara."
]
},
{
"kind": "row",
"cells": [
"Cadena mas debil",
"Identificar si es empuje o tiron, y cual es el desequilibrio mas critico a resolver en los proximos 3 meses. Ver hoja 'Como Personalizar Libremente' para el metodo segun el perfil detectado."
]
},
{
"kind": "row",
"cells": [
"Puntos fuertes y debiles",
"Identificar un punto fuerte y hasta 3 puntos debiles, ordenados de mas a menos critico. Sirve de base para decidir, junto al cliente, entre especializar (reforzar fortalezas) o equilibrar (trabajar tambien las debilidades) - ver 'Mentalidad y Filosofia'."
]
},
{
"kind": "row",
"cells": [
"Perfil de fuerza en planche",
"Determinar si el cliente es Equilibrado, Fuerza muerta (tipo A, caderas bajas/banana, mejor en push-ups que en press) o Fuerza de empuje (tipo B, caderas altas/pike, mejor en press que en push-ups). Condiciona el agarre en paralelas, la colocacion de la banda/lastre y las variantes a priorizar. Ver tabla 'Perfiles de fuerza en planche' en la hoja 'Planche - Galeria Ampliada'."
]
},
{
"kind": "row",
"cells": [
"Punto debil de forma en Front Lever",
"Revisar en orden: 1) piernas (rodillas extendidas, pies) 2) cabeza 3) pelvis 4) retraccion escapular 5) brazos completamente bloqueados. Corregir un elemento a la vez, nunca todos a la vez. Ver 'Orden de correccion de forma' en la hoja 'FL - Filosofia y Tecnica'."
]
},
{
"kind": "row",
"cells": [
"Elemento de mayor impacto",
"El que esta realmente al alcance del atleta en el corto-medio plazo (no el mas vistoso)."
]
},
{
"kind": "row",
"cells": [
"Limitaciones",
"De tiempo o material que condicionan el diseno del bloque de entrenamiento (dias/semana disponibles, acceso a banda elastica, barra, paralelas o anillas)."
]
},
{
"kind": "text",
"text": "TABLA DE EQUIVALENCIA DE NIVELES (nivel general -> Step Planche -> Nivel Front Lever -> metodo principal -> hojas a consultar)"
},
{
"kind": "row",
"cells": [
"Principiante",
"EMPUJE: Step I 'Base' (sin base de fuerza previa) o Step II 'Beginning of the straddle' (deportista nuevo en planche, banda en straddle) -> hojas 'Planche - Steps' y 'Planche - Ejercicios'. TIRON: catalogo 'Facil (Easy)' (Australian pull-up, L-sit, tuck front lever) + Programa Nivel 1 -> hojas 'FL - Catalogo Ejercicios' y 'FL - Programas L1-L4'. Prerrequisito de Front Lever: 5 dominadas estrictas + 15 Australian pull-ups. METODO PRINCIPAL (ver 'Metodologia - Estructura' - Adaptacion Principiante): sin XXX, XXXX ni lastre; GTG para los primeros holds; submaximas como unico metodo de volumen; maximo 4 dias/semana; handstand y L-sit como descanso activo. Error comun a vigilar: ir demasiado rapido a variantes completas."
]
},
{
"kind": "row",
"cells": [
"Intermedio",
"EMPUJE: Step III 'Bad form to clean straddle' o Step IV \"Clean straddle to 'full'\" -> hojas 'Planche - Steps', 'Planche - Ejercicios' y 'Planche - Combos'. TIRON: catalogo 'Normal' + Programas Nivel 1-2 (tuck / advanced tuck / one leg front lever) -> hojas 'FL - Catalogo Ejercicios' y 'FL - Programas L1-L4'. METODO PRINCIPAL (ver 'Metodologia - Estructura' - Adaptacion Intermedio): submaximas como metodo principal; GTG para el siguiente nivel de cada cadena; XXX solo cuando el cliente tenga hold + push-up + press con buena forma en full planche; combo method para subir volumen sin subir reps maximas; identificar el perfil de fuerza en planche y decidir con el cliente si especializar o equilibrar (equilibrar por defecto). Autorregulacion general ya aplicable desde este nivel. Error comun a vigilar: no aislar el hold."
]
},
{
"kind": "row",
"cells": [
"Avanzado (entrada)",
"EMPUJE: Step V \"'Full' to Full Planche\" (foco 100% en control y propiocepcion fina) -> hojas 'Planche - Steps' y 'Planche - Ejercicios'. TIRON: catalogo 'Dificil (Difficult)' + Programa Nivel 3 (one leg front lever consolidado) -> hojas 'FL - Catalogo Ejercicios' y 'FL - Programas L1-L4'. METODO PRINCIPAL (ver 'Metodologia - Estructura' - Adaptacion Avanzado): XXX como herramienta principal rotando el orden; XXXX si el XXX se estanca 6-8 semanas; lastre solo en elementos ya consolidados; GTG para elementos nuevos de la siguiente cadena; programar segun el perfil de fuerza especifico del cliente. Error comun a vigilar: no rotar el orden del XXX."
]
},
{
"kind": "row",
"cells": [
"Avanzado (alto nivel)",
"EMPUJE: Next Level Planche, Modulos 6-8 (NLP1 -> NLP2 -> NLP3, de Full a 555) y Formatos Avanzados (Modulos 9-10) -> hojas 'NLP - Filosofia', 'NLP - Progresion 1-3' y 'NLP - Formatos Avanzados'. TIRON: Programa Nivel 4 (front lever completo) -> Front Lever Nivel 2 / power moves (press, pull-up, touch), solo con front lever estatico solido y tecnica basica consolidada -> hojas 'FL - Programas L1-L4', 'FL - N2 Filosofia y Tecnica' y 'FL - N2 Rutinas Ejemplo'. METODO PRINCIPAL (ver 'Metodologia - Estructura' - Autorregulacion Version Avanzada): el bloque de volumen + control clasico pasa a ser solo el 50% de la sesion, el resto se elige 'entrenando por sensacion' (dia con fuerza pero poco control vs. dia con control pero poca fuerza). Usar 'Planche - Galeria Ampliada' y 'FL - Galeria Ampliada' para diversificar agarres, superficies y romper el estancamiento. Si hay disponibilidad horaria, valorar 2 entrenamientos al dia."
]
},
{
"kind": "row",
"cells": [
"Prerrequisito de Front Lever",
"Si el cliente no cumple el prerrequisito (5 dominadas estrictas + 15 Australian pull-ups), se programa esa base antes de asignarle ningun nivel del catalogo de Front Lever (ver 'FL - Filosofia y Tecnica')."
]
},
{
"kind": "row",
"cells": [
"Criterio alternativo mas exigente",
"Para partir con mas margen de seguridad: 15+ dominadas estrictas y 20+ segundos de L-sit antes de empezar tuck front lever. 20+ segundos de tuck front lever antes de pasar a nivel intermedio. 10+ segundos de front lever a una pierna antes de pasar a nivel avanzado. El Front Lever Nivel 2 (power moves) solo se aborda con front lever estatico solido y tecnica basica ya consolidada."
]
},
{
"kind": "row",
"cells": [
"Conexion con Ficha Cliente",
"Una vez completado este diagnostico, trasladar las conclusiones a la hoja 'Ficha Cliente': Step de inicio recomendado (I-V), nivel de programa Front Lever recomendado (1-4) y punto debil principal, para construir el planning semanal personalizado (ver tambien 'Metodologia - Estructura' para la estructura semanal y de bloque)."
]
},
{
"kind": "text",
"text": "PROTOCOLO DE CALENTAMIENTO (5 partes, ~20 minutos) - estructura fija, contenido adaptable al cliente"
},
{
"kind": "row",
"cells": [
"Regla general",
"Independientemente del nivel del cliente, la sesion empieza siempre por la parte mas facil del entrenamiento, nunca por lo mas dificil. Objetivo: llegar a la primera serie de trabajo sintiendose caliente, con energia y mentalmente enfocado, nunca fatigado."
]
},
{
"kind": "row",
"cells": [
"1. Cardiovascular (~5 min, baja intensidad)",
"Comba, carrera suave, burpees u otro ejercicio de eleccion, solo para elevar la temperatura corporal general."
]
},
{
"kind": "row",
"cells": [
"2. Articular (sin resistencia)",
"15-20 repeticiones por ejercicio en hombros, codos y munecas (las articulaciones mas exigidas en planche y front lever). Con banda ligera (5-15 kg de tension), preparar especificamente el manguito rotador."
]
},
{
"kind": "row",
"cells": [
"3. Muscular",
"Ejercicios de peso corporal que el cliente ya domina bien (push-ups, dips, pull-ups, scapula push-ups, elevaciones de piernas colgado, hollow body, elevaciones de hombro). Nunca ejercicios nuevos o exigentes aqui, para no restar energia a la sesion real. Opcional: trabajo ligero con carga externa (Zanetti, curl, flexion de munecas) con foco en ejecucion, no en peso."
]
},
{
"kind": "row",
"cells": [
"4. Estiramiento de la zona de trabajo",
"Priorizar munecas, hombros, espalda, zona lumbar, antebrazos y cuello (aun mas importante antes de front lever); complementar con movilidad (baston) o automasaje (rodillo/pelota)."
]
},
{
"kind": "row",
"cells": [
"5. Sobrecarga progresiva",
"Series con goma elastica para activar el patron motor y la propiocepcion antes de la primera serie real de trabajo; si el cliente ya se siente listo, puede saltar directamente a la primera serie de la sesion."
]
},
{
"kind": "text",
"text": "GLOSARIO DE TERMINOS (referencia rapida para explicar vocabulario tecnico a un cliente principiante)"
},
{
"kind": "row",
"cells": [
"Hold",
"Mantener la posicion estatica."
]
},
{
"kind": "row",
"cells": [
"Press",
"Subir desde la posicion (ej. planche) hasta el handstand."
]
},
{
"kind": "row",
"cells": [
"Push-up (en la figura)",
"Flexion ejecutada dentro de la posicion estatica."
]
},
{
"kind": "row",
"cells": [
"Negative",
"Bajar desde una posicion mas dificil hacia la de trabajo (lo opuesto al press)."
]
},
{
"kind": "row",
"cells": [
"Deadstop",
"Pausa completa cortando la tension antes de un push-up o press."
]
},
{
"kind": "row",
"cells": [
"PR",
"Record personal: maximo rendimiento conseguido."
]
},
{
"kind": "row",
"cells": [
"Deload",
"Semana de reduccion voluntaria de intensidad para recuperar el sistema nervioso."
]
},
{
"kind": "row",
"cells": [
"RIR",
"Reps in Reserve: repeticiones de margen antes del fallo tecnico (ver 'Metodologia - Programacion')."
]
},
{
"kind": "row",
"cells": [
"GTG",
"Grease the Groove: practica frecuente a baja intensidad (40-50% del maximo) para automatizar un patron motor nuevo (ver 'Metodologia - Programacion')."
]
}
]
},
{
"id": "fundamentos-mentalidad-y-filosofia",
"category": "Fundamentos",
"title": "Mentalidad y filosofía",
"subtitle": "Principios generales de calistenia, aplicables a cualquier movimiento (push y pull).",
"blocks": [
{
"kind": "row",
"cells": [
"Concepto",
"Descripcion"
]
},
{
"kind": "row",
"cells": [
"Seeking Emotions (buscar emociones)",
"El estado mental representa una parte fundamental del nivel (se estima que hasta un 70%). En vez de entrenar sin emocion, el objetivo es buscar y canalizar cualquier emocion (alegria, tristeza, rabia) y transformarla en energia de entrenamiento. Cada emocion es una oportunidad si se sabe gestionar."
]
},
{
"kind": "row",
"cells": [
"Visualizacion",
"Antes de intentar un movimiento, visualizarlo en el maximo detalle: cada fase, cada contraccion muscular, la postura perfecta, la respiracion. Segun estudios, se puede progresar tanto visualizando un movimiento como practicandolo fisicamente. Es mas efectiva cuando ya se domina la base tecnica del movimiento (sin comprension fisica previa, el cerebro no puede recrear bien las sensaciones)."
]
},
{
"kind": "row",
"cells": [
"Simplificar una habilidad",
"Convencerse mediante repeticion mental de que un movimiento dificil es en realidad facil y natural para uno mismo. Cambiar el dialogo interno de 'es imposible' a 'es superfacil, lo voy a hacer'. Aplica tambien a combos y repeticiones: no pensar en el limite, sino en que esta al alcance."
]
},
{
"kind": "row",
"cells": [
"Dias malos",
"Son inevitables y le pasan a todos los atletas, incluso a los avanzados. Estrategias: tomar 10-20 min para refocalizar; si no funciona, parar la sesion para no acumular frustracion; saltarse 1-2 sesiones al mes no afecta al progreso anual; hacer actividades fuera de la calistenia para descansar la mente; la autoconfianza es un pilar clave para afrontar estos dias."
]
},
{
"kind": "row",
"cells": [
"Establecer objetivos",
"Tener una vision clara del objetivo (atleta completo, nivel competitivo, especializacion en una figura, disfrute sin presion, salud/equilibrio fisico, o sensacion de fuerza) estructura el tipo de entrenamiento a seguir. Los objetivos pueden evolucionar; conviene redefinirlos regularmente. Combinar objetivos a corto plazo (motivacion diaria) con un objetivo a largo plazo ambicioso (vision guia)."
]
},
{
"kind": "row",
"cells": [
"Como mantener la motivacion",
"Mantener pensamientos positivos, fijar objetivos a corto plazo alcanzables y retadores, visualizar el objetivo a largo plazo, registrar y celebrar el progreso, usar musica, inspirarse en videos (propios y de otros atletas), entrenar con amigos ocasionalmente, y no temer 'perder' progreso durante un descanso (el sistema nervioso se regenera)."
]
},
{
"kind": "row",
"cells": [
"Disciplina",
"Compromiso de seguir el plan independientemente del estado de animo o motivacion del momento. Ni un pico de motivacion ni una bajada deben cambiar las acciones planificadas. Se construye poco a poco, sesion a sesion. Es lo que sostiene el progreso cuando la motivacion decae o desaparece a largo plazo."
]
},
{
"kind": "row",
"cells": [
"Calentamiento mental",
"Preparar la mente antes de cada sesion tanto como se prepara el cuerpo: despejar la mente (meditacion breve, respiracion), escuchar musica relajante o motivadora segun necesidad, visualizar movimientos y secuencias, trabajar la respiracion y gestion del estres, usar afirmaciones positivas ('estoy listo', 'voy a lograr este movimiento')."
]
},
{
"kind": "row",
"cells": [
"Divertirse (Have Fun)",
"La pasion y el disfrute son la clave real del progreso, mas alla de la estructura del entrenamiento. Variar regularmente los entrenamientos (nuevas transiciones, cambiar el orden de movimientos, entrenar en lugares distintos) evita la monotonia. Revisar y adaptar el plan cada pocos meses para introducir nuevos retos."
]
},
{
"kind": "row",
"cells": [
"Entrenar solo vs con amigos",
"Entrenar solo permite explorar los propios limites y desarrollar resiliencia; es la base del progreso individual. Entrenar con amigos (recomendado ~1 sesion/semana) aporta motivacion social y disfrute, aunque suele ser menos productivo en terminos de rendimiento puro. El equilibrio entre autonomia y motivacion social es clave."
]
},
{
"kind": "row",
"cells": [
"Entrenar 'by feel' (por sensacion)",
"A nivel avanzado, adaptar el entrenamiento segun el estado de animo y las sensaciones del dia en vez de seguir un programa rigido al pie de la letra (tiempos de descanso exactos, repeticiones fijas). No significa hacer cualquier cosa: sigue existiendo un marco general y objetivos a seguir."
]
},
{
"kind": "row",
"cells": [
"Puntos fuertes y debiles (push vs pull)",
"Hay personas predispuestas a movimientos de traccion (ej. front lever, retraccion natural) y otras a movimientos de empuje (ej. planche, maltes, protraccion natural). Es posible tener un punto fuerte y uno debil dentro de la MISMA figura (ej. buenos push-ups de planche sin poder sostener la full planche; front lever fuerte pero pull-up de front lever debil)."
]
},
{
"kind": "row",
"cells": [
"Especializarse vs equilibrar (push/pull)",
"Dos enfoques validos: (1) reforzar los puntos fuertes minimizando el trabajo de los debiles (especializacion), o (2) homogeneizar todos los aspectos incluyendo debilidades (equilibrio). Trabajar debilidades es menos gratificante psicologicamente pero necesario para un atleta completo; trabajar fortalezas es mas motivador y efectivo a corto plazo."
]
},
{
"kind": "row",
"cells": [
"Metodo paso a paso para equilibrar push y pull",
"Centrarse en un solo movimiento hasta el 100%, luego aparcarlo (aceptando una ligera regresion) y trabajar la debilidad de la misma forma. Progresar en push y pull simultaneamente es raro y dificil: evitar dividir el esfuerzo en cada sesion entre ambos tipos de movimiento hasta tener una base solida en cada uno. Solo cuando ambos son comodos, mezclar 50% push / 50% pull en la misma sesion, ajustando el reparto segun preferencias del momento (ej. 70/30 si se necesita reforzar una debilidad)."
]
}
]
},
{
"id": "fundamentos-tecnica-y-respiracion",
"category": "Fundamentos",
"title": "Técnica y respiración",
"subtitle": "TECNICA TRANSVERSAL - AGARRE, ERRORES DE FORMA Y SEGURIDAD ARTICULAR (Planche y Front Lever)",
"blocks": [
{
"kind": "text",
"text": "Aplicable a cualquier habilidad de calistenia (push y pull)."
},
{
"kind": "row",
"cells": [
"Concepto",
"Descripcion"
]
},
{
"kind": "row",
"cells": [
"Control motor - 7 factores",
"El control motor combina: fuerza, movilidad, propiocepcion, velocidad de ejecucion, precision, estabilidad y gestion de la energia. Dominar todos estos factores a la vez es la clave para acercarse a la perfeccion en un movimiento."
]
},
{
"kind": "row",
"cells": [
"Reforzar una habilidad - 3 pasos",
"1) Descomponer el movimiento en pasos y comprobar la movilidad necesaria; reducir la dificultad (variante mas facil o banda elastica) para maximizar consciencia y posicion. 2) Una vez comprendida la coordinacion/colocacion, aumentar la dificultad para construir fuerza. 3) Repetir, repetir, repetir: es lo que perfecciona el control motor. Cuidado: la mayoria del trabajo debe parecerse al objetivo final (no abusar de 'refuerzos' genericos esperando transferencia)."
]
},
{
"kind": "row",
"cells": [
"Potenciacion previa (pre-fatiga)",
"Fatigar el cuerpo con un ejercicio intenso relacionado justo antes de testear la habilidad objetivo, descansar ~5 min, y luego intentar el maximo. Ejemplo: 3 pull-ups a una pierna + pull-over a max hold front lever touch, descansar 5 min, testear max hold touch - el hold mejora notablemente tras la pre-fatiga."
]
},
{
"kind": "row",
"cells": [
"Variacion de velocidad (lento/explosivo)",
"Trabajar sistematicamente distintas velocidades (lento, deadstop, explosivo) desarrolla fluidez, control superior y mayor facilidad en los movimientos. Repeticiones lentas implican mas profundamente el musculo; las explosivas mejoran potencia y velocidad de reaccion. Se puede apoyar en musica, visualizando una coreografia sincronizada con el ritmo."
]
},
{
"kind": "row",
"cells": [
"Colocar el punto debil al final del combo",
"Situar el movimiento que se quiere reforzar al FINAL de la secuencia (cuando el cuerpo ya esta fatigado) en vez de al principio. Esto fuerza a usar mas fuerza y control bajo fatiga, mejorando el rendimiento de ese movimiento cuando se entrena aislado en otras sesiones. Ejemplo: hold front lever 3s - front lever raise x2 - pull-over - max front lever pull-up."
]
},
{
"kind": "row",
"cells": [
"Entrenar en 'mala forma' (bad form)",
"Al inicio de sesion (con energia fresca), priorizar la forma perfecta aunque sean pocos minutos o combos. Hacia la mitad/final de sesion, permitir voluntariamente que la forma se degrade para aumentar el volumen (ej. forzar 5 presses en mala forma, subir a 7-8-10, luego volver a 5 en forma limpia). Elegir bien QUE se permite degradar: nunca sacrificar la retraccion escapular en planche (esencial para estabilizar el hombro); si se puede ceder ligeramente en altura de piernas o retroversion pelvica incompleta."
]
},
{
"kind": "row",
"cells": [
"Combos de tension larga (long tension combos)",
"El objetivo es permanecer en tension continua sobre la barra/soporte el mayor tiempo posible, sin tocar el suelo, aunque implique mala forma o movimientos menos exigentes al final. Empezar con combos de 10-30s e ir extendiendolos a 40-60s. Usar transiciones inteligentes para liberar tension parcialmente sin soltar (ej. L-sit entre dos planches, pull-over entre dos front levers). Variar siempre el orden de los combos: el cuerpo se adapta rapido a rutinas repetidas."
]
},
{
"kind": "row",
"cells": [
"Mentalidad 'una o dos reps mas'",
"Fijar un objetivo al inicio de sesion y, mentalmente, apuntar mas alla de el (ej. objetivo real 5 pull-ups de front lever, visualizar 10). Esto prepara mente y cuerpo para un volumen mayor, facilitando alcanzar el objetivo real. Ejemplo cuantificado: anadir solo 2 reps extra por serie (4 sesiones/semana, 192 sesiones/ano) supone pasar de 1.760 a 3.520 repeticiones anuales - el doble de volumen acumulado."
]
},
{
"kind": "row",
"cells": [
"Respiracion - tipos",
"Respiracion toracica: enfocada en la parte alta del cuerpo, usada en esfuerzos simples o de resistencia sin gran implicacion del core. Respiracion abdominal/diafragmatica: la mas importante en calistenia, mantiene la presion intraabdominal y estabilidad del tronco necesarias para la resistencia de fuerza; consume menos energia que la toracica."
]
},
{
"kind": "row",
"cells": [
"Respiracion - regla general",
"Exhalar durante la contraccion muscular, inhalar durante la relajacion (aplica a push-ups, pull-ups, dips, etc.), manteniendo siempre respiracion abdominal (no toracica). Cuanto mas fuerte se es en un movimiento, mas natural se vuelve respirar durante su ejecucion."
]
},
{
"kind": "row",
"cells": [
"Respiracion en fuerza estatica",
"Los holds isometricos intensos (planche, front lever) provocan fases de apnea forzada inevitables a cualquier nivel. Cuanto mas se domina el movimiento, mejor se puede optimizar la respiracion en los segundos previos al final del hold. Apnea prolongada tiene riesgos (mareo, rotura de vasos pequenos) que hay que gestionar con la progresion."
]
},
{
"kind": "row",
"cells": [
"Respiracion en fuerza dinamica controlada",
"En movimientos con deadstop (ej. planche push-up con pausa), se suele inspirar brevemente en la fase descendente y exhalar ligeramente en el hold, manteniendo tension abdominal. Fases de menor exigencia (ej. press comodo, front lever raise en posicion alta) permiten respirar con mas normalidad y sirven para anadir volumen/variedad ahorrando energia."
]
},
{
"kind": "row",
"cells": [
"Respiracion en 'spam' (alto volumen)",
"Empezar la serie con apnea para estabilizar el cuerpo y fijar la trayectoria; cuando la estabilidad del core es optima, exhalar/inhalar brevemente sin perder esa estabilidad ni la trayectoria, se respire o no."
]
},
{
"kind": "row",
"cells": [
"Como optimizar la respiracion",
"Dos metodos practicos: (1) Grabarse en video sin sonido ambiente para escuchar claramente la propia respiracion y corregir; repetir la prueba varias veces. (2) Entrenar con banda elastica de resistencia media/alta: al reducir la carga, la mente puede prestar mas atencion a la respiracion en vez de estar centrada solo en la fuerza."
]
},
{
"kind": "row",
"cells": [
"Agarre y forma en planche - no hay un unico correcto",
"Tanto la forma (con o sin hollow back/arqueo) como el agarre (dentro, medio o fuera) son cuestion de preferencia individual y flexibilidad de base; probar y quedarse con lo mas comodo. Al empezar, el agarre en paralelas suele ser el mas facil (menos estres en tendon, mas implicacion de antebrazo/muneca)."
]
},
{
"kind": "row",
"cells": [
"Errores comunes de forma - planche",
"Protraccion escapular excesiva, falta de retroversion pelvica, brazos flexionados. La retraccion escapular (llevar los hombros hacia atras) es un error en planche: el hombro debe ir en protraccion."
]
},
{
"kind": "row",
"cells": [
"Errores comunes de forma - front lever",
"Flexionar la cadera, flexionar los brazos, no seguir la linea horizontal recta del cuerpo, retraccion o protraccion escapular excesiva, piernas no extendidas. Nunca sacrificar la calidad de ejecucion: es la via mas rapida de progreso."
]
},
{
"kind": "row",
"cells": [
"Estandar minimo de hold",
"Para que un hold cuente como logrado, debe sostenerse un minimo de 3 segundos en linea horizontal correcta (ni por encima ni por debajo del cuerpo alineado)."
]
},
{
"kind": "row",
"cells": [
"La cabeza guia la trayectoria",
"La posicion de la cabeza condiciona el rendimiento: meterla a mitad de un press facilita notablemente la subida."
]
},
{
"kind": "row",
"cells": [
"Nunca aguantar la respiracion por evitar exhalar",
"Si se retiene el aire sin necesidad, el limite lo marca la falta de oxigeno, no la fuerza. Exhalar antes de lanzar un hold de planche."
]
},
{
"kind": "row",
"cells": [
"Colocacion con banda elastica",
"Mantenerse detras de la barra o paralelas al trabajar con banda: si el cuerpo se coloca demasiado adelantado, la banda tira hacia atras durante el hold o el press."
]
},
{
"kind": "row",
"cells": [
"Salud articular",
"Soltar la barra o las paralelas de forma lenta y gradual al terminar un combo u hold (evita o agrava dolor de antebrazo). No usar munequeras/coderas de compresion para tapar el dolor: el dolor es una senal que hay que atender directamente (hielo en zona inflamada, bajar intensidad, reforzar especificamente esa zona), nunca entrenar a traves de el."
]
},
{
"kind": "row",
"cells": [
"Estilo de vida",
"Sueno, nutricion y estiramiento regular condicionan el rendimiento tanto como el propio entrenamiento."
]
}
]
},
{
"id": "fundamentos-metodos-de-entrenamiento",
"category": "Fundamentos",
"title": "Métodos de entrenamiento",
"subtitle": "Componentes basicos (volumen/intensidad/frecuencia) + 10 metodos/formatos de entrenamiento.",
"blocks": [
{
"kind": "heading",
"text": "COMPONENTES DEL ENTRENAMIENTO"
},
{
"kind": "row",
"cells": [
"Componente",
"Descripcion"
]
},
{
"kind": "row",
"cells": [
"Volumen",
"Cantidad total de trabajo en un periodo: numero de sesiones, series, repeticiones y tiempo bajo tension. Determina el nivel de estres y, indirectamente, la adaptacion. Existe un 'volumen minimo efectivo' (por debajo, no hay estimulo suficiente) y un 'volumen maximo recuperable' (por encima, el cuerpo no puede recuperar y el trabajo se vuelve contraproducente)."
]
},
{
"kind": "row",
"cells": [
"Intensidad",
"Nivel de esfuerzo relativo al maximo del atleta; representa la 'dificultad' del estres. A mayor intensidad, mayor respuesta corporal, pero tambien mayor fatiga central y riesgo de lesion si se abusa. Debe gestionarse con cuidado."
]
},
{
"kind": "row",
"cells": [
"Frecuencia",
"Ritmo general del trabajo: numero de sesiones/dias de descanso por semana, tiempos de descanso entre series, etc. La consistencia (frecuencia regular de estimulo) es clave para la adaptacion. Distribuir bien la energia evita el agotamiento prematuro dentro de una sesion o semana."
]
},
{
"kind": "heading",
"text": "TABLA: TIPOS DE ESFUERZO SEGUN VOLUMEN / INTENSIDAD / FRECUENCIA"
},
{
"kind": "row",
"cells": [
"Parametro",
"PERF VOLUME",
"RENFO VOLUME",
"PERF INTENSITY",
"RENFO TECHNIQUE"
]
},
{
"kind": "row",
"cells": [
"Parametros",
"Volumen +, Intensidad +, Frecuencia -",
"Volumen +, Intensidad -, Frecuencia +",
"Volumen -, Intensidad +, Frecuencia -",
"Volumen -, Intensidad -, Frecuencia +"
]
},
{
"kind": "row",
"cells": [
"Cualidades trabajadas",
"Fuerza + Resistencia de fuerza + Resistencia",
"Tecnica + Resistencia de fuerza + Resistencia",
"Fuerza + Tecnica",
"Tecnica + Resistencia"
]
},
{
"kind": "row",
"cells": [
"Tipo de fatiga",
"Nerviosa + Muscular",
"Muscular",
"Nerviosa",
"-"
]
},
{
"kind": "row",
"cells": [
"Reps por serie",
"5-20",
"10-30",
"1-5",
"1-3"
]
},
{
"kind": "row",
"cells": [
"Tiempo bajo tension / serie",
"15-45 s",
"20-50 s",
"3-10 s",
"5-10 s"
]
},
{
"kind": "row",
"cells": [
"Descanso entre series",
"5-10 min",
"1-3 min",
"4-6 min",
"1-2 min"
]
},
{
"kind": "heading",
"text": "METODOS Y FORMATOS DE ENTRENAMIENTO"
},
{
"kind": "row",
"cells": [
"Metodo",
"Descripcion"
]
},
{
"kind": "row",
"cells": [
"Combo Method (sesion de combos)",
"Encadenar al menos 3 movimientos de fuerza/equilibrio sin interrupcion ni soltar el soporte. Principiantes: empezar por lo mas dificil y acabar en lo mas facil. Avanzado: se puede alternar. Referencia: 7-15 combos por sesion, priorizando volumen sobre intensidad, con un reparto tipico de 50% push / 50% pull (ajustable segun debilidad, ej. 70% pull / 30% push)."
]
},
{
"kind": "row",
"cells": [
"Dropset Method",
"Reducir progresivamente la dificultad del ejercicio a lo largo de la serie, permitiendo descansos entre pasos (a diferencia del combo). Se usa con ejercicios ya dominados (ej. push-ups, pull-ups) en vez de power moves. Ejemplo: straddle planche push-up x4 - 5s descanso - x3 - 5s descanso - straddle planche max hold. Recomendado: ~5 series, repetidas 1-3 veces (5-15 series/sesion)."
]
},
{
"kind": "row",
"cells": [
"Potenciacion al inicio de sesion",
"Tecnica para aumentar temporalmente la fuerza de un grupo muscular justo despues del calentamiento, usando variantes mas dificiles, peso anadido (tobillos o cadera) o resistencia contra un obstaculo, cerca del maximo. El efecto dura pocos minutos (descansos de 2-5 min). Exigente: solo para atletas experimentados, no principiantes. Anadir peso en tobillos = mas dificultad/palanca (explosividad); peso en cadera = palanca mas natural (mas volumen, dificultad ligera)."
]
},
{
"kind": "row",
"cells": [
"Optimizacion especifica",
"Dedicar toda la sesion a un unico tipo de movimiento (ej. front lever pull-ups o planche press) para reforzar una debilidad, aislando y repitiendo con descansos. Se fija un numero total de repeticiones objetivo (ej. 100 front lever pull-ups) repartido en series segun el foco deseado (mas series/menos reps = mas tecnica; menos series/mas reps = mas volumen). No abusar: maximo 1 vez por semana por lo exigente que es."
]
},
{
"kind": "row",
"cells": [
"Testeo de nuevas habilidades + refuerzo ligero",
"Para dias de fatiga o baja energia: probar habilidades nuevas, explorar transiciones nuevas, y cerrar con refuerzo ligero de baja intensidad. Ideal tambien para principiantes que quieren testear sus fortalezas/debilidades y decidir en que metodos enfocarse."
]
},
{
"kind": "row",
"cells": [
"2 entrenamientos al dia (manana tiron - tarde mixto)",
"Aumenta el volumen total diario. Ejemplo de reparto: manana 100% tiron (combo o dropset); tarde 70% push / 30% pull. Requiere disponibilidad de horario y adaptacion a entrenar en momentos menos habituales."
]
},
{
"kind": "row",
"cells": [
"EMOM de refuerzo",
"Elegir un ejercicio con esfuerzo minimo de 15s y repetirlo cada minuto durante X minutos. Version facil: el descanso empieza al terminar el ejercicio (casi 1 min completo de descanso). Version dificil: el cronometro corre desde el inicio (cuanto mas tarda el ejercicio, menos descanso queda). Usar con movimientos ya dominados y de baja intensidad relativa, ya que el formato es muy exigente hacia el final."
]
},
{
"kind": "row",
"cells": [
"Refuerzo en circuito",
"Elegir 4-6 habilidades y encadenarlas sin descanso, con el maximo numero de series/holds en cada una. Empezar con movimientos dinamicos y terminar con holds mas simples. Muy efectivo para resistencia y preparacion de competicion; combina fuerza isometrica y dinamica."
]
},
{
"kind": "row",
"cells": [
"Refuerzo piramidal",
"Version 1 (clasica): subir 1-2 reps con descanso entre series hasta un numero maximo, luego bajar de nuevo (ej. 1-2-4-6 descanso, luego 4-2). Version 2 (mas intensa): alternar 2 habilidades subiendo 1 repeticion por serie SIN descanso hasta el fallo (ej. 1 pull-up - 1 push-up - 2 pull-ups - 2 push-ups...). Recomendado: 3 series piramidales hasta el fallo, enfocado en 1-2 movimientos."
]
},
{
"kind": "row",
"cells": [
"Refuerzo decreciente en un elemento especifico",
"Realizar el ejercicio empezando por el maximo de repeticiones/tiempo, reduciendo progresivamente con descansos entre series (las primeras series priorizan volumen, las ultimas priorizan tecnica/forma). Ejemplo: max push-ups (6) - 5 min descanso - 5 - descanso - ... hasta 1. Se recomienda un unico circuito (no repetir el ciclo completo)."
]
},
{
"kind": "row",
"cells": [
"Refuerzo con banda elastica (forma y tecnica)",
"Prioriza la forma y la comprension de la trayectoria sobre la intensidad/volumen, usando una banda de resistencia media para reducir la carga. Util para aprender habilidades nuevas o pulir la forma de un movimiento que se esta a punto de dominar. Ejemplo: ~5 series de max hold en planche con banda media, enfocado en mantener buena forma."
]
}
]
},
{
"id": "fundamentos-como-personalizar",
"category": "Fundamentos",
"title": "Cómo personalizar",
"subtitle": "Util como referencia rapida al rellenar la Ficha Cliente: cruzar el perfil de fortalezas/debilidades con el metodo recomendado (ver hoja \"Metodos de Entrenamiento\").",
"blocks": [
{
"kind": "row",
"cells": [
"Perfil",
"Aplicacion / Enfoque",
"Metodos a implementar"
]
},
{
"kind": "row",
"cells": [
"Sin elementos de push ni pull",
"Trabajar segun sensaciones para descubrir las habilidades que mas gustan y resultan mas comodas, y luego desarrollarlas al 100%.",
"Testeo de nuevas habilidades + refuerzo ligero"
]
},
{
"kind": "row",
"cells": [
"Habil en pull, quiere mejorar push",
"Sesiones compuestas por 80% movimientos de empuje (solo combinaciones de push) y 20% de traccion.",
"Combo Method o Dropset Method con 80% push / 20% pull"
]
},
{
"kind": "row",
"cells": [
"Habil en push, quiere mejorar pull",
"Sesiones compuestas por 80% movimientos de traccion (solo combinaciones de pull) y 20% de empuje.",
"Combo Method o Dropset Method con 80% pull / 20% push"
]
},
{
"kind": "row",
"cells": [
"Domina push-ups pero quiere progresar en press y planche holds",
"Trabajo especifico centrado en presses y holds. Ej. un EMOM enfocado solo en negativos o de hold a press.",
"Optimizacion especifica, EMOM de refuerzo, o Refuerzo decreciente en un elemento especifico"
]
},
{
"kind": "row",
"cells": [
"Domina front lever raises pero quiere mejorar pull-ups y front touch",
"Centrarse en pull-ups y holds de touch. Se pueden integrar pull-ups negativos a touch en el entrenamiento.",
"Optimizacion especifica, EMOM de refuerzo, o Refuerzo decreciente en un elemento especifico"
]
},
{
"kind": "row",
"cells": [
"Habil en push y pull pero le falta resistencia",
"Seguir trabajando ambos elementos, combinandolos para crear combos mas largos.",
"Combo Method, Refuerzo en circuito o Refuerzo piramidal"
]
},
{
"kind": "row",
"cells": [
"Comodo con push y pull pero menos con power moves",
"Dedicar una parte del entrenamiento exclusivamente a power moves, seguido de otro metodo para evitar intensidad excesiva.",
"Optimizacion especifica, Refuerzo con banda elastica (forma y tecnica)"
]
},
{
"kind": "row",
"cells": [
"Buena resistencia pero le falta explosividad",
"Reducir el volumen mientras se aumenta la intensidad, en particular anadiendo peso.",
"Sesion iniciada con Potenciacion al inicio de sesion"
]
},
{
"kind": "row",
"cells": [
"Habil en power moves pero le falta resistencia o fluidez",
"Centrarse en todos los metodos orientados a mejorar la resistencia.",
"Combo Method, Dropset Method, EMOM de refuerzo, Refuerzo piramidal, Refuerzo en circuito"
]
},
{
"kind": "row",
"cells": [
"Habil en push, pull, power moves y combos de resistencia",
"Entrenar con 2 sesiones al dia: una por la manana con peso anadido en el elemento a priorizar, y otra por la tarde centrada en combos y refuerzo, para maximizar el progreso.",
"Metodo de 2 entrenamientos al dia"
]
}
]
},
{
"id": "fundamentos-principios-de-resistencia",
"category": "Fundamentos",
"title": "Principios de resistencia",
"subtitle": "Principios transversales aplicables tanto a Planche como a Front Lever (empuje y traccion).",
"blocks": [
{
"kind": "row",
"cells": [
"Principio",
"Nivel",
"Descripcion"
]
},
{
"kind": "row",
"cells": [
"Visualizacion, proyeccion, relativizacion",
"Todos los niveles",
"Proyectarse (vivir y sentir el movimiento de antemano) es mas eficaz que solo 'visualizarlo'. Para superar un techo que ya no resulta coherente para el subconsciente, relativizar: buscar una via alternativa fiable (ej. reducir volumen y anadir peso con banda) que haga el objetivo creible de nuevo."
]
},
{
"kind": "row",
"cells": [
"Optimizacion corporal",
"Todos los niveles",
"El peso corporal y el % de grasa impactan directamente en el rendimiento; priorizar micronutrientes (vitaminas y minerales) ademas de macros, evitar alimentos procesados y agua con toxinas/disruptores endocrinos. El ayuno intermitente ayuda a limpiar el sistema digestivo y eliminar exceso de grasa/agua."
]
},
{
"kind": "row",
"cells": [
"Periodo de fuerza - periodo de forma",
"Todos los niveles",
"Proceso binario: primero ganar fuerza/volumen (80% del entrenamiento) con la forma como trabajo de fondo (20%), luego invertir la proporcion para pulir la forma. Regla: no se puede tener forma limpia sintiendose 'pesado'; primero aumentar fuerza, acostumbrarse al volumen, despues limpiar. Aplica a todos los niveles hasta el mas avanzado."
]
},
{
"kind": "row",
"cells": [
"Equilibrar el nivel de variantes",
"Todos los niveles",
"Cada persona tiene puntos fuertes/debiles (hold, flexion, press). Centrarse solo en una variante genera desequilibrios con las demas. Rotar el foco de forma logica y regular; en niveles intermedios/avanzados usar combos especificos que se centren en una variante mientras mantienen trabajo de fondo en las otras."
]
},
{
"kind": "row",
"cells": [
"El 3x (50% - 80% - 100%)",
"Principiante",
"Cuando aun no se puede alcanzar el esfuerzo maximo en un solo intento, realizar 3 repeticiones consecutivas: la primera al 50% del maximo (descanso 3-5s), la segunda al 80% (descanso 5-7s), la tercera al 100% real. El cuerpo memoriza la posicion mas rapido y se alcanza el verdadero esfuerzo maximo."
]
},
{
"kind": "row",
"cells": [
"Trabajo con forma degresiva",
"Medio a avanzado",
"Mantener siempre la forma perfecta impide ganar mas volumen a maxima intensidad (igual que un poderlevantador con 1RM no puede hacer directamente 2 reps al mismo peso). Solucion: repetir bajando progresivamente la calidad de ejecucion a lo largo de la serie o combo, corrigiendo despues los ultimos intentos de mala forma."
]
},
{
"kind": "row",
"cells": [
"Spam",
"Todos los niveles",
"Trabajo de alto volumen en una sola variante para ganar fuerza bruta. Principiante: puede apoyarse en rebote de piernas o salto. Avanzado: mejor trabajar de forma dinamica sin ayuda de piernas (mas rapido = menos perdida de resistencia). Cuidado: nunca perder la posicion/activacion de hombros al hacer spam; usar solo ocasionalmente, nunca en un dia de cansancio."
]
},
{
"kind": "row",
"cells": [
"Repeticiones parciales",
"Principiante y avanzado",
"Dos usos: (1) Acceder a un nuevo movimiento - trabajar solo el rango ya alcanzable, aguantar antes de caer, y repetir para ganar rango progresivamente (aplica igual a flexiones: rango corto solo para desbloquear/bloquear el codo). (2) Ganar resistencia - trabajar a medio rango (ej. 90 grados) para acumular mas repeticiones y facilitar despues el rango completo."
]
},
{
"kind": "row",
"cells": [
"EMOM (Every Minute On the Minute)",
"Medio a avanzado",
"Definir un numero fijo de repeticiones a realizar cada minuto durante X minutos (debe ser el maximo sostenible en ese tiempo). El objetivo es aumentar progresivamente la duracion total manteniendo el mismo numero de repeticiones, y despues subir el numero de repeticiones por minuto. Debe llevarse al fallo para ser efectivo; no abusar en la semana."
]
},
{
"kind": "row",
"cells": [
"Combos cortos (enfoque tecnico)",
"Medio a avanzado",
"Las transiciones suelen ser mas dificiles que el propio movimiento. Aislar una transicion problematica (ej. flexion a press) en un combo corto la hace mas fluida, lo que ahorra fuerza para el resto de una combinacion larga posterior. Ahorrar fuerza es ganar fuerza."
]
},
{
"kind": "row",
"cells": [
"Combos largos (enfoque en resistencia)",
"Medio a avanzado",
"3 reglas para una combinacion larga eficaz: 1) Presentar la tecnica de forma degresiva (dificil a facil). 2) Cambiar de grupo muscular a lo largo del combo para poder respirar/descansar activamente. 3) La forma tambien debe ser degresiva; intentar ejecutarlo todo perfecto impide ganar mas volumen."
]
},
{
"kind": "row",
"cells": [
"95% maximo a press / pushup",
"Medio a avanzado",
"Ejecutar un hold maximo y, justo antes de caer, encadenar un press + negativo o un pushup a hold. Requiere mantener la trayectoria correcta y la maxima altura posible. Se busca anadir un segundo al maximo previo en cada sesion."
]
},
{
"kind": "row",
"cells": [
"El XXX",
"Avanzado a profesional",
"El mejor principio para ganar resistencia segun el autor: combinar push-press-hold en distintos ordenes (push-hold-press, hold-press-push, etc.), permitiendo mala forma temporal para aumentar volumen y corrigiendola despues. Nunca lleva al estancamiento (se puede adaptar indefinidamente), permite trabajar todas las variantes principales a la vez, y es un 'juego' sin fin claro. Ejemplo desequilibrado: enfocar mas repeticiones en la variante mas debil (ej. hold) manteniendo trabajo de fondo en las demas."
]
},
{
"kind": "row",
"cells": [
"El XXXX",
"Avanzado+ a profesional+",
"Complementario al XXX y con la misma logica. Se usa a partir de un minimo de 555: se anade un primer movimiento relativo (ej. press maltes, planche a un brazo, plancha larga) ANTES del XXX habitual, para generar fatiga previa. Se progresa reduciendo la pausa entre el primer movimiento y el XXX (de 20s hasta 10s), y aumentando despues el numero de repeticiones del primer movimiento."
]
},
{
"kind": "row",
"cells": [
"Banda elastica lastrada",
"Avanzado a profesional",
"Anadir peso via banda elastica aumenta la intensidad y el control (movimiento mas duro e inestable), manteniendo al menos el 50% del volumen normal de trabajo. Nivel avanzado: ~5 kg ya es mucho mas duro. Nivel profesional: maximo ~15 kg (una banda de 25 kg es excesiva, no permite suficiente resistencia y es arriesgada). Hacerlo 1-3 veces por sesion, con grandes descansos (7-10 min)."
]
}
]
},
{
"id": "planche-filosofia",
"category": "Planche",
"title": "Filosofía",
"subtitle": "",
"blocks": [
{
"kind": "row",
"cells": [
"Principio",
"Descripcion"
]
},
{
"kind": "row",
"cells": [
"Progresion Volumen <-> Forma",
"La evolucion es un fenomeno binario: primero se gana fuerza/volumen (descuidando la forma), luego se corrige la forma en base al volumen ganado. Al querer mas volumen, se vuelve a descuidar la forma momentaneamente, y se corrige un escalon mas arriba. Ciclo repetido."
]
},
{
"kind": "row",
"cells": [
"Intensidad en peso corporal",
"Sin peso externo anadido, la intensidad es relativa a la calidad de ejecucion (forma). Descuidar la forma equivale a bajar la intensidad para permitir mas volumen de trabajo."
]
},
{
"kind": "row",
"cells": [
"Mentalidad / postura",
"El estado mental condiciona directamente la postura y el gesto. Una persona confiada mantiene la muneca en el eje de la barra, presion equilibrada biceps/triceps, buscando SUBIR y mantener altura -en vez de 'sujetar una caida'-."
]
},
{
"kind": "row",
"cells": [
"Normalizar y relativizar el objetivo",
"Cuanto mas dificil se percibe el objetivo, mas dificil se vuelve. Desmitificar el objetivo: la planche es alcanzable por cualquier persona normal durante unos segundos."
]
},
{
"kind": "row",
"cells": [
"Visualizacion / proyeccion",
"Visualizar no es solo imaginar el esfuerzo, es vivir la situacion de antemano, sintiendo cada sensacion y detalle. Es la parte 'mental' del entrenamiento."
]
},
{
"kind": "row",
"cells": [
"Anti 'no pain no gain'",
"El dolor no es indicador de trabajo bien hecho. Empujar el esfuerzo al limite es un placer, fallar es positivo (cada fallo acerca al objetivo). No requiere 'motivacion' externa."
]
},
{
"kind": "row",
"cells": [
"Frecuencia de entrenamiento",
"Entre 3 y 5 dias de entrenamiento/semana segun forma fisica. El descanso activo (movilidad, stretching, bajo volumen) suele ser preferible al descanso total."
]
},
{
"kind": "row",
"cells": [
"Volumen por combinacion",
"Ejercicio corto e intenso (~10s) = fuerza maxima, descanso corto (1-3min). Ejercicio/combo largo (~20-40s) = resistencia nerviosa, descanso largo (4-5min)."
]
},
{
"kind": "row",
"cells": [
"Dolor vs tension",
"Nunca pedir al cuerpo un movimiento que implique DOLOR persistente (no confundir con tension/agujetas normales). Ante dolor persistente: cambiar agarre o cambiar de movimiento."
]
},
{
"kind": "row",
"cells": [
"Adaptacion",
"No forzar al maximo todo el tiempo. Bajar intensidad/carga en: subida grande de nivel, cambio de estacion, cambio grande en la forma de entrenar."
]
},
{
"kind": "row",
"cells": [
"Trabajar otros movimientos en paralelo",
"Es recomendable trabajar todas las amplitudes posibles para balance muscular, evitando acumular demasiados movimientos que sobrecarguen la misma zona (ej. codo)."
]
},
{
"kind": "row",
"cells": [
"Combos - 3 reglas",
"1) Presentar habilidades de forma degresiva (dificil -> facil). 2) La calidad de ejecucion tambien debe ser degresiva (no volver demasiado rapido a variantes muy simples). 3) Alternar grupos musculares y respirar entre movimientos para aumentar el volumen total."
]
}
]
},
{
"id": "planche-steps-por-donde-empezar",
"category": "Planche",
"title": "Steps: por dónde empezar",
"subtitle": "",
"blocks": [
{
"kind": "row",
"cells": [
"Step",
"Nombre",
"Criterio de entrada (nivel cliente)",
"Enfoque del entrenamiento"
]
},
{
"kind": "row",
"cells": [
"Step I",
"Base",
"Cliente empezando a entrenar (sin base de fuerza)",
"Refuerzo fisico general: push-ups, dips, plank hold, lean, frog planche, elbow planche, semi planche. 1-1.5h de sesion."
]
},
{
"kind": "row",
"cells": [
"Step II",
"Beginning of the straddle",
"Cliente ya deportista pero nuevo en planche",
"Trabajo especifico straddle con banda: hold, press, push-ups asistidos + combos. Objetivo: primera straddle planche 'bad form'."
]
},
{
"kind": "row",
"cells": [
"Step III",
"Bad form to clean straddle",
"Cliente ya tiene straddle planche en mala forma (brazos estirados obligatorio)",
"Combos intensos (6 combos tipo) al inicio de sesion + trabajo de forma con banda al final. Sesion 1-2h."
]
},
{
"kind": "row",
"cells": [
"Step IV",
"Clean straddle to 'full'",
"Cliente tiene straddle planche con forma correcta",
"Introduccion de la full planche con banda (bungee), combos con 'try negative full' e 'impossible'. Se acepta mala forma en full al inicio."
]
},
{
"kind": "row",
"cells": [
"Step V",
"'Full' to Full Planche",
"Cliente tiene full planche con mala forma",
"Combos mas cortos, foco 100% en control y forma (simbolo corona/control). Trabajo de propiocepcion fina."
]
},
{
"kind": "row",
"cells": [
"Next Level (555)",
"De Full a 555",
"Cliente ya tiene full planche limpia + variantes de flexion/press (aunque imperfectas)",
"Programa avanzado 'Next Level Planche': modulos NLP1-NLP3, formatos XXX/EMOM/spam, diversificacion de agarres y superficies. Ver hojas 'NLP - *'."
]
}
]
},
{
"id": "planche-catalogo-de-ejercicios",
"category": "Planche",
"title": "Catálogo de ejercicios",
"subtitle": "Simbolos foco: (S)=Hombro  (B)=Brazo  (H)=Body Hold  (C)=Control",
"blocks": [
{
"kind": "row",
"cells": [
"Step",
"Ejercicio",
"Repeticiones",
"Descanso",
"Foco (simbolos)",
"Notas"
]
},
{
"kind": "heading",
"text": "STEP I - BASE (preparacion fisica general)"
},
{
"kind": "row",
"cells": [
"STEP I",
"Push-ups normal/wide/close",
"Max reps (cambiar agarre cada vez)",
"1-3 min",
"B"
]
},
{
"kind": "row",
"cells": [
"STEP I",
"Dips",
"Max reps",
"2-4 min",
"B, S"
]
},
{
"kind": "row",
"cells": [
"STEP I",
"Triceps extensions",
"Max reps",
"1-3 min",
"B"
]
},
{
"kind": "row",
"cells": [
"STEP I",
"Plank hold",
"Max hold",
"1-3 min",
"H"
]
},
{
"kind": "row",
"cells": [
"STEP I",
"Lean",
"Max hold",
"2-3 min",
"H, S, C"
]
},
{
"kind": "row",
"cells": [
"STEP I",
"Frog planche",
"Max hold",
"2-3 min",
"B, S"
]
},
{
"kind": "row",
"cells": [
"STEP I",
"HSPU wall assisted",
"Max reps",
"2-3 min",
"B, S"
]
},
{
"kind": "row",
"cells": [
"STEP I",
"Elbow planche",
"Max hold",
"2-3 min",
"H, C"
]
},
{
"kind": "row",
"cells": [
"STEP I",
"Zanetti fly",
"Max reps",
"1-3 min",
"B, S"
]
},
{
"kind": "row",
"cells": [
"STEP I",
"Lean press to pike",
"Max reps",
"2-4 min",
"H, S, C"
]
},
{
"kind": "row",
"cells": [
"STEP I",
"Lean push-ups",
"Max reps",
"2-3 min",
"B, S, C"
]
},
{
"kind": "row",
"cells": [
"STEP I",
"Wall walk",
"Max reps",
"2-4 min",
"H, S"
]
},
{
"kind": "row",
"cells": [
"STEP I",
"Pike push-ups",
"Max reps",
"1-3 min",
"B"
]
},
{
"kind": "row",
"cells": [
"STEP I",
"Tuck raises",
"Max reps",
"2-3 min",
"B, S"
]
},
{
"kind": "row",
"cells": [
"STEP I",
"Semi planche",
"Max reps",
"2-4 min",
"H, B, S"
]
},
{
"kind": "heading",
"text": "STEP II - BEGINNING OF THE STRADDLE"
},
{
"kind": "row",
"cells": [
"STEP II",
"Tuck - advanced hold",
"Max hold x3",
"2-4 min",
"H, S, C, B",
"3 maximos consecutivos con respiracion entre cada uno"
]
},
{
"kind": "row",
"cells": [
"STEP II",
"Semi planche",
"Max hold",
"2-4 min",
"B, H"
]
},
{
"kind": "row",
"cells": [
"STEP II",
"Straddle hold band assistance",
"Max hold",
"2-4 min",
"S, H"
]
},
{
"kind": "row",
"cells": [
"STEP II",
"Straddle press band assistance",
"1/2 max reps - 1/2 1 rep minimo asistencia",
"3-4 min",
"C, S, H",
"1/2 = alternar formas cada otra vez"
]
},
{
"kind": "row",
"cells": [
"STEP II",
"Straddle push-ups band assistance",
"Max reps dead stop",
"3-4 min",
"C, H",
"Dead stop = parar al llegar/volver a posicion deseada"
]
},
{
"kind": "row",
"cells": [
"STEP II",
"Tuck push-ups",
"Max reps",
"2-4 min",
"B"
]
},
{
"kind": "row",
"cells": [
"STEP II",
"Tuck 'kick' to straddle",
"Max reps",
"2-3 min",
"S, H"
]
},
{
"kind": "row",
"cells": [
"STEP II",
"Lean to tuck to lean",
"Max reps dead stop",
"2-3 min",
"S, H"
]
},
{
"kind": "row",
"cells": [
"STEP II",
"Wall lean",
"Max hold x3",
"2-3 min",
"S, H"
]
},
{
"kind": "row",
"cells": [
"STEP II",
"HSPU (parallels elbows)",
"Max reps",
"3-4 min",
"B"
]
},
{
"kind": "row",
"cells": [
"STEP II",
"Zanetti fly",
"Max reps + iso",
"2-4 min",
"B, S"
]
},
{
"kind": "row",
"cells": [
"STEP II",
"HS press + negative",
"Max reps",
"2-3 min",
"C, S, H"
]
},
{
"kind": "row",
"cells": [
"STEP II",
"Semi planche to tuck",
"Max reps dead stop",
"2-4 min",
"B, H"
]
},
{
"kind": "row",
"cells": [
"STEP II",
"Tuck to frog straddle",
"Max reps",
"2-3 min",
"S, H"
]
},
{
"kind": "row",
"cells": [
"STEP II",
"Try straddle",
"x3",
"2-3 min",
"C, B, S, H"
]
},
{
"kind": "row",
"cells": [
"STEP II",
"Free combo band assistance",
"Maximo esfuerzo, no parar por fallo tecnico",
"4 min",
"C, B, S, H"
]
},
{
"kind": "heading",
"text": "STEP III - BAD FORM TO CLEAN STRADDLE"
},
{
"kind": "row",
"cells": [
"STEP III",
"Straddle hold band assistance",
"Max hold",
"2 min",
"S, H"
]
},
{
"kind": "row",
"cells": [
"STEP III",
"Straddle hold to pushup to press band assistance",
"1 rep",
"2-3 min",
"C, S, H, B"
]
},
{
"kind": "row",
"cells": [
"STEP III",
"Straddle push up band assistance",
"Max reps dead stop",
"2 min",
"H, B"
]
},
{
"kind": "row",
"cells": [
"STEP III",
"Straddle press band assistance",
"Max reps",
"2 min",
"S, H"
]
},
{
"kind": "row",
"cells": [
"STEP III",
"Wall lean",
"Max hold x3",
"2-3 min",
"S, H"
]
},
{
"kind": "row",
"cells": [
"STEP III",
"HSPU (parallels elbows)",
"Max reps",
"3-4 min",
"B"
]
},
{
"kind": "row",
"cells": [
"STEP III",
"Free combo band assistance",
"Maximo esfuerzo, no parar por fallo tecnico",
"3 min",
"C, B, S, H"
]
},
{
"kind": "heading",
"text": "STEP IV - CLEAN STRADDLE TO 'FULL'"
},
{
"kind": "row",
"cells": [
"STEP IV",
"Full hold band assistance",
"Max hold",
"2 min",
"S, H"
]
},
{
"kind": "row",
"cells": [
"STEP IV",
"Full hold to press to push-up band assistance",
"1 rep",
"2-3 min",
"C, S, H, B"
]
},
{
"kind": "row",
"cells": [
"STEP IV",
"Full push-ups band assistance",
"Max reps dead stop",
"2 min",
"H, B"
]
},
{
"kind": "row",
"cells": [
"STEP IV",
"Full press assistance",
"Max reps",
"2 min",
"S, H"
]
},
{
"kind": "row",
"cells": [
"STEP IV",
"90 grados push-ups",
"Max reps (codos paralelos)",
"3-4 min",
"B, H"
]
},
{
"kind": "row",
"cells": [
"STEP IV",
"Free combo band assistance",
"Maximo esfuerzo, no parar por fallo tecnico",
"3 min",
"C, B, S, H"
]
},
{
"kind": "heading",
"text": "STEP V - 'FULL' TO FULL PLANCHE"
},
{
"kind": "row",
"cells": [
"STEP V",
"Full hold band assistance",
"Max hold",
"2 min",
"C"
]
},
{
"kind": "row",
"cells": [
"STEP V",
"Full hold to press to push-up band assistance",
"1 rep",
"2-3 min",
"C"
]
},
{
"kind": "row",
"cells": [
"STEP V",
"Full push-ups band assistance",
"Max reps dead stop",
"2 min",
"C"
]
},
{
"kind": "row",
"cells": [
"STEP V",
"Full press band assistance",
"Max reps",
"2 min",
"C"
]
},
{
"kind": "row",
"cells": [
"STEP V",
"Free combo band assistance",
"Maximo esfuerzo, no parar por fallo tecnico",
"3 min",
"C"
]
}
]
},
{
"id": "planche-combos",
"category": "Planche",
"title": "Combos",
"subtitle": "Descanso entre combos: 4-5 min salvo que se indique otro. Foco: (S)=Hombro (B)=Brazo (H)=Body Hold (C)=Control",
"blocks": [
{
"kind": "row",
"cells": [
"Step",
"Combo",
"Secuencia",
"Foco"
]
},
{
"kind": "heading",
"text": "STEP III - BAD FORM TO CLEAN STRADDLE (combos)"
},
{
"kind": "row",
"cells": [
"STEP III",
"Combo 1",
"Straddle - push up no hold - Lsit - Straddle - semi planche hold - Lsit - tuck push ups",
"S, B"
]
},
{
"kind": "row",
"cells": [
"STEP III",
"Combo 2",
"Tuck push up - straddle - L sit - tuck push up - straddle - L sit - repetir ciclo hasta fallo",
"S, B"
]
},
{
"kind": "row",
"cells": [
"STEP III",
"Combo 3",
"Semi planche - push up to tuck - semi planche - push up to tuck - repetir",
"S, B"
]
},
{
"kind": "row",
"cells": [
"STEP III",
"Combo 4",
"L sit to straddle + press - negative - L sit - straddle max",
"S, H"
]
},
{
"kind": "row",
"cells": [
"STEP III",
"Combo 5",
"Handstand - negative straddle - L sit - handstand - negative - L sit - straddle",
"S, H"
]
},
{
"kind": "row",
"cells": [
"STEP III",
"Combo 6",
"Fast lean - use keeping to press - block handstand - stop - repetir max veces",
"S, C"
]
},
{
"kind": "heading",
"text": "STEP IV - CLEAN STRADDLE TO 'FULL' (combos)"
},
{
"kind": "row",
"cells": [
"STEP IV",
"Combo 1",
"Straddle - press - try negative full - open straddle + push up - Lsit - straddle - push up - L sit straddle",
"S, B, H"
]
},
{
"kind": "row",
"cells": [
"STEP IV",
"Combo 2",
"Try full - straddle - push up - impossible - straddle - push up - impossible - repetir hasta fallo",
"S, B, H"
]
},
{
"kind": "row",
"cells": [
"STEP IV",
"Combo 3",
"Try full - straddle - L sit - straddle - Lsit - straddle",
"S, B, H"
]
},
{
"kind": "row",
"cells": [
"STEP IV",
"Combo 4",
"L sit to straddle + press - negative full - L sit - straddle + press - negative",
"S, H, B"
]
},
{
"kind": "row",
"cells": [
"STEP IV",
"Combo 5",
"Straddle - L sit - handstand - negative - L sit - straddle",
"S, H, B"
]
},
{
"kind": "row",
"cells": [
"STEP IV",
"Combo 6",
"Handstand - try negative full - L sit - handstand - negative full - L sit - negative straddle - repetir hasta fallo",
"S, H, B"
]
},
{
"kind": "heading",
"text": "STEP V - 'FULL' TO FULL PLANCHE (combos)"
},
{
"kind": "row",
"cells": [
"STEP V",
"Combo 1",
"Straddle - press - negative full - hold",
"C"
]
},
{
"kind": "row",
"cells": [
"STEP V",
"Combo 2",
"Full - impossible - full - L sit - full",
"C"
]
},
{
"kind": "row",
"cells": [
"STEP V",
"Combo 3",
"Straddle - push up - full - impossible - full",
"C"
]
},
{
"kind": "row",
"cells": [
"STEP V",
"Combo 4",
"L sit to full + press - negative",
"C"
]
},
{
"kind": "row",
"cells": [
"STEP V",
"Combo 5",
"Handstand - negative full + re press",
"C"
]
}
]
},
{
"id": "planche-programas-l1-l5",
"category": "Planche",
"title": "Programas L1–L5",
"subtitle": "Avanzar de nivel cada 2-4 semanas segun progreso. Elegir por dia UN metodo (Combo o Dropset), nunca ambos el mismo dia. El bloque de Fuerza (Muscle Strengthening) es opcional/final. Correspondencia orientativa con 'Planche - Steps': Nivel 1 ~ Step I/II, Nivel 2 ~ Step II/III, Nivel 3 ~ Step III/IV, Nivel 4 ~ Step IV/V, Nivel 5 ~ Step V consolidado (puente hacia NLP1).",
"blocks": [
{
"kind": "heading",
"text": "PROGRAM LEVEL 1"
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 1 -> METODO COMBO"
},
{
"kind": "row",
"cells": [
"Sets",
"Secuencia / Ejercicio",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"x1",
"Lean planche hold 2s - Pike push-up a posicion lean planche - Pike push-up x5",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Handstand push-up - Lean planche hold 2s - Push-up x3 - Lean planche max hold",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Lean planche push-up x2 - Pike push-up x2 a posicion lean - Max push-up",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Pike push-up x3 - Lean planche push-up x2 - Lean planche max hold",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Lean planche hold 2s - Lean planche push-up x4 - Max handstand push-up",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Push-up x5 - Pike push-up x3 - Lean planche max hold",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Pike push-up a posicion lean x3 - Lean planche push-up x2 - Lean planche hold 2s - Max lean planche push-up",
"3-5 min"
]
},
{
"kind": "text",
"text": "Segun tu nivel de energia, realiza entre 5 y 10 combos. El orden no importa, elige los que prefieras. Puedes repetir el mismo combo varias veces o crear el tuyo siguiendo la misma estructura. El objetivo es acumular volumen, la forma perfecta no es imprescindible aunque conviene dar lo mejor de ti. Si no puedes ejecutar un movimiento, modificalo quitandolo o sustituyendolo."
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 1 -> FUERZA (Muscle Strengthening, opcional/final)"
},
{
"kind": "row",
"cells": [
"Sets",
"Secuencia / Ejercicio",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"x3",
"Tuck planche hold 5s",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x3",
"Max lean planche push-up",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x3",
"Max lean planche hold",
"5 min"
]
},
{
"kind": "text",
"text": "Ajusta la dificultad con banda elastica (ligera/media/fuerte) o peso corporal. Puedes hacer todos los ejercicios o centrarte en 1-2 areas concretas segun tus necesidades (puntos debiles y objetivos)."
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 1 -> METODO DROPSET"
},
{
"kind": "row",
"cells": [
"Sets",
"Dropset",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"70% max push-up (desc ~20s) - 50% max push-up (desc ~20s) - Max hold lean planche",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"Pike push-up x5 (desc ~20s) - Pike push-up x3 (desc ~20s) - Max hold lean planche",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"Pike push-up a posicion lean x5 (desc ~20s) - Pike push-up a posicion lean x3 (desc ~20s) - Max push-up",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"Handstand push-up x3 (desc ~20s) - Handstand push-up (desc ~20s) - Max lean planche push-up",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"Lean planche push-up x5 (desc ~20s) - Lean planche push-up x3 (desc ~20s) - Max pike push-up",
"5 min"
]
},
{
"kind": "text",
"text": "Segun tu nivel de energia, completa un total de 10 a 20 series. Ajusta los descansos y la dificultad de las variantes segun tus capacidades del dia."
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 2"
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 2 -> METODO COMBO"
},
{
"kind": "row",
"cells": [
"Sets",
"Secuencia / Ejercicio",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"x1",
"Negative tuck planche x2 - Tuck planche hold 2s - Lean planche push-up x2 - Tuck planche max hold",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Tuck planche push-up x2 - L-sit to tuck planche - Tuck planche push-up - Max lean planche push-up",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Advanced tuck planche sin hold - Tuck planche press - Negative tuck planche - Max tuck planche push-up",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Semi planche to tuck planche push-up - Handstand push-up x3 - Tuck planche push-up x2 a tuck planche max hold",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"L-sit to tuck planche - Tuck planche press - Negative tuck planche - L-sit to tuck planche max hold",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Tuck planche push-up x4 - L-sit to tuck planche - Tuck planche push-up - Tuck planche to lean planche - Max lean planche push-up",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Handstand push-up x5 - Negative tuck planche - L-sit to tuck planche max hold - Max hold lean planche",
"3-5 min"
]
},
{
"kind": "text",
"text": "Segun tu nivel de energia, realiza entre 5 y 10 combos. El orden no importa, elige los que prefieras. Puedes repetir el mismo combo varias veces o crear el tuyo siguiendo la misma estructura. El objetivo es acumular volumen, la forma perfecta no es imprescindible aunque conviene dar lo mejor de ti. Si no puedes ejecutar un movimiento, modificalo quitandolo o sustituyendolo."
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 2 -> FUERZA (Muscle Strengthening, opcional/final)"
},
{
"kind": "row",
"cells": [
"Sets",
"Secuencia / Ejercicio",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"x3",
"Max hold advanced tuck planche",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x3",
"Max advanced tuck planche push-up",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x3",
"Max tuck planche press",
"5 min"
]
},
{
"kind": "text",
"text": "Ajusta la dificultad con banda elastica (ligera/media/fuerte) o peso corporal. Puedes hacer todos los ejercicios o centrarte en 1-2 areas concretas segun tus necesidades (puntos debiles y objetivos)."
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 2 -> METODO DROPSET"
},
{
"kind": "row",
"cells": [
"Sets",
"Dropset",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"Tuck planche push-up x3 (desc ~20s) - Tuck planche push-up x3 (desc ~20s) - Max hold tuck planche",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"Handstand push-up x5 (desc ~20s) - Handstand push-up x3 (desc ~20s) - Max lean planche push-up",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"L-sit to tuck planche x4 (desc ~20s) - L-sit to tuck planche x2 (desc ~20s) - Max handstand push-up",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"Tuck planche push-up x3 (desc ~20s) - Lean planche push-up x6 (desc ~20s) - Max hold tuck planche",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"Tuck planche hold 3s (desc ~20s) - Tuck planche hold 3s (desc ~20s) - Max hold lean planche",
"5 min"
]
},
{
"kind": "text",
"text": "Segun tu nivel de energia, completa un total de 10 a 20 series. Ajusta los descansos y la dificultad de las variantes segun tus capacidades del dia."
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 3"
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 3 -> METODO COMBO"
},
{
"kind": "row",
"cells": [
"Sets",
"Secuencia / Ejercicio",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"x1",
"Advanced tuck planche press - Negative advanced tuck planche - L-sit - Tuck planche push-up x3 - L-sit - Max hold tuck planche",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Negative advanced tuck planche - Advanced tuck planche push-up x2 - L-sit a max hold advanced tuck planche",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Tuck planche to advanced tuck planche x3 - L-sit to tuck planche - Tuck planche press - Negative tuck planche to advanced tuck planche max hold",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Advanced tuck planche push-up x2 - L-sit to advanced tuck planche push-up - L-sit to advanced tuck planche max hold",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Advanced tuck planche hold 5s - L-sit to advanced tuck planche press - Negative advanced tuck planche a max tuck planche push-up",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Advanced tuck planche push-up x3 - Handstand push-up x5 - Negative advanced tuck planche a max hold advanced tuck planche",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Tuck planche push-up x5 - Tuck planche to advanced tuck planche x3 - L-sit to tuck planche press - Negative tuck planche a max hold tuck planche",
"3-5 min"
]
},
{
"kind": "text",
"text": "Segun tu nivel de energia, realiza entre 5 y 10 combos. El orden no importa, elige los que prefieras. Puedes repetir el mismo combo varias veces o crear el tuyo siguiendo la misma estructura. El objetivo es acumular volumen, la forma perfecta no es imprescindible aunque conviene dar lo mejor de ti. Si no puedes ejecutar un movimiento, modificalo quitandolo o sustituyendolo."
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 3 -> FUERZA (Muscle Strengthening, opcional/final)"
},
{
"kind": "row",
"cells": [
"Sets",
"Secuencia / Ejercicio",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"x3",
"Advanced tuck planche press x5",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x3",
"Max tuck planche to one leg planche",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x3",
"Max advanced tuck planche push-up",
"5 min"
]
},
{
"kind": "text",
"text": "Ajusta la dificultad con banda elastica (ligera/media/fuerte) o peso corporal. Puedes hacer todos los ejercicios o centrarte en 1-2 areas concretas segun tus necesidades (puntos debiles y objetivos)."
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 3 -> METODO DROPSET"
},
{
"kind": "row",
"cells": [
"Sets",
"Dropset",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"Advanced tuck planche hold 3s (desc ~20s) - Advanced tuck planche hold 3s (desc ~20s) - Max tuck planche push-up",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"Negative advanced tuck planche x2 (desc ~20s) - Advanced tuck planche push-up x3 (desc ~20s) - Max hold advanced tuck planche",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"Advanced tuck planche push-up x4 (desc ~20s) - Advanced tuck planche push-up x2 (desc ~20s) - Max hold tuck planche",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"Tuck planche press x3 (desc ~20s) - Negative advanced tuck planche x2 (desc ~20s) - Max advanced tuck planche push-up",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"Advanced tuck planche hold 2s (desc ~20s) - Tuck planche push-up x5 (desc ~20s) - Max hold tuck planche",
"5 min"
]
},
{
"kind": "text",
"text": "Segun tu nivel de energia, completa un total de 10 a 20 series. Ajusta los descansos y la dificultad de las variantes segun tus capacidades del dia."
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 4"
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 4 -> METODO COMBO"
},
{
"kind": "row",
"cells": [
"Sets",
"Secuencia / Ejercicio",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"x1",
"Straddle planche kicks - Advanced tuck planche push-up x5 - L-sit to handstand - Negative straddle planche sin hold",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Tuck planche to one leg planche x3 - L-sit to handstand - 90 grados push-up - Advanced tuck planche max hold",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Advanced tuck planche push-up x3 - L-sit to straddle planche kicks - L-sit to advanced tuck planche - Advanced tuck planche press - Max handstand push-up",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Straddle planche sin hold - L-sit to straddle kicks - Advanced tuck planche push-up x5 - L-sit a max hold advanced tuck planche",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Straddle planche negative sin hold - L-sit to straddle kicks - L-sit to handstand - 90 grados push-up - Max advanced tuck planche push-up",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Straddle planche push-up sin hold - L-sit to straddle kicks x2 - L-sit to handstand - Handstand push-up - Negative advanced tuck planche a max advanced tuck planche push-up",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Advanced tuck planche push-up x3 - Tuck planche to one leg planche - Tuck planche push-up x5 - L-sit to straddle kicks",
"3-5 min"
]
},
{
"kind": "text",
"text": "Segun tu nivel de energia, realiza entre 5 y 10 combos. El orden no importa, elige los que prefieras. Puedes repetir el mismo combo varias veces o crear el tuyo siguiendo la misma estructura. El objetivo es acumular volumen, la forma perfecta no es imprescindible aunque conviene dar lo mejor de ti. Si no puedes ejecutar un movimiento, modificalo quitandolo o sustituyendolo."
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 4 -> FUERZA (Muscle Strengthening, opcional/final)"
},
{
"kind": "row",
"cells": [
"Sets",
"Secuencia / Ejercicio",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"x3",
"Straddle planche push-up x3",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x3",
"Negative straddle planche x3",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x3",
"Max hold straddle planche",
"5 min"
]
},
{
"kind": "text",
"text": "Ajusta la dificultad con banda elastica (ligera/media/fuerte) o peso corporal. Puedes hacer todos los ejercicios o centrarte en 1-2 areas concretas segun tus necesidades (puntos debiles y objetivos)."
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 4 -> METODO DROPSET"
},
{
"kind": "row",
"cells": [
"Sets",
"Dropset",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"Straddle planche max hold (desc ~20s) - Straddle planche max hold (desc ~20s) - Max negative straddle planche",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"Straddle planche sin hold (desc ~20s) - Straddle planche sin hold (desc ~20s) - Max advanced tuck planche push-up",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"Negative straddle planche x2 (desc ~20s) - Negative straddle planche (desc ~20s) - Max L-sit to straddle kicks",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"Advanced tuck press x3 (desc ~20s) - Advanced tuck planche push-up x5 (desc ~20s) - Max handstand push-up",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"Straddle planche kicks x3 (desc ~20s) - Straddle planche kicks x2 (desc ~20s) - Negative straddle planche sin hold",
"5 min"
]
},
{
"kind": "text",
"text": "Segun tu nivel de energia, completa un total de 10 a 20 series. Ajusta los descansos y la dificultad de las variantes segun tus capacidades del dia."
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 5"
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 5 -> METODO COMBO"
},
{
"kind": "row",
"cells": [
"Sets",
"Secuencia / Ejercicio",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"x1",
"Negative straddle planche - L-sit to full planche kicks - L-sit to straddle planche - Advanced tuck planche push-up x2 - L-sit a max hold straddle planche",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"L-sit to full planche kicks - L-sit to straddle planche press - Negative straddle planche - L-sit a max straddle planche push-up",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Full planche sin hold - L-sit to straddle planche push-up x2 - L-sit to straddle planche press - Handstand push-up x3 - Negative straddle planche a max hold straddle planche",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Straddle planche push-up x2 - L-sit to full planche kicks - L-sit to straddle planche push-up - L-sit to straddle planche max hold",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Straddle planche press - Negative straddle planche - L-sit to handstand - Negative straddle planche a max advanced tuck planche push-up",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Full planche max hold - L-sit to full planche kicks - L-sit a max straddle planche push-up",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Straddle planche hold 3s - L-sit to full planche kicks x2 - L-sit to straddle planche press - 90 grados push-up a max hold straddle planche",
"3-5 min"
]
},
{
"kind": "text",
"text": "Segun tu nivel de energia, realiza entre 5 y 10 combos. El orden no importa, elige los que prefieras. Puedes repetir el mismo combo varias veces o crear el tuyo siguiendo la misma estructura. El objetivo es acumular volumen, la forma perfecta no es imprescindible aunque conviene dar lo mejor de ti. Si no puedes ejecutar un movimiento, modificalo quitandolo o sustituyendolo."
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 5 -> FUERZA (Muscle Strengthening, opcional/final)"
},
{
"kind": "row",
"cells": [
"Sets",
"Secuencia / Ejercicio",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"x3",
"Max hold full planche",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x3",
"Max straddle planche push-up",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x3",
"Max straddle planche press",
"5 min"
]
},
{
"kind": "text",
"text": "Ajusta la dificultad con banda elastica (ligera/media/fuerte) o peso corporal. Puedes hacer todos los ejercicios o centrarte en 1-2 areas concretas segun tus necesidades (puntos debiles y objetivos)."
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 5 -> METODO DROPSET"
},
{
"kind": "row",
"cells": [
"Sets",
"Dropset",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"Straddle planche push-up x2 (desc ~20s) - Straddle planche push-up x2 (desc ~20s) - Max hold straddle planche",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"L-sit to full planche kicks x3 (desc ~20s) - L-sit to full planche kicks x3 (desc ~20s) - Max straddle planche push-up",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"Full planche max hold (desc ~20s) - Full planche max hold (desc ~20s) - Max advanced tuck planche push-up",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"Negative straddle planche x3 (desc ~20s) - L-sit to full planche kicks x3 (desc ~20s) - Max straddle planche push-up",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"Full planche sin hold (desc ~20s) - Full planche sin hold (desc ~20s) - Max L-sit to full planche kicks",
"5 min"
]
},
{
"kind": "text",
"text": "Segun tu nivel de energia, completa un total de 10 a 20 series. Ajusta los descansos y la dificultad de las variantes segun tus capacidades del dia."
}
]
},
{
"id": "planche-galeria-ampliada",
"category": "Planche",
"title": "Galería ampliada",
"subtitle": "Banco de sustitucion y variedad dentro del nivel del cliente, no un catalogo estructurado en Steps. Usar para romper el estancamiento sin perder la logica de progresion.",
"blocks": [
{
"kind": "row",
"cells": [
"Nivel",
"Principiante",
"Intermedio",
"Avanzado"
]
},
{
"kind": "heading",
"text": "GALERIA AMPLIADA - EMPUJE (PLANCHE Y MALTES), POR NIVEL"
},
{
"kind": "row",
"cells": [
"Nota",
"Banco de sustitucion de empuje; no es un catalogo estructurado en Steps, solo variedad dentro del nivel del cliente. Se usa para romper el estancamiento variando ejercicios sin perder la logica de progresion."
]
},
{
"kind": "row",
"cells": [
"Ej. 1",
"L-sit to tuck planche",
"L-sit to advanced tuck planche",
"L-sit to full planche"
]
},
{
"kind": "row",
"cells": [
"Ej. 2",
"Lean planche",
"Lean planche",
"Lean planche"
]
},
{
"kind": "row",
"cells": [
"Ej. 3",
"Lean planche elevated",
"Lean planche elevated",
"Lean planche elevated"
]
},
{
"kind": "row",
"cells": [
"Ej. 4",
"Pseudo push-ups",
"Lean planche wall",
"Lean planche wall"
]
},
{
"kind": "row",
"cells": [
"Ej. 5",
"Tuck planche hold",
"Tuck planche push-ups",
"Tuck planche push-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 6",
"Tuck planche push-ups",
"Straddle planche kicks",
"Straddle planche kicks"
]
},
{
"kind": "row",
"cells": [
"Ej. 7",
"Straddle planche kicks",
"Straddle planche hold",
"Straddle planche hold"
]
},
{
"kind": "row",
"cells": [
"Ej. 8",
"Straddle planche hold",
"Straddle planche hold to press",
"Straddle planche hold to press"
]
},
{
"kind": "row",
"cells": [
"Ej. 9",
"Straddle planche hold to press",
"Negative to straddle planche hold",
"Negative to straddle planche hold"
]
},
{
"kind": "row",
"cells": [
"Ej. 10",
"Negative to straddle planche hold",
"Straddle planche press",
"Straddle planche press"
]
},
{
"kind": "row",
"cells": [
"Ej. 11",
"Straddle planche press",
"High half ROM straddle push-ups",
"High half ROM straddle push-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 12",
"Wide straddle planche hold",
"Full planche kicks",
"Full planche kicks"
]
},
{
"kind": "row",
"cells": [
"Ej. 13",
"Wide straddle planche kicks",
"Full planche hold to press",
"Full planche hold to press"
]
},
{
"kind": "row",
"cells": [
"Ej. 14",
"Wide straddle planche press",
"Negative to full planche hold",
"Negative to full planche hold"
]
},
{
"kind": "row",
"cells": [
"Ej. 15",
"Full planche press",
"Full planche press"
]
},
{
"kind": "row",
"cells": [
"Ej. 16",
"High half ROM full planche push-ups",
"High half ROM full planche push-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 17",
"Pseudo push-ups",
"Pseudo push-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 18",
"90 grados push-ups",
"90 grados push-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 19",
"Low half ROM straddle push-ups",
"Low half ROM straddle push-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 20",
"Low half ROM full planche push-ups",
"Low half ROM full planche push-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 21",
"Deep straddle planche push-ups",
"Deep straddle planche push-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 22",
"Dead planche hold",
"Deep full planche push-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 23",
"Wide planche hold",
"Dead planche hold"
]
},
{
"kind": "row",
"cells": [
"Ej. 24",
"Wide planche press",
"Dead planche push-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 25",
"Lean maltese",
"Wide planche hold"
]
},
{
"kind": "row",
"cells": [
"Ej. 26",
"Zanetti",
"Wide planche press"
]
},
{
"kind": "row",
"cells": [
"Ej. 27",
"Maltese elevator",
"Lean maltese"
]
},
{
"kind": "row",
"cells": [
"Ej. 28",
"Maltese hold",
"Lean maltese elevator"
]
},
{
"kind": "row",
"cells": [
"Ej. 29",
"Maltese press",
"Lean maltese to full (rings)"
]
},
{
"kind": "text",
"text": "PERFILES DE FUERZA EN PLANCHE (para orientar que variante priorizar segun el cliente)"
},
{
"kind": "row",
"cells": [
"Equilibrado",
"Forma limpia, caderas alineadas o ligeramente altas, escapulas en protraccion o neutras, capaz de press y push-ups.",
"Agarre en el medio de las paralelas, goma a la altura de cadera, peso en cadera, trabajar el hold, alternar pronado/supinado, trabajar wide y airplane, lean maltese y zanetti."
]
},
{
"kind": "row",
"cells": [
"Fuerza muerta (tipo A)",
"Inclinacion excesiva, caderas bajas ('banana'), escapulas retraidas o neutras, mejor en push-ups que en press, debil en agarre supinado.",
"Agarre al final de las paralelas por delante, banda de cuello asistida, chaleco lastrado, priorizar el press, planche supinada, wide planche, lean maltese."
]
},
{
"kind": "row",
"cells": [
"Fuerza de empuje (tipo B)",
"Sin inclinacion excesiva, caderas altas ('pike'), escapulas en protraccion o neutras, mejor en press que en push-ups, buen agarre supinado.",
"Agarre al final de las paralelas por detras, elastico en contra-resistencia, peso en tobillo, priorizar push-ups de planche, planche muerta (dead), airplane, maltese elevator."
]
},
{
"kind": "heading",
"text": "GALERIA AMPLIADA - EMPUJE GENERAL (PUSH), POR NIVEL"
},
{
"kind": "row",
"cells": [
"Ej. 1",
"Knee push-ups / wide / close",
"Bench dips",
"Push-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 2",
"Incline push-ups / wide / close",
"Low plank to high plank",
"Wide / close push-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 3",
"Bench dips",
"Push-ups",
"Decline / wide decline / close decline push-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 4",
"Low plank to high plank",
"Wide / close push-ups",
"Archer push-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 5",
"Push-ups hold / dips hold",
"Pike hold",
"Triceps extension"
]
},
{
"kind": "row",
"cells": [
"Ej. 6",
"Push-ups",
"Hindu push-ups",
"Lean planche hold, pseudo push-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 7",
"Wide / close push-ups",
"Decline / wide decline / close decline push-ups",
"Push-ups on rings / close push-ups on rings"
]
},
{
"kind": "row",
"cells": [
"Ej. 8",
"Pike hold",
"Archer push-ups",
"Pike push-ups / wide / close"
]
},
{
"kind": "row",
"cells": [
"Ej. 9",
"Hindu push-ups",
"Triceps extension",
"Handstand leans"
]
},
{
"kind": "row",
"cells": [
"Ej. 10",
"Triceps extension",
"Pike walks",
"Dips on straight bar / dips / planche dips / dips on rings"
]
},
{
"kind": "row",
"cells": [
"Ej. 11",
"Pike walks",
"Lean planche hold, pseudo push-ups",
"Wall walks / chest flies on rings"
]
},
{
"kind": "row",
"cells": [
"Ej. 12",
"Lean planche hold, pseudo push-ups",
"Handstand hold",
"Decline pike push-ups / wide / close"
]
},
{
"kind": "row",
"cells": [
"Ej. 13",
"Handstand hold",
"Push-ups on rings / close push-ups on rings",
"Face pull"
]
},
{
"kind": "row",
"cells": [
"Ej. 14",
"Push-ups on rings / close push-ups on rings",
"Pike push-ups / wide / close",
"Tuck planche raises / hold"
]
},
{
"kind": "row",
"cells": [
"Ej. 15",
"Decline push-ups / wide / close",
"Dips on straight bar / dips / planche dips / dips on rings",
"Supinated dips on straight bar"
]
},
{
"kind": "row",
"cells": [
"Ej. 16",
"Pike push-ups / wide / close",
"Handstand leans / wall walks",
"Impossible push-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 17",
"Dips on straight bar / dips / planche dips",
"Decline pike push-ups / wide / close",
"Half ROM / full handstand push-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 18",
"Handstand leans / wall walks",
"Face pull",
"Impossible dips on straight bar"
]
},
{
"kind": "row",
"cells": [
"Ej. 19",
"Decline pike push-ups",
"Tuck planche raises / hold",
"Lean planche press to pike"
]
},
{
"kind": "row",
"cells": [
"Ej. 20",
"Impossible push-ups (nivel avanzado temprano)",
"Supinated dips on straight bar",
"Straddle planche kicks, bent arm/forearm planche hold y press"
]
},
{
"kind": "row",
"cells": [
"Ej. 21",
"Half ROM / full handstand push-ups",
"Close handstand push-ups, handstand 90 grados push-ups",
"Muscle-ups / muscle-ups on rings"
]
},
{
"kind": "heading",
"text": "SUBGRUPOS DE FOCO MUSCULAR DENTRO DEL PUSH"
},
{
"kind": "row",
"cells": [
"Hombro",
"decline push-ups -> lean planche -> pseudo push-ups -> pike push-ups -> handstand leans -> planche dips -> decline pike push-ups -> tuck planche -> handstand push-ups."
]
},
{
"kind": "row",
"cells": [
"Pecho",
"push-ups -> wide push-ups -> push-ups on rings -> decline push-ups -> archer push-ups -> dips -> dips on rings -> chest flies on rings -> supinated dips."
]
},
{
"kind": "row",
"cells": [
"Triceps",
"push-ups -> close push-ups -> decline push-ups -> triceps extension -> close push-ups on rings -> dips -> impossible push-ups -> half ROM handstand push-ups -> handstand push-ups."
]
}
]
},
{
"id": "next-level-planche-filosofia",
"category": "Next Level Planche",
"title": "Filosofía",
"subtitle": "Prerequisito de entrada: full planche mas o menos limpia + variantes de flexion/press aunque no perfectas.",
"blocks": [
{
"kind": "row",
"cells": [
"Concepto",
"Descripcion"
]
},
{
"kind": "row",
"cells": [
"La evolucion no existe (adaptacion, no evolucion lineal)",
"'Evolucion' sugiere mejora progresiva, lineal y repetitiva - esto es falso. Lo que llamamos evolucion es en realidad ADAPTACION: la respuesta a una demanda parcial o insatisfecha del organismo. La adaptacion fisica esta ligada a la adaptacion tecnica: puedes bloquearte mucho tiempo por un simple detalle no relacionado con la fuerza (ej. problemas de press o extension). Hay que aceptar hacer las cosas de forma imperfecta para adaptarse y corregir despues."
]
},
{
"kind": "row",
"cells": [
"Realizar el push - estado mental",
"La plancha requiere un estado mental similar al de deportes de combate/lucha: tension, respiracion intensa. Una persona temerosa, ansiosa o demasiado relajada NO podra realizar la plancha correctamente."
]
},
{
"kind": "row",
"cells": [
"Vinculo mente-cuerpo",
"Individuo retraido/animo negativo -> postura encorvada tipo hollow (puede ayudar en plancha a la larga). Persona relajada y equilibrada -> postura mas erguida/retraida (favorece el trabajo de tiron). El estado de animo determina si te estancas o ganas altura: son trayectorias musculares distintas."
]
},
{
"kind": "row",
"cells": [
"Ejemplo trayectoria incorrecta 1",
"Avanzar hasta sentir alineacion con centro de gravedad, luego luchar contra caida hacia atras (piernas). Crea desequilibrio en contacto con la barra, impide aplicar fuerza correcta en mano/muneca."
]
},
{
"kind": "row",
"cells": [
"Ejemplo trayectoria incorrecta 2",
"Dejar que se cree una rotura en la muneca para sostener la caida delantera por compresion -> plancha mas baja y angulo mas agudo. Implicacion excesiva de cadena delantera del brazo, sin aprovechar cadena trasera."
]
},
{
"kind": "row",
"cells": [
"Persona segura de si misma",
"Mantiene inconscientemente muneca en eje de la barra, presion equilibrada biceps/triceps, buscando SUBIR y mantener altura en vez de aguantar una caida. Lo que haces es la transcripcion de lo que pasa en tu cabeza."
]
},
{
"kind": "row",
"cells": [
"Normalizar / Relativizar",
"Desmitificar el objetivo: cuanto mas dificil se percibe, mas dificil se vuelve. La desmitificacion es el factor principal que permite a cada generacion superar a la anterior."
]
},
{
"kind": "row",
"cells": [
"Proyeccion / Visualizacion",
"Visualizar = vivir la situacion por adelantado sintiendo cada sensacion y detalle (no solo imaginar el esfuerzo). Es la parte mental del entrenamiento. Ligada a la percepcion del placer: si un dia visualizas un movimiento que no esta en la programacion pero te apetece, hazlo."
]
},
{
"kind": "row",
"cells": [
"Estandares acordes a tu categoria",
"La dificultad es relativa a los parametros fisicos propios (la palanca importa en trabajo isometrico). Un '555' no significa lo mismo para 150cm, 170cm o 180+cm. Compararse con personas de fisiologia similar."
]
},
{
"kind": "row",
"cells": [
"No Pain No ??? (anti dolor=ganancia)",
"Cuando hay dolor, hay poca o ninguna ganancia. El dolor NO es indicador de trabajo bien hecho. Esforzarse al limite es un placer; fallar es positivo porque acerca al objetivo; no requiere 'motivacion' externa."
]
},
{
"kind": "row",
"cells": [
"Trabajo con banda elastica",
"Banda ligera con nudos ajustables (no gruesa). Debe simplificar el ejercicio sin facilitarlo en exceso. Si esta por encima, coloca el apoyo un paso por delante de la linea vertical de la banda."
]
},
{
"kind": "row",
"cells": [
"Combos largos - 3 reglas",
"1) Ordenar elementos de forma decreciente (dificil -> facil). 2) La calidad de ejecucion tambien debe ser decreciente (dejar bajar piernas si permite combo mas largo). 3) Alternar grupos musculares y respirar entre movimientos; usar elementos de equilibrio (HS, OAH, hollowback) como 'descanso'."
]
},
{
"kind": "row",
"cells": [
"Frecuencia y volumen de trabajo",
"Sesion: 1.5 a 3 horas segun forma fisica (pasadas 2h intensas, el progreso es mas tecnico -> ir de duro a facil). Frecuencia semanal: 3-5 dias segun estado percibido. Descanso activo preferible al total."
]
},
{
"kind": "row",
"cells": [
"Volumen a nivel de combo",
"Ejercicio corto (~10s) intenso = fuerza maxima, descanso 1-3 min. Ejercicio largo/combo (~20-40s) = resistencia nerviosa, descanso 4-5 min. Al fallo total: descanso hasta 7 min."
]
},
{
"kind": "row",
"cells": [
"Aprender y asimilar",
"No forzar el cuerpo a intensidad maxima de forma continuada. Precaucion especial ante: subida grande de nivel (el cuerpo necesita asimilar y descansar), cambio de estacion (temperatura, presion, humedad), cambio en la forma de entrenar (nueva programacion o movimiento nuevo)."
]
},
{
"kind": "row",
"cells": [
"Adaptarse a condiciones externas",
"Lugar de entrenamiento distinto, falta de musica, clima (frio/lluvia/calor) pueden perturbar. Depende de ti adaptarte y fortalecerte mentalmente: centrarte en el objetivo, aumentar capacidad de recuperacion."
]
},
{
"kind": "row",
"cells": [
"Intencion / Contraccion voluntaria",
"La intencion (foco consciente en un detalle tecnico) optimiza el rendimiento: ej. intencion de velocidad en el press, explosividad en flexiones. La contraccion voluntaria de musculos solicitados optimiza altura, velocidad de colapso, fuerza de empuje."
]
},
{
"kind": "row",
"cells": [
"Trayectorias de Press (3 tipos)",
"BANANA: pasa de plancha a HS sin importar la forma -> solo para volumen/progresion, no rendimiento valido. DELFIN: sumergirse ligeramente hacia delante + impulso fuerte, mas fuerza y tecnica, genera momento. PISTON: fuerza bruta pura, sin ningun arco, posicion identica de principio a fin -> dificil, poco fluido."
]
},
{
"kind": "row",
"cells": [
"Trayectorias de flexion",
"CIERRE TORACICO: reducir angulo hombro-mano ('cerrojo'), mantiene deltoides al frente + contraccion de serrato mayor para optimizar la protraccion en la subida. FLEXIONES ARQUERAS: requiere rotacion brusca de muneca al subir para recuperar el agarre en el eje y optimizar la altura."
]
},
{
"kind": "row",
"cells": [
"Tecnica negativa",
"Mas dificil y tecnica que el press: hay que re-enganchar el hollow y mantener altura optima. Reemplazar agarre si es necesario, apretar fuerte la barra (dorso de la mano). Para el hollow en la negativa: usar progresion mas facil (tuck/tuck avanzado) o reducir voluntariamente la palanca rompiendo la cadera."
]
},
{
"kind": "row",
"cells": [
"Trabajar la forma estricta (serrato mayor)",
"Trabajar la forma FUERA de la parte de volumen. El musculo clave es el serrato mayor/anterior: pequeno, lento de fortalecer, requiere paciencia. Reforzarlo con variantes de nivel inferior (straddle, tuck avanzada) al final de la sesion de volumen, con banda: series de aguante, negativas o pushups."
]
},
{
"kind": "row",
"cells": [
"Trabajo de base vs trabajo especifico",
"Trabajo de base = diario: volumen, control, combinaciones largas y elastico (el 'XXX'). A medida que avanzas, da acceso al trabajo especifico: variantes, nuevas transiciones, combinaciones variadas."
]
},
{
"kind": "row",
"cells": [
"Test de fase de entrada (combos de examen)",
"Etapa 1 (examen final): aguante full 2s - pushup deadstop - press - negativa - aguante 2s. Etapa 2 (examen final): 3-3-3 dinamico en buena forma (push-press-hold). Si estas por debajo del nivel 1, empiezas en Modulo 6 (NLP1). Si superas nivel 2, ve directo a Modulo 8 (NLP3)."
]
},
{
"kind": "row",
"cells": [
"Calentamiento",
"Saltar a la cuerda (munecas/codos/hombros), sprint corto, estiramiento activo con resistencia (munecas y hombros), ejercicios basicos limpios (dips, pull-ups, lean tuck, lean push-ups), combo intenso con gran asistencia como cierre de calentamiento."
]
},
{
"kind": "row",
"cells": [
"Tensiones y dolores - tendinopatia",
"Nunca pedir al cuerpo un movimiento con dolor persistente. Ante tendinopatia: descansar 2-3 dias para reducir inflamacion, luego seguir trabajando POR DEBAJO de un umbral de dolor 3-4/10 (mantiene el tejido irrigado). Ante lesion: acudir a osteopata / medico de cabecera."
]
}
]
},
{
"id": "next-level-planche-progresion-1-3",
"category": "Next Level Planche",
"title": "Progresión 1–3",
"subtitle": "Secuencia de sesion: 10 min calentamiento - elastico - volumen (combos) - combo de elasticos. Duracion total: 1h30 a 3h. No detenerse en fallo tecnico: sustituir full por straddle si hace falta.",
"blocks": [
{
"kind": "heading",
"text": "MODULO 6 - NEXT LEVEL PLANCHE 1 (NLP1)"
},
{
"kind": "heading",
"text": "MODULO 6 - NEXT LEVEL PLANCHE 1 (NLP1) -> METODO DE COMBOS"
},
{
"kind": "row",
"cells": [
"Combo",
"Secuencia",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"Combo 1",
"Full - press - negativa - pushup - hold - L sit - max straddle pushups - intentar hold",
"4-5 min"
]
},
{
"kind": "row",
"cells": [
"Combo 2",
"Full - pushup - press - negativa - pushup - hold 2s - L sit - full - press - negativa - max hold",
"4-5 min"
]
},
{
"kind": "row",
"cells": [
"Combo 3",
"Full - pushup - hold - L sit - full - press - negativa - pushup - hold - L sit - straddle max hold",
"4-5 min"
]
},
{
"kind": "row",
"cells": [
"Combo 4",
"Full press - negativa - push up - hold corto - stop 5s respirar - repite hasta fallo",
"4-5 min"
]
},
{
"kind": "row",
"cells": [
"Combo 5",
"Handstand - negativa - pushup - repress - negativa - L sit - straddle max hold",
"4-5 min"
]
},
{
"kind": "row",
"cells": [
"Combo 6",
"Full - press - negativa - repress - negativa - push up - hold - L sit - full hold - L sit - straddle hold",
"10 min descanso final"
]
},
{
"kind": "text",
"text": "MODULO 6 - NEXT LEVEL PLANCHE 1 (NLP1) -> METODO DE REPETICION (elastico)"
},
{
"kind": "row",
"cells": [
"Ejercicio",
"Detalle",
"Descanso / Foco"
]
},
{
"kind": "row",
"cells": [
"Full max hold to press",
"clean elastico, max hold to press",
"2 min - focus CONTROL"
]
},
{
"kind": "row",
"cells": [
"Full hold to press to push up",
"elastico, max reps",
"2-3 min - focus CONTROL"
]
},
{
"kind": "row",
"cells": [
"Full push ups to press to hold",
"elastico, max reps",
"2 min - focus CONTROL"
]
},
{
"kind": "row",
"cells": [
"Full press",
"elastico, max reps clean",
"2 min - focus CONTROL"
]
},
{
"kind": "row",
"cells": [
"Combo libre elastico",
"maximo esfuerzo, ir al fallo",
"3 min - focus CONTROL"
]
},
{
"kind": "text",
"text": "MODULO 6 - NEXT LEVEL PLANCHE 1 (NLP1) -> SEGUNDA OPCION DE ENTRENAMIENTO (series)"
},
{
"kind": "row",
"cells": [
"Serie",
"Contenido",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"1a serie x3-4",
"Full planche 2/3s - to straddle 2/3s",
"1 min entre series / 5 min tras bloque"
]
},
{
"kind": "row",
"cells": [
"2a serie x3-4",
"Full press - to negativa straddle 3s",
"2 min / 5 min tras bloque"
]
},
{
"kind": "row",
"cells": [
"3a serie x3-4",
"Handstand to negativa full/straddle max hold - relanzar straddle planche",
"2 min / 5 min tras bloque"
]
},
{
"kind": "row",
"cells": [
"4a serie x3-4",
"Straddle pushup to hold - reinicia straddle planche hold",
"2 min / 5 min tras bloque"
]
},
{
"kind": "row",
"cells": [
"5a serie x3-4",
"Negativa straddle to pushup straddle - reinicia straddle (frog o advanced si duro)",
"2 min / 5 min tras bloque"
]
},
{
"kind": "row",
"cells": [
"6a serie x3-4",
"Straddle archer - to L sit - to straddle press - to negativa straddle",
"2 min / 7-10 min tras bloque"
]
},
{
"kind": "text",
"text": "COMBO DE EXAMEN (debe hacerse PERFECTAMENTE para pasar de nivel): Aguante completo 2s - push up - dead stop - press - negativa - aguante 2s"
},
{
"kind": "heading",
"text": "MODULO 7 - NEXT LEVEL PLANCHE 2 (NLP2)"
},
{
"kind": "heading",
"text": "MODULO 7 - NEXT LEVEL PLANCHE 2 (NLP2) -> METODO DE COMBOS"
},
{
"kind": "row",
"cells": [
"Combo",
"Secuencia",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"Combo 1",
"Full - press - negativa - press - negativa - pushup - hold - L sit - max straddle pushup - intenta hold",
"4-5 min"
]
},
{
"kind": "row",
"cells": [
"Combo 2",
"Full - pushup - press - negativa - pushup - pushup - hold - L sit - full - press - negativa - max hold",
"4-5 min"
]
},
{
"kind": "row",
"cells": [
"Combo 3",
"Full - pushup - hold - press - negativa - L sit - full - pushup - hold - L sit - straddle pushups max hold",
"4-5 min"
]
},
{
"kind": "row",
"cells": [
"Combo 4",
"Full hold - press - negativa - hold push up - hol - stop 10s respirar - repite hasta fallo (straddle si imposible en full)",
"4-5 min"
]
},
{
"kind": "row",
"cells": [
"Combo 5",
"Handstand pushups 3x - negativa - pushup - repress - negativa - L sit - straddle max pushups",
"4-5 min"
]
},
{
"kind": "row",
"cells": [
"Combo 6",
"Full - press - negativa - repress - negativa - repress - hold - pushup - L sit - full hold - L sit - straddle hold",
"10 min descanso final"
]
},
{
"kind": "text",
"text": "MODULO 7 - NEXT LEVEL PLANCHE 2 (NLP2) -> METODO DE REPETICION (elastico)"
},
{
"kind": "row",
"cells": [
"Ejercicio",
"Detalle",
"Descanso / Foco"
]
},
{
"kind": "row",
"cells": [
"Full max hold to press + negative",
"clean elastico, max hold to press",
"2 min - focus CONTROL"
]
},
{
"kind": "row",
"cells": [
"Full hold to press to push up",
"elastico, max reps",
"2-3 min - focus CONTROL"
]
},
{
"kind": "row",
"cells": [
"Full push ups to press to hold",
"elastico, max reps clean",
"2 min - focus CONTROL"
]
},
{
"kind": "row",
"cells": [
"Full press",
"elastico, max reps clean",
"2 min - focus CONTROL"
]
},
{
"kind": "row",
"cells": [
"Combo libre elastico",
"maximo esfuerzo, ir al fallo",
"3 min - focus CONTROL"
]
},
{
"kind": "text",
"text": "MODULO 7 - NEXT LEVEL PLANCHE 2 (NLP2) -> SEGUNDA OPCION DE ENTRENAMIENTO (series)"
},
{
"kind": "row",
"cells": [
"Serie",
"Contenido",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"1a serie x3-4",
"Full planche press x2 + negativa max hold full",
"1 min / 5 min tras bloque"
]
},
{
"kind": "row",
"cells": [
"2a serie x3-4",
"Full pushup to press + negativa to straddle press",
"1 min / 5 min tras bloque"
]
},
{
"kind": "row",
"cells": [
"3a serie x3-4",
"Handstand push-ups x5 to negativa 90 full - to pushup to hold (reinicia si no hold)",
"2 min / 5 min tras bloque"
]
},
{
"kind": "row",
"cells": [
"4a serie x3-4",
"Full pushup - handstand to negativa full max hold",
"2 min / 5 min tras bloque"
]
},
{
"kind": "row",
"cells": [
"5a serie x3-4",
"Full press - Flag/negative to straddle pushup - reinicio straddle max hold",
"2 min / 5 min tras bloque"
]
},
{
"kind": "row",
"cells": [
"6a serie x3-4",
"1-3s full hold - to press",
"2 min / 7-10 min tras bloque"
]
},
{
"kind": "text",
"text": "XXX: XXX: formato muy intenso y largo, maximo 2-3 veces por sesion, 5 min descanso despues. Objetivo base: pushup-press-hold, luego alternar todas las variantes: press-pushup-hold / hold-pushup-press / hold-press-pushup, anadiendo repeticiones de press, pushup, deadstop o un segundo hold. Se permite mala forma temporalmente para aumentar el volumen (corregir despues)."
},
{
"kind": "text",
"text": "COMBO DE EXAMEN (debe hacerse PERFECTAMENTE para pasar de nivel): Combo de examen 333 en buena forma"
},
{
"kind": "heading",
"text": "MODULO 8 - NEXT LEVEL PLANCHE 3 (NLP3)"
},
{
"kind": "heading",
"text": "MODULO 8 - NEXT LEVEL PLANCHE 3 (NLP3) -> METODO DE COMBOS"
},
{
"kind": "row",
"cells": [
"Combo",
"Secuencia",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"Combo 1 (COMBO LIBRE)",
"Empieza a utilizar tu fuerza y resistencia para crear tus propias combinaciones y tu personalidad, siguiendo las reglas de las combinaciones largas",
"4-5 min"
]
},
{
"kind": "row",
"cells": [
"Combo 2",
"Full - pushup x2 - press - negativa - pushup - hold - L sit - full - press - negativa - max hold",
"4-5 min"
]
},
{
"kind": "row",
"cells": [
"Combo 3",
"Full - pushup x2 - hold - press - negativa - L sit - full - pushup - hold - L sit - full pushups max hold (acaba en spam sin forma, abre a straddle si necesario)",
"4-5 min"
]
},
{
"kind": "row",
"cells": [
"Combo 4",
"Full hold - press - negativa - pushup - hold push up - hold - stop 10s respire - repite hasta fallo (straddle si imposible en full)",
"4-5 min"
]
},
{
"kind": "row",
"cells": [
"Combo 5",
"Full - press - negativa + pushup - repress - negative - L sit - full hold - straddle max pushups",
"4-5 min"
]
},
{
"kind": "row",
"cells": [
"Combo 6",
"Full - arquera pushup - press - negativa - hold - L sit - archer pushup - L sit - max hold pushup",
"10 min descanso final"
]
},
{
"kind": "text",
"text": "MODULO 8 - NEXT LEVEL PLANCHE 3 (NLP3) -> METODO DE REPETICION (elastico)"
},
{
"kind": "row",
"cells": [
"Ejercicio",
"Detalle",
"Descanso / Foco"
]
},
{
"kind": "row",
"cells": [
"Full max hold to press + negative",
"clean elastico, max hold to press",
"2 min - focus CONTROL"
]
},
{
"kind": "row",
"cells": [
"Full hold to press to push up",
"elastico, max reps",
"2-3 min - focus CONTROL"
]
},
{
"kind": "row",
"cells": [
"Full push ups to press to hold",
"elastico, max reps clean",
"2 min - focus CONTROL"
]
},
{
"kind": "row",
"cells": [
"Full press",
"elastico, max reps clean",
"2 min - focus CONTROL"
]
},
{
"kind": "row",
"cells": [
"Combo libre elastico",
"maximo esfuerzo, ir al fallo",
"3 min - focus CONTROL"
]
},
{
"kind": "text",
"text": "MODULO 8 - NEXT LEVEL PLANCHE 3 (NLP3) -> SEGUNDA OPCION DE ENTRENAMIENTO (series)"
},
{
"kind": "row",
"cells": [
"Serie",
"Contenido",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"1a serie x3-4",
"Full pushup x3/5 (reinicia si no hold)",
"1 min / 5 min tras bloque"
]
},
{
"kind": "row",
"cells": [
"2a serie x3-4",
"Full press x3-5 + negativa to hold",
"1 min / 5 min tras bloque"
]
},
{
"kind": "row",
"cells": [
"3a serie x3-4",
"Arquera push-ups straddle to pushup straddle to press to negativ to hold (reinicia si no hold)",
"2 min / 5 min tras bloque"
]
},
{
"kind": "row",
"cells": [
"4a serie x3-4",
"Handstand to negativa full to pushup to press to negativa to max hold (reinicia si no hold)",
"2 min / 5 min tras bloque"
]
},
{
"kind": "row",
"cells": [
"5a serie x3-4",
"2-5s hold to press",
"2 min / 5 min tras bloque"
]
},
{
"kind": "row",
"cells": [
"6a serie x3-4",
"Arquera full pushup to pushup full to L sit to max hold full",
"2 min / 10 min tras bloque"
]
},
{
"kind": "text",
"text": "XXX: XXX: continuar hacia el 555 - 2 a 3 intentos maximo por sesion, 5 min descanso. A medida que te acercas al 555, reducir progresivamente el trabajo con banda y centrarte mas en trabajo sin asistencia, guardando algo de energia al final para lo que mas te falte."
},
{
"kind": "text",
"text": "COMBO DE EXAMEN (debe hacerse PERFECTAMENTE para pasar de nivel): Combo de examen 555 en forma media"
}
]
},
{
"id": "next-level-planche-formatos-avanzados",
"category": "Next Level Planche",
"title": "Formatos avanzados",
"subtitle": "A partir de aqui la planificacion literal deja de ser eficaz: el atleta debe autoevaluarse cada dia.",
"blocks": [
{
"kind": "row",
"cells": [
"Concepto",
"Descripcion"
]
},
{
"kind": "row",
"cells": [
"Fin del planning literal (Modulo 9)",
"En este nivel el atleta se conoce a si mismo (habilidades, forma) y sabe adaptarse diariamente. El entrenamiento principal (volumen + control clasico) pasa a ser solo el 50% de la sesion; el resto se modula segun lo que el atleta sienta que necesita ese dia usando los formatos del Modulo 10."
]
},
{
"kind": "row",
"cells": [
"Diversificar el entrenamiento",
"Aumentar carga de trabajo mientras se prueban distintos agarres, superficies y variaciones nuevas."
]
},
{
"kind": "row",
"cells": [
"Supinacion vs pronacion",
"Desarrollan fuerzas diferentes y complementarias; familiarizarse con ambos agarres."
]
},
{
"kind": "row",
"cells": [
"Trabajo en el suelo",
"Centra el trabajo en hombros y codos (no hay agarre implicado); buena forma de fortalecerse diferente."
]
},
{
"kind": "row",
"cells": [
"Anillas",
"Superficie a entrenar de forma independiente (no es solo un 'extra'); trabajar cuando ya se tiene suficiente fuerza y control en otros soportes, ya que estos ayudan a progresar en anillas (y viceversa)."
]
},
{
"kind": "heading",
"text": "MODULO 10 - FORMATOS DE ENTRENAMIENTO"
},
{
"kind": "text",
"text": "Cada formato tiene un proposito especifico y debe usarse en el momento adecuado segun la condicion fisica y necesidad del dia. El trabajo de base (volumen + control) se mantiene, y se combina con estos formatos."
},
{
"kind": "row",
"cells": [
"Formato",
"Descripcion"
]
},
{
"kind": "row",
"cells": [
"Combinaciones cortas (aislar transicion/variacion)",
"En un combo largo, el minimo fallo o perdida de trayectoria cuesta mucha resistencia (se gasta en recuperar forma). Aislar una transicion problematica permite dominarla del todo antes de integrarla en combos largos 'ricos' sin arriesgar tanto."
]
},
{
"kind": "row",
"cells": [
"XXX / XXXX",
"Formato muy intenso y voluminoso: max 2-3 veces por sesion. Define el nivel actual de forma dinamica. Objetivo base: pushup-press-hold, alternando variantes (press-pushup-hold / hold-pushup-press / hold-press-pushup), anadiendo repeticiones progresivamente. Se permite mala forma temporal para aumentar volumen (corregir despues)."
]
},
{
"kind": "row",
"cells": [
"Push up a press de full planche (max reps)",
"Mas que una simple transicion aislada: es una alternativa al XXX. Es la transicion mas problematica (recuperar altura tras la flexion). Se puede introducir en cualquier nivel del programa, lastrado con: rodillas, tobillos o banda elastica. Una vez factible lastrarse, aumentar intensidad reduciendo volumen total (herramienta para ganar fuerza maxima sin pesas externas)."
]
},
{
"kind": "row",
"cells": [
"Con ojos vendados (propiocepcion)",
"Obliga a concentrarse solo en las sensaciones -> mejora control y sobre todo confianza (si superas un combo sin ver, sera casi imposible fallarlo con los ojos abiertos). ATENCION: no usar en soporte alto, favorecer paralelas bajas."
]
},
{
"kind": "row",
"cells": [
"Max hold a press",
"Exige mantener la altura en el momento mas duro del combo, forzando una buena trayectoria con el gesto correcto (se falla si no se cumple ese requisito)."
]
},
{
"kind": "row",
"cells": [
"Max spam",
"Formato extremadamente largo: repetir solo 1-2 veces por sesion. Sirve para conocer el volumen bruto (limpio o en deadstop) y cuantificar la evolucion; entrena mantener el mismo ritmo a lo largo de una serie larga sin perder energia."
]
},
{
"kind": "row",
"cells": [
"EMOM (Every Minute On the Minute)",
"Metodo para trabajar resistencia de fuerza: 1 ejercicio cada minuto durante X minutos. Usar al final de la sesion para vaciar reservas de energia (no en cada entrenamiento). Ejemplos: EMOM 10' de 2 full press; EMOM 5' de 5 flexiones a press; EMOM 8' de 10s de aguante de plancha. Version simple: al terminar el ejercicio, se activa 1 min de descanso completo. Version dificil: el cronometro corre desde el inicio del ejercicio (si dura 20s, solo quedan 40s de descanso) - se reinicia cada minuto exacto. Puede hacerse solo con banda elastica si no queda energia."
]
},
{
"kind": "row",
"cells": [
"Trabajo con gomas/bandas (recordatorio)",
"Presente en todo el programa: banda ligera con nudos ajustables, retirar gradualmente. No debe facilitar en exceso; util incluso para sesiones completas en dias de cansancio extremo (trabajar trayectorias y tecnica sin castigar el cuerpo)."
]
},
{
"kind": "heading",
"text": "EJEMPLOS DE SESION 'CORRECTA' SEGUN SENSACION DEL DIA"
},
{
"kind": "row",
"cells": [
"Escenario",
"Estructura de sesion sugerida"
]
},
{
"kind": "row",
"cells": [
"Dia con FUERZA pero POCO CONTROL",
"Parte 1: calentamiento. Parte 2: volumen XXX/XXXX - flexiones a press - max spam. Parte 3: combinaciones cortas, probar nuevos agarres (wide/maltes). Parte 4: fortalecimiento tecnico buscando una forma mas limpia."
]
},
{
"kind": "row",
"cells": [
"Dia con CONTROL pero POCA FUERZA",
"Parte 1: calentamiento. Parte 2: combinaciones cortas. Parte 3: probar/trabajar una transicion concreta - trabajo de equilibrio. Parte 4: trabajo corto/deadstop y forma limpia con elastico."
]
}
]
},
{
"id": "front-lever-filosofia-y-tecnica",
"category": "Front Lever",
"title": "Filosofía y técnica",
"subtitle": "",
"blocks": [
{
"kind": "row",
"cells": [
"Aspecto",
"Descripcion"
]
},
{
"kind": "row",
"cells": [
"Musculos implicados",
"Dorsales (lats) = motor principal (jalar y mantener brazos rectos). Triceps = bloquean el codo. Redondo mayor (teres major) = estabiliza junto a dorsales. Romboides + trapecio medio/inferior = retraccion escapular. Abdomen/lumbar = evitan caida de pelvis."
]
},
{
"kind": "row",
"cells": [
"Retraccion escapular",
"Con brazos extendidos, apretar omoplatos hacia atras/columna (romboides + trapecio medio-inferior). Maximiza reclutamiento muscular, mejora la linea y reduce la distancia a la barra."
]
},
{
"kind": "row",
"cells": [
"Posicion de pelvis",
"Neutra o con ligera retroversion (activa gluteos). Dos posiciones validas: ligera depresion lumbar (curva sutil) o posicion lumbar neutra (espalda recta). Evitar exceso de curva o caida de pelvis."
]
},
{
"kind": "row",
"cells": [
"Posicion de cabeza",
"Dos opciones: 1) cabeza ligeramente atras (mejora estiramiento/apertura toracica) 2) mirar a los pies (control visual constante de la alineacion). Evitar tension cervical excesiva."
]
},
{
"kind": "row",
"cells": [
"Agarre",
"Pronacion: false grip (mas rapido progreso, requiere movilidad de muneca), strong grip (dificultad media), no false grip (mas dificil, solo dedos). Supinacion: similar pero enfatiza mas triceps que dorsal ancho. Recomendado para aprendizaje: pronacion con ligero false grip."
]
},
{
"kind": "row",
"cells": [
"Posicion de brazos",
"Completamente extendidos/bloqueados, ancho de hombros. Si hay hiperlaxitud de codo: rotacion externa del brazo (interior del codo mirando hacia arriba)."
]
},
{
"kind": "row",
"cells": [
"Posicion de piernas y pies",
"Piernas totalmente bloqueadas y rectas, contrayendo muslos y gemelos, 'estirando' hacia los talones. Pies: plana (recomendado por el autor), en punta, o relajados."
]
},
{
"kind": "row",
"cells": [
"Linea global valida",
"Hombros-cadera-rodillas-pies alineados + minimo de retraccion escapular + pelvis neutra/ligera retroversion. La proteccion (hombros hacia delante) no invalida el movimiento pero reduce rendimiento."
]
},
{
"kind": "row",
"cells": [
"Orden de correccion de forma",
"1) Piernas (rodillas extendidas, pies) 2) Cabeza 3) Pelvis 4) Retraccion escapular 5) Brazos completamente bloqueados. Corregir un elemento a la vez, nunca todos simultaneamente."
]
},
{
"kind": "row",
"cells": [
"Metodo Combo",
"Encadenar varios movimientos/skills sin pausa. Mejora fluidez, resistencia, control y coordinacion. Se hace al inicio de la sesion con energia fresca."
]
},
{
"kind": "row",
"cells": [
"Metodo Dropset",
"Llevar un ejercicio al fallo, luego bajar inmediatamente la dificultad (variante mas facil) sin descansar. Maximiza tiempo bajo tension."
]
},
{
"kind": "row",
"cells": [
"Bloque de fuerza (Muscle Strengthening)",
"Al final de la sesion (tras 5-10 min de descanso del bloque principal). Aumenta volumen, mejora trayectorias/forma. Usar bandas solo si ya no hay fuerza para peso corporal."
]
},
{
"kind": "row",
"cells": [
"Test de progreso al inicio de sesion",
"Al empezar cada sesion, probar una variante mas dificil que el nivel actual (3-5 intentos maximos, ~5 min descanso). Familiariza el cuerpo con la siguiente progresion aunque no se consiga aun."
]
},
{
"kind": "row",
"cells": [
"Frecuencia recomendada",
"~3 sesiones/semana como base solida (no hace falta entrenar 6-7 dias). Calidad de la sesion > cantidad. Avanzar de nivel cada 2-4 semanas segun progreso (objetivo: 2-4 meses para el front lever)."
]
},
{
"kind": "row",
"cells": [
"Trabajo de piernas",
"No es prioritario para rendimiento en fuerza/skills; el enfoque debe ser tren superior si el objetivo es rendimiento en movimientos de fuerza, no estetica."
]
},
{
"kind": "row",
"cells": [
"Uso de bandas elasticas",
"Utiles para aprender el patron de movimiento correcto y afinar la forma al final de sesion. No abusar: la dependencia de banda ralentiza el progreso en intensidad real."
]
},
{
"kind": "row",
"cells": [
"Bad form aceptado como fase",
"Trabajar en 'mala forma' al principio es valido y recomendado para ganar resistencia/fuerza; la forma se corrige progresivamente despues."
]
}
]
},
{
"id": "front-lever-catalogo-de-ejercicios",
"category": "Front Lever",
"title": "Catálogo de ejercicios",
"subtitle": "Requisito previo recomendado por el autor: minimo 5 dominadas estrictas + 15 Australian pull-ups",
"blocks": [
{
"kind": "row",
"cells": [
"Nivel de dificultad",
"Ejercicio"
]
},
{
"kind": "heading",
"text": "Facil (Easy)"
},
{
"kind": "row",
"cells": [
"Facil (Easy)",
"Australian pull up"
]
},
{
"kind": "row",
"cells": [
"Facil (Easy)",
"Lsit"
]
},
{
"kind": "row",
"cells": [
"Facil (Easy)",
"Leg raise"
]
},
{
"kind": "row",
"cells": [
"Facil (Easy)",
"Lsit pull up"
]
},
{
"kind": "row",
"cells": [
"Facil (Easy)",
"Pull up"
]
},
{
"kind": "row",
"cells": [
"Facil (Easy)",
"Chin up"
]
},
{
"kind": "row",
"cells": [
"Facil (Easy)",
"Tuck front lever"
]
},
{
"kind": "row",
"cells": [
"Facil (Easy)",
"Tuck front lever negative"
]
},
{
"kind": "row",
"cells": [
"Facil (Easy)",
"Tuck front lever raise"
]
},
{
"kind": "heading",
"text": "Normal"
},
{
"kind": "row",
"cells": [
"Normal",
"Tuck front lever pull up"
]
},
{
"kind": "row",
"cells": [
"Normal",
"Advanced tuck front lever"
]
},
{
"kind": "row",
"cells": [
"Normal",
"Tuck front lever to advanced tuck front lever"
]
},
{
"kind": "row",
"cells": [
"Normal",
"Advanced tuck front lever negative"
]
},
{
"kind": "row",
"cells": [
"Normal",
"Advanced tuck front lever raise"
]
},
{
"kind": "row",
"cells": [
"Normal",
"Advanced tuck front lever pull up"
]
},
{
"kind": "row",
"cells": [
"Normal",
"One leg front lever"
]
},
{
"kind": "row",
"cells": [
"Normal",
"Advanced tuck front lever to one leg front lever"
]
},
{
"kind": "heading",
"text": "Dificil (Difficult)"
},
{
"kind": "row",
"cells": [
"Dificil (Difficult)",
"One leg front lever negative"
]
},
{
"kind": "row",
"cells": [
"Dificil (Difficult)",
"One leg front lever raise"
]
},
{
"kind": "row",
"cells": [
"Dificil (Difficult)",
"One leg front lever pull up"
]
},
{
"kind": "row",
"cells": [
"Dificil (Difficult)",
"Tuck front lever to front lever"
]
},
{
"kind": "row",
"cells": [
"Dificil (Difficult)",
"Advanced tuck front lever to front lever"
]
},
{
"kind": "row",
"cells": [
"Dificil (Difficult)",
"One leg front lever to front lever"
]
},
{
"kind": "row",
"cells": [
"Dificil (Difficult)",
"Front lever negative"
]
},
{
"kind": "row",
"cells": [
"Dificil (Difficult)",
"Front lever raise"
]
},
{
"kind": "row",
"cells": [
"Dificil (Difficult)",
"Front lever"
]
}
]
},
{
"id": "front-lever-galeria-ampliada",
"category": "Front Lever",
"title": "Galería ampliada",
"subtitle": "Banco de sustitucion y variedad dentro del nivel del cliente, no un catalogo estructurado en Steps. Usar para romper el estancamiento sin perder la logica de progresion.",
"blocks": [
{
"kind": "row",
"cells": [
"Nivel",
"Principiante",
"Intermedio",
"Avanzado"
]
},
{
"kind": "heading",
"text": "GALERIA AMPLIADA - TIRON, POR NIVEL"
},
{
"kind": "row",
"cells": [
"Nota",
"Banco de sustitucion de tiron; no es un catalogo estructurado en Steps, solo variedad dentro del nivel del cliente. Se usa para romper el estancamiento variando ejercicios sin perder la logica de progresion."
]
},
{
"kind": "row",
"cells": [
"Ej. 1",
"Dead hangs",
"Chin-ups hold",
"Australian pull-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 2",
"Scapula pull-ups",
"Pull-ups hold",
"Close grip Australian pull-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 3",
"Negative chin-ups",
"Australian pull-ups",
"Wide grip Australian pull-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 4",
"Negative pull-ups",
"Close grip Australian pull-ups",
"Low half ROM chin-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 5",
"Chin-ups hold",
"Wide grip Australian pull-ups",
"High half ROM chin-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 6",
"Pull-ups hold",
"Low half ROM chin-ups",
"Low half ROM close grip chin-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 7",
"Australian pull-ups",
"High half ROM chin-ups",
"High half ROM close grip chin-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 8",
"Close grip Australian pull-ups",
"Low half ROM close grip chin-ups",
"Low half ROM pull-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 9",
"Wide grip Australian pull-ups",
"High half ROM close grip chin-ups",
"High half ROM pull-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 10",
"Low half ROM chin-ups",
"Low half ROM pull-ups",
"Low half ROM close grip pull-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 11",
"High half ROM chin-ups",
"High half ROM pull-ups",
"High half ROM close grip pull-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 12",
"Low half ROM close grip chin-ups",
"Low half ROM close grip pull-ups",
"Face pull"
]
},
{
"kind": "row",
"cells": [
"Ej. 13",
"High half ROM close grip chin-ups",
"High half ROM close grip pull-ups",
"Chin-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 14",
"Low half ROM pull-ups",
"Face pull",
"Pull-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 15",
"High half ROM pull-ups",
"Assisted pull-ups",
"Close grip chin-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 16",
"Low half ROM close grip pull-ups",
"Chin-ups",
"Close grip pull-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 17",
"High half ROM close grip pull-ups",
"Pull-ups",
"Wide grip chin-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 18",
"Face pull",
"Close grip chin-ups",
"Wide grip pull-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 19",
"Assisted pull-ups",
"Close grip pull-ups",
"Commando pull-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 20",
"Chin-ups",
"Wide grip chin-ups",
"Archer pull-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 21",
"Pull-ups",
"Wide grip pull-ups",
"L-sit pull-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 22",
"Commando pull-ups",
"Incline biceps curl",
"Impossible dips on straight bar"
]
},
{
"kind": "row",
"cells": [
"Ej. 23",
"Archer pull-ups",
"Pelican biceps curl",
"Weighted pull-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 24",
"L-sit pull-ups",
"Impossible dips on straight bar",
"Chest to bar pull-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 25",
"Incline biceps curl",
"Tuck front lever raises",
"Muscle-ups / muscle-ups on rings"
]
},
{
"kind": "row",
"cells": [
"Ej. 26",
"Pelican biceps curl",
"Tuck front lever hold",
"Tuck front lever raises / hold"
]
},
{
"kind": "row",
"cells": [
"Ej. 27",
"Impossible dips on straight bar",
"Tuck front lever pull-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 28",
"Tuck front lever raises",
"Advanced tuck front lever raises"
]
},
{
"kind": "row",
"cells": [
"Ej. 29",
"Tuck front lever hold",
"Full front lever kicks / raises"
]
},
{
"kind": "row",
"cells": [
"Ej. 30",
"Dragon flag reps"
]
},
{
"kind": "row",
"cells": [
"Ej. 31",
"Tucked Hefesto pull-ups"
]
},
{
"kind": "row",
"cells": [
"Ej. 32",
"Back lever touch hold"
]
},
{
"kind": "heading",
"text": "SUBGRUPOS DE FOCO MUSCULAR DENTRO DEL TIRON"
},
{
"kind": "row",
"cells": [
"Dorsales",
"deadhangs, scapula pull-ups, negative chin-ups/pull-ups, chin-ups/pull-ups hold, Australian pull-ups, half ROM chin-ups/pull-ups, hasta tuck/advanced tuck/full front lever raises y dragon flag en avanzado."
]
},
{
"kind": "row",
"cells": [
"Deltoides posterior",
"Australian pull-ups, wide grip Australian pull-ups, face pull, wide grip chin-ups, tuck front lever pull-ups (avanzado)."
]
},
{
"kind": "row",
"cells": [
"Biceps",
"chin-ups hold, close grip Australian pull-ups, half ROM chin-ups/pull-ups, close grip chin-ups/pull-ups, commando pull-ups, incline/pelican biceps curl, hasta tucked Hefesto pull-ups y back lever touch hold en avanzado."
]
}
]
},
{
"id": "front-lever-programas-l1-l4",
"category": "Front Lever",
"title": "Programas L1–L4",
"subtitle": "Avanzar de nivel cada 2-4 semanas segun progreso. Elegir por dia UN metodo (Combo o Dropset), nunca ambos el mismo dia. El bloque de Fuerza (Muscle Strengthening) es opcional/final.",
"blocks": [
{
"kind": "heading",
"text": "PROGRAM LEVEL 1"
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 1 -> METODO COMBO"
},
{
"kind": "row",
"cells": [
"Sets",
"Secuencia / Ejercicio",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"x1",
"Negative tuck front lever x1 - Pull up x3 - Max Lsit",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Leg raise x2 - Tuck front lever negative x2 - Max pull ups",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Leg raise x4 - Max tuck front lever raise - Max Lsit hold",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Tuck front lever hold 2s - Leg raise x3 - Max Lsit pull up",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Tuck front lever hold 3s - Tuck front lever pull up x1 - Max tuck front lever hold",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Tuck front lever hold 4s - Negative tuck front lever x2 - Max leg raises",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Tuck front lever pull up x1 - Tuck front lever hold 3s - Tuck front lever raise",
"3-5 min"
]
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 1 -> FUERZA (Muscle Strengthening, opcional/final)"
},
{
"kind": "row",
"cells": [
"Sets",
"Secuencia / Ejercicio",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"x3",
"Tuck front lever hold 5s",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x3",
"Tuck front lever pull up x5",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x3",
"Max pull ups",
"5 min"
]
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 1 -> METODO DROPSET"
},
{
"kind": "row",
"cells": [
"Sets",
"Secuencia / Ejercicio",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"70% max pull ups (rest ~20s) -> 50% max pull ups (rest ~20s) -> Max Lsit hold",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"Leg raise x3 (rest ~20s) -> Leg raise x3 (rest ~20s) -> Max hold Lsit",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"Negative tuck FL x4 (rest ~20s) -> Negative tuck FL x2 (rest ~20s) -> Negative tuck FL x2",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"Tuck FL raise x4 (rest ~20s) -> Tuck FL raise x2 (rest ~20s) -> Tuck FL raise x2",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"Tuck FL hold 5s (rest ~20s) -> Tuck FL hold 3s (rest ~20s) -> Tuck FL hold 2s",
"5 min"
]
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 1 -> FUERZA (Muscle Strengthening, opcional/final)"
},
{
"kind": "row",
"cells": [
"Sets",
"Secuencia / Ejercicio",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"x3",
"Max tuck front lever pull up",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x3",
"Max tuck front lever raise",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x3",
"Advanced tuck front lever hold 5s",
"5 min"
]
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 2"
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 2 -> METODO COMBO"
},
{
"kind": "row",
"cells": [
"Sets",
"Secuencia / Ejercicio",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"x1",
"Advanced tuck FL max hold - Tuck front pull up x1 - Tuck FL raise x1 - Tuck FL hold 3s",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Tuck FL hold 5s - Tuck FL pull up x3 - Tuck FL max hold",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Advanced tuck FL raise x2 - Tuck FL hold 3s - Max tuck FL pull up",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Tuck FL to one leg FL (no hold) x3 - Advanced tuck FL hold 2s - Tuck FL pull up x3",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Negative one leg FL x1 - Advanced tuck FL pull up x2 - Max tuck FL raise high ROM",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Advanced tuck FL pull up x4 - Negative one leg FL x1 - Advanced tuck FL max hold",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"One leg FL raise x1 - Advanced tuck FL raise x2 - Max advanced tuck FL pull up",
"3-5 min"
]
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 2 -> FUERZA (Muscle Strengthening, opcional/final)"
},
{
"kind": "row",
"cells": [
"Sets",
"Secuencia / Ejercicio",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"x3",
"Advanced tuck front lever pull up x5",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x3",
"Advanced tuck front lever raise x5",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x3",
"Advanced tuck front lever hold 10s",
"5 min"
]
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 2 -> METODO DROPSET"
},
{
"kind": "row",
"cells": [
"Sets",
"Secuencia / Ejercicio",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"Negative advanced tuck FL x2 (rest ~20s) -> Tuck FL pull up x3 (rest ~20s) -> Tuck FL max hold",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"Tuck FL to advanced tuck (deadstop) x3 (rest ~20s) -> Tuck raise x2 (rest ~20s) -> Tuck FL max hold",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"Negative one leg FL x1 (rest ~20s) -> Advanced tuck FL pull up x3 (rest ~20s) -> Max advanced tuck raise",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"Advanced tuck FL pull up x3 (rest ~20s) -> Tuck FL to one leg x2 (rest ~20s) -> Tuck FL max hold",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"One leg FL raise x2 (rest ~20s) -> Negative one leg FL x3 (rest ~20s) -> Advanced tuck FL max hold",
"5 min"
]
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 2 -> FUERZA (Muscle Strengthening, opcional/final)"
},
{
"kind": "row",
"cells": [
"Sets",
"Secuencia / Ejercicio",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"x3",
"Advanced tuck front lever pull up x5",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x3",
"Advanced tuck front lever raise x5",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x3",
"Advanced tuck to front lever hold 10s",
"5 min"
]
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 3"
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 3 -> METODO COMBO"
},
{
"kind": "row",
"cells": [
"Sets",
"Secuencia / Ejercicio",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"x1",
"One leg FL raise x2 - One leg FL hold 3s - One leg FL raise x1 - Negative one leg FL (slow) x1",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"One leg FL pull up x1 - One leg FL hold 3s - One leg FL raise x1 - Advanced tuck FL max hold",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"One leg FL hold 1s - Advanced tuck FL pull up x3 - One leg FL raise x1 - One leg FL max hold",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"FL (no hold) to one leg FL raise x1 - Negative FL (no hold) x1 - One leg FL max hold",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"One leg FL pull up x1 - Negative FL (no hold) x1 - Max one leg FL raise",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Negative FL (deadstop) x1 - One leg FL raise x1 - One leg FL hold 5s - Max advanced tuck FL pull up",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"One leg FL pull up (deadstop) x3 - One leg FL raise x1 - Negative one leg FL (slow) x1",
"3-5 min"
]
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 3 -> FUERZA (Muscle Strengthening, opcional/final)"
},
{
"kind": "row",
"cells": [
"Sets",
"Secuencia / Ejercicio",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"x3",
"One leg front lever raise x3",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x3",
"One leg front lever max hold",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x3",
"Max advanced tuck front lever pull up",
"5 min"
]
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 3 -> METODO DROPSET"
},
{
"kind": "row",
"cells": [
"Sets",
"Secuencia / Ejercicio",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"Negative FL x1 (rest ~20s) -> Negative FL x1 (rest ~20s) -> One leg FL max hold",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"One leg FL hold 5s (rest ~20s) -> One leg FL hold 3s (rest ~20s) -> Advanced tuck FL max hold",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"One leg FL raise x2 (rest ~20s) -> Negative FL (no hold) x1 (rest ~20s) -> One leg FL max hold",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"FL hold 1s (rest ~20s) -> One leg FL raise x2 (rest ~20s) -> Max one leg FL pull up",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"Negative FL x2 (rest ~20s) -> One leg FL raise x2 (rest ~20s) -> One leg FL raise x1",
"5 min"
]
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 3 -> FUERZA (Muscle Strengthening, opcional/final)"
},
{
"kind": "row",
"cells": [
"Sets",
"Secuencia / Ejercicio",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"x3",
"One leg front lever raise x3",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x3",
"One leg front lever max hold",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x3",
"Max advanced tuck front lever pull up",
"5 min"
]
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 4"
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 4 -> METODO COMBO"
},
{
"kind": "row",
"cells": [
"Sets",
"Secuencia / Ejercicio",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"x1",
"One leg FL hold 5s - FL raise x1 - Max one leg FL pull up",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"FL raise x1 - Negative FL (deadstop) - One leg FL raise x3 - One leg FL max hold",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"FL raise x2 - Negative FL hold 2s - Max one leg FL pull up",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Advanced tuck FL pull up x5 - FL raise x1 - Negative FL (no hold) x1 - One leg FL max hold",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"Tuck to FL (deadstop) x2 - FL raise x1 - Negative FL x1 - One leg FL hold 5s - One leg FL raise x1 - Negative one leg FL (deadstop) x1",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"FL hold 3s - One leg FL pull up x2 - One leg FL max hold",
"3-5 min"
]
},
{
"kind": "row",
"cells": [
"x1",
"FL pull up x2 - FL raise x1 - One leg FL pull up x2 - Max one leg FL raise",
"3-5 min"
]
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 4 -> FUERZA (Muscle Strengthening, opcional/final)"
},
{
"kind": "row",
"cells": [
"Sets",
"Secuencia / Ejercicio",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"x3",
"Full front lever raise x3",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x3",
"Front lever hold 5s",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x3",
"One leg front lever pull up x5",
"5 min"
]
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 4 -> METODO DROPSET"
},
{
"kind": "row",
"cells": [
"Sets",
"Secuencia / Ejercicio",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"FL raise x1 (rest ~20s) -> FL raise x1 (rest ~20s) -> One leg FL raise x2",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"Tuck to FL (deadstop) x3 (rest ~20s) -> Tuck to FL (deadstop) x2 (rest ~20s) -> One leg FL max hold",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"FL raise (deadstop) x1 (rest ~20s) -> FL raise x1 (rest ~20s) -> One leg FL max hold",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"One leg FL pull up x5 (rest ~20s) -> One leg FL pull up x3 (rest ~20s) -> Max advanced tuck FL pull up",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x1-3",
"FL hold 5s (rest ~20s) -> FL hold 3s (rest ~20s) -> One leg FL max hold",
"5 min"
]
},
{
"kind": "heading",
"text": "PROGRAM LEVEL 4 -> FUERZA (Muscle Strengthening, opcional/final)"
},
{
"kind": "row",
"cells": [
"Sets",
"Secuencia / Ejercicio",
"Descanso"
]
},
{
"kind": "row",
"cells": [
"x3",
"Full front lever raise x3",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x3",
"Front lever hold 5s",
"5 min"
]
},
{
"kind": "row",
"cells": [
"x3",
"One leg front lever pull up x5",
"5 min"
]
}
]
},
{
"id": "front-lever-nivel-2-filosofia-y-tecnica",
"category": "Front Lever",
"title": "Nivel 2 · Filosofía y técnica",
"subtitle": "Prerequisito: front lever estatico solido y tecnica basica ya consolidada antes de abordar press, pull up y touch.",
"blocks": [
{
"kind": "row",
"cells": [
"Aspecto",
"Descripcion"
]
},
{
"kind": "row",
"cells": [
"Mentalidad",
"La conexion mente-cuerpo condiciona el progreso. Ser consciente de las propias capacidades sin autolimitarse: una barrera mental cuesta mas superarla que una barrera fisica. Recurso clave: entrenamiento imaginario (visualizar el ejercicio/combo en la cabeza) para acostumbrar al sistema nervioso a una forma correcta antes de ejecutarla fisicamente."
]
},
{
"kind": "row",
"cells": [
"Lesiones mas comunes",
"Al trabajar power moves aumenta mucho el impacto muscular. Las lesiones mas frecuentes ocurren en redondos (teres), romboides o triceps, normalmente por ejecucion incorrecta (mala posicion de escapula/hombro). Tambien hay lesiones por sobrecarga muscular debido a activacion incorrecta que reparte la carga de forma desigual."
]
},
{
"kind": "row",
"cells": [
"Prevencion de lesiones",
"Buena condicion tendinosa/articular de base + ejecucion tecnica correcta son la clave. Si las articulaciones no estan sanas, fortalecer tendones especificamente antes de progresar."
]
},
{
"kind": "row",
"cells": [
"Mecanica del Press",
"Rotacion del cuerpo por efecto palanca hasta alcanzar la barra con las piernas. Codos completamente bloqueados (carga en dorsales, no en triceps), extension de cadera adecuada sin hiperextender, cuerpo en bloque. Intencion de 'bajar la barra' con el brazo extendido para transformar la fuerza en inercia circular. Progresion inicial: impulso de muneca o golpe de cabeza hacia atras."
]
},
{
"kind": "row",
"cells": [
"Mecanica del Pull up",
"Flexion de codos sin perder la linea, objetivo: cadera toca la barra. El triceps recibe la mayor carga en todo el recorrido. Los hombros pasan de rotacion interna (hold estatico) a rotacion externa progresiva hasta que el biceps mira a la barra. El false grip afecta el rango de recorrido y la implicacion del deltoides posterior en la parte final."
]
},
{
"kind": "row",
"cells": [
"Mecanica del Touch",
"Resultado estatico de mantener tension en la parte mas alta del recorrido del pull up, con la cadera en contacto con la barra. Musculos principales: triceps + deltoide posterior. Como en el pull up, se recomienda dominar primero con false grip antes de entrenarlo sin el."
]
},
{
"kind": "row",
"cells": [
"Uso de bandas elasticas",
"Las bandas alteran el centro de gravedad, por lo que no son la mejor opcion para trabajar fuerza real, sino para entender el patron de movimiento. Excepcion: el touch, donde la banda debe ayudar solo en el resto del recorrido (no en el propio touch) para permitir un pull up positivo sin dificultad extra y llegar a la posicion de touch con fuerza propia."
]
},
{
"kind": "row",
"cells": [
"Organizacion del entrenamiento",
"Press, pull up y touch se entrenan en sesiones separadas (no mezclar fuerza de tiron de pull up con fuerza de palanca de press) para maximizar el rendimiento en cada uno. Los ejercicios mas exigentes van primero en la sesion; los mas faciles al final, reduciendo series pero aumentando repeticiones."
]
},
{
"kind": "row",
"cells": [
"Principio Volumen <-> Forma",
"Primero se da estimulo de volumen al sistema nervioso, despues se aumenta la intensidad de ese mismo estimulo (correccion de forma). No exigir tecnica perfecta en cada repeticion desde el inicio, especialmente en un ejercicio recien empezado a entrenar."
]
},
{
"kind": "row",
"cells": [
"Principio Explosividad -> Control -> Deadstop",
"Progresion en 3 fases para ganar fuerza: 1) Explosividad cuando aun no hay fuerza suficiente (abre la puerta a mas volumen). 2) Control: repeticiones controladas con tension muscular constante una vez ganado volumen. 3) Deadstop: parar entre repeticiones cortando la tension, para maximizar la fuerza."
]
},
{
"kind": "row",
"cells": [
"Combos - cuando entrenarlos",
"Los combos generan mucha mas resistencia (se aprende a encadenar elementos acumulando carga), pero exigen mucha mas atencion del sistema nervioso. Si no se domina un elemento por separado, entrenarlo dentro de un combo impide ejecutarlo correctamente. Recomendacion: dominar cada elemento por separado antes de combinarlos; entrenar combos solo de vez en cuando (no a diario)."
]
},
{
"kind": "row",
"cells": [
"Combos - el orden importa",
"La dificultad y forma de ejecucion de un elemento varian segun lo que venga antes o despues. Ejemplo: un pull up justo despues de bajar de un press es mas dificil (mayor angulo de hombro) que si se espera medio segundo tras alcanzar la linea (el hombro recupera su angulo inicial). Al construir combos, buscar siempre el punto de mayor dificultad como base de referencia para progresar; sin incomodidad no hay progreso."
]
},
{
"kind": "row",
"cells": [
"Psicologia - Confianza",
"La confianza en uno mismo es clave para avanzar. Si el cuerpo intenta algo pero la mente no confia en lograrlo, ambas fuerzas se enfrentan en vez de sumar. Hay que ser el principal apoyo de uno mismo."
]
},
{
"kind": "row",
"cells": [
"Psicologia - Entrenamiento imaginario",
"Visualizar el propio entrenamiento en la cabeza entrena el sistema nervioso (la mente suele ejecutar una forma mas correcta que el cuerpo, mas lento en asimilar) y cambia el foco durante el esfuerzo real: en vez de pensar 'ya he superado mi record' al pasar el punto habitual, se piensa 'aun quedan X segundos', empujando mas alla del limite previo."
]
},
{
"kind": "row",
"cells": [
"Psicologia - Musica",
"Cada melodia genera estimulos y sensaciones asociables a elementos concretos del entrenamiento; escuchar un estilo o cancion especifica puede favorecer una mejor conexion neuronal y, por tanto, mayor rendimiento."
]
},
{
"kind": "row",
"cells": [
"Psicologia - Gestion de lesiones",
"Aceptar la lesion, entender que no se puede cambiar el hecho de estar lesionado, y enfocar la energia en la recuperacion (en vez de rumiar el tiempo o nivel perdido) es la via mas rapida hacia una recuperacion satisfactoria."
]
}
]
},
{
"id": "front-lever-nivel-2-rutinas-ejemplo",
"category": "Front Lever",
"title": "Nivel 2 · Rutinas ejemplo",
"subtitle": "Entrenar Press, Pull up y Touch en dias/sesiones separadas. Son ejemplos de referencia: la dificultad real varia segun cada atleta.",
"blocks": [
{
"kind": "heading",
"text": "PRESS"
},
{
"kind": "row",
"cells": [
"Sets x Reps",
"Ejercicio",
"Notas / Objetivo"
]
},
{
"kind": "row",
"cells": [
"4x2",
"Front lever negativo bajando mas alla de la linea + recuperar + hold",
"Trabaja el negativo en el rango del press; al bajar mas de lo habitual se fuerza la subida, aumentando la intensidad."
]
},
{
"kind": "row",
"cells": [
"4x2",
"Front lever positivo explosivo + press sin deadstop + negativo + hold",
"Trabaja la parte concentrica aprovechando la inercia de la primera parte del recorrido."
]
},
{
"kind": "row",
"cells": [
"3x3",
"Negativo explosivo + clavar el front lever",
"Mejora la explosividad generando gran esfuerzo en un periodo mas corto."
]
},
{
"kind": "row",
"cells": [
"3x4",
"Front lever positivo + hold",
"Clave para dominar el rango completo del movimiento."
]
},
{
"kind": "row",
"cells": [
"2x4",
"Pasar de posicion de remo (rowing) a posicion pike",
"Intensidad variable segun el atleta; mejor programarlo al inicio de la sesion, no al final."
]
},
{
"kind": "row",
"cells": [
"2x6",
"Scapula raises",
"Uno de los mejores ejercicios para solidificar el front lever a cualquier nivel."
]
},
{
"kind": "heading",
"text": "PULL UP"
},
{
"kind": "row",
"cells": [
"Sets x Reps",
"Ejercicio",
"Notas / Objetivo"
]
},
{
"kind": "row",
"cells": [
"4x2",
"Pull up parcial",
"Completar la parte inicial del recorrido; si no se logra, la tension generada ayuda al cuerpo a asimilar el patron."
]
},
{
"kind": "row",
"cells": [
"3x3",
"Pull up negativo (llegando con salto a la parte final)",
"Resistir la caida el maximo posible; la parte mas dificil es la mas alta (ahi se entrena especificamente el touch)."
]
},
{
"kind": "row",
"cells": [
"3x3",
"Pull up en tuck avanzado + negativo en full",
"Reduce la intensidad concentrica pero la aumenta en la fase excentrica, activando el musculo de forma mas completa."
]
},
{
"kind": "row",
"cells": [
"3x4",
"Pull ups en posicion de remo (rowing)",
"Ejercicio basico para ganar la fuerza de tiron necesaria para el pull up."
]
},
{
"kind": "row",
"cells": [
"2x6",
"Scapula raise",
"Ejercicio perfecto para ganar mas fuerza en el front lever."
]
},
{
"kind": "heading",
"text": "TOUCH"
},
{
"kind": "row",
"cells": [
"Sets x Reps",
"Ejercicio",
"Notas / Objetivo"
]
},
{
"kind": "row",
"cells": [
"4x2",
"Pull up a touch con banda fuerte pero floja",
"La banda ayuda en la primera parte del recorrido; el press se hace con intencion de quedarse pegado aunque no se logre. Se puede usar la banda para rebotar y hacer una segunda repeticion."
]
},
{
"kind": "row",
"cells": [
"3x3",
"Extension a touch desde touch en remo + negativo",
"Pegar la cadera a la barra en posicion de remo y extender las piernas hasta alinear el cuerpo; es normal caer, resistiendo la caida."
]
},
{
"kind": "row",
"cells": [
"3x3",
"Touch negativo desde posicion pike",
"Bajar tratando de despegar la cadera de la barra lo minimo posible; lo importante es generar tension, no quedarse completamente pegado."
]
},
{
"kind": "row",
"cells": [
"2x3",
"Rechazo (refusal) de touch en straddle",
"Una vez acumulada fatiga muscular, se repite el ejercicio con menor intensidad para cerrar el entrenamiento."
]
},
{
"kind": "row",
"cells": [
"2x6",
"Scapula raise",
"Se repite en las tres rutinas por su importancia central en la fuerza de front lever."
]
},
{
"kind": "text",
"text": "Recomendacion de agarre: dominar primero pull up y touch CON false grip, y progresivamente entrenarlos con menos o sin false grip."
}
]
},
{
"id": "elite-filosofia-y-progresion",
"category": "Élite",
"title": "Filosofía y progresión",
"subtitle": "Nivel superior a NLP3/555 (empuje) y Front Lever Nivel 2 (tiron), para clientes que ya han consolidado esos techos y quieren seguir progresando. Basado en bloques reales aportados por el coach.",
"blocks": [
{
"kind": "row",
"cells": [
"Aspecto",
"Descripcion"
]
},
{
"kind": "heading",
"text": "NIVEL ELITE - CONCEPTO GENERAL"
},
{
"kind": "row",
"cells": [
"Para quien es",
"Clientes que ya han consolidado el nivel maximo de los programas estandar: en empuje, Full Planche limpia con Next Level Planche (NLP1-NLP3, hasta el 555) y los Formatos Avanzados (Modulos 9-10); en tiron, el Programa Nivel 4 de Front Lever completo y el Front Lever Nivel 2 (power moves: press, pull-up, touch) ya consolidados. Aspiran a seguir subiendo el nivel mas alla de estos techos."
]
},
{
"kind": "row",
"cells": [
"Principio transversal",
"El nivel elite no se mide (solo) en repeticiones, sino en la AMPLITUD DEL AGARRE/POSICION DE BRAZOS. Cuanto mas se abren los brazos respecto a la posicion estandar, mayor la palanca y mayor la dificultad del movimiento, tanto en empuje como en tiron. La progresion de amplitud sustituye a la progresion de Step/Nivel como principal eje de dificultad."
]
},
{
"kind": "row",
"cells": [
"Rol del entrenador en este nivel",
"Igual que en NLP Modulos 9-10 y en la Autorregulacion Version Avanzada de Front Lever, el planning literal deja de ser suficiente: el entrenador (o la IA) debe adaptarse sesion a sesion a cada atleta de elite, usando los ejemplos de bloques de esta hoja como referencia y punto de partida, no como plantilla fija. Los ejemplos de programacion en 'Elite - Programa Ejemplo' son bloques reales aportados por el coach; sirven de modelo para construir nuevos bloques a medida."
]
},
{
"kind": "heading",
"text": "PROGRESION EN EMPUJE (PLANCHE) - de Full Planche/555 a Maltese"
},
{
"kind": "row",
"cells": [
"Paso 1 - Base consolidada",
"Full Planche limpia (555 o superior), con press y push-up dominados en forma estricta. Es el punto de entrada al nivel elite en empuje."
]
},
{
"kind": "row",
"cells": [
"Paso 2 - Wide Planche",
"Agarre mas ancho que el estandar. Al abrir el agarre, la palanca dificulta mucho el push-up (flexion) de planche, por lo que YA NO se prioriza el volumen de flexiones en wide: se prioriza el PRESS (subir desde el hold ancho hasta el handstand y bajar controlado) y el HOLD. El push-up en wide se mantiene como accesorio, no como eje principal."
]
},
{
"kind": "row",
"cells": [
"Paso 3 - XXX en Wide",
"Se aplica el mismo formato XXX que en NLP (rotando variantes: press-push-hold / push-press-hold / hold-press-push), pero en amplitud wide. El objetivo de repeticiones no tiene techo fijo (a diferencia del 555 clasico): se trabaja hacia el numero que el atleta pueda alcanzar con buena forma, por ejemplo 2-2-2 al empezar, subiendo progresivamente."
]
},
{
"kind": "row",
"cells": [
"Paso 4 - Maltese",
"Brazos totalmente abiertos en cruz (posicion de maltesa). Es el elemento de maxima amplitud y maxima dificultad del empuje: cuanto mas ancho el agarre, mas dificil. Se entrena con press (maltese press, incluida la variante supinada) y hold; representa el techo actual del nivel elite en empuje. Ahi es donde se 'juega' para seguir subiendo el nivel del atleta."
]
},
{
"kind": "row",
"cells": [
"Elementos de apoyo en la progresion",
"Arqueras (archer push-ups, priorizando siempre el brazo debil sobre el fuerte) para equilibrar la fuerza unilateral de cara a variantes a un brazo; Full planche push suelo para ganar rango; trabajo con ojos vendados (propiocepcion, igual que en NLP Modulos 9-10) aplicado a Wide y Maltese cuando ya hay control basico."
]
},
{
"kind": "heading",
"text": "PROGRESION EN TIRON (FRONT LEVER) - de Front Lever/Power Moves a SAT"
},
{
"kind": "row",
"cells": [
"Paso 1 - Base consolidada",
"Front Lever completo con pull-up y touch dominados (Front Lever Nivel 2 / power moves). El touch en este contexto es el aguante del front lever por ENCIMA de la barra (en vez de por debajo), lo que aumenta la palanca y la dificultad respecto al touch estandar de FL Nivel 2."
]
},
{
"kind": "row",
"cells": [
"Paso 2 - Wide (WEID)",
"Se abren mas las manos (agarre ancho) tanto en el pull-up como en el touch dentro de la posicion de front lever. Abrir el agarre dificulta el movimiento por palanca, igual que en empuje. Wide pull-up y wide touch son los ejercicios clave de este paso."
]
},
{
"kind": "row",
"cells": [
"Paso 3 - SAT",
"Brazos totalmente abiertos, aguantando la posicion de touch o wide touch: es el elemento de AGUANTE mas dificil de todo el sistema de tiron. Se entrena como hold estatico (SAT estatico), progresando en segundos con la menor asistencia de goma posible."
]
},
{
"kind": "row",
"cells": [
"Paso 4 - Pull-up a SAT",
"Una vez dominado el SAT estatico (referencia: 6+ segundos sin goma), se anade el componente dinamico: tirar un pull-up hasta la posicion de SAT. Es el elemento mas dificil de todo el catalogo de tiron elite."
]
},
{
"kind": "row",
"cells": [
"Paso 5 - XXX/XXXX en Tiron elite",
"Mismo principio que en empuje: formato XXX rotando hold-pull-up-wide touch (u otras combinaciones), sin techo de repeticiones fijo, subiendo el numero segun el atleta. Requiere especial atencion a la salud articular del codo por la mayor palanca (ver nota de precaucion en 'Elite - Programa Ejemplo')."
]
},
{
"kind": "row",
"cells": [
"Elementos de apoyo en la progresion",
"Front 1 brazo (front lever a un brazo, primero asistido con banda y luego como hold libre) como paso intermedio hacia el equilibrio unilateral; Hefesto (preparacion articular y fase excentrica) para proteger codo/hombro; touch supino como variante complementaria; arqueras combinadas (ambos brazos) como equivalente de tiron a las arqueras de empuje."
]
},
{
"kind": "heading",
"text": "PRINCIPIOS METODOLOGICOS QUE SE MANTIENEN EN NIVEL ELITE"
},
{
"kind": "row",
"cells": [
"Estructura de bloque",
"El nivel elite sigue usando la estructura de bloque de 8 semanas de 'Metodologia - Estructura': semanas 1-4 base y progresion, semanas 5-6 microciclo de fuerza bruta (spam + EMOM), semana 7 deload al 50%, semana 8 test general con preguntas concretas de referencia (ej. '¿SAT sin goma mas de 5 seg?', '¿wide touch fluido?')."
]
},
{
"kind": "row",
"cells": [
"Lastre (chaleco)",
"Se introduce en fases avanzadas del bloque elite, siempre en elementos base ya consolidados (nunca en elementos nuevos o en fase de aprendizaje), siguiendo la misma regla que en 'Metodos de Entrenamiento' / 'Resistencia - Principios'."
]
},
{
"kind": "row",
"cells": [
"Banda elastica (goma)",
"Se usa de forma progresiva y decreciente: mucha asistencia al introducir un elemento nuevo (Wide, SAT, Maltese, Front 1 brazo), reduciendola semana a semana hasta entrenar sin ella, igual que en el resto del sistema."
]
},
{
"kind": "row",
"cells": [
"Ojos vendados",
"Se aplica en fases avanzadas del bloque a elementos ya con cierto control (Maltese, SAT) para maximizar la propiocepcion, siempre en soporte bajo (paralelas bajas), nunca en soporte alto (ver 'NLP - Formatos Avanzados')."
]
},
{
"kind": "row",
"cells": [
"Personalizacion libre",
"Igual que en el resto de niveles avanzados, el entrenador puede y debe combinar libremente ejercicios de empuje y tiron elite segun la necesidad especifica del cliente, respetando las reglas de combos, XXX/XXXX, RIR y estructura semanal/de bloque (ver 'Metodologia - Programacion' e 'Como Personalizar Libremente')."
]
}
]
},
{
"id": "elite-catalogo-de-ejercicios",
"category": "Élite",
"title": "Catálogo de ejercicios",
"subtitle": "Catalogo de ejercicios propios del nivel elite, organizados por bloque de progresion. Complementa (no sustituye) los catalogos de Planche y Front Lever ya existentes.",
"blocks": [
{
"kind": "row",
"cells": [
"Ejercicio",
"Bloque",
"Descripcion / Como se entrena"
]
},
{
"kind": "heading",
"text": "EMPUJE - CATALOGO ELITE (Wide Planche -> Maltese)"
},
{
"kind": "row",
"cells": [
"Planche push-up",
"Base",
"Push-up de full planche en agarre estandar, ya consolidado. Punto de partida del bloque elite; se sigue usando como volumen base."
]
},
{
"kind": "row",
"cells": [
"Wide planche push-up",
"Wide",
"Push-up de planche con agarre mas ancho que el estandar. Accesorio, no eje principal: la palanca ancha dificulta mucho la flexion."
]
},
{
"kind": "row",
"cells": [
"Wide planche press",
"Wide",
"Subida desde el hold ancho hasta el handstand y bajada controlada. Es el ejercicio prioritario en la fase Wide, por delante del push-up."
]
},
{
"kind": "row",
"cells": [
"Wide planche hold",
"Wide",
"Mantener la posicion de planche con agarre ancho. Se entrena junto al press como base de la fase Wide."
]
},
{
"kind": "row",
"cells": [
"Maltese press (pronado)",
"Maltese",
"Press hacia la posicion de maltesa con los brazos totalmente abiertos en cruz. Elemento de maxima amplitud del empuje; cuanto mas ancho, mas dificil."
]
},
{
"kind": "row",
"cells": [
"Maltese press supinado",
"Maltese",
"Variante supinada del press a maltesa; activa la musculatura de forma distinta al press pronado. Se suele introducir con banda antes que la version pronada."
]
},
{
"kind": "row",
"cells": [
"Maltese hold",
"Maltese",
"Mantener la posicion de maltesa. Techo actual del nivel elite en empuje; se progresa reduciendo la asistencia de goma semana a semana."
]
},
{
"kind": "row",
"cells": [
"Full planche push suelo",
"Apoyo",
"Push-up de full planche realizado desde el suelo (sin paralelas), con mayor rango de movimiento que en paralelas. Se usa para ganar rango y como GTG de base."
]
},
{
"kind": "row",
"cells": [
"Arqueras (archer) brazo debil / brazo fuerte",
"Apoyo",
"Push-up de planche unilateral tipo arquera. Se prioriza siempre el brazo debil sobre el fuerte (ratio orientativo 3:1) para equilibrar la fuerza de cara a variantes a un brazo."
]
},
{
"kind": "row",
"cells": [
"Planche push-up ojos vendados",
"Propiocepcion",
"Push-up de planche (wide o maltese segun el nivel) con los ojos vendados, en paralelas bajas. Maximiza la propiocepcion y la confianza; nunca en soporte alto."
]
},
{
"kind": "row",
"cells": [
"XXX / XXXX Wide-Maltese",
"Formato",
"Formato XXX/XXXX aplicado a amplitud elite: rotar variantes (press-push-hold / push-press-hold / hold-press-push) sin techo de repeticiones fijo, subiendo el numero segun el atleta (ej. 2-2-2 al empezar)."
]
},
{
"kind": "heading",
"text": "TIRON - CATALOGO ELITE (Wide/WEID -> SAT)"
},
{
"kind": "row",
"cells": [
"Front pull-up",
"Base",
"Pull-up dentro de la posicion de front lever con agarre estandar, ya consolidado. Se mantiene como volumen base del bloque elite."
]
},
{
"kind": "row",
"cells": [
"Touch (por encima de la barra)",
"Base",
"Aguante del front lever por ENCIMA de la barra (en vez de por debajo, como en FL Nivel 2). Aumenta la palanca y la dificultad respecto al touch estandar."
]
},
{
"kind": "row",
"cells": [
"Wide pull-up (WEID)",
"Wide",
"Pull-up dentro del front lever con agarre mas ancho que el estandar. La apertura de manos dificulta el movimiento por palanca; ejercicio clave de la fase Wide."
]
},
{
"kind": "row",
"cells": [
"Wide touch",
"Wide",
"Touch (ver arriba) realizado con agarre ancho. Mas dificil que el touch estandar; suele progresar hacia el SAT."
]
},
{
"kind": "row",
"cells": [
"Touch supino",
"Apoyo",
"Variante supina del touch; se usa como ejercicio complementario dentro del volumen de tiron elite."
]
},
{
"kind": "row",
"cells": [
"SAT estatico",
"SAT",
"Hold estatico con los brazos totalmente abiertos, sosteniendo la posicion de touch o wide touch. Es el elemento de aguante mas dificil de todo el sistema de tiron. Se progresa en segundos reduciendo la goma; referencia: 6+ segundos sin goma marca el paso al siguiente elemento."
]
},
{
"kind": "row",
"cells": [
"SAT pull-up",
"SAT",
"Pull-up hasta la posicion de SAT, una vez el SAT estatico esta dominado (6+ segundos sin goma). Es el elemento dinamico mas dificil de todo el catalogo de tiron elite."
]
},
{
"kind": "row",
"cells": [
"SAT ojos vendados",
"Propiocepcion",
"SAT estatico con los ojos vendados, en soporte bajo. Se introduce cuando ya hay control basico del SAT, para maximizar la propiocepcion."
]
},
{
"kind": "row",
"cells": [
"Front 1 brazo (asistido / hold)",
"Apoyo",
"Front lever a un solo brazo. Se empieza asistido con banda (hold corto) y se progresa hacia el hold libre; paso intermedio hacia el equilibrio unilateral en tiron."
]
},
{
"kind": "row",
"cells": [
"Arqueras combinadas (ambos brazos)",
"Apoyo",
"Equivalente en tiron de las arqueras de empuje: trabajo unilateral combinando ambos brazos en la misma serie, buscando equilibrio entre ambos lados."
]
},
{
"kind": "row",
"cells": [
"Hefesto (prep / excentrico)",
"Apoyo",
"Ejercicio ya presente en el catalogo general de tiron (ver 'FL - Galeria Ampliada'). En nivel elite se trabaja primero como preparacion de movilidad y despues en fase excentrica lenta con negativas, para proteger la salud articular del codo/hombro antes de exponerlo a Wide/SAT."
]
},
{
"kind": "row",
"cells": [
"XXX / XXXX Tiron",
"Formato",
"Formato XXX/XXXX rotando hold-pull-up-wide touch (u otras combinaciones equivalentes), sin techo de repeticiones fijo. Requiere vigilar especialmente la salud articular del codo por la mayor palanca de los agarres anchos."
]
}
]
},
{
"id": "elite-programa-ejemplo",
"category": "Élite",
"title": "Programa ejemplo",
"subtitle": "Bloques reales aportados por el coach, transcritos como referencia. Cada fase sigue la estructura de bloque de 8 semanas de 'Metodologia - Estructura' (sem 1-4 base/progresion, sem 5-6 microciclo de fuerza bruta, sem 7 deload, sem 8 test).",
"blocks": [
{
"kind": "row",
"cells": [
"Ejercicio",
"Series x Reps/Seg",
"Descanso",
"Nota"
]
},
{
"kind": "text",
"text": "FASE 1 - BASE ELITE: VOLUMEN Y GTG (introduccion de Wide, Maltese, SAT, Front 1 brazo)"
},
{
"kind": "heading",
"text": "LUNES - Empuje volumen"
},
{
"kind": "row",
"cells": [
"Planche push-up",
"4 x 10 reps",
"2.5 min",
"-"
]
},
{
"kind": "row",
"cells": [
"Planche press",
"4 x 8 reps",
"2.5 min",
"-"
]
},
{
"kind": "row",
"cells": [
"Maltese press",
"GTG 4 x 3-4 reps",
"3 min",
"Con goma"
]
},
{
"kind": "row",
"cells": [
"Full planche push suelo",
"GTG 3 x 2 reps",
"3 min",
"Base + GTG: familiarizar el patron antes de anadir intensidad"
]
},
{
"kind": "heading",
"text": "MARTES - Tiron volumen"
},
{
"kind": "row",
"cells": [
"Front pull-up",
"4 x 12 reps",
"2 min",
"-"
]
},
{
"kind": "row",
"cells": [
"Wide pull-up",
"GTG 5 x 10-11 reps",
"2.5 min",
"Prioridad de la sesion"
]
},
{
"kind": "row",
"cells": [
"Touch",
"3 x 8 reps",
"3 min",
"-"
]
},
{
"kind": "row",
"cells": [
"SAT estatico",
"4 x 5-6 seg",
"3.5 min",
"Con goma progresiva"
]
},
{
"kind": "heading",
"text": "MIERCOLES - Descanso (recuperacion activa)"
},
{
"kind": "heading",
"text": "JUEVES - Empuje + arqueras"
},
{
"kind": "row",
"cells": [
"Arqueras brazo debil",
"GTG 6 x 2-3 reps",
"3 min",
"Ratio 3:1 respecto al brazo fuerte. Prioridad absoluta semanas 1-8"
]
},
{
"kind": "row",
"cells": [
"Arqueras brazo fuerte",
"2 x 3 reps",
"3 min",
"Solo mantenimiento"
]
},
{
"kind": "row",
"cells": [
"Maltese press supinado",
"4 x 3-4 reps",
"3.5 min",
"Con goma"
]
},
{
"kind": "row",
"cells": [
"Planche supino push-up",
"3 x 6-7 reps",
"2.5 min",
"Trabajar siempre primero el brazo debil en arqueras"
]
},
{
"kind": "heading",
"text": "VIERNES - Tiron + SAT + wide touch"
},
{
"kind": "row",
"cells": [
"SAT estatico",
"5 x 5-7 seg",
"4 min",
"Con goma progresiva"
]
},
{
"kind": "row",
"cells": [
"Wide touch",
"GTG 4 x 4-5 reps",
"3 min",
"Pausa 1 seg. Progresion hacia SAT pull-up"
]
},
{
"kind": "row",
"cells": [
"Front 1 brazo asistido",
"GTG 4 x 2-3 seg hold",
"4 min",
"Con goma fuerte"
]
},
{
"kind": "row",
"cells": [
"Hefesto prep",
"Sem 1-4: movilidad 3x8. Sem 5-8: excentrica 3x3",
"-",
"Goma fuerte al final. SAT y wide touch son la prioridad de la sesion"
]
},
{
"kind": "heading",
"text": "SABADO - Fuerte mixto (sesion mas exigente de la semana)"
},
{
"kind": "row",
"cells": [
"Planche push-up",
"4 x 12 reps",
"3 min",
"Subir reps por serie"
]
},
{
"kind": "row",
"cells": [
"Wide pull-up",
"4 x 12-13 reps",
"2.5 min",
"-"
]
},
{
"kind": "row",
"cells": [
"Maltese press",
"GTG 4 x 4-5 reps",
"3.5 min",
"Con goma minima"
]
},
{
"kind": "row",
"cells": [
"SAT estatico",
"4 x max seg limpios",
"4 min",
"-"
]
},
{
"kind": "row",
"cells": [
"Arqueras combinadas",
"3 x 3 reps c/brazo",
"3 min",
"-"
]
},
{
"kind": "heading",
"text": "DOMINGO - GTG suave (frecuencia sin fatiga)"
},
{
"kind": "row",
"cells": [
"Full planche push suelo",
"4 x 2 reps",
"-",
"Al 50% de esfuerzo"
]
},
{
"kind": "row",
"cells": [
"Wide touch",
"4 x 3-4 reps",
"-",
"Sin forzar"
]
},
{
"kind": "row",
"cells": [
"Front 1 brazo hold",
"4 x 2 seg",
"-",
"Con goma, tecnico"
]
},
{
"kind": "row",
"cells": [
"Maltese press",
"3 x 3 reps",
"-",
"Con goma, ligero"
]
},
{
"kind": "text",
"text": "Sem 5-6 (microciclo de fuerza bruta): spam de wide pull-up y planche push-up el sabado; EMOM de 8 min x SAT 4 seg cada minuto el domingo al final. Sem 7: deload al 50%. Sem 8 (test): ¿arqueras del brazo debil igualado con el fuerte? ¿SAT sin goma mas de 5 seg? ¿Wide touch fluido?"
},
{
"kind": "text",
"text": "FASE 2 - XXX ELITE: INTRODUCCION DEL FORMATO XXX EN WIDE/MALTESE Y TIRON"
},
{
"kind": "heading",
"text": "LUNES - Empuje volumen"
},
{
"kind": "row",
"cells": [
"Planche push-up",
"4 x 11-12 reps",
"2.5 min",
"Subir reps de base respecto a la Fase 1"
]
},
{
"kind": "row",
"cells": [
"Planche press supinado",
"4 x 9-10 reps",
"2.5 min",
"Prioridad"
]
},
{
"kind": "row",
"cells": [
"Maltese press supinado",
"4 x 5-6 reps",
"3.5 min",
"Con goma minima"
]
},
{
"kind": "row",
"cells": [
"Full planche push suelo",
"4 x 3-4 reps",
"3 min",
"Sin goma"
]
},
{
"kind": "heading",
"text": "MARTES - Tiron volumen"
},
{
"kind": "row",
"cells": [
"Front pull-up",
"4 x 13-14 reps",
"2 min",
"-"
]
},
{
"kind": "row",
"cells": [
"Wide pull-up",
"5 x 12 reps",
"2.5 min",
"Prioridad"
]
},
{
"kind": "row",
"cells": [
"Wide touch",
"4 x 6-7 reps",
"3 min",
"Pausa 1 seg"
]
},
{
"kind": "row",
"cells": [
"SAT estatico",
"4 x 6-8 seg",
"4 min",
"Sin goma. Objetivo de la sesion: wide + SAT"
]
},
{
"kind": "heading",
"text": "MIERCOLES - Descanso (recuperacion activa)"
},
{
"kind": "heading",
"text": "JUEVES - Empuje - XXX"
},
{
"kind": "row",
"cells": [
"XXX Empuje",
"2-3 x XXX EMPUJE. Sem 1-2: hold-push-press (6-6-6). Sem 3-4: push-press-hold (7-7-7). Sem 5-6: press-hold-push (7-7-7)",
"7-10 min entre intentos",
"Rotar el orden segun la variante mas debil"
]
},
{
"kind": "row",
"cells": [
"Arqueras combinadas",
"5 x 3 reps c/brazo",
"3 min",
"Ambos brazos"
]
},
{
"kind": "row",
"cells": [
"Hefesto excentrico",
"3 x 3 negativas lentas",
"4 min",
"Con goma reducida. Rotar el orden cada 2 semanas"
]
},
{
"kind": "heading",
"text": "VIERNES - Tiron - XXX experimental"
},
{
"kind": "row",
"cells": [
"XXX Tiron (explorar)",
"2 x XXX TIRON: hold-pull-up-wide touch",
"7-10 min",
"Observar el codo con atencion"
]
},
{
"kind": "row",
"cells": [
"Front 1 brazo",
"GTG 4 x 3-4 seg hold",
"4 min",
"Con goma reducida"
]
},
{
"kind": "row",
"cells": [
"SAT pull-up (si SAT >6 seg)",
"4 x 2-3 reps",
"4 min",
"Con goma; si no llega a 6 seg de SAT, sustituir por wide touch + volumen"
]
},
{
"kind": "heading",
"text": "SABADO - Fuerte mixto (mixto intenso)"
},
{
"kind": "row",
"cells": [
"Planche push-up + lastre",
"3 x 6-8 reps",
"4 min",
"Con chaleco"
]
},
{
"kind": "row",
"cells": [
"Wide pull-up",
"4 x 13-14 reps",
"3 min",
"Maximas"
]
},
{
"kind": "row",
"cells": [
"Maltese press supinado",
"4 x 5-6 reps",
"4 min",
"Con goma minima"
]
},
{
"kind": "row",
"cells": [
"SAT + lastre (si >6 seg)",
"4 x 4-5 reps",
"4 min",
"Con chaleco"
]
},
{
"kind": "row",
"cells": [
"Touch supino",
"3 x 5-6 reps",
"3 min",
"-"
]
},
{
"kind": "heading",
"text": "DOMINGO - GTG suave (tecnico, sin fatiga)"
},
{
"kind": "row",
"cells": [
"Full planche push suelo",
"4 x 3 reps",
"-",
"Tecnico"
]
},
{
"kind": "row",
"cells": [
"Wide touch",
"4 x 4 reps",
"-",
"Con pausa"
]
},
{
"kind": "row",
"cells": [
"Front 1 brazo",
"4 x 2-3 seg",
"-",
"Con goma"
]
},
{
"kind": "row",
"cells": [
"Maltese press",
"3 x 3 reps",
"-",
"Con goma, ligero"
]
},
{
"kind": "text",
"text": "Sem 5-6: spam el sabado (wide pull-up + planche push-up). EMOM domingo: 10 min x SAT 5 seg / Maltese 5 seg alternando. Lastre solo en elementos base ya consolidados. Sem 7: deload. Sem 8 (test XXX): ¿nuevo record 9-9-9? ¿Hefesto con repeticion parcial real? ¿SAT pull-up sin goma?"
},
{
"kind": "heading",
"text": "FASE 3 - XXXX ELITE: MAXIMA AMPLITUD, LASTRE Y TEST GENERAL"
},
{
"kind": "heading",
"text": "LUNES - Empuje volumen alto"
},
{
"kind": "row",
"cells": [
"Planche push-up",
"5 x 12-13 reps",
"2.5 min",
"-"
]
},
{
"kind": "row",
"cells": [
"Maltese press supinado",
"4 x 5-6 reps",
"4 min",
"Sin goma. Prioridad de la sesion"
]
},
{
"kind": "row",
"cells": [
"Arqueras ambos brazos",
"4 x 4 reps c/brazo",
"3 min",
"Equilibrados"
]
},
{
"kind": "row",
"cells": [
"Full planche push suelo",
"3 x 4-5 reps",
"3 min",
"Sin forzar"
]
},
{
"kind": "heading",
"text": "MARTES - Tiron volumen alto"
},
{
"kind": "row",
"cells": [
"Wide pull-up",
"5 x 13-14 reps",
"2.5 min",
"-"
]
},
{
"kind": "row",
"cells": [
"Touch supino wide",
"4 x 5-6 reps",
"3.5 min",
"Sin goma. Prioridad de la sesion"
]
},
{
"kind": "row",
"cells": [
"SAT pull-up",
"4 x 3-4 reps",
"4 min",
"Sin goma"
]
},
{
"kind": "row",
"cells": [
"Front 1 brazo",
"4 x 3-4 seg hold",
"4 min",
"Con goma minima"
]
},
{
"kind": "heading",
"text": "MIERCOLES - Descanso (recuperacion activa)"
},
{
"kind": "heading",
"text": "JUEVES - Empuje - XXXX"
},
{
"kind": "row",
"cells": [
"XXXX Empuje",
"2 x XXXX EMPUJE: Maltese press x2 con pausa 20 seg (a reducir progresivamente) -> XXX push-press-hold",
"8-10 min entre intentos",
"Formato consolidado. Reducir la pausa cada 2 semanas"
]
},
{
"kind": "row",
"cells": [
"Hefesto",
"3 x 2-3 reps",
"4 min",
"Con goma minima; contar solo repeticiones parciales reales si la fase excentrica es solida"
]
},
{
"kind": "row",
"cells": [
"Planche push-up ojos vendados",
"3 x 5 reps",
"3 min",
"En paralelas bajas, foco en propiocepcion"
]
},
{
"kind": "heading",
"text": "VIERNES - Tiron - XXX + 1 brazo"
},
{
"kind": "row",
"cells": [
"XXX Tiron",
"2-3 x XXX TIRON, rotando: hold-pull-up-wide touch / wide-hold-pull-up",
"7-10 min entre intentos",
"Formato consolidado"
]
},
{
"kind": "row",
"cells": [
"Front 1 brazo",
"4 x 4-5 seg",
"4 min",
"Con goma minima; maximo valor competitivo"
]
},
{
"kind": "row",
"cells": [
"SAT ojos vendados",
"3 x max seg",
"4 min",
"En paralelas bajas, con control"
]
},
{
"kind": "heading",
"text": "SABADO - Fuerte mixto (sesion mas exigente del ciclo)"
},
{
"kind": "row",
"cells": [
"Planche push-up + lastre",
"3 x 8 reps",
"4 min",
"Con chaleco"
]
},
{
"kind": "row",
"cells": [
"Wide pull-up + lastre",
"3 x 8-10 reps",
"4 min",
"Con chaleco"
]
},
{
"kind": "row",
"cells": [
"Maltese press supinado",
"4 x 6 reps",
"4 min",
"Sin goma"
]
},
{
"kind": "row",
"cells": [
"SAT + lastre",
"4 x 5-6 reps",
"4 min",
"Con chaleco"
]
},
{
"kind": "row",
"cells": [
"Hefesto",
"2 x 2 reps",
"5 min",
"Con goma solo si es necesario"
]
},
{
"kind": "heading",
"text": "DOMINGO - GTG suave (activacion, sin fatiga)"
},
{
"kind": "row",
"cells": [
"Touch supino wide",
"4 x 3 reps",
"-",
"Tecnico"
]
},
{
"kind": "row",
"cells": [
"Full planche push suelo",
"4 x 3 reps",
"-",
"Sin forzar"
]
},
{
"kind": "row",
"cells": [
"Front 1 brazo",
"3 x 2-3 seg",
"-",
"Ligero"
]
},
{
"kind": "row",
"cells": [
"Maltese press",
"3 x 3 reps",
"-",
"Con goma, tecnico"
]
},
{
"kind": "text",
"text": "Sem 5-6: spam el sabado + EMOM con lastre el domingo (SAT con chaleco / Maltese con chaleco, alternando). Ojos vendados en Maltese y en SAT, siempre en paralelas bajas. Sem 7: deload. Sem 8 (test general completo): repasar todos los elementos del bloque elite, grabarse en video y comparar con el inicio del ciclo. Este test define la base del siguiente ciclo de entrenamiento."
}
]
},
{
"id": "metodologia-ficha-de-cliente-referencia",
"category": "Metodología",
"title": "Ficha de cliente (referencia)",
"subtitle": "Rellena las celdas amarillas para cada cliente. Duplica esta hoja por cliente si prefieres un archivo por persona.",
"blocks": [
{
"kind": "heading",
"text": "DATOS BASICOS"
},
{
"kind": "heading",
"text": "Nombre del cliente"
},
{
"kind": "heading",
"text": "Fecha de evaluacion"
},
{
"kind": "heading",
"text": "Edad"
},
{
"kind": "heading",
"text": "Peso / Altura (opcional)"
},
{
"kind": "heading",
"text": "Objetivo principal (ej: Full Planche, Front Lever, ambos)"
},
{
"kind": "heading",
"text": "Dias/semana disponibles para entrenar"
},
{
"kind": "heading",
"text": "EVALUACION - PLANCHE"
},
{
"kind": "heading",
"text": "Nivel actual (usa hoja 'Planche - Steps' como referencia)"
},
{
"kind": "heading",
"text": "Punto fuerte identificado (parte del movimiento que resulta mas facil)"
},
{
"kind": "heading",
"text": "Punto debil principal 1 (ranking: mas dificil)"
},
{
"kind": "heading",
"text": "Punto debil principal 2"
},
{
"kind": "heading",
"text": "Punto debil principal 3 (ranking: menos dificil)"
},
{
"kind": "heading",
"text": "Step de inicio recomendado (I-V)"
},
{
"kind": "heading",
"text": "EVALUACION - FRONT LEVER"
},
{
"kind": "heading",
"text": "Dominadas estrictas maximas (prerequisito: >=5)"
},
{
"kind": "heading",
"text": "Australian pull-ups maximas (prerequisito: >=15)"
},
{
"kind": "heading",
"text": "Mejor variante conseguida (tuck / advanced tuck / one leg / full)"
},
{
"kind": "text",
"text": "Punto debil principal (retraccion escapular / pelvis / brazos / piernas)"
},
{
"kind": "heading",
"text": "Nivel de programa recomendado (1-4)"
},
{
"kind": "heading",
"text": "PLANNING SEMANAL PERSONALIZADO"
},
{
"kind": "row",
"cells": [
"Dia",
"Foco del dia",
"Ejercicios / Combos seleccionados (ver hojas de catalogo)",
"Notas / Intensidad"
]
},
{
"kind": "heading",
"text": "Lunes"
},
{
"kind": "heading",
"text": "Martes"
},
{
"kind": "heading",
"text": "Miercoles"
},
{
"kind": "heading",
"text": "Jueves"
},
{
"kind": "heading",
"text": "Viernes"
},
{
"kind": "heading",
"text": "Sabado"
},
{
"kind": "heading",
"text": "Domingo"
},
{
"kind": "heading",
"text": "SEGUIMIENTO / FEEDBACK"
},
{
"kind": "row",
"cells": [
"Fecha",
"Sesion realizada",
"Sensacion (1-5)",
"Comentarios del cliente / ajustes"
]
}
]
}
];
