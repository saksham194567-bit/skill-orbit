import ProgressBar from './ProgressBar.jsx'
import StatCard from './StatCard.jsx'

export default function Dashboard({ data, records }) {
  const stats = data?.stats || {}
  const goals = records.goals || []
  const completed = goals.reduce((sum, goal) => sum + (goal.milestones || []).filter(step => step.done).length, 0)
  const milestoneCount = goals.reduce((sum, goal) => sum + (goal.milestones || []).length, 0)

  return (
    <section className="dashboard">
      <p className="banner">Live view · Dashboard totals and deadlines are calculated from your saved records.</p>
      <div className="stat-grid">
        <StatCard label="Skills" value={stats.skills ?? 0} hint="Competencies tracked" />
        <StatCard label="Projects" value={stats.projects ?? 0} hint="Portfolio pieces" />
        <StatCard label="Certificates" value={stats.certificates ?? 0} hint="Credentials earned" />
        <StatCard label="Opportunities" value={stats.opportunities ?? 0} hint="Career pathways" />
      </div>
      <div className="panel-grid">
        <article className="panel">
          <p className="eyebrow">Keep moving</p>
          <h2>Learning goals</h2>
          <ProgressBar
            label="Milestones complete"
            value={data.goalProgress}
            caption={milestoneCount ? completed + ' of ' + milestoneCount + ' milestones complete' : 'Add goals and milestones to track your progress.'}
          />
          <p className="muted goals-count">{goals.length} saved learning {goals.length === 1 ? 'goal' : 'goals'}</p>
        </article>
        <article className="panel">
          <p className="eyebrow">Coming up</p>
          <h2>Upcoming deadlines</h2>
          {data.deadlines.length ? (
            <ul className="deadline-list">{data.deadlines.map((item, index) =>
              <li key={item.kind + item.title + index}>
                <span className="deadline-kind">{item.kind}</span>
                <span>{item.title}</span>
                <time dateTime={String(item.date).slice(0, 10)}>{String(item.date).slice(0, 10)}</time>
              </li>)}</ul>
          ) : <p className="muted">No upcoming deadlines. Add a goal or opportunity with a target date.</p>}
        </article>
      </div>
      <article className="panel activity-panel">
        <p className="eyebrow">Recently updated</p>
        <h2>Activity</h2>
        {data.activity.length ? (
          <ul className="activity-list">{data.activity.map((item, index) =>
            <li key={item.kind + item.title + index}>
              <span className="activity-dot" />
              <span><strong>{item.title}</strong><small>{item.kind}</small></span>
              <time dateTime={item.updatedAt}>{new Date(item.updatedAt).toLocaleDateString()}</time>
            </li>)}</ul>
        ) : <p className="muted">Your recent updates will appear here.</p>}
      </article>
    </section>
  )
}
