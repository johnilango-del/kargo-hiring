export default function Flags({ flags }) {
  const list = Array.isArray(flags) ? flags : [];
  if (!list.length) return <span className="flag-none">None</span>;
  return (
    <ul className="flags">
      {list.map((f, i) => <li key={i}>{f.detail}</li>)}
    </ul>
  );
}
