const video = document.getElementById("video")
const strip = document.getElementById("photos")
const counter = document.getElementById("countdown")
const retakeBtn = document.getElementById("retakeBtn")
const printBtn = document.getElementById("printBtn")
const stopBtn = document.getElementById("stopBtn")
const qrStatus = document.getElementById("qrStatus")
const qrCountdown = document.getElementById("qrCountdown")
const qrCanvas = document.getElementById("qrCanvas")
const downloadLink = document.getElementById("downloadLink")

const SUPABASE_URL = "https://ayalafmqetfunliexrng.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdWJhYmFzZSIsInJlZiI6ImF5YWxhZm1xZXRmdW5saWV4cm5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDM3MjMsImV4cCI6MjA5NzgxOTcyM30.hbBHLllj5eJLFSkK-CIb32Zxu1a4oitTPqZ-81fMg-U"
const BUCKET_NAME = "Photobooth"
const SIGNED_URL_TTL_SECONDS = 60 * 10
const QR_RESET_TIMEOUT_MS = 20000
const MAX_PHOTOS = 3
const PHOTO_DELAY = 7
const SESSION_DURATION = 120000
const EXPORT_WIDTH = 700
const EXPORT_SCALE = 3

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

let retakeLeft = 2
let sessionStartTime = null
let animationFrame = null
let capturing = false
let isSessionActive = false
let isUploading = false
let qrResetTimer = null
let qrCountdownInterval = null

const captions = [
  "Life is sweeter with you 🍰",
  "Sweet moments, sweet memories",
  "Happiness is homemade",
  "Bite, smile, repeat 😄",
  "Sugar rush incoming!",
  "Dessert first, always",
  "Good vibes only ✨",
  "Made with love 💕",
  "Stay sweet!",
  "You look amazing today!"
]

const captions2 = [
  "Tag us @thesweets",
  "See you again!",
  "Bring your friends next time",
  "Sweet memories start here"
]

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(screen => screen.classList.remove("active"))
  document.getElementById(id).classList.add("active")
}

function setRandomCaption() {
  const el1 = document.getElementById("randomCaption")
  const el2 = document.getElementById("randomCaption2")

  if (el1) {
    el1.innerText = captions[Math.floor(Math.random() * captions.length)]
  }

  if (el2) {
    el2.innerText = captions2[Math.floor(Math.random() * captions2.length)]
  }
}

function updateDateTime() {
  const el = document.getElementById("datetime")
  if (!el) return

  const now = new Date()
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const day = now.getDate()
  const month = months[now.getMonth()]
  const year = now.getFullYear()
  const hours = now.getHours().toString().padStart(2, "0")
  const mins = now.getMinutes().toString().padStart(2, "0")

  el.innerText = `${day} ${month} ${year} | ${hours}:${mins}`
}

function updateRetakeUI() {
  retakeBtn.innerText = `🔁 Coba Lagi (${retakeLeft})`
}

function toggleActionButtons() {
  const photoCount = strip.children.length
  retakeBtn.disabled = isUploading || capturing || retakeLeft <= 0
  printBtn.disabled = isUploading || capturing || photoCount < MAX_PHOTOS
  stopBtn.disabled = isUploading
}

function resetProgressBar() {
  document.getElementById("progressTop").style.width = "0%"
  document.getElementById("progressRight").style.height = "0%"
  document.getElementById("progressBottom").style.width = "0%"
  document.getElementById("progressLeft").style.height = "0%"
  document.getElementById("progressTop").style.opacity = "1"
  document.getElementById("progressRight").style.opacity = "1"
  document.getElementById("progressBottom").style.opacity = "1"
  document.getElementById("progressLeft").style.opacity = "1"
}

function clearQrResetTimers() {
  if (qrResetTimer) {
    clearTimeout(qrResetTimer)
    qrResetTimer = null
  }

  if (qrCountdownInterval) {
    clearInterval(qrCountdownInterval)
    qrCountdownInterval = null
  }

  qrCountdown.innerText = ""
}

function scheduleQrReset(ms = QR_RESET_TIMEOUT_MS) {
  clearQrResetTimers()

  let secondsLeft = Math.ceil(ms / 1000)
  qrCountdown.innerText = `Kembali ke layar awal dalam ${secondsLeft} detik`

  qrCountdownInterval = setInterval(() => {
    secondsLeft -= 1
    if (secondsLeft > 0) {
      qrCountdown.innerText = `Kembali ke layar awal dalam ${secondsLeft} detik`
    }
  }, 1000)

  qrResetTimer = setTimeout(() => {
    clearQrResetTimers()
    stopSessionForce()
  }, ms)
}

function startSessionTimer() {
  cancelAnimationFrame(animationFrame)
  sessionStartTime = Date.now()
  runTimer()
}

function runTimer() {
  const now = Date.now()
  const elapsed = now - sessionStartTime
  const remaining = SESSION_DURATION - elapsed

  updateProgressSmooth(elapsed)

  if (remaining <= 0) {
    cancelAnimationFrame(animationFrame)
    alert("Waktu habis")
    stopSessionForce()
    return
  }

  animationFrame = requestAnimationFrame(runTimer)
}

function updateProgressSmooth(elapsed) {
  const percent = Math.min(1, elapsed / SESSION_DURATION) * 100
  const top = document.getElementById("progressTop")
  const right = document.getElementById("progressRight")
  const bottom = document.getElementById("progressBottom")
  const left = document.getElementById("progressLeft")

  top.style.width = "0%"
  right.style.height = "0%"
  bottom.style.width = "0%"
  left.style.height = "0%"

  if (percent <= 25) {
    top.style.width = `${(percent / 25) * 100}%`
  } else if (percent <= 50) {
    top.style.width = "100%"
    right.style.height = `${((percent - 25) / 25) * 100}%`
  } else if (percent <= 75) {
    top.style.width = "100%"
    right.style.height = "100%"
    bottom.style.width = `${((percent - 50) / 25) * 100}%`
  } else {
    top.style.width = "100%"
    right.style.height = "100%"
    bottom.style.width = "100%"
    left.style.height = `${((percent - 75) / 25) * 100}%`
  }

  if (percent > 90) {
    const flashOpacity = Math.sin(Date.now() / 100) > 0 ? 1 : 0.35
    top.style.opacity = flashOpacity
    right.style.opacity = flashOpacity
    bottom.style.opacity = flashOpacity
    left.style.opacity = flashOpacity
  }

  const r = Math.floor(255 - (percent * 0.1))
  const g = Math.floor(94 - (percent * 0.35))
  const b = Math.floor(162 - (percent * 0.55))
  const color = `rgb(${Math.max(r, 196)}, ${Math.max(g, 24)}, ${Math.max(b, 84)})`

  top.style.background = color
  right.style.background = color
  bottom.style.background = color
  left.style.background = color
}

function resetSession() {
  retakeLeft = 2
  strip.innerHTML = ""
  capturing = false
  isSessionActive = false
  counter.innerText = ""
  clearQrResetTimers()
  updateRetakeUI()
  updateDateTime()
  setRandomCaption()
  resetProgressBar()
  qrStatus.innerText = "Menyiapkan link download..."
  downloadLink.href = "#"
  toggleActionButtons()
}

function goInstruction() {
  clearQrResetTimers()
  stopCameraStream()
  showScreen("instructionScreen")
}

async function startSession() {
  clearQrResetTimers()
  showScreen("cameraScreen")
  resetSession()

  try {
    await startCamera()
  } catch (err) {
    console.error("Camera start failed:", err)
    alert("Kamera gagal dibuka. Pastikan izin kamera diizinkan dan halaman dibuka via HTTPS atau localhost.")
    showScreen("instructionScreen")
    return
  }

  startSessionTimer()
  startCapture()
}

async function startCamera() {
  const existingStream = video.srcObject
  if (existingStream) {
    const hasLiveTrack = existingStream.getVideoTracks().some(track => track.readyState === "live")
    if (hasLiveTrack) {
      if (video.readyState >= 2) {
        await video.play()
      }
      return
    }
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user",
      width: { ideal: 2560 },
      height: { ideal: 1440 }
    },
    audio: false
  })

  video.srcObject = stream

  await new Promise((resolve, reject) => {
    const onReady = async () => {
      try {
        video.onloadedmetadata = null
        await video.play()
        resolve()
      } catch (error) {
        reject(error)
      }
    }

    if (video.readyState >= 1 && video.videoWidth && video.videoHeight) {
      onReady()
      return
    }

    video.onloadedmetadata = onReady
  })
}

function stopCameraStream() {
  const stream = video.srcObject
  if (!stream) return

  stream.getTracks().forEach(track => track.stop())
  video.srcObject = null
}

async function startCapture() {
  if (capturing) return

  capturing = true
  isSessionActive = true
  strip.innerHTML = ""
  counter.innerText = ""
  setRandomCaption()
  toggleActionButtons()

  for (let i = 0; i < MAX_PHOTOS; i += 1) {
    if (!isSessionActive) break

    await countdown(PHOTO_DELAY)
    if (!isSessionActive) break

    const dataUrl = captureCurrentFrame()
    const image = document.createElement("img")
    image.src = dataUrl
    image.alt = `Photo ${i + 1}`
    strip.appendChild(image)
    flash()
    toggleActionButtons()
  }

  capturing = false
  counter.innerText = ""
  toggleActionButtons()
}

function captureCurrentFrame() {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error("Kamera belum siap")
  }

  const canvas = document.createElement("canvas")
  canvas.width = video.videoWidth || 1920
  canvas.height = video.videoHeight || 1080

  const ctx = canvas.getContext("2d")
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

  return canvas.toDataURL("image/png")
}

function flash() {
  const flashLayer = document.createElement("div")
  flashLayer.style.position = "fixed"
  flashLayer.style.top = 0
  flashLayer.style.left = 0
  flashLayer.style.width = "100%"
  flashLayer.style.height = "100%"
  flashLayer.style.background = "white"
  flashLayer.style.zIndex = 9999
  flashLayer.style.opacity = 0.9
  document.body.appendChild(flashLayer)
  setTimeout(() => flashLayer.remove(), 120)
}

function countdown(sec) {
  return new Promise(resolve => {
    let remaining = sec
    counter.innerText = remaining

    const timer = setInterval(() => {
      if (!isSessionActive) {
        clearInterval(timer)
        counter.innerText = ""
        resolve()
        return
      }

      remaining -= 1

      if (remaining <= 0) {
        clearInterval(timer)
        counter.innerText = ""
        resolve()
        return
      }

      counter.innerText = remaining
    }, 1000)
  })
}

function retake() {
  if (capturing || isUploading) return

  if (retakeLeft <= 0) {
    alert("Kesempatan habis")
    return
  }

  retakeLeft -= 1
  updateRetakeUI()
  startCapture()
}

function stopSession() {
  if (isUploading) return
  if (!confirm("Yakin berhenti?")) return
  stopSessionForce()
}

function stopSessionForce() {
  clearQrResetTimers()
  isSessionActive = false
  capturing = false
  counter.innerText = ""
  cancelAnimationFrame(animationFrame)
  resetProgressBar()
  stopCameraStream()
  showScreen("startScreen")
  toggleActionButtons()
}

async function renderStripToBlob() {
  const stripNode = document.getElementById("strip")
  const exportWrapper = document.createElement("div")
  const exportStrip = stripNode.cloneNode(true)

  exportWrapper.style.position = "fixed"
  exportWrapper.style.left = "-99999px"
  exportWrapper.style.top = "0"
  exportWrapper.style.padding = "24px"
  exportWrapper.style.background = "#ffffff"
  exportWrapper.style.zIndex = "-1"

  exportStrip.style.width = `${EXPORT_WIDTH}px`
  exportStrip.style.padding = "26px"
  exportStrip.style.borderRadius = "0"
  exportStrip.style.boxShadow = "none"
  exportStrip.style.fontSize = "22px"
  exportStrip.style.lineHeight = "1.55"

  exportStrip.querySelectorAll("img").forEach(img => {
    img.style.width = "100%"
    img.style.display = "block"
    img.style.marginBottom = "10px"
    img.style.borderRadius = "10px"
    img.style.filter = "none"
  })

  exportWrapper.appendChild(exportStrip)
  document.body.appendChild(exportWrapper)

  try {
    const canvas = await html2canvas(exportStrip, {
      backgroundColor: "#ffffff",
      scale: EXPORT_SCALE,
      useCORS: true,
      logging: false
    })

    return await new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error("Gagal membuat image strip"))
          return
        }
        resolve(blob)
      }, "image/png", 1)
    })
  } finally {
    exportWrapper.remove()
  }
}

function buildFilePath() {
  const now = new Date()
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`
  const randomPart = crypto.randomUUID()
  return `strips/${datePart}/${randomPart}.png`
}

async function uploadStripBlob(filePath, blob) {
  const { error } = await supabaseClient
    .storage
    .from(BUCKET_NAME)
    .upload(filePath, blob, {
      contentType: "image/png",
      upsert: false,
      cacheControl: "3600"
    })

  if (error) {
    throw error
  }
}

async function createSignedUrlWithRetry(filePath, ttlSeconds) {
  let lastError = null

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const { data, error } = await supabaseClient
      .storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, ttlSeconds, {
        download: `the-sweets-${Date.now()}.png`
      })

    if (!error && data?.signedUrl) {
      return data.signedUrl
    }

    lastError = error || new Error("Signed URL tidak berhasil dibuat")
    await wait(350 * attempt)
  }

  throw lastError
}

async function showQrScreen(url) {
  qrStatus.innerText = "Scan QR untuk download foto"
  downloadLink.href = url

  const ctx = qrCanvas.getContext("2d")
  ctx.clearRect(0, 0, qrCanvas.width, qrCanvas.height)

  await QRCode.toCanvas(qrCanvas, url, {
    width: 280,
    margin: 1,
    color: {
      dark: "#b70d62",
      light: "#ffffff"
    }
  })

  showScreen("qrScreen")
  scheduleQrReset()
}

async function printStrip() {
  if (isUploading || capturing) return

  if (strip.children.length < MAX_PHOTOS) {
    alert("Ambil 3 foto dulu ya.")
    return
  }

  if (!confirm("Sudah puas?")) return

  const originalLabel = printBtn.innerText

  try {
    isUploading = true
    qrStatus.innerText = "Mengupload foto..."
    printBtn.innerText = "Mengupload..."
    toggleActionButtons()

    const blob = await renderStripToBlob()
    const filePath = buildFilePath()

    console.log("Uploading to bucket:", BUCKET_NAME)
    console.log("Uploading filePath:", filePath)

    await uploadStripBlob(filePath, blob)

    console.log("Upload OK, creating signed URL for:", filePath)

    const signedUrl = await createSignedUrlWithRetry(filePath, SIGNED_URL_TTL_SECONDS)

    isSessionActive = false
    capturing = false
    counter.innerText = ""
    cancelAnimationFrame(animationFrame)
    resetProgressBar()
    stopCameraStream()

    await showQrScreen(signedUrl)
  } catch (err) {
    console.error("Supabase upload / signed URL error:", err)
    const message = err?.message || err?.error_description || JSON.stringify(err)
    alert(`Gagal upload foto: ${message}`)
    qrStatus.innerText = "Upload gagal. Coba lagi."
  } finally {
    isUploading = false
    printBtn.innerText = originalLabel
    toggleActionButtons()
  }
}

updateDateTime()
setRandomCaption()
updateRetakeUI()
toggleActionButtons()
