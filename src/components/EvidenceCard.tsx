import type { TerritorialEvidence } from '../types/evidence'

const VALUE_FORMATTER = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })

function displayValue(value: number | null, unit: string): string {
  if (value === null) return 'Sin dato'
  const sign = value > 0 ? '+' : ''
  return `${sign}${VALUE_FORMATTER.format(value)}${unit}`
}

interface EvidenceCardProps {
  evidence: TerritorialEvidence
}

export function EvidenceCard({ evidence }: EvidenceCardProps) {
  return (
    <article className="evidence-card">
      <header className="evidence-card__header">
        <div className="evidence-card__topline">
          <span className="evidence-card__badge">EXTERNO</span>
          <span className="evidence-card__subject">
            {evidence.subject.variable} · {evidence.subject.condition}
          </span>
        </div>

        <p className="evidence-card__territory">
          {evidence.territory.adminName} · {evidence.territory.province}
        </p>
        <h3>{evidence.claim.title}</h3>
        <strong className="evidence-card__value" data-testid="evidence-value">
          {displayValue(evidence.result.value, evidence.result.unit)}
        </strong>
      </header>

      <div className="evidence-card__grid">
        <section className="evidence-card__block">
          <h4>Qué sabemos</h4>
          <p>{evidence.claim.statement}</p>
        </section>

        <section className="evidence-card__block evidence-card__block--meaning">
          <h4>Qué significa</h4>
          <p>{evidence.result.interpretation}</p>
          {evidence.result.statisticalSignificance === null ? (
            <p className="evidence-card__note">Significancia individual: no verificada en la referencia publicada.</p>
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

          <div className="evidence-card__method">
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
    </article>
  )
}
