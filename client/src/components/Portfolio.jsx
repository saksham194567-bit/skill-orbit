import { useState } from 'react'

export default function Portfolio({ data }) {
  const profile = data.profile
  const initials = profile?.name?.split(' ').map(part => part[0]).join('').slice(0, 2) || 'S'
  const [shareMessage, setShareMessage] = useState('')

  async function sharePortfolio() {
    const summary = [
      profile?.name,
      [profile?.program, profile?.college].filter(Boolean).join(' · '),
      data.skills.map(skill => skill.name).join(', '),
      ...data.projects.map(project => project.title),
      ...data.certificates.map(certificate => certificate.name),
    ].filter(Boolean).join('\n')
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Student portfolio', text: summary })
        setShareMessage('Portfolio shared.')
      } else {
        await navigator.clipboard.writeText(summary)
        setShareMessage('Portfolio summary copied.')
      }
    } catch (error) {
      if (error.name !== 'AbortError') setShareMessage('Sharing is unavailable here. Try Print / Save as PDF instead.')
    }
  }

  return (
    <section className="module-page portfolio-page">
      <div className="section-heading">
        <div><p className="eyebrow">Share your story</p><h2>Portfolio preview</h2>
          <p className="muted">A simple showcase generated from your saved skills, projects, and certificates.</p></div>
        <div className="portfolio-actions">
          <button className="secondary-btn" type="button" onClick={() => window.print()}>Print / Save as PDF</button>
          <button className="primary-btn" type="button" onClick={sharePortfolio}>Share summary</button>
        </div>
      </div>
      {shareMessage && <p className="share-message" role="status">{shareMessage}</p>}
      <div className="portfolio-hero panel">
        <span className="avatar portfolio-avatar" aria-hidden="true">{initials}</span>
        <div><p className="eyebrow">Student portfolio</p><h3>{profile?.name || "Student profile"}</h3>
          <p className="muted">{[profile?.program, profile?.college].filter(Boolean).join(" · ")}</p></div>
      </div>
      <article className="panel portfolio-section">
        <h3>Skills</h3>
        {data.skills.length ? <div className="tag-list">{data.skills.map(skill =>
          <span className="tag skill-tag" key={skill.id}>{skill.name} <small>{skill.proficiency}/5</small></span>)}</div>
          : <p className="muted">Add skills to show them here.</p>}
      </article>
      <article className="panel portfolio-section">
        <h3>Projects</h3>
        {data.projects.length ? <div className="record-grid">{data.projects.map(project =>
          <div className="portfolio-project" key={project.id}><h4>{project.title}</h4><p className="muted">{project.description}</p>
            <div className="tag-list">{(project.technologies || []).map(tag => <span className="tag" key={tag}>{tag}</span>)}</div>
            <div className="link-row">{project.githubUrl && <a href={project.githubUrl} target="_blank" rel="noreferrer">GitHub ↗</a>}
              {project.demoUrl && <a href={project.demoUrl} target="_blank" rel="noreferrer">Live demo ↗</a>}</div>
          </div>)}</div> : <p className="muted">Add projects to show them here.</p>}
      </article>
      <article className="panel portfolio-section">
        <h3>Certificates</h3>
        {data.certificates.length ? <ul className="certificate-list">{data.certificates.map(certificate =>
          <li key={certificate.id}><strong>{certificate.name}</strong><span>{certificate.issuer}</span>
            {certificate.credentialUrl && <a href={certificate.credentialUrl} target="_blank" rel="noreferrer">View credential ↗</a>}</li>)}</ul>
          : <p className="muted">Add certificates to show them here.</p>}
      </article>
    </section>
  )
}
