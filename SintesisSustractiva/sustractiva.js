const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;
let analyser, canvasCtx;

let currentOsc = null;
let gainNode = null;
let filter = null;
let drawVisual;

const activeNotes = {};

const waveSelect = document.getElementById('waveform');
const cutoff = document.getElementById('cutoff');
const resonance = document.getElementById('resonance');
const attack = document.getElementById('attack');
const decay = document.getElementById('decay');
const sustain = document.getElementById('sustain');
const release = document.getElementById('release');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const cutoffDisplay = document.getElementById('cutoffDisplay');
const canvas = document.getElementById('oscilloscope');
canvasCtx = canvas.getContext('2d');

startButton.addEventListener('click', () => {
  audioCtx = new AudioContext();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  draw();
});

stopButton.addEventListener('click', () => {
  for (let key in activeNotes) {
    stopNote(key);
  }
});

cutoff.addEventListener('input', () => {
  cutoffDisplay.textContent = `${cutoff.value} Hz`;
});

const keyboard = document.querySelectorAll('.keyboard button');
keyboard.forEach(btn => {
  btn.addEventListener('mousedown', () => playNote(btn.dataset.note));
  btn.addEventListener('mouseup', () => stopNote(btn.dataset.note));
  btn.addEventListener('mouseleave', () => stopNote(btn.dataset.note));
});

document.addEventListener('keydown', (e) => {
  const notes = {
    'a': 261.63, 's': 293.66, 'd': 329.63, 'f': 349.23,
    'g': 392.00, 'h': 440.00, 'j': 493.88, 'k': 523.25
  };
  if (notes[e.key] && !activeNotes[e.key]) {
    playNote(notes[e.key], e.key);
  }
});

document.addEventListener('keyup', (e) => {
  if (activeNotes[e.key]) stopNote(e.key);
});

function createNoiseBuffer(type) {
  const bufferSize = 2 * audioCtx.sampleRate;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const output = buffer.getChannelData(0);

  if (type === 'white') {
    for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
  } else if (type === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
    }
  }

  return buffer;
}

function playNote(freq, key = null) {
  const osc = waveSelect.value === 'white' || waveSelect.value === 'pink'
    ? audioCtx.createBufferSource()
    : audioCtx.createOscillator();

  const filt = audioCtx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(cutoff.value, audioCtx.currentTime);
  filt.Q.setValueAtTime(resonance.value, audioCtx.currentTime);

  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;
  const a = parseFloat(attack.value);
  const d = parseFloat(decay.value);
  const s = parseFloat(sustain.value);

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(1, now + a);
  gain.gain.linearRampToValueAtTime(s, now + a + d);

  if (osc instanceof AudioBufferSourceNode) {
    osc.buffer = createNoiseBuffer(waveSelect.value);
    osc.loop = true;
  } else {
    osc.type = waveSelect.value;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  }

  osc.connect(filt);
  filt.connect(gain);
  gain.connect(analyser);
  analyser.connect(audioCtx.destination);
  osc.start();

  activeNotes[key || freq] = { osc, gain };
}

function stopNote(key) {
  const note = activeNotes[key];
  if (!note) return;
  const now = audioCtx.currentTime;
  const r = parseFloat(release.value);
  note.gain.gain.cancelScheduledValues(now);
  note.gain.gain.setValueAtTime(note.gain.gain.value, now);
  note.gain.gain.linearRampToValueAtTime(0, now + r);
  note.osc.stop(now + r);
  delete activeNotes[key];
}

function draw() {
  const bufferLength = analyser.fftSize;
  const dataArray = new Uint8Array(bufferLength);

  function drawOscilloscope() {
    drawVisual = requestAnimationFrame(drawOscilloscope);
    analyser.getByteTimeDomainData(dataArray);

    canvasCtx.fillStyle = 'black';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = 'lime';
    canvasCtx.beginPath();

    const sliceWidth = canvas.width * 1.0 / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = v * canvas.height / 2;

      if (i === 0) canvasCtx.moveTo(x, y);
      else canvasCtx.lineTo(x, y);

      x += sliceWidth;
    }

    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();
  }

  drawOscilloscope();
}
