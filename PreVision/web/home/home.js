(() => {
  'use strict';

  const root = document.querySelector('.intro');
  const video = document.getElementById('introVideo');
  const action = document.getElementById('actionButton');
  const status = document.getElementById('introStatus');
  const canvas = document.getElementById('particleCanvas');
  const context = canvas.getContext('2d', { alpha: true });
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const pieces = [...document.querySelectorAll('.piece')];
  const timers = new Set();
  let state = 'idle';
  let runId = 0;
  let particles = [];
  let particleFrame = 0;
  let hiddenAt = 0;
  let navigationQueued = false;
  let stallWatchdog = 0;
  const directorPath = '/director/';
  const stallTimeoutMs = 8000;

  const later = (callback, delay) => {
    const timer = setTimeout(() => { timers.delete(timer); callback(); }, delay);
    timers.add(timer);
    return timer;
  };

  const clearTimers = () => {
    timers.forEach(clearTimeout);
    timers.clear();
    stallWatchdog = 0;
  };

  const clearStallWatchdog = () => {
    if (!stallWatchdog) return;
    clearTimeout(stallWatchdog);
    timers.delete(stallWatchdog);
    stallWatchdog = 0;
  };

  const armStallWatchdog = () => {
    clearStallWatchdog();
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (stallWatchdog !== timer) return;
      stallWatchdog = 0;
      if (state === 'playing') restore('landing.videoError');
    }, stallTimeoutMs);
    stallWatchdog = timer;
    timers.add(timer);
  };

  const setState = (next) => {
    state = next;
    root.dataset.state = next;
  };

  const setStatus = (key = '') => {
    status.textContent = key ? PreVisionI18n.t(key) : '';
  };

  const seeded = (seed) => () => {
    seed |= 0;
    seed = seed + 0x6d2b79f5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };

  const fitCanvas = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const makeParticles = () => {
    fitCanvas();
    const random = seeded(0x505256);
    const budget = Math.min(520, Math.max(300, Math.round(innerWidth / 2.6)));
    const largeCount = Math.min(56, Math.round(budget * .12));
    const mediumCount = Math.min(160, Math.round(budget * .32));
    const visible = pieces.filter((piece) => piece.getBoundingClientRect().width > 0);
    particles = Array.from({ length: budget }, (_, index) => {
      const rect = visible[index % visible.length].getBoundingClientRect();
      const tier = index < largeCount ? 'large' : (index < largeCount + mediumCount ? 'medium' : 'micro');
      const delay = tier === 'large'
        ? 300 + (index % visible.length) * 52 + random() * 380
        : tier === 'medium'
          ? 820 + (index % visible.length) * 64 + random() * 680
          : 1450 + (index % visible.length) * 72 + random() * 1050;
      const size = tier === 'large'
        ? 6 + random() * 10
        : tier === 'medium'
          ? 2.3 + random() * 4.8
          : .55 + random() * 2;
      return {
        x: rect.left + random() * rect.width,
        y: rect.top + random() * rect.height,
        vx: (random() - .46) * (tier === 'large' ? .85 : tier === 'medium' ? 1.35 : 2.1),
        vy: (random() - .58) * (tier === 'large' ? .75 : tier === 'medium' ? 1.2 : 1.75),
        size,
        aspect: .55 + random() * 1.25,
        delay,
        life: tier === 'large' ? 1050 + random() * 700 : tier === 'medium' ? 1150 + random() * 850 : 1250 + random() * 1100,
        tier,
        color: random() > .74 ? '#ed4035' : (random() > .45 ? '#24150e' : '#f7d79d')
      };
    });
  };

  const drawParticles = (startedAt) => {
    const elapsed = performance.now() - startedAt;
    context.clearRect(0, 0, innerWidth, innerHeight);
    let active = false;
    for (const particle of particles) {
      const age = elapsed - particle.delay;
      if (age < 0 || age > particle.life) continue;
      active = true;
      const progress = age / particle.life;
      context.globalAlpha = Math.sin(progress * Math.PI) * .78;
      context.fillStyle = particle.color;
      const scale = particle.tier === 'large'
        ? Math.max(.12, 1 - progress * .88)
        : particle.tier === 'medium'
          ? Math.max(.2, 1 - progress * .76)
          : Math.max(.28, 1 - progress * .62);
      context.fillRect(
        particle.x + particle.vx * age * .055,
        particle.y + particle.vy * age * .055 + progress * progress * 22,
        particle.size * scale * particle.aspect,
        particle.size * scale / particle.aspect
      );
    }
    context.globalAlpha = 1;
    if (active || elapsed < 4300) particleFrame = requestAnimationFrame(() => drawParticles(startedAt));
    else context.clearRect(0, 0, innerWidth, innerHeight);
  };

  const requestDirectorNavigation = () => {
    if (navigationQueued || state !== 'complete') return false;
    navigationQueued = true;
    const completedRun = runId;
    queueMicrotask(() => {
      if (state === 'complete' && runId === completedRun) location.assign(directorPath);
    });
    return true;
  };

  const emitComplete = (reason = 'ended') => {
    if (state === 'complete') return;
    clearStallWatchdog();
    pieces.forEach((piece) => { piece.hidden = true; });
    setState('complete');
    root.classList.remove('is-dissolving');
    cancelAnimationFrame(particleFrame);
    context.clearRect(0, 0, innerWidth, innerHeight);
    const detail = Object.freeze({ reason, target: directorPath, runId });
    dispatchEvent(new CustomEvent('prevision:intro-complete', { detail }));
    try {
      if (typeof window.PreVisionIntro?.onComplete === 'function') window.PreVisionIntro.onComplete(detail);
    } finally {
      requestDirectorNavigation();
    }
  };

  const restore = (key) => {
    runId += 1;
    clearTimers();
    cancelAnimationFrame(particleFrame);
    try { video.pause(); video.currentTime = 0; } catch {}
    navigationQueued = false;
    pieces.forEach((piece) => { piece.hidden = false; });
    pieces.forEach((piece) => piece.getAnimations().forEach((animation) => animation.cancel()));
    root.classList.remove('is-dissolving');
    context.clearRect(0, 0, innerWidth, innerHeight);
    setState('idle');
    action.disabled = false;
    setStatus(key);
    if (key) later(() => state === 'idle' && setStatus(), 4600);
  };

  const begin = async () => {
    if (state !== 'idle') return false;
    const thisRun = ++runId;
    setState('starting');
    action.disabled = true;
    setStatus();
    try {
      video.currentTime = 0;
      try {
        await video.play();
      } catch (error) {
        if (error?.name !== 'NotAllowedError') throw error;
        video.muted = true;
        await video.play();
        video.muted = false;
        if (video.paused) await video.play();
      }
      if (thisRun !== runId) return false;
    } catch {
      restore('landing.videoError');
      return false;
    }
    setState('playing');
    root.classList.add('is-dissolving');
    if (!reduceMotion.matches) {
      makeParticles();
      drawParticles(performance.now());
    }
    later(() => {
      if (thisRun === runId && state === 'playing') pieces.forEach((piece) => { piece.hidden = true; });
    }, reduceMotion.matches ? 720 : 4400);
    return true;
  };

  action.addEventListener('click', begin);
  video.addEventListener('ended', () => emitComplete('ended'));
  video.addEventListener('error', () => {
    if (state === 'starting' || state === 'playing') restore('landing.videoError');
  });
  video.addEventListener('stalled', () => {
    if (state === 'playing') {
      setStatus('landing.videoStalled');
      armStallWatchdog();
    }
  });
  video.addEventListener('waiting', () => {
    if (state === 'playing') armStallWatchdog();
  });
  video.addEventListener('playing', () => {
    clearStallWatchdog();
    setStatus();
  });
  video.addEventListener('timeupdate', clearStallWatchdog);
  addEventListener('resize', () => state === 'idle' && fitCanvas(), { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'playing') {
      hiddenAt = performance.now();
      video.pause();
    } else if (!document.hidden && state === 'playing' && hiddenAt) {
      hiddenAt = 0;
      video.play().catch(() => restore('landing.videoError'));
    }
  });
  addEventListener('pageshow', (event) => { if (event.persisted) restore(''); });
  addEventListener('pagehide', () => clearTimers());

  window.PreVisionIntro = Object.freeze({
    start: begin,
    reset: () => restore(''),
    completeForTest: () => emitComplete('test'),
    getState: () => state,
    config: Object.freeze({ particleBudget: 520, largeBudget: 56, mediumBudget: 160, maxDevicePixelRatio: 2, stallTimeoutMs, completionEvent: 'prevision:intro-complete', target: directorPath })
  });

  fitCanvas();
  PreVisionI18n.apply(document);
})();
