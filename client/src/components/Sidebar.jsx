import { navItems } from '../demoStudent.js'

export default function Sidebar({ current, onNavigate, open, onClose }) {
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <div>
          <strong>SkillOrbit</strong>
          <p>Student tracker</p>
        </div>
      </div>
      <nav className="nav" id="skillorbit-nav" aria-label="Main">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={current === item.id ? 'nav-item active' : 'nav-item'}
            aria-current={current === item.id ? 'page' : undefined}
            onClick={() => {
              onNavigate(item.id)
              onClose()
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <p className="sidebar-note">Track your progress, one step at a time.</p>
    </aside>
  )
}
