import type { ActionLog } from '../types/game';

interface EventLogProps {
  logs: ActionLog[];
}

const typeLabel: Record<string, string> = {
  battle:  '⚔',
  action:  '▶',
  economy: '⊕',
  event:   '✦',
  system:  '◆',
  warning: '！',
  save:    '□',
};

export function EventLog({ logs }: EventLogProps) {
  const sorted = [...logs].reverse();
  return (
    <section className="panel">
      <div className="sectionTitle">
        <h2>軍 記</h2>
        <span>{logs.length}件</span>
      </div>
      <ol className="logList">
        {sorted.map((log) => (
          <li className={`logItem log-${log.type}`} key={log.id}>
            <div className="logTurn">
              <div style={{ fontSize: '0.9rem' }}>{typeLabel[log.type] ?? '─'}</div>
              <div>{log.turn}月</div>
            </div>
            <p>{log.message}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
