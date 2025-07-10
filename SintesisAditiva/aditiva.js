window.addEventListener("DOMContentLoaded", () => {
  // Firebase Auth
  const auth = firebase.auth();
  const loginContainer = document.getElementById("login-container");
  const sintetizadorContainer = document.getElementById("sintetizador");

  document.getElementById("registerBtn").addEventListener("click", () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    auth.createUserWithEmailAndPassword(email, password)
      .then(() => document.getElementById("message").innerText = "✅ Registro exitoso.")
      .catch(err => document.getElementById("message").innerText = "❌ " + err.message);
  });

  document.getElementById("loginBtn").addEventListener("click", () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    auth.signInWithEmailAndPassword(email, password)
      .then(() => document.getElementById("message").innerText = "✅ Sesión iniciada.")
      .catch(err => document.getElementById("message").innerText = "❌ " + err.message);
  });

  document.getElementById("logoutBtn").addEventListener("click", () => auth.signOut());

  auth.onAuthStateChanged(user => {
    if (user) {
      loginContainer.style.display = "none";
      sintetizadorContainer.style.display = "block";
    } else {
      loginContainer.style.display = "block";
      sintetizadorContainer.style.display = "none";
    }
  });

  // Parámetros
  const playBtn = document.getElementById("play");
  const stopBtn = document.getElementById("stop");
  const canvas = document.getElementById("visualizador");
  const ctx = canvas.getContext("2d");

  const osciladores = [];
  const toneOscs = [];
  const toneEnvs = [];
  const toneGains = [];
  const toneLFOs = [];
  let merger, analyser, isPlaying = false;

  // FRECUENCIA BASE y notas relativas
  let baseFreq = 440;
  const semitoneRatio = Math.pow(2, 1 / 12);
  const keyOffsets = {
    KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5,
    KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12
  };
  const keyFreq = {};

  function actualizarKeyFreq() {
    for (const key in keyOffsets) {
      keyFreq[key] = baseFreq * Math.pow(semitoneRatio, keyOffsets[key]);
    }
  }
  actualizarKeyFreq();

  // Obtener todos los osciladores
  document.querySelectorAll(".oscilador").forEach(container => {
    osciladores.push({
      container,
      wave: container.querySelector(".forma-onda"),
      freq: container.querySelector(".frecuencia"),
      vol: container.querySelector(".volumen"),
      attack: container.querySelector(".attack"),
      decay: container.querySelector(".decay"),
      sustain: container.querySelector(".sustain"),
      release: container.querySelector(".release"),
      usarLFO: container.querySelector(".usar-lfo"),
      lfoFreq: container.querySelector(".lfo-freq"),
      lfoDepth: container.querySelector(".lfo-depth")
    });
  });

  function reproducirTodo() {
    if (isPlaying) return;
    isPlaying = true;

    merger = new Tone.Gain().toDestination();
    analyser = new Tone.Analyser("waveform", 1024);
    merger.connect(analyser);

    osciladores.forEach((p, i) => {
      const osc = new Tone.Oscillator({
        frequency: parseFloat(p.freq.value),
        type: p.wave.value
      });

      const env = new Tone.AmplitudeEnvelope({
        attack: parseFloat(p.attack.value),
        decay: parseFloat(p.decay.value),
        sustain: parseFloat(p.sustain.value),
        release: parseFloat(p.release.value)
      });

      const gain = new Tone.Gain(parseFloat(p.vol.value));

      osc.connect(env);
      env.connect(gain);
      gain.connect(merger);

      osc.start();
      env.triggerAttack();

      toneOscs[i] = osc;
      toneEnvs[i] = env;
      toneGains[i] = gain;

      if (p.usarLFO.checked) {
        const lfo = new Tone.LFO({
          frequency: parseFloat(p.lfoFreq.value),
          min: -parseFloat(p.lfoDepth.value),
          max: parseFloat(p.lfoDepth.value)
        }).start();
        lfo.connect(osc.frequency);
        toneLFOs[i] = lfo;
      } else {
        toneLFOs[i] = null;
      }

      p.wave.addEventListener("input", () => osc.type = p.wave.value);

      if (i === 0) {
        p.freq.addEventListener("input", () => {
          const nuevaFreq = parseFloat(p.freq.value);
          p.container.querySelector(".freq-val").textContent = nuevaFreq;
          osc.frequency.value = nuevaFreq;
          baseFreq = nuevaFreq;
          actualizarKeyFreq();
        });
      } else {
        p.freq.addEventListener("input", () => {
          p.container.querySelector(".freq-val").textContent = p.freq.value;
          osc.frequency.value = parseFloat(p.freq.value);
        });
      }

      p.vol.addEventListener("input", () => {
        p.container.querySelector(".vol-val").textContent = p.vol.value;
        gain.gain.value = parseFloat(p.vol.value);
      });

      p.attack.addEventListener("input", () => env.attack = parseFloat(p.attack.value));
      p.decay.addEventListener("input", () => env.decay = parseFloat(p.decay.value));
      p.sustain.addEventListener("input", () => env.sustain = parseFloat(p.sustain.value));
      p.release.addEventListener("input", () => env.release = parseFloat(p.release.value));

      p.lfoFreq.addEventListener("input", () => {
        if (toneLFOs[i]) toneLFOs[i].frequency.value = parseFloat(p.lfoFreq.value);
      });

      p.lfoDepth.addEventListener("input", () => {
        if (toneLFOs[i]) {
          const depth = parseFloat(p.lfoDepth.value);
          toneLFOs[i].min = -depth;
          toneLFOs[i].max = depth;
        }
      });

      p.usarLFO.addEventListener("change", () => {
        if (p.usarLFO.checked && !toneLFOs[i]) {
          const lfo = new Tone.LFO({
            frequency: parseFloat(p.lfoFreq.value),
            min: -parseFloat(p.lfoDepth.value),
            max: parseFloat(p.lfoDepth.value)
          }).start();
          lfo.connect(osc.frequency);
          toneLFOs[i] = lfo;
        } else if (!p.usarLFO.checked && toneLFOs[i]) {
          toneLFOs[i].stop();
          toneLFOs[i].disconnect();
          toneLFOs[i].dispose();
          toneLFOs[i] = null;
        }
      });
    });

    draw();
  }

  function pararTodo() {
    if (!isPlaying) return;
    toneEnvs.forEach(env => env.triggerRelease());
    const maxRelease = Math.max(...toneEnvs.map(env => env.release));

    setTimeout(() => {
      toneOscs.forEach(osc => { osc.stop(); osc.dispose(); });
      toneEnvs.forEach(env => env.dispose());
      toneGains.forEach(gain => gain.dispose());
      toneLFOs.forEach(lfo => { if (lfo) { lfo.stop(); lfo.disconnect(); lfo.dispose(); } });

      toneOscs.length = 0;
      toneEnvs.length = 0;
      toneGains.length = 0;
      toneLFOs.length = 0;
      isPlaying = false;
    }, maxRelease * 1000 + 100);
  }

  function draw() {
    if (!isPlaying) return;
    requestAnimationFrame(draw);
    const data = analyser.getValue();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    data.forEach((val, i) => {
      const x = i / data.length * canvas.width;
      const y = (0.5 + val / 2) * canvas.height;
      ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#00FF88";
    ctx.stroke();
  }

  playBtn.addEventListener("click", async () => {
    await Tone.start();
    reproducirTodo();
  });

  stopBtn.addEventListener("click", pararTodo);

  // ✅ TECLAS PRESIONADAS (teclado físico y visual)
  const keysPressed = new Set();

  // Teclado físico
  window.addEventListener("keydown", e => {
    if (keysPressed.has(e.code) || !keyFreq[e.code]) return;
    keysPressed.add(e.code);

    const osc1 = toneOscs[0], env1 = toneEnvs[0];
    if (!osc1 || !env1) return;
    osc1.frequency.value = keyFreq[e.code];
    env1.triggerAttack();

    const btn = document.querySelector(`#teclado button[data-note="${e.code}"]`);
    if (btn) btn.classList.add("activa");
  });

  window.addEventListener("keyup", e => {
    if (!keysPressed.has(e.code)) return;
    keysPressed.delete(e.code);

    const env1 = toneEnvs[0];
    if (env1) env1.triggerRelease();

    const btn = document.querySelector(`#teclado button[data-note="${e.code}"]`);
    if (btn) btn.classList.remove("activa");
  });

  // Teclado visual (con clic)
  document.querySelectorAll("#teclado button").forEach(btn => {
    const noteCode = btn.dataset.note;

    btn.addEventListener("mousedown", () => {
      const osc1 = toneOscs[0], env1 = toneEnvs[0];
      if (!osc1 || !env1 || !keyFreq[noteCode]) return;
      osc1.frequency.value = keyFreq[noteCode];
      env1.triggerAttack();
      btn.classList.add("activa");
    });

    btn.addEventListener("mouseup", () => {
      const env1 = toneEnvs[0];
      if (env1) env1.triggerRelease();
      btn.classList.remove("activa");
    });

    btn.addEventListener("mouseleave", () => {
      const env1 = toneEnvs[0];
      if (env1) env1.triggerRelease();
      btn.classList.remove("activa");
    });
  });
});

