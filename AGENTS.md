# Pulso Público Argentina — guía para agentes

> **Qué está pasando. Dónde. Y cómo lo sabemos.**

Leé este archivo antes de modificar el proyecto. Es una brújula editorial y de trabajo, no una invitación a rediseñarlo.

## Qué es Pulso

Pulso Público es una **publicación interactiva de información argentina**. Tiene algo de magazine: se puede recorrer por temas, descubrir una historia detrás de un número y mirar el país desde distintos ángulos. Los datos no están para impresionar ni para dictar conclusiones; están para ayudar a entender.

Hoy se recorre en tres secciones, con propósitos distintos:

- **Pulso Nacional:** indicadores públicos y su contexto.
- **Pulso Territorial:** información situada en el mapa y en el tiempo.
- **Pulso Evidencia:** relaciones y afirmaciones que necesitan método, matices y contexto faltante.

No es una consola de alertas, un tablero de vigilancia, un agregador indiscriminado de noticias ni una extensión de GeoPlatform. No conviertas cada idea nueva en otra plataforma o en otra sección.

## Cuidá el ritmo que ya existe

La identidad y la composición actuales son decisiones conscientes. Antes de tocar la interfaz, leé `src/App.tsx`, `src/styles.css`, `src/territorial.css` y los diseños en `docs/superpowers/specs/`.

- Mantené el recorrido editorial: **titular → dato → contexto → fuente**. El detalle se consulta sin competir con lo principal.
- Conservá la base oscura, el texto claro, el dorado contenido, los espacios amplios, la tipografía y el contraste entre cifras, títulos y metadatos. La serif puntual en Evidencia es parte de ese lenguaje.
- Priorizá pequeños ajustes de legibilidad, jerarquía, contraste, responsive y accesibilidad. Evitá rehacer secciones completas, sumar tarjetas por reflejo o llenar la pantalla de controles.
- Si proponés cambiar un ritmo visual, mostrá qué problema concreto resuelve y comparalo con la pantalla actual. No copies estilos de otros sitios sin criterio.

## Cómo escribir

Escribí **para una persona curiosa**, en español argentino claro. Primero contá qué muestra el dato y por qué vale la pena mirarlo; después explicá el método. Preferí títulos y bajadas breves, sin grandilocuencia ni jerga de ingeniería.

El `README.md` ya tiene una voz y una estructura logradas: **no lo reescribas por rutina**. No lo conviertas en una lista de funcionalidades, roadmap técnico ni registro de cada commit. Dejá los detalles de implementación en la documentación técnica.

## La confianza es parte del diseño

Cada señal debe conservar **valor, unidad, lugar, período/hora, procedencia, método, actualización y límites**, según el contrato que le corresponda.

- **Sin dato no es cero.** Una consulta reciente no vuelve reciente una observación vieja.
- **Modelo no es observación.** Una nube modelada no es imagen satelital ni la humedad permite deducir nubosidad.
- **Señal no es conclusión.** Un foco térmico no confirma un incendio; una asociación histórica no predice una cosecha; coincidencia no es causalidad.
- No inventes interpolaciones, promedios provinciales, alertas ni niveles de riesgo que las fuentes no respalden.
- Distinguí siempre **fuente, dato, interpretación e hipótesis**. Si algo falla, mostrá el límite sin borrar un snapshot válido.
- Delimitá el alcance espacial real: una geometría que dibuja la Antártida no significa que la malla meteorológica la cubra. Continente, mar y sector antártico requieren fuentes, coberturas y decisiones cartográficas explícitas.

## Antes de sumar un tema

Argentina tiene muchas preguntas posibles: ambiente, mar, agro, ciencia, energía, territorio, infraestructura. No se agregan todas de golpe.

Para proponer un nuevo contenido, respondé primero:

1. **¿Qué pregunta concreta puede hacerse alguien que vive o trabaja en Argentina?**
2. **¿Qué fuente verificable responde esa pregunta?** Revisá cobertura, fecha, licencia y continuidad.
3. **¿Qué puede decirse y qué no?** Separá datos oficiales, modelos y análisis propios.
4. **¿Dónde se lee mejor?** Una cifra, un mapa o una pieza de Evidencia; no todo necesita una capa.
5. **¿Cómo se mantiene?** Indicá actualización, fallos posibles y costo operativo.

**Mar Argentino y Antártida son líneas posibles de investigación, no funciones ya implementadas.** Una propuesta no se presenta como disponibilidad real hasta tener datos y pruebas.

## Cómo trabajar en este repositorio

- Inspeccioná el código y las decisiones existentes antes de modificar; preservá contratos y nombres cuando no haya un motivo claro para cambiarlos.
- La aplicación React lee **snapshots públicos estáticos**. Los adaptadores consultan fuentes fuera del navegador. No agregues llamadas directas del frontend a proveedores ni un backend nuevo sin una necesidad demostrada.
- Hacé cambios pequeños y aislados, con pruebas de regresión. Ejecutá `npm run test:run` y `npm run build` para cambios de código.
- Trabajá en rama y explicá en el PR **qué problema del lector resolvés**, qué cambiaste, qué dejaste intacto y qué límites siguen abiertos.
- Para cambios visuales, comprobá desktop y móvil. Para nuevos datos, probá nulos, antigüedad, fuentes caídas y etiquetas de procedencia.
- No presentes un despliegue, una fuente ni una verificación como completados si no los comprobaste.

## Referencias, no plantillas

Para aprender de criterio editorial y claridad de datos —sin copiarles la estética—:

- [Our World in Data](https://ourworldindata.org/about): conectar preguntas, visualizaciones y explicaciones.
- [Datawrapper Academy](https://www.datawrapper.de/academy/annotate-tab): títulos, notas, fuentes y lectura de gráficos.
- [Reuters — estándares periodísticos](https://reutersagency.com/about/standards-values/): precisión, atribución y correcciones.

El norte está en el producto actual, su `README.md` y las decisiones ya documentadas en `docs/`. **Mejor una señal bien contada que diez módulos a medio explicar.**
