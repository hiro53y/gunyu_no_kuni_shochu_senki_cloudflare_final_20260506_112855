// 冒険中の部隊：上に並ぶ顔（HP・技の準備）と、技の一覧
import { skillDef } from '../content/skills';
import { canUseSkill, cooldown, LORD, skillsOf } from '../engine/skills';
import type { Run } from '../engine/types';
import { tokenUrl } from '../render/sprites';
import { Modal } from './common';
import { playSe } from '../audio/sound';

interface Member { id: string; name: string; portrait: string; hp: number; maxHp: number; here: boolean; fallen: boolean }

export function partyMembers(run: Run): Member[] {
  const p = run.player;
  const out: Member[] = [{ id: LORD, name: '朔', portrait: 'akatsuki_saku', hp: p.hp, maxHp: p.maxHp, here: true, fallen: false }];
  for (const id of run.party) {
    const g = run.gens[id];
    const m = run.monsters.find((x) => x.gen === id && !x.dead);
    out.push({ id, name: g.short, portrait: g.portrait, hp: m?.hp ?? 0, maxHp: m?.maxHp ?? 1, here: !!m, fallen: run.fallen.includes(id) });
  }
  return out;
}

/** 誰かの技が使えるか */
export function anySkillReady(run: Run, who: string): boolean {
  return skillsOf(run, who).some((s) => canUseSkill(run, who, s).ok);
}

export function PartyBar({ run, onOpen }: { run: Run; onOpen: () => void }) {
  const members = partyMembers(run);
  return (
    <div className="party-bar" onClick={() => { playSe('menu'); onOpen(); }} role="button" aria-label="技の一覧">
      {members.map((m) => {
        const ready = !m.fallen && anySkillReady(run, m.id);
        const waiting = !m.fallen && skillsOf(run, m.id).every((s) => cooldown(run, m.id, s) > 0);
        return (
          <div key={m.id} className={`party-face ${m.fallen ? 'fallen' : ''} ${ready ? 'ready' : ''}`}>
            <img src={tokenUrl(m.portrait)} alt="" width={30} height={30} />
            <div className="pf-text">
              <span className="pf-name">{m.name}</span>
              <div className="hp-bar tiny"><div className={`hp-fill ${m.hp / m.maxHp < 0.3 ? 'danger' : ''}`} style={{ width: `${m.fallen ? 0 : Math.max(0, m.hp / m.maxHp) * 100}%` }} /></div>
            </div>
            {ready && <span className="pf-mark">技</span>}
            {!ready && waiting && <span className="pf-mark wait">…</span>}
          </div>
        );
      })}
    </div>
  );
}

export function SkillPanel({ run, onUse, onClose }: { run: Run; onUse: (who: string, skill: string) => void; onClose: () => void }) {
  const members = partyMembers(run);
  return (
    <Modal title="技" onClose={onClose} className="inventory skill-modal">
      <p className="note">使うと1ターン進み、しばらく待ちになる。将には効きにくい技もある。</p>
      {members.map((m) => (
        <div key={m.id} className={`skill-member ${m.fallen ? 'fallen' : ''}`}>
          <img className="token-img" src={tokenUrl(m.portrait)} alt="" width={44} height={44} />
          <div className="skill-list">
            <b>{m.name}{m.fallen ? '（深手で退いた）' : ''}</b>
            {skillsOf(run, m.id).map((sid) => {
              const def = skillDef(sid);
              const can = canUseSkill(run, m.id, sid);
              return (
                <button key={sid} className={`skill-btn ${can.ok ? 'ok' : ''}`} disabled={!can.ok} onClick={() => { playSe('menu'); onUse(m.id, sid); }} style={{ borderColor: can.ok ? def.color : undefined }}>
                  <span className="skill-name" style={{ color: can.ok ? def.color : undefined }}>{def.name}</span>
                  <small>{def.desc}</small>
                  <small className="skill-state">{can.ok ? '使える' : can.reason}</small>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </Modal>
  );
}
