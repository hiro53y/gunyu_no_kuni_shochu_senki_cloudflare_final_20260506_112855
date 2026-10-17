// できごと（会話）：立ち絵と名札、タップで進む
import { loadChronicle, sceneKey } from '../campaign/strategy';
import { useEffect, useState } from 'react';
import { GEN_BY_ID } from '../content/generals';
import type { Campaign, Scene } from '../campaign/state';
import { genInfo } from '../campaign/campaign';
import { bustUrl } from './common';
import { playSe } from '../audio/sound';

export function SceneView({ c, scene, onDone }: { c: Campaign; scene: Scene; onDone: () => void }) {
  const read=!!loadChronicle().read[sceneKey(scene)];
  const [i, setI] = useState(0);
  useEffect(() => { setI(0); }, [scene]);
  const line = scene.lines[Math.min(i, scene.lines.length - 1)];
  const [who, text] = line ?? ['', ''];
  let name = '';
  let portrait: string | null = null;
  if (who) {
    try {
      const info = genInfo(c, who);
      name = info.name;
      portrait = info.portrait;
    } catch {
      const def = GEN_BY_ID[who];
      name = def?.name ?? '';
      portrait = def?.portrait ?? null;
    }
  }
  const next = () => {
    playSe('menu');
    if (i + 1 >= scene.lines.length) onDone();
    else setI(i + 1);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); next(); }
      if (e.key === 'Escape') onDone();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div className={`scene-view mood-${scene.mood ?? 'normal'}`} onClick={next}>
      {scene.title && <div className="scene-title">{scene.title}{read?' · 既読':''}</div>}
      {portrait && <img key={portrait} className="scene-bust" src={bustUrl(portrait)} alt="" />}
      <div className={`scene-box ${who ? '' : 'narration'}`}>
        {name && <div className="scene-name">{name}</div>}
        <p className="scene-text">{who ? text.replace(/^[^「]{1,10}「/, '「') : text}</p>
        <div className="scene-foot">
          <span>{i + 1}/{scene.lines.length}</span>
          <button className="scene-skip" onClick={(e) => { e.stopPropagation(); onDone(); }}>飛ばす</button>
        </div>
      </div>
    </div>
  );
}
