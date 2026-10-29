export default function ProgressBar({ label, value, caption }) {
  const clamped = Math.min(100, Math.max(0, Number(value) || 0))

  return (
    <div className="progress-block">
      <div className="progress-meta">
        <span>{label}</span>
        <span>{clamped}%</span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={label}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="progress-fill" style={{ width: `${clamped}%` }} />
      </div>
      {caption ? <p className="progress-caption">{caption}</p> : null}
    </div>
  )
}
