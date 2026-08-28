interface SectionHeadingProps {
  eyebrow: string
  title: string
  description: string
}

export function SectionHeading({ eyebrow, title, description }: SectionHeadingProps) {
  return (
    <header className="section-heading">
      <p className="section-heading__eyebrow">{eyebrow}</p>
      <div className="section-heading__body">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </header>
  )
}
