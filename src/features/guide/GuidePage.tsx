import { PageHeader } from '../../components/ui'
import { useWords } from '../../i18n/useWords'

// Resumen de la «Guía de Acompañamiento y Convivencia» de JUDEVAL (temporada 2026/27).
export function GuidePage() {
  const w = useWords()
  return (
    <div className="stack guide">
      <PageHeader
        title="Guía rápida"
        subtitle={`Que cada ${w.player} se sienta ${w.seen}, ${w.respected} y parte del grupo, sin dejar de lado la exigencia deportiva.`}
      />

      <section className="card callout">
        <h2>Idea central</h2>
        <p>
          No {w.all} {w.thePl} {w.players} necesitan lo mismo. {w.Some} necesitan confianza; {w.others}, estructura y
          límites; {w.others}, oportunidades para integrarse o aprender a liderar. Adaptar nuestra forma de acompañar no
          significa bajar las expectativas, sino ayudar a {w.eachOne} a alcanzarlas.
        </p>
      </section>

      <section className="card">
        <h2>Principios compartidos</h2>
        <ul>
          <li>La persona está por encima del rendimiento.</li>
          <li>Corregimos conductas, no etiquetamos personas («es un desastre», «no se entera», «siempre la lía»).</li>
          <li>Cercanía y exigencia son compatibles: escuchamos, ponemos límites claros y damos oportunidades para reparar.</li>
          <li>La integración es responsabilidad del grupo y del cuerpo técnico.</li>
          <li>Ser {w.quiet} no es un problema que haya que arreglar.</li>
          <li>
            Acompañamos sin invadir: no somos {w.psychologists} ni {w.substitutes} de la familia; pedimos apoyo cuando hace
            falta.
          </li>
        </ul>
      </section>

      <section className="card">
        <h2>Cinco hábitos</h2>
        <ol>
          <li>
            <strong>Saludar y conectar antes de entrenar.</strong> Preguntar por algo concreto y retomarlo otro día.
          </li>
          <li>
            <strong>Corregir sin humillar.</strong> Describir lo ocurrido → explicar cómo afecta al grupo → indicar qué
            esperamos → dar oportunidad de rectificar. Faltas de respeto: con firmeza y, si se puede, en privado.
          </li>
          <li>
            <strong>Reconocer avances concretos.</strong> Escuchar, animar a {w.a} {w.teammate}, volver a intentarlo, pedir
            ayuda, mantener la calma… Felicitación sincera y específica.
          </li>
          <li>
            <strong>Crear oportunidades para ayudarse.</strong> Parejas variadas, bienvenida a quien llega; no cargar
            siempre a {w.theSame}.
          </li>
          <li>
            <strong>Cerrar con una pregunta breve.</strong> Respuestas voluntarias; lo delicado, en privado.
          </li>
        </ol>
      </section>

      <section className="card">
        <h2>Conocer a cada {w.player} poco a poco</h2>
        <p>Dos conversaciones individuales por semana, de 5 a 10 minutos. Temas posibles:</p>
        <ul>
          <li>Su vida fuera del equipo: «¿Qué te gusta hacer cuando no estás aquí?»</li>
          <li>Su bienestar: «¿Qué tal te está yendo últimamente?»</li>
          <li>Su experiencia en Judeval: «¿Qué es lo que más te gusta de venir?»</li>
          <li>Sus necesidades: «¿Qué haría que te sintieras más a gusto aquí?»</li>
          <li>Sus objetivos: «¿Hay algo que te gustaría conseguir este año?»</li>
          <li>El grupo: «¿Te sientes {w.integrated}? ¿Hay algo que podríamos hacer mejor?»</li>
        </ul>
        <p className="muted small">
          No midamos la confianza por cuánto nos cuenta {w.a} {w.player}. No prometamos secreto absoluto y sigamos los
          protocolos de protección de menores si surge una situación preocupante.
        </p>
      </section>

      <section className="card">
        <h2>Orientaciones según lo observado</h2>
        <p className="muted small">Hipótesis de trabajo, no etiquetas ni diagnósticos.</p>
        <dl className="guide-dl">
          <dt>Necesitan confianza y espacio</dt>
          <dd>Oportunidades de opinar sin ponerlos en el centro; no confundir timidez con desinterés.</dd>
          <dt>Se distraen o buscan atención</dt>
          <dd>Instrucciones claras y breves; comprobar comprensión discretamente; límites consistentes sin escenas.</dd>
          <dt>Responden mal o corrigen con dureza</dt>
          <dd>Norma común sobre el lenguaje; señalar la acción sin atacar a la persona; pedir reparación.</dd>
          <dt>{w.NewPl}, con barreras lingüísticas o que regresan</dt>
          <dd>Bienvenida clara; explicar rutinas; {w.teammates} de referencia; comprobar que siguen las instrucciones.</dd>
          <dt>Dificultades de asistencia</dt>
          <dd>Preguntar qué compromiso es realista; no confundir horario o distancia con falta de interés.</dd>
          <dt>{w.InjuredPl} o con condiciones físicas</dt>
          <dd>Mantener el vínculo si lo desean; adaptar a indicaciones sanitarias; consultar ante dolor.</dd>
          <dt>Liderazgo o gran calidad</dt>
          <dd>Liderar con el ejemplo, incluir a {w.theOthers} y corregir con respeto.</dd>
        </dl>
      </section>

      <section className="card">
        <h2>Tres errores a evitar</h2>
        <ul>
          <li>
            <strong>Querer salvar a {w.all}.</strong> Acompañar también es pedir ayuda.
          </li>
          <li>
            <strong>Confundir compañerismo con ausencia de exigencia.</strong>
          </li>
          <li>
            <strong>Convertir a alguien en una etiqueta.</strong>
          </li>
        </ul>
      </section>

      <section className="card callout">
        <h2>La pregunta que nos orienta</h2>
        <p>«¿Qué oportunidades estamos creando para que {w.these} {w.kids} aprendan a cuidarse entre sí?»</p>
      </section>
    </div>
  )
}
