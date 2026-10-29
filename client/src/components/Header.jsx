export default function Header({ student, apiStatus, menuOpen, onMenu, pageTitle, eyebrow }) {
  return (
    <header className="header">
      <button type="button" className="menu-btn" onClick={onMenu} aria-label="Open navigation" aria-expanded={menuOpen} aria-controls="skillorbit-nav">
        Menu
      </button>
      <div className="header-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{pageTitle}</h1>
      </div>
      <div className="header-aside">
        <p className={`api-pill ${apiStatus.state}`} role="status">
          API {apiStatus.label}
        </p>
        <div className="profile-chip">
          <span className="avatar" aria-hidden="true">
            {student.initials || student.name.split(' ').map(part => part[0]).join('').slice(0, 2)}
          </span>
          <div>
            <strong>{student.name}</strong>
            <p>
              {student.program} · {student.year}
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}
