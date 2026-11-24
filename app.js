const $ = (id) => document.getElementById(id);
let cameraStream = null;
let currentAudioUrl = null;
let recognition = null;
let finalTranscript = "";
let qrImageUrl = "";

const pageTitles = {
  inicio: "Inicio", "texto-voz": "Texto a voz", sonido: "Reproducción de sonido",
  qr: "Generador QR", camara: "Cámara", reconocimiento: "Reconocimiento de voz", llamada: "Llamada telefónica",
  acerca: "Acerca del proyecto"
};

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  $("cameraVideo").srcObject = null;
  $("cameraPlaceholder").hidden = false;
  $("startCameraBtn").disabled = false;
  $("captureBtn").disabled = true;
  $("stopCameraBtn").disabled = true;
}

function navigate() {
  const page = (location.hash || "#inicio").slice(1);
  const safePage = pageTitles[page] ? page : "inicio";
  document.querySelectorAll(".page").forEach(el => el.classList.toggle("active", el.id === `page-${safePage}`));
  document.querySelectorAll(".nav-link").forEach(el => el.classList.toggle("active", el.dataset.page === safePage));
  $("pageName").textContent = pageTitles[safePage];
  $("sidebar").classList.remove("open");
  if (safePage !== "camara") stopCamera();
  if (safePage !== "texto-voz" && "speechSynthesis" in window) speechSynthesis.cancel();
}
window.addEventListener("hashchange", navigate);
navigate();

$("menuToggle").addEventListener("click", () => $("sidebar").classList.toggle("open"));

/* TEXTO A VOZ */
function loadVoices() {
  if (!("speechSynthesis" in window)) {
    $("speechStatus").textContent = "Este navegador no admite síntesis de voz.";
    $("speakBtn").disabled = true;
    return;
  }
  const select = $("voiceSelect");
  const selected = select.value;
  const voices = speechSynthesis.getVoices();
  select.innerHTML = '<option value="">Voz predeterminada</option>';
  voices.forEach((voice, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `${voice.name} (${voice.lang})`;
    select.appendChild(option);
  });
  select.value = selected;
}
if ("speechSynthesis" in window) {
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
}
$("rate").addEventListener("input", e => $("rateValue").textContent = `${Number(e.target.value).toFixed(1)}×`);
$("pitch").addEventListener("input", e => $("pitchValue").textContent = Number(e.target.value).toFixed(1));
$("speakBtn").addEventListener("click", () => {
  const text = $("speechText").value.trim();
  if (!text) return $("speechStatus").textContent = "Escribe un texto antes de reproducir.";
  if (!("speechSynthesis" in window)) return $("speechStatus").textContent = "Tu navegador no admite esta función.";
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = speechSynthesis.getVoices();
  const index = $("voiceSelect").value;
  if (index !== "" && voices[Number(index)]) utterance.voice = voices[Number(index)];
  utterance.rate = Number($("rate").value);
  utterance.pitch = Number($("pitch").value);
  utterance.onstart = () => $("speechStatus").textContent = "Reproduciendo el texto...";
  utterance.onend = () => $("speechStatus").textContent = "Lectura finalizada.";
  utterance.onerror = () => $("speechStatus").textContent = "No fue posible reproducir la voz.";
  speechSynthesis.speak(utterance);
});
$("pauseSpeechBtn").addEventListener("click", () => {
  if (!("speechSynthesis" in window)) return;
  if (speechSynthesis.speaking && !speechSynthesis.paused) { speechSynthesis.pause(); $("speechStatus").textContent = "Lectura pausada."; }
  else if (speechSynthesis.paused) { speechSynthesis.resume(); $("speechStatus").textContent = "Lectura reanudada."; }
});
$("stopSpeechBtn").addEventListener("click", () => {
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  $("speechStatus").textContent = "Lectura detenida.";
});

/* REPRODUCCIÓN DE SONIDO */
const audio = $("audioPlayer");
$("audioFile").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
  currentAudioUrl = URL.createObjectURL(file);
  audio.src = currentAudioUrl;
  $("audioName").textContent = file.name;
  $("audioDuration").textContent = "Archivo cargado";
  $("audioStatus").textContent = "Audio listo para reproducirse.";
});
audio.addEventListener("loadedmetadata", () => {
  const d = audio.duration;
  if (Number.isFinite(d)) $("audioDuration").textContent = `Duración: ${Math.floor(d/60)}:${String(Math.floor(d%60)).padStart(2,"0")}`;
});
audio.addEventListener("ended", () => $("audioStatus").textContent = "Reproducción finalizada.");
$("playAudioBtn").addEventListener("click", async () => {
  if (!audio.src) return $("audioStatus").textContent = "Primero selecciona un archivo de audio.";
  try { await audio.play(); $("audioStatus").textContent = "Reproduciendo audio."; }
  catch { $("audioStatus").textContent = "No se pudo reproducir el archivo."; }
});
$("pauseAudioBtn").addEventListener("click", () => { audio.pause(); $("audioStatus").textContent = "Audio pausado."; });
$("stopAudioBtn").addEventListener("click", () => { audio.pause(); audio.currentTime = 0; $("audioStatus").textContent = "Audio detenido."; });
$("volume").addEventListener("input", e => { audio.volume = Number(e.target.value); $("volumeValue").textContent = `${Math.round(audio.volume*100)}%`; });

/* GENERADOR QR: servicio externo */
$("generateQrBtn").addEventListener("click", () => {
  const value = $("qrText").value.trim();
  if (!value) { $("qrStatus").textContent = "Escribe un texto o enlace para continuar."; return; }
  const size = $("qrSize").value;
  qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`;
  const img = $("qrImage");
  img.hidden = false;
  img.onload = () => {
    $("qrPlaceholder").hidden = true;
    $("downloadQrBtn").disabled = false;
    $("qrStatus").textContent = "Código QR generado correctamente.";
  };
  img.onerror = () => {
    img.hidden = true;
    $("qrPlaceholder").hidden = false;
    $("qrStatus").textContent = "No se pudo generar. Revisa tu conexión a Internet e inténtalo de nuevo.";
  };
  img.src = qrImageUrl;
});
$("downloadQrBtn").addEventListener("click", async () => {
  if (!qrImageUrl) return;
  try {
    const response = await fetch(qrImageUrl);
    if (!response.ok) throw new Error("QR no disponible");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "codigo-qr.png"; a.click();
    URL.revokeObjectURL(url);
  } catch {
    window.open(qrImageUrl, "_blank", "noopener");
    $("qrStatus").textContent = "Se abrió el código en otra pestaña; puedes guardarlo desde allí.";
  }
});

/* CÁMARA */
$("startCameraBtn").addEventListener("click", async () => {
  if (!navigator.mediaDevices?.getUserMedia) {
    $("cameraStatus").textContent = "La cámara requiere HTTPS o localhost y un navegador compatible.";
    return;
  }
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
    $("cameraVideo").srcObject = cameraStream;
    $("cameraPlaceholder").hidden = true;
    $("startCameraBtn").disabled = true;
    $("captureBtn").disabled = false;
    $("stopCameraBtn").disabled = false;
    $("cameraStatus").textContent = "Cámara activada correctamente.";
    $("captureResult").hidden = true;
  } catch (error) {
    $("cameraStatus").textContent = error.name === "NotAllowedError" ? "Permiso de cámara denegado. Revisa los permisos del navegador." : "No fue posible acceder a la cámara.";
  }
});
$("stopCameraBtn").addEventListener("click", () => { stopCamera(); $("cameraStatus").textContent = "Cámara apagada."; });
$("captureBtn").addEventListener("click", () => {
  const video = $("cameraVideo");
  if (!cameraStream || !video.videoWidth) return;
  const canvas = $("photoCanvas");
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  $("captureResult").hidden = false;
  $("cameraStatus").textContent = "Fotografía capturada.";
});
$("downloadPhotoBtn").addEventListener("click", () => {
  const a = document.createElement("a");
  a.download = "fotografia-asistente.png";
  a.href = $("photoCanvas").toDataURL("image/png");
  a.click();
});

/* RECONOCIMIENTO DE VOZ */
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "es-MX";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.onstart = () => {
    finalTranscript = $("recognizedText").value.trim();
    if (finalTranscript) finalTranscript += " ";
    $("recognitionState").textContent = "Te estamos escuchando...";
    $("micVisual").classList.add("listening");
    $("startRecognitionBtn").disabled = true;
    $("stopRecognitionBtn").disabled = false;
    $("recognitionStatus").textContent = "Micrófono activo.";
  };
  recognition.onresult = event => {
    let interimText = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const part = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalTranscript += part + " ";
      else interimText += part;
    }
    $("recognizedText").value = finalTranscript + interimText;
  };
  recognition.onerror = event => {
    $("recognitionStatus").textContent = `Ocurrió un problema: ${event.error}.`;
  };
  recognition.onend = () => {
    $("recognitionState").textContent = "Reconocimiento finalizado";
    $("micVisual").classList.remove("listening");
    $("startRecognitionBtn").disabled = false;
    $("stopRecognitionBtn").disabled = true;
    $("recognitionStatus").textContent = "Puedes iniciar un nuevo reconocimiento.";
  };
  $("startRecognitionBtn").addEventListener("click", () => {
    try { recognition.start(); } catch { $("recognitionStatus").textContent = "El reconocimiento ya está activo."; }
  });
  $("stopRecognitionBtn").addEventListener("click", () => recognition.stop());
} else {
  $("recognitionState").textContent = "Función no compatible";
  $("recognitionStatus").textContent = "Este navegador no ofrece SpeechRecognition. Prueba con Chrome o Edge actualizado.";
  $("startRecognitionBtn").disabled = true;
}
$("copyTextBtn").addEventListener("click", async () => {
  const value = $("recognizedText").value.trim();
  if (!value) return showToast("No hay texto para copiar.");
  try { await navigator.clipboard.writeText(value); showToast("Texto copiado."); }
  catch { $("recognizedText").select(); showToast("Selecciona y copia el texto."); }
});
$("clearTextBtn").addEventListener("click", () => {
  $("recognizedText").value = "";
  finalTranscript = "";
  $("recognitionStatus").textContent = "Texto limpiado.";
});

/* ESTADO DE CONEXIÓN E INSTALACIÓN */
function updateConnection() {
  const online = navigator.onLine;
  $("connectionLabel").textContent = online ? "Conectado" : "Sin conexión";
  document.querySelector(".online-indicator").style.background = online ? "var(--green)" : "#e4a15e";
}
window.addEventListener("online", updateConnection);
window.addEventListener("offline", updateConnection);
updateConnection();

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(err => console.warn("No se pudo registrar el Service Worker:", err));
  });
}
window.addEventListener("beforeunload", () => {
  stopCamera();
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
});

/* SIMULADOR DE LLAMADAS: todas las acciones son locales y ficticias */
const phoneInput = $("phoneNumber");
const callScreen = $("callScreen");
let callMode = "idle";
let callSeconds = 0;
let callTimerInterval = null;
let callMuted = false;
let callSpeaker = false;

function formatCallTime(total) {
  const mins = String(Math.floor(total / 60)).padStart(2, "0");
  const secs = String(total % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}
function stopCallTimer() {
  if (callTimerInterval) window.clearInterval(callTimerInterval);
  callTimerInterval = null;
}
function startCallTimer() {
  stopCallTimer();
  callSeconds = 0;
  $("callDuration").textContent = "00:00";
  callTimerInterval = window.setInterval(() => {
    callSeconds += 1;
    $("callDuration").textContent = formatCallTime(callSeconds);
  }, 1000);
}
function resetCallScreen(message = "Simulación finalizada.") {
  stopCallTimer();
  callMode = "idle";
  callScreen.hidden = true;
  $("phoneStatus").textContent = message;
  $("activeCallKeypad").hidden = true;
  $("activeCallControls").hidden = true;
  $("incomingCallActions").hidden = false;
  $("ringingCallActions").hidden = true;
  $("endCallActions").hidden = true;
  $("muteCallBtn").classList.remove("active");
  $("speakerCallBtn").classList.remove("active");
  callMuted = false;
  callSpeaker = false;
}
function showCallScreen(name, number, status) {
  callScreen.hidden = false;
  $("callContactName").textContent = name;
  $("callContactNumber").textContent = number;
  $("callScreenStatus").textContent = status;
  $("callDuration").textContent = "00:00";
}
function beginActiveCall() {
  callMode = "active";
  $("callStateLabel").textContent = "En llamada · Simulación";
  $("callScreenStatus").textContent = "Llamada conectada (modo demostración)";
  $("incomingCallActions").hidden = true;
  $("ringingCallActions").hidden = true;
  $("endCallActions").hidden = false;
  $("activeCallControls").hidden = false;
  startCallTimer();
}
$("callKeypad").addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.digit) phoneInput.value += button.dataset.digit;
  if (button.dataset.action === "delete") phoneInput.value = phoneInput.value.slice(0, -1);
  phoneInput.focus();
});
$("clearPhoneBtn").addEventListener("click", () => {
  phoneInput.value = "";
  $("phoneStatus").textContent = "Número borrado. Puedes escribir otro o simular una llamada entrante.";
  phoneInput.focus();
});
$("startOutgoingCallBtn").addEventListener("click", () => {
  const raw = phoneInput.value.trim();
  const digits = raw.replace(/\D/g, "");
  if (!/^[0-9+*#()\s-]+$/.test(raw) || digits.length < 3 || digits.length > 15) {
    $("phoneStatus").textContent = "Escribe al menos 3 dígitos para iniciar la demostración.";
    phoneInput.focus();
    return;
  }
  callMode = "outgoing";
  showCallScreen("Llamando…", raw, "Marcando número simulado");
  $("callStateLabel").textContent = "Llamada saliente";
  $("incomingCallActions").hidden = true;
  $("ringingCallActions").hidden = false;
  $("endCallActions").hidden = true;
  $("activeCallControls").hidden = true;
  $("phoneStatus").textContent = "Llamada saliente simulada. Pulsa Conectar para continuar.";
});
$("simulateIncomingBtn").addEventListener("click", () => {
  callMode = "incoming";
  showCallScreen("Contacto de prueba", "Número desconocido · 000-000-0000", "Llamada entrante simulada");
  $("callStateLabel").textContent = "Llamada entrante";
  $("incomingCallActions").hidden = false;
  $("ringingCallActions").hidden = true;
  $("endCallActions").hidden = true;
  $("activeCallControls").hidden = true;
  $("phoneStatus").textContent = "Tienes una llamada entrante de demostración.";
});
$("acceptCallBtn").addEventListener("click", () => {
  if (callMode !== "incoming") return;
  beginActiveCall();
  $("phoneStatus").textContent = "Aceptaste la llamada simulada.";
});
$("declineCallBtn").addEventListener("click", () => resetCallScreen("Llamada simulada rechazada."));
$("connectOutgoingCallBtn").addEventListener("click", () => {
  if (callMode !== "outgoing") return;
  beginActiveCall();
  $("callContactName").textContent = "Contacto marcado";
  $("phoneStatus").textContent = "La llamada de demostración está conectada.";
});
$("cancelOutgoingCallBtn").addEventListener("click", () => resetCallScreen("Llamada saliente cancelada."));
$("endCallBtn").addEventListener("click", () => resetCallScreen("Finalizaste la llamada simulada."));
$("muteCallBtn").addEventListener("click", () => {
  callMuted = !callMuted;
  $("muteCallBtn").classList.toggle("active", callMuted);
  $("muteCallBtn").querySelector("small").textContent = callMuted ? "Activar micro" : "Silenciar";
  $("callScreenStatus").textContent = callMuted ? "Micrófono silenciado (simulado)" : "Micrófono activado (simulado)";
});
$("speakerCallBtn").addEventListener("click", () => {
  callSpeaker = !callSpeaker;
  $("speakerCallBtn").classList.toggle("active", callSpeaker);
  $("callScreenStatus").textContent = callSpeaker ? "Altavoz activado (simulado)" : "Altavoz desactivado (simulado)";
});
$("keypadCallBtn").addEventListener("click", () => {
  $("activeCallKeypad").hidden = !$("activeCallKeypad").hidden;
});
$("activeCallKeypad").addEventListener("click", event => {
  const button = event.target.closest("button[data-tone]");
  if (button) $("callScreenStatus").textContent = `Tono ${button.dataset.tone} (simulado)`;
});