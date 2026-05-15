// ===========================================================================
// AudioManager
// Web Audio API でプログラマティックに SFX を生成する。
// 外部音源を必要としないため、音声ファイル無しでも音が鳴る。
// 将来 BGM ファイルを /assets/sounds/bgm/ に置けば差し替え可能。
// ===========================================================================

export type SfxKind =
  | 'click'      // UIボタン
  | 'tap'        // 軽いタップ
  | 'attack'     // 通常攻撃ヒット
  | 'skill'      // 必殺技発動
  | 'heal'       // 回復
  | 'turnEnd'    // ターン終了
  | 'victory'    // 勝利
  | 'defeat'     // 敗北
  | 'levelUp'    // 登用成功
  | 'fail'       // 失敗・無効
  | 'cutIn';     // カットイン突入

class AudioManager {
  private ctx: AudioContext | null = null;
  private gainSfx: GainNode | null = null;
  private gainBgm: GainNode | null = null;
  private bgmSource: AudioBufferSourceNode | null = null;
  private bgmOscillators: OscillatorNode[] = [];
  private bgmAudio: HTMLAudioElement | null = null;
  private currentBgmKey: string | null = null;
  private requestedBgmKey: 'title' | 'map' | 'battle' | 'defeat' | null = null;
  private unlocked = false;

  /** 設定で持っている音量（0〜1）。AudioContext が無くても保持できる */
  private sfxVolume = 0.7;
  private bgmVolume = 0.6;

  /** AudioContext は user gesture 後でないと開始できない。lazy 初期化 */
  private ensure(): boolean {
    if (this.ctx) return true;
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return false;
      this.ctx = new Ctor();
      this.gainSfx = this.ctx.createGain();
      this.gainSfx.gain.value = this.sfxVolume;
      this.gainSfx.connect(this.ctx.destination);
      this.gainBgm = this.ctx.createGain();
      this.gainBgm.gain.value = this.bgmVolume;
      this.gainBgm.connect(this.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  /** AudioContext がブラウザでサスペンドされていたら resume を試みる */
  private async resume(): Promise<void> {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume().catch(() => {/* ignore */});
    }
  }

  /** ユーザー操作後に呼び、直近で要求されたBGMを確実に再開する */
  unlock(): void {
    this.unlocked = true;
    if (!this.ensure()) return;
    this.resume().finally(() => {
      if (!this.requestedBgmKey) return;
      const key = this.requestedBgmKey;
      this.playBgm(key).catch(() => {/* ignore */});
    });
  }

  setVolumes(sfx: number, bgm: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, sfx));
    this.bgmVolume = Math.max(0, Math.min(1, bgm));
    if (this.gainSfx) this.gainSfx.gain.value = this.sfxVolume;
    if (this.gainBgm) this.gainBgm.gain.value = this.bgmVolume;
    if (this.bgmAudio) this.bgmAudio.volume = this.bgmVolume;
  }

  /** 主要 SFX */
  play(kind: SfxKind): void {
    if (!this.ensure() || !this.ctx || !this.gainSfx) return;
    this.resume().catch(() => {/* ignore */});
    if (this.sfxVolume <= 0) return;

    switch (kind) {
      case 'click':   return this.playClick(1200, 0.04, 0.05);
      case 'tap':     return this.playClick(800, 0.03, 0.04);
      case 'fail':    return this.playClick(220, 0.12, 0.10);
      case 'attack':  return this.playNoiseBurst(0.18, 1800);
      case 'skill':   return this.playChord([523, 659, 784], 0.4);
      case 'heal':    return this.playChord([523, 659, 880, 1046], 0.6, true);
      case 'turnEnd': return this.playGong(220, 0.6);
      case 'victory': return this.playArpeggio([392, 523, 659, 784, 1046], 0.10, 'asc');
      case 'defeat':  return this.playArpeggio([523, 466, 392, 311, 261], 0.14, 'desc');
      case 'levelUp': return this.playArpeggio([523, 659, 784, 1046, 1318], 0.08, 'asc');
      case 'cutIn':   return this.playCutIn();
    }
  }

  /** 短い矩形波クリック */
  private playClick(freq: number, duration: number, peakGain: number): void {
    if (!this.ctx || !this.gainSfx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(peakGain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g).connect(this.gainSfx);
    o.start(t);
    o.stop(t + duration + 0.02);
  }

  /** ノイズバースト（攻撃ヒット） */
  private playNoiseBurst(duration: number, lpFreq: number): void {
    if (!this.ctx || !this.gainSfx) return;
    const t = this.ctx.currentTime;
    const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * duration), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.6);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lpFreq;
    const g = this.ctx.createGain();
    g.gain.value = 0.32;
    src.connect(filter).connect(g).connect(this.gainSfx);
    src.start(t);
  }

  /** ベルライクな和音 */
  private playChord(freqs: number[], duration: number, sineOnly = false): void {
    if (!this.ctx || !this.gainSfx) return;
    const t = this.ctx.currentTime;
    freqs.forEach((freq, i) => {
      const o = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      o.type = sineOnly ? 'sine' : (i === 0 ? 'triangle' : 'sine');
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, t + i * 0.025);
      g.gain.linearRampToValueAtTime(0.07, t + i * 0.025 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + duration);
      o.connect(g).connect(this.gainSfx!);
      o.start(t + i * 0.025);
      o.stop(t + duration + 0.05);
    });
  }

  /** 銅鑼風（低音＋減衰） */
  private playGong(freq: number, duration: number): void {
    if (!this.ctx || !this.gainSfx) return;
    const t = this.ctx.currentTime;
    [freq, freq * 1.5, freq * 2.7].forEach((f) => {
      const o = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + duration);
      o.connect(g).connect(this.gainSfx!);
      o.start(t);
      o.stop(t + duration + 0.05);
    });
  }

  /** アルペジオ（勝利・敗北・登用成功） */
  private playArpeggio(freqs: number[], step: number, _dir: 'asc' | 'desc'): void {
    if (!this.ctx || !this.gainSfx) return;
    const t = this.ctx.currentTime;
    freqs.forEach((f, i) => {
      const o = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.10, t + i * step);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * step + 0.30);
      o.connect(g).connect(this.gainSfx!);
      o.start(t + i * step);
      o.stop(t + i * step + 0.32);
    });
  }

  /** カットインの轟音（ノイズ＋低音衝撃） */
  private playCutIn(): void {
    if (!this.ctx || !this.gainSfx) return;
    this.playNoiseBurst(0.25, 800);
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(80, t + 0.3);
    g.gain.setValueAtTime(0.20, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    o.connect(g).connect(this.gainSfx);
    o.start(t);
    o.stop(t + 0.5);
  }

  // --- BGM（音声ファイルを優先。失敗時のみWeb Audio合成BGM） ---------------

  async playBgm(key: 'title' | 'map' | 'battle' | 'defeat'): Promise<void> {
    this.requestedBgmKey = key;
    if (this.currentBgmKey === key) {
      if (this.bgmAudio && this.bgmAudio.paused && this.unlocked) {
        await this.bgmAudio.play().catch(() => {
          this.stopBgm();
          this.playGeneratedBgm(key);
        });
      }
      return;
    }
    this.stopBgm();

    const url = this.assetUrl(`/assets/sounds/bgm/${key}.mp3`);
    const audio = new Audio(url);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = this.bgmVolume;
    audio.crossOrigin = 'anonymous';
    this.bgmAudio = audio;
    this.currentBgmKey = key;

    try {
      await audio.play();
    } catch {
      if (this.unlocked) {
        this.stopHtmlBgm();
        this.playGeneratedBgm(key);
      }
    }
  }

  stopBgm(): void {
    if (this.bgmSource) {
      try { this.bgmSource.stop(); } catch { /* ignore */ }
      this.bgmSource.disconnect();
      this.bgmSource = null;
    }
    this.stopHtmlBgm();
    for (const osc of this.bgmOscillators) {
      try { osc.stop(); } catch { /* ignore */ }
      osc.disconnect();
    }
    this.bgmOscillators = [];
    this.currentBgmKey = null;
  }

  private stopHtmlBgm(): void {
    if (!this.bgmAudio) return;
    try {
      this.bgmAudio.pause();
      this.bgmAudio.src = '';
      this.bgmAudio.load();
    } catch { /* ignore */ }
    this.bgmAudio = null;
  }

  private assetUrl(path: string): string {
    const base = import.meta.env.BASE_URL || '/';
    const normalizedBase = base.endsWith('/') ? base : `${base}/`;
    return new URL(path.replace(/^\//, ''), new URL(normalizedBase, window.location.origin)).toString();
  }

  private playGeneratedBgm(key: 'title' | 'map' | 'battle' | 'defeat'): void {
    if (!this.ctx || !this.gainBgm || this.bgmVolume <= 0) return;
    const t = this.ctx.currentTime;
    const patterns: Record<'title' | 'map' | 'battle' | 'defeat', number[]> = {
      title: [196, 246.94, 293.66],
      map: [220, 277.18, 329.63],
      battle: [130.81, 196, 261.63],
      defeat: [196, 174.61, 146.83],
    };
    const freqs = patterns[key];
    this.bgmOscillators = freqs.map((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(i === 0 ? 0.035 : 0.018, t);
      osc.connect(gain).connect(this.gainBgm!);
      osc.start(t + i * 0.03);
      return osc;
    });
    this.currentBgmKey = key;
  }
}

export const audio = new AudioManager();
