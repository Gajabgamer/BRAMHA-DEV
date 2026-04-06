export default function EmptyState({ title, text, actionLabel, onAction }) {
  return (
    <div className="surface-card rounded-3xl border-dashed p-7">
      <h3 className="mb-3 text-xl font-semibold text-white">{title}</h3>
      <p className="mb-5 max-w-2xl text-sm leading-7 text-muted md:text-base">{text}</p>
      {actionLabel ? (
        <button className="btn-primary btn-small" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
