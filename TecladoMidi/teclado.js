const playBtn = document.getElementById("play");
const stopBtn = document.getElementById("stop");
const canvas = document.getElementById("visualizador");
const ctx = canvas.getContext("2d");

let osc, env, analyser, isPlaying = false;

const mapTeclado = {
  "a": 60, "w": 61, "s": 62, "e": 63, "d": 64,
  "f": 65, "t": 66, "g": 67, "y": 68, "h": 69,
  "u": 70, "j": 71, "k": 72
};

let teclaPresionada = {};

function midiToFreq(n) {
  return 440 * Math.pow(2, (n - 69) / 12);
}

function iniciarOscilador() {
  if (isPlaying) return;

  osc = new Tone.Oscillator({ type: "sine", frequency: 440 });
  env = new Tone.AmplitudeEnvelope({
    attack: 0.05, decay: 0.1, sustain: 0.5, release: 0.8
  });

  analyser = new Tone.Analyser("waveform", 1024);

  osc.connect(env);
  env.toDestination().connect(analyser);
  osc.start();
  isPlaying = true;
  draw();
}

function detenerOscilador() {
  if (!isPlaying) return;
  env.triggerRelease();
  setTimeout(() => {
    osc.stop(); osc.dispose(); env.dispose();
    isPlaying = false;
  }, 1000);
}

playBtn.addEventListener("click", async () => {
  await Tone.start();
  iniciarOscilador();
});

stopBtn.addEventListener("click", detenerOscilador);

// Control por teclado del computador
window.addEventListener("keydown", e => {
  const k = e.key.toLowerCase();
  if (mapTeclado[k] && !teclaPresionada[k] && isPlaying) {
    osc.frequency.value = midiToFreq(mapTeclado[k]);
    env.triggerAttack();
    teclaPresionada[k] = true;
  }
});

window.addEventListener("keyup", e => {
  const k = e.key.toLowerCase();
  if (mapTeclado[k]) {
    env.triggerRelease();
    teclaPresionada[k] = false;
  }
});

// Soporte para teclado MIDI físico
navigator.requestMIDIAccess().then(access => {
  for (let input of access.inputs.values()) {
    input.onmidimessage = e => {
      const [status, note, velocity] = e.data;
      if (status === 144 && velocity > 0 && isPlaying) {
        osc.frequency.value = midiToFreq(note);
        env.triggerAttack();
      }
      if ((status === 128 || (status === 144 && velocity === 0)) && isPlaying) {
        env.triggerRelease();
      }
    };
  }
});

function draw() {
  if (!isPlaying) return;
  requestAnimationFrame(draw);
  const valores = analyser.getValue();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  valores.forEach((v, i) => {
    const x = (i / valores.length) * canvas.width;
    const y = (0.5 + v / 2) * canvas.height;
    ctx.lineTo(x, y);
  });
  ctx.strokeStyle = "#00FF88";
  ctx.stroke();
}
