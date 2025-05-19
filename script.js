let slides = document.querySelectorAll(".slide");
let current = 0;

function showNextSlide() {
  slides[current].classList.remove("active");
  current = (current + 1) % slides.length;
  slides[current].classList.add("active");
}

setInterval(showNextSlide, 4000);

/*PARA EL SIMULADOR*/

const sintetizador = new Tone.Synth().toDestination();
let notaActiva = false;

const formaOndaSelect = document.getElementById("formaOnda");
const frecuenciaSlider = document.getElementById("frecuencia");
const valorFrecuencia = document.getElementById("valorFrecuencia");
const amplitudSlider = document.getElementById("amplitud");
const valorAmplitud = document.getElementById("valorAmplitud");
const playBtn = document.getElementById("play");
const stopBtn = document.getElementById("stop");
const canvas = document.getElementById("visualizador");
const ctx = canvas.getContext("2d");

let analyser = null;
let dataArray = null;
let animationId = null;

// Muestra valores numéricos
frecuenciaSlider.addEventListener("input", () => {
  valorFrecuencia.textContent = frecuenciaSlider.value;
  if (notaActiva) {
    sintetizador.frequency.value = Number(frecuenciaSlider.value);
  }
});

amplitudSlider.addEventListener("input", () => {
  valorAmplitud.textContent = amplitudSlider.value;
  if (notaActiva) {
    sintetizador.volume.value = Tone.gainToDb(Number(amplitudSlider.value));
  }
});

async function startAudioContext() {
  await Tone.start();
  console.log("AudioContext iniciado");
}

function dibujarOnda() {
  if (!analyser) return;

  analyser.getFloatTimeDomainData(dataArray);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();

  const sliceWidth = canvas.width / dataArray.length;
  let x = 0;

  for(let i = 0; i < dataArray.length; i++) {
    const v = dataArray[i] * 0.5 + 0.5;
    const y = v * canvas.height;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
    x += sliceWidth;
  }

  ctx.strokeStyle = '#00aaff';
  ctx.lineWidth = 2;
  ctx.stroke();

  animationId = requestAnimationFrame(dibujarOnda);
}

playBtn.addEventListener("click", async () => {
  if (Tone.context.state !== "running") {
    await startAudioContext();
  }

  sintetizador.oscillator.type = formaOndaSelect.value;
  sintetizador.frequency.value = Number(frecuenciaSlider.value);
  sintetizador.volume.value = Tone.gainToDb(Number(amplitudSlider.value));

  if (!analyser) {
    analyser = Tone.context.createAnalyser();
    analyser.fftSize = 2048;
    const bufferLength = analyser.fftSize;
    dataArray = new Float32Array(bufferLength);

    sintetizador.connect(analyser);
    analyser.connect(Tone.context.destination);
  }

  sintetizador.triggerAttack("C4"); // Mantiene la nota activa
  notaActiva = true;

  if (!animationId) {
    dibujarOnda();
  }
});

stopBtn.addEventListener("click", () => {
  sintetizador.triggerRelease();
  notaActiva = false;

  // Detiene la animación
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
});
