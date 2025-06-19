window.addEventListener("DOMContentLoaded", () => {
  // Elementos Firebase y Login
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

  document.getElementById("logoutBtn").addEventListener("click", () => {
    auth.signOut();
  });

  auth.onAuthStateChanged(user => {
    if (user) {
      loginContainer.style.display = "none";
      sintetizadorContainer.style.display = "block";
    } else {
      loginContainer.style.display = "block";
      sintetizadorContainer.style.display = "none";
    }
  });

  // === Audio con Tone.js ===
  const playBtn = document.getElementById("play");
  const stopBtn = document.getElementById("stop");
  const canvas = document.getElementById("visualizador");
  const ctx = canvas?.getContext("2d");

  const osciladores = [];
  let merger;
  let analyser;
  let isPlaying = false;

  const toneOscs = [];
  const toneEnvs = [];
  const toneGains = [];
  const toneLFOs = [];

  document.querySelectorAll(".oscilador").forEach(container => {
    const wave = container.querySelector(".forma-onda");
    const freq = container.querySelector(".frecuencia");
    const vol = container.querySelector(".volumen");
    const attack = container.querySelector(".attack");
    const decay = container.querySelector(".decay");
    const sustain = container.querySelector(".sustain");
    const release = container.querySelector(".release");
    const usarLFO = container.querySelector(".usar-lfo");
    const lfoFreq = container.querySelector(".lfo-freq");
    const lfoDepth = container.querySelector(".lfo-depth");

    osciladores.push({ container, wave, freq, vol, attack, decay, sustain, release, usarLFO, lfoFreq, lfoDepth });
  });

  function reproducirTodo() {
    if (isPlaying) return;

    isPlaying = true;
    merger = new Tone.Gain().toDestination();
    analyser = new Tone.Analyser("waveform", 1024);
    merger.connect(analyser);

    osciladores.forEach((params, i) => {
      const osc = new Tone.Oscillator({
        frequency: parseFloat(params.freq.value),
        type: params.wave.value
      });

      const env = new Tone.AmplitudeEnvelope({
        attack: parseFloat(params.attack.value),
        decay: parseFloat(params.decay.value),
        sustain: parseFloat(params.sustain.value),
        release: parseFloat(params.release.value)
      });

      const gain = new Tone.Gain(parseFloat(params.vol.value));

      osc.connect(env);
      env.connect(gain);
      gain.connect(merger);

      osc.start();
      env.triggerAttack();

      toneOscs[i] = osc;
      toneEnvs[i] = env;
      toneGains[i] = gain;

      // LFO si está activado
      if (params.usarLFO.checked) {
        const lfo = new Tone.LFO({
          frequency: parseFloat(params.lfoFreq.value),
          min: -parseFloat(params.lfoDepth.value),
          max: parseFloat(params.lfoDepth.value)
        }).start();
        lfo.connect(osc.frequency);
        toneLFOs[i] = lfo;
      } else {
        toneLFOs[i] = null;
      }

      // Listeners en tiempo real
      params.wave.addEventListener("input", () => osc.type = params.wave.value);
      params.freq.addEventListener("input", () => {
        params.container.querySelector(".freq-val").textContent = params.freq.value;
        osc.frequency.value = parseFloat(params.freq.value);
      });
      params.vol.addEventListener("input", () => {
        params.container.querySelector(".vol-val").textContent = params.vol.value;
        gain.gain.value = parseFloat(params.vol.value);
      });
      params.attack.addEventListener("input", () => env.attack = parseFloat(params.attack.value));
      params.decay.addEventListener("input", () => env.decay = parseFloat(params.decay.value));
      params.sustain.addEventListener("input", () => env.sustain = parseFloat(params.sustain.value));
      params.release.addEventListener("input", () => env.release = parseFloat(params.release.value));

      params.lfoFreq.addEventListener("input", () => {
        if (toneLFOs[i]) toneLFOs[i].frequency.value = parseFloat(params.lfoFreq.value);
      });
      params.lfoDepth.addEventListener("input", () => {
        if (toneLFOs[i]) {
          const depth = parseFloat(params.lfoDepth.value);
          toneLFOs[i].min = -depth;
          toneLFOs[i].max = depth;
        }
      });

      params.usarLFO.addEventListener("change", () => {
        if (params.usarLFO.checked && !toneLFOs[i]) {
          const lfo = new Tone.LFO({
            frequency: parseFloat(params.lfoFreq.value),
            min: -parseFloat(params.lfoDepth.value),
            max: parseFloat(params.lfoDepth.value)
          }).start();
          lfo.connect(osc.frequency);
          toneLFOs[i] = lfo;
        } else if (!params.usarLFO.checked && toneLFOs[i]) {
          toneLFOs[i].stop();
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
      toneLFOs.forEach(lfo => { if (lfo) lfo.stop().dispose(); });

      toneOscs.length = 0;
      toneEnvs.length = 0;
      toneGains.length = 0;
      toneLFOs.length = 0;

      isPlaying = false;
    }, maxRelease * 1000 + 100);
  }

  function draw() {
    if (!isPlaying || !ctx) return;
    requestAnimationFrame(draw);
    const valores = analyser.getValue();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    valores.forEach((val, i) => {
      const x = (i / valores.length) * canvas.width;
      const y = (0.5 + val / 2) * canvas.height;
      ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#00FF88";
    ctx.stroke();
  }

  playBtn?.addEventListener("click", async () => {
    await Tone.start(); // Necesario en navegadores modernos
    reproducirTodo();
  });

  stopBtn?.addEventListener("click", pararTodo);
});
