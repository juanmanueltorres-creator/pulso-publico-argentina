import type { TerritorialEvidence } from '../types/evidence'

const VALUE_FORMATTER = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })

function displayValue(value: number | null, unit: string): string {
  if (value === null) return 'Sin dato'
  const sign = value > 0 ? '+' : ''
  return `${sign}${VALUE_FORMATTER.format(value)}${unit}`
}

function displayAbsoluteValue(value: number, unit: string): string {
  return `${VALUE_FORMATTER.format(Math.abs(value))}${unit}`
}

function publicAssetHref(path: string): string {
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`
  return `${base}${path.replace(/^\//, '')}`
}

interface EvidenceCardProps {
  evidence: TerritorialEvidence
}

export function EvidenceCard({ evidence }: EvidenceCardProps) {
  const resultLabel = evidence.provenance.resultKind === 'external-reference' ? 'Referencia externa' : 'Resultado reproducido'
  const methodId = `evidence-method-${evidence.id}`
  const displayedValue = displayValue(evidence.result.value, evidence.result.unit)
  const direction =
    evidence.result.value === null
      ? null
      : evidence.result.value > 0
        ? `${displayAbsoluteValue(evidence.result.value, evidence.result.unit)} más`
        : evidence.result.value < 0
          ? `${displayAbsoluteValue(evidence.result.value, evidence.result.unit)} menos`
          : `el mismo rendimiento`

  return (
    <article className="evidence-card">
      <div className="evidence-card__top-rail" data-testid="evidence-top-rail">
        <span>{resultLabel}</span>
        <span>
          {evidence.subject.variable} · {evidence.subject.condition}
        </span>
      </div>

      <header className="evidence-card__header">
        <p className="evidence-card__territory">
          {evidence.territory.adminName} · {evidence.territory.province}
          <span> · {evidence.territory.adminCode}</span>
        </p>
        <h3>{evidence.claim.title}</h3>
        <strong className="evidence-card__value" data-testid="evidence-value">
          {displayedValue}
        </strong>
        <p className="evidence-card__value-label">{resultLabel}</p>
      </header>

      <div className="evidence-card__grid">
        <section className="evidence-card__block">
          <h4>Qué sabemos</h4>
          <p>{evidence.claim.statement}</p>
        </section>

        <section className="evidence-card__block evidence-card__block--meaning">
          <h4>Qué significa</h4>

          <div className="evidence-card__plain-language">
            <div>
              <h5>¿Qué quiere decir {displayedValue}?</h5>
              {evidence.result.value === null ? (
                <p>
                  Esta referencia no trae un valor numérico que Pulso pueda mostrar con seguridad. Por eso aparece como Sin dato en vez de inventar un cero.
                </p>
              ) : (
                <p>
                  {evidence.provenance.analysisName} publica para {evidence.territory.adminName} un valor cercano a {displayedValue} para{' '}
                  {evidence.subject.variable.toLowerCase()} durante campañas {evidence.subject.condition}, comparado con la referencia de rendimiento de su análisis histórico. Es algo que aparece al mirar muchos años juntos; no quiere decir que la próxima cosecha vaya a rendir {direction}.
                </p>
              )}
            </div>

            <div>
              <h5>¿Por qué importa fuera de {evidence.territory.adminName}?</h5>
              <p>
                Porque este valor no sirve para toda Argentina. La relación entre {evidence.subject.condition} y el rendimiento puede cambiar de un departamento a otro: puede ser más fuerte, más débil o no aparecer. Por eso importa saber dónde se observó y no quedarse solamente con el número.
              </p>
            </div>

            <div>
              <h5>¿Esto cambia solo?</h5>
              <p>
                Hoy no. Esta primera versión conserva un caso histórico de {evidence.territory.adminName}. No cambia automáticamente ni permite elegir otra zona todavía. La siguiente etapa puede sumar más departamentos y actualizar los cálculos cuando entren nuevas campañas, sin borrar esta referencia original.
              </p>
            </div>
          </div>

          <p className="evidence-card__reference-note">Referencia publicada: {evidence.result.interpretation}</p>
          {evidence.result.statisticalSignificance === null ? (
            <p className="evidence-card__note">
              La publicación que usamos no alcanza para confirmar por separado qué tan sólida es estadísticamente la señal de {evidence.territory.adminName}, por eso Pulso no la da por confirmada.
            </p>
          ) : (
            <p className="evidence-card__note">
              Significancia estadística individual: {evidence.result.statisticalSignificance ? 'reportada' : 'no reportada'}.
            </p>
          )}
        </section>

        <section className="evidence-card__block" data-testid="evidence-missing">
          <h4>Qué falta</h4>
          {evidence.missingContext.length === 0 ? (
            <p>Sin contexto adicional declarado.</p>
          ) : (
            <ul>
              {evidence.missingContext.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="evidence-card__block evidence-card__block--how" data-testid="evidence-how">
          <h4>Cómo lo sabemos</h4>
          <dl className="evidence-card__facts">
            <div>
              <dt>Análisis</dt>
              <dd>
                <a href={evidence.provenance.sourceUrl} target="_blank" rel="noreferrer">
                  {evidence.provenance.analysisName}
                </a>
              </dd>
            </div>
            <div>
              <dt>Autores</dt>
              <dd>{evidence.provenance.authors.join(' · ')}</dd>
            </div>
            <div>
              <dt>Período</dt>
              <dd>{evidence.temporalContext.coverage}</dd>
            </div>
            <div>
              <dt>Método</dt>
              <dd>{evidence.method.summary}</dd>
            </div>
          </dl>

          <div className="evidence-card__sources">
            <h5>Insumos declarados</h5>
            <ul>
              {evidence.provenance.inputs.map((input) => (
                <li key={`${input.role}-${input.sourceName}`}>
                  <a href={input.sourceUrl} target="_blank" rel="noreferrer">
                    {input.sourceName}
                  </a>
                  <span> · {input.role}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="evidence-card__method" id={methodId}>
            <h5>Cadena de procesamiento declarada</h5>
            <ol>
              {evidence.method.processingSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>

          <div className="evidence-card__limitations">
            <h5>Limitaciones</h5>
            {evidence.limitations.length === 0 ? (
              <p>Sin limitaciones adicionales declaradas.</p>
            ) : (
              <ul>
                {evidence.limitations.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <nav className="evidence-card__actions" aria-label="Accesos de evidencia">
        <a href={evidence.provenance.sourceUrl} target="_blank" rel="noreferrer">
          <span aria-hidden="true">↗</span> Fuente
        </a>
        <a href={`#${methodId}`}>
          <span aria-hidden="true">↓</span> Método
        </a>
        <a href={publicAssetHref(evidence.territory.geometryRef)} target="_blank" rel="noreferrer">
          <span aria-hidden="true">◇</span> Territorio
        </a>
      </nav>
    </article>
  )
}
