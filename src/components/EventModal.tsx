import { eventDialogue } from '../data/dialogue';
import type { RandomEventKind } from '../types/game';

interface EventModalProps {
  eventKind: RandomEventKind;
  effectText: string;
  onClose: () => void;
}

export function EventModal({ eventKind, effectText, onClose }: EventModalProps) {
  const dialogue = eventDialogue[eventKind] ?? {
    title: 'お知らせ',
    drama: '何かが起きた。',
    speaker: '伝令',
  };

  return (
    <div className="modalBackdrop" onClick={onClose}>
      <div className="eventModal" onClick={(e) => e.stopPropagation()}>
        <div className="eventModalTop">
          <p className="eventModalEyebrow">突発イベント</p>
          <h2 className="eventModalTitle">{dialogue.title}</h2>
        </div>
        <div className="eventModalBody">
          <p className="eventDrama">{dialogue.drama}</p>
          <p className="eventSpeaker">── {dialogue.speaker}</p>
          <div className="eventEffect">{effectText}</div>
          <button className="eventCloseBtn" onClick={onClose} type="button">
            承知した
          </button>
        </div>
      </div>
    </div>
  );
}
