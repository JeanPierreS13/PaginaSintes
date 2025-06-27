/* aditiva.js */
window.addEventListener("DOMContentLoaded", () => {
  /* ---- 1.  Autenticación Firebase ---- */
  const auth = firebase.auth();
  const loginContainer      = document.getElementById("login-container");
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

  /* ---- 2.  Parámetros UI y arreglos ---- */
  const playBtn  = document.getElementById("play");
  const stopBtn  = document.getElementById("stop");
  const canvas   = document.getElementById("visualizador");
  const ctx      = canvas.getContext("2d");

  const osciladores = [];           // refs a todos los controles de cada oscilador
  const toneOscs    = [];           // Tone.Oscillator por oscilador
  const toneEnvs    = [];           // Tone.AmplitudeEnvelope por oscilador
  const toneGains   = [];           // Gain por oscilador
  const toneLFOs    = [];           // LFOs
  let merger, analyser, isPlaying = false;

  document.querySelectorAll(".oscilador").forEach(container => {
    osciladores.push({
      container,
      wave:     container.querySelector(".forma-onda"),
      freq:     container.querySelector(".frecuencia"),
      vol:      container.querySelector(".volumen"),
      attack:   container.querySelector(".attack"),
      decay:    container.querySelector(".decay"),
      sustain:  container.querySelector(".sustain"),
      release:  container.querySelector(".release"),
      usarLFO:  container.querySelector(".usar-lfo"),
      lfoFreq:  container.querySelector(".lfo-freq"),
      lfoDepth: container.querySelector(".lfo-depth")
    });
  });

  /* ---- 3.  Funciones Play / Stop ---- */
  function reproducirTodo() {
    if (isPlaying) return;
    isPlaying = true;

    merger   = new Tone.Gain().toDestination();
    analyser = new Tone.Analyser("waveform", 1024);
    merger.connect(analyser);

    osciladores.forEach((p, i) => {
      const osc = new Tone.Oscillator({
        frequency: parseFloat(p.freq.value),
        type:       p.wave.value
      });

      const env = new Tone.AmplitudeEnvelope({
        attack:  parseFloat(p.attack.value),
        decay:   parseFloat(p.decay.value),
        sustain: parseFloat(p.sustain.value),
        release: parseFloat(p.release.value)
      });

      const gain = new Tone.Gain(parseFloat(p.vol.value));

      osc.connect(env);
      env.connect(gain);
      gain.connect(merger);

      osc.start();
      env.triggerAttack();

      toneOscs[i]  = osc;
      toneEnvs[i]  = env;
      toneGains[i] = gain;

      /* -- LFO -- */
      if (p.usarLFO.checked) {
        const lfo = new Tone.LFO({
          frequency: parseFloat(p.lfoFreq.value),
          min: -parseFloat(p.lfoDepth.value),
          max:  parseFloat(p.lfoDepth.value)
        }).start();
        lfo.connect(osc.frequency);
        toneLFOs[i] = lfo;
      } else {
        toneLFOs[i] = null;
      }

      /* -- Listeners de UI en vivo -- */
      p.wave.addEventListener("input", () => osc.type = p.wave.value);
      p.freq.addEventListener("input", () => {
        p.container.querySelector(".freq-val").textContent = p.freq.value;
        osc.frequency.value = parseFloat(p.freq.value);
      });
      p.vol.addEventListener("input", () => {
        p.container.querySelector(".vol-val").textContent = p.vol.value;
        gain.gain.value = parseFloat(p.vol.value);
      });
      p.attack.addEventListener("input", () => env.attack  = parseFloat(p.attack.value));
      p.decay.addEventListener("input",  () => env.decay   = parseFloat(p.decay.value));
      p.sustain.addEventListener("input",() => env.sustain = parseFloat(p.sustain.value));
      p.release.addEventListener("input",() => env.release = parseFloat(p.release.value));

      p.lfoFreq.addEventListener("input", () => {
        if (toneLFOs[i]) toneLFOs[i].frequency.value = parseFloat(p.lfoFreq.value);
      });
      p.lfoDepth.addEventListener("input", () => {
        if (toneLFOs[i]) {
          const depth = parseFloat(p.lfoDepth.value);
          toneLFOs[i].min = -depth;
          toneLFOs[i].max =  depth;
        }
      });
      p.usarLFO.addEventListener("change", () => {
        if (p.usarLFO.checked && !toneLFOs[i]) {
          const lfo = new Tone.LFO({
            frequency: parseFloat(p.lfoFreq.value),
            min: -parseFloat(p.lfoDepth.value),
            max:  parseFloat(p.lfoDepth.value)
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
      toneOscs.forEach(osc  => { osc.stop(); osc.dispose(); });
      toneEnvs.forEach(env  => env.dispose());
      toneGains.forEach(g   => g.dispose());
      toneLFOs.forEach(lfo  => { if (lfo) { lfo.stop(); lfo.disconnect(); lfo.dispose(); } });

      toneOscs.length = toneEnvs.length = toneGains.length = toneLFOs.length = 0;
      isPlaying = false;
    }, maxRelease * 1000 + 100);
  }

  function draw() {
    if (!isPlaying) return;
    requestAnimationFrame(draw);
    const data = analyser.getValue();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = i / data.length * canvas.width;
      const y = (0.5 + v / 2) * canvas.height;
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

  /* ---- 4.  Control por teclado QWERTY (Oscilador 1) ---- */
  const keyFreq = {
    KeyA: 261.63, //  C4
    KeyW: 277.18, //  C#4
    KeyS: 293.66, //  D4
    KeyE: 311.13, //  D#4
    KeyD: 329.63, //  E4
    KeyF: 349.23, //  F4
    KeyT: 369.99, //  F#4
    KeyG: 392.00, //  G4
    KeyY: 415.30, //  G#4
    KeyH: 440.00, //  A4
    KeyU: 466.16, //  A#4
    KeyJ: 493.88, //  B4
    KeyK: 523.25  //  C5
  };
  const keysPressed = new Set();

  window.addEventListener("keydown", e => {
    if (keysPressed.has(e.code) || keyFreq[e.code] === undefined) return;
    keysPressed.add(e.code);

    const osc1 = toneOscs[0];
    const env1 = toneEnvs[0];
    if (!osc1 || !env1) return;     // necesita haber presionado Play primero

    osc1.frequency.value = keyFreq[e.code];
    env1.triggerAttack();
  });

  window.addEventListener("keyup", e => {
    if (!keysPressed.has(e.code)) return;
    keysPressed.delete(e.code);

    const env1 = toneEnvs[0];
    if (env1) env1.triggerRelease();
  });
});
