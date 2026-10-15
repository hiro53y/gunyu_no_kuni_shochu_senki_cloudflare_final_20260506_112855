import { useEffect, useState } from 'react';
import type { General } from '../types/game';
import { CharacterPortrait } from './CharacterPortrait';
import { normalizePortraitKey, portraitUrl } from './portraitUtils';

interface Props {
  general: General;
  size?: number;
  showLabel?: boolean;
  selected?: boolean;
}

export function GeneralPortrait({ general, size = 64, showLabel = true, selected = false }: Props) {
  const [stage, setStage] = useState<'png' | 'jpg' | 'fallback'>('png');
  const [loaded, setLoaded] = useState(false);
  const h = Math.round(size * 1.25);
  const imageKey = normalizePortraitKey(general);

  useEffect(() => {
    setStage('png');
    setLoaded(false);
  }, [general.id, imageKey]);

  if (stage === 'fallback') {
    return <CharacterPortrait general={general} size={size} showLabel={showLabel} selected={selected} />;
  }

  return (
    <div
      className={`portrait imagePortrait ${selected ? 'selected' : ''}`}
      style={{ width: size, height: showLabel ? h + 14 : h, position: 'relative' }}
      title={general.name}
    >
      <CharacterPortrait general={general} size={size} showLabel={false} selected={selected} />
      <img
        key={`${general.id}-${imageKey}-${stage}`}
        src={portraitUrl(imageKey, stage)}
        alt={general.name}
        width={size}
        height={h}
        loading="eager"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (stage === 'png') {
            setStage('jpg');
            setLoaded(false);
          } else {
            if (import.meta.env.DEV) {
              console.warn(`[portrait] ${general.name} (${general.id}) の画像が見つかりません: ${general.portraitKey}`);
            }
            setStage('fallback');
          }
        }}
        style={{
          position: 'absolute',
          inset: 0,
          width: size,
          height: h,
          objectFit: 'cover',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.18s ease',
          pointerEvents: 'none',
        }}
      />
      {showLabel && (
        <div className="label">
          {general.name.split(' ').slice(-1)[0]}
        </div>
      )}
    </div>
  );
}
