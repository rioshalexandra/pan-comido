import { STATUSES } from '../format';

export default function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{STATUSES[status] || status}</span>;
}
