import type { ActionLog } from '../types/game';

interface EventLogProps {
  logs: ActionLog[];
}

export function EventLog({ logs }: EventLogProps) {
  return (
    <section className="panel">
      <div className="sectionTitle">
        <h2>軍記</h2>
        <span>{logs.length}件</span>
      </div>
      <ol className="logList">
        {logs.map((log) => (
          <li className={`logItem log-${log.type}`} key={log.id}>
            <span>{log.turn}月</span>
            <p>{log.message}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
