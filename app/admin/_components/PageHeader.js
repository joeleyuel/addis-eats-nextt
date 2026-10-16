// Title, one line of context, and the page's main action(s) on the right.
export default function PageHeader({ title, lead, actions }) {
  return (
    <header className="admin-head">
      <div>
        <h1>{title}</h1>
        {lead && <p className="admin-head__lead">{lead}</p>}
      </div>
      {actions && <div className="admin-head__actions">{actions}</div>}
    </header>
  );
}
