const SUPABASE_URL = "https://ayalafmqetfunliexrng.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5YWxhZm1xZXRmdW5saWV4cm5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDM3MjMsImV4cCI6MjA5NzgxOTcyM30.hbBHLllj5eJLFSkK-CIb32Zxu1a4oitTPqZ-81fMg-U"
const BUCKET_NAME = "Photobooth"

const video = document.getElementById("video")
const photosContainer = document.getElementById("photos")
const counter = document.getElementById("countdown")
const retakeBtn = document.getElementById("retakeBtn")
const sessionCodeEl = document.getElementById("sessionCode")
const dateTimeEl = document.getElementById("datetime")
const randomCaptionEl = document.getElementById("randomCaption")
const randomCaption2El = document.getElementById("randomCaption2")
const qrCanvas = document.getElementById("qrCanvas")
const qrStatus = document.getElementById("qrStatus")
const downloadLink = document.getElementById("downloadLink")

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const sessionDuration = 120000
const photoDelay = 7
const MAX_PHOTOS = 3
const QR_TIMEOUT_MS = 60000
const EXPORT_WIDTH = 1200
const EXPORT_PADDING = 56
const EXPORT_GAP = 24

let retakeLeft = 2
let sessionStartTime = null
let animationFrame = null
let capturing = false
let isSessionActive = false
let isUploading = false
let capturedPhotos = []
let currentSessionCode = ""
let currentDateTime = ""
let currentCaption1 = ""
let currentCaption2 = ""
let qrCloseTimer = null


const captions = [
  "Life is sweeter with you",
  "Sweet moments, sweet memories",
  "Happiness is homemade",
  "Bite, smile, repeat",
  "Sugar rush incoming",
  "Dessert first, always",
  "Good vibes only",
  "Made with love",
  "Stay sweet",
  "You look amazing today"
]

const captions2 = [
  "You are so sweet!",
  "See you again!",
  "Bring your friends next time",
  "Sweet memories start here"
]

function generateSessionCode() {
  const seed = Date.now().toString().slice(-6)
  return `TS-${seed}`
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"))
  document.getElementById(id).classList.add("active")
}

function goInstruction() {
  showScreen("instructionScreen")
}

function updateDateTime() {
  const now = new Date()
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  const day = now.getDate()
  const month = months[now.getMonth()]
  const year = now.getFullYear()
  const hours = now.getHours().toString().padStart(2, "0")
  const mins = now.getMinutes().toString().padStart(2, "0")
  currentDateTime = `${day} ${month} ${year} | ${hours}:${mins}`
  dateTimeEl.innerText = currentDateTime
}

function setRandomCaption() {
 currentCaption1 = captions[Math.floor(Math.random() * captions.length)]
  currentCaption2 = captions2[Math.floor(Math.random() * captions2.length)]

  const el1 = document.getElementById("randomCaption")
  const el2 = document.getElementById("randomCaption2")

  if (el1) el1.innerText = currentCaption1
  if (el2) el2.innerText = currentCaption2
}

function resetProgressBar() {
  document.getElementById("progressTop").style.width = "0%"
  document.getElementById("progressRight").style.height = "0%"
  document.getElementById("progressBottom").style.width = "0%"
  document.getElementById("progressLeft").style.height = "0%"
}

function updateProgressSmooth(elapsed) {
  const percent = Math.min(1, elapsed / sessionDuration) * 100
  const top = document.getElementById("progressTop")
  const right = document.getElementById("progressRight")
  const bottom = document.getElementById("progressBottom")
  const left = document.getElementById("progressLeft")

  top.style.width = "0%"
  right.style.height = "0%"
  bottom.style.width = "0%"
  left.style.height = "0%"

  if (percent <= 25) {
    top.style.width = (percent / 25) * 100 + "%"
  } else if (percent <= 50) {
    top.style.width = "100%"
    right.style.height = ((percent - 25) / 25) * 100 + "%"
  } else if (percent <= 75) {
    top.style.width = "100%"
    right.style.height = "100%"
    bottom.style.width = ((percent - 50) / 25) * 100 + "%"
  } else {
    top.style.width = "100%"
    right.style.height = "100%"
    bottom.style.width = "100%"
    left.style.height = ((percent - 75) / 25) * 100 + "%"
  }

  if (percent > 90) {
    const pulse = Math.sin(Date.now() / 100) > 0 ? 1 : 0.3
    top.style.opacity = pulse
    right.style.opacity = pulse
    bottom.style.opacity = pulse
    left.style.opacity = pulse
  } else {
    top.style.opacity = 1
    right.style.opacity = 1
    bottom.style.opacity = 1
    left.style.opacity = 1
  }

  const r = Math.floor(46 + (231 - 46) * (percent / 100))
  const g = Math.floor(204 - (204 - 76) * (percent / 100))
  const b = Math.floor(113 - (113 - 60) * (percent / 100))
  const color = `rgb(${r},${g},${b})`

  top.style.background = color
  right.style.background = color
  bottom.style.background = color
  left.style.background = color
}

function startSessionTimer() {
  cancelAnimationFrame(animationFrame)
  sessionStartTime = Date.now()
  runTimer()
}

function runTimer() {
  const now = Date.now()
  const elapsed = now - sessionStartTime
  const remaining = sessionDuration - elapsed

  updateProgressSmooth(elapsed)

  if (remaining <= 0) {
    cancelAnimationFrame(animationFrame)
    alert("Waktu habis")
    stopSessionForce()
    return
  }

  animationFrame = requestAnimationFrame(runTimer)
}

function updateRetakeUI() {
  retakeBtn.innerText = `🔁 Coba Lagi (${retakeLeft})`
}

function resetSession() {
  retakeLeft = 2
  updateRetakeUI()
  photosContainer.innerHTML = ""
  capturedPhotos = []
  capturing = false
  isSessionActive = false
  counter.innerText = ""
  currentSessionCode = generateSessionCode()
  sessionCodeEl.innerText = currentSessionCode
  updateDateTime()
  setRandomCaption()
}

function stopCameraStream() {
  const stream = video.srcObject
  if (!stream) return
  stream.getTracks().forEach(track => track.stop())
  video.srcObject = null
}

async function startCamera() {
  const existingStream = video.srcObject
  if (existingStream) {
    const hasLiveTrack = existingStream.getVideoTracks().some(track => track.readyState === "live")
    if (hasLiveTrack) {
      if (video.readyState >= 2) await video.play()
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

async function startSession() {
  showScreen("cameraScreen")
  resetSession()
  updateRetakeUI()

  try {
    await startCamera()
  } catch (err) {
    console.error("Camera start failed:", err)
    alert("Kamera gagal dibuka. Pastikan izin kamera diizinkan dan halaman dibuka via HTTPS / localhost.")
    showScreen("instructionScreen")
    return
  }

  startSessionTimer()
  startCapture()
}

function countdown(sec) {
  return new Promise(resolve => {
    let i = sec
    counter.innerText = i
    const timer = setInterval(() => {
      if (!isSessionActive) {
        clearInterval(timer)
        counter.innerText = ""
        resolve()
        return
      }
      i--
      counter.innerText = i > 0 ? i : ""
      if (i <= 0) {
        clearInterval(timer)
        resolve()
      }
    }, 1000)
  })
}

function flash() {
  const f = document.createElement("div")
  f.style.position = "fixed"
  f.style.top = 0
  f.style.left = 0
  f.style.width = "100%"
  f.style.height = "100%"
  f.style.background = "white"
  f.style.zIndex = 9999
  document.body.appendChild(f)
  setTimeout(() => f.remove(), 120)
}

function appendPhotoToPreview(src) {
  const image = document.createElement("img")
  image.src = src
  photosContainer.appendChild(image)
}

async function captureSinglePhoto() {
  const width = video.videoWidth || 1920
  const height = video.videoHeight || 1080
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext("2d")
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(video, 0, 0, width, height)

  return canvas.toDataURL("image/png")
}

async function startCapture() {
  if (capturing) return
  if (!video.videoWidth || !video.videoHeight) {
    alert("Kamera belum siap. Coba mulai lagi.")
    return
  }

  capturing = true
  isSessionActive = true
  photosContainer.innerHTML = ""
  capturedPhotos = []
  setRandomCaption()

  for (let i = 0; i < MAX_PHOTOS; i++) {
    if (!isSessionActive) break
    await countdown(photoDelay)
    if (!isSessionActive) break
    const imgSrc = await captureSinglePhoto()
    capturedPhotos.push(imgSrc)
    appendPhotoToPreview(imgSrc)
    flash()
  }

  capturing = false
}

function retake() {
  if (retakeLeft <= 0) {
    alert("Kesempatan habis")
    return
  }
  retakeLeft--
  updateRetakeUI()
  startCapture()
}

function stopSession() {
  if (!confirm("Yakin berhenti?")) return
  stopSessionForce()
}

function stopSessionForce() {
  isSessionActive = false
  capturing = false
  counter.innerText = ""
  cancelAnimationFrame(animationFrame)
  resetProgressBar()
  stopCameraStream()
  showScreen("startScreen")
}

function closeQRSession() {
  if (qrCloseTimer) {
    clearTimeout(qrCloseTimer)
    qrCloseTimer = null
  }

  stopSessionForce()

  if (qrCanvas) {
    const ctx = qrCanvas.getContext("2d")
    if (ctx) ctx.clearRect(0, 0, qrCanvas.width, qrCanvas.height)
  }

  if (downloadLink) {
    downloadLink.removeAttribute("href")
    downloadLink.innerText = ""
  }

  if (qrStatus) {
    qrStatus.innerText = ""
  }
}


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

async function renderStripBlob() {
  if (capturedPhotos.length === 0) {
    throw new Error("Belum ada foto untuk disimpan")
  }

  const images = await Promise.all(capturedPhotos.map(loadImage))
  const photoWidth = EXPORT_WIDTH - (EXPORT_PADDING * 2)
  const photoHeights = images.map(img => Math.round(photoWidth * (img.height / img.width)))

  const headerHeight = 360
  const footerHeight = 360
  const photosHeight = photoHeights.reduce((sum, h) => sum + h, 0) + ((images.length - 1) * EXPORT_GAP)
  const canvasHeight = EXPORT_PADDING + headerHeight + photosHeight + footerHeight + EXPORT_PADDING

  const canvas = document.createElement("canvas")
  canvas.width = EXPORT_WIDTH
  canvas.height = canvasHeight
  const ctx = canvas.getContext("2d")

  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = "#111111"
  ctx.textAlign = "center"
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"

  let y = EXPORT_PADDING + 20

  function centerText(text, size, weight = "normal", color = "#111111", gap = 16) {
    ctx.font = `${weight} ${size}px Courier New`
    ctx.fillStyle = color
    ctx.fillText(text, EXPORT_WIDTH / 2, y)
    y += gap
  }

  
  centerText("THE SWEETS", 72, "bold", "#111111", 72)
  centerText("PHOTO RECEIPT", 48, "bold", "#444444", 46)
  centerText("--------------------------------", 48, "normal", "#666666", 54)
  centerText(`Session: ${currentSessionCode}`, 48, "normal", "#111111", 48)
  centerText(`Date|Time: ${currentDateTime}`, 48, "normal", "#111111", 48)
  centerText("Item: 3 Photo Strip", 48, "normal", "#111111", 48)
  centerText("Status: READY TO DOWNLOAD", 48, "normal", "#111111", 60)

  let photoY = y
  const x = EXPORT_PADDING

  images.forEach((img, index) => {
    const h = photoHeights[index]
    ctx.drawImage(img, x, photoY, photoWidth, h)
    ctx.strokeStyle = "#ececec"
    ctx.lineWidth = 2
    ctx.strokeRect(x, photoY, photoWidth, h)
    photoY += h + EXPORT_GAP
  })

  y = photoY + 20
  centerText("--------------------------------", 48, "normal", "#666666", 54)
  centerText(currentCaption1 || "Sweet moments, sweet memories", 48, "normal", "#111111", 54)
  centerText(currentCaption2 || "Tag us @hellothesweets", 48, "normal", "#111111", 48)
  centerText("Total: GOOD DAY", 48, "normal", "#111111", 48)
  centerText("@hellothesweets", 48, "normal", "#111111", 48)
  centerText("Thank you for visiting", 48, "normal", "#111111", 48)
  centerText("--------------------------------", 48, "normal", "#666666", 48)

  return await new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error("Gagal membuat image strip"))
        return
      }
      resolve(blob)
    }, "image/png")
  })
}

async function createSignedUrlWithRetry(filePath, attempts = 5) {
  let lastError = null

  for (let i = 0; i < attempts; i++) {
    const { data, error } = await supabaseClient
      .storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, 60 * 30)

    if (!error && data?.signedUrl) {
      return data.signedUrl
    }

    lastError = error
    await sleep(500 * (i + 1))
  }

  throw lastError || new Error("Gagal membuat signed URL")
}

async function uploadStripToSupabase(blob) {
  const filePath = `strips/${new Date().toISOString().slice(0, 10)}/${currentSessionCode}-${Date.now()}.png`

  const { error: uploadError } = await supabaseClient
    .storage
    .from(BUCKET_NAME)
    .upload(filePath, blob, {
      contentType: "image/png",
      upsert: false
    })

  if (uploadError) {
    throw uploadError
  }

  return await createSignedUrlWithRetry(filePath)
}

async function showQRCode(url) {
  qrStatus.innerText = "Scan QR untuk download foto"
  downloadLink.href = url
  downloadLink.innerText = "Buka foto"
  qrCanvas.width = 280
  qrCanvas.height = 280

  await QRCode.toCanvas(qrCanvas, url, {
    width: 280,
    margin: 2,
    color: {
      dark: "#111111",
      light: "#ffffff"
    }
  })

  showScreen("qrScreen")

 if (qrCloseTimer) {
    clearTimeout(qrCloseTimer)
  }

  qrCloseTimer = setTimeout(() => {
    closeQRSession()
  }, QR_TIMEOUT_MS)
}

async function printStrip() {
  if (isUploading) return
  if (capturedPhotos.length !== MAX_PHOTOS) {
    alert("Tunggu sampai 3 foto selesai diambil dulu ya.")
    return
  }
  if (!confirm("Sudah puas?")) return

  try {
    isUploading = true
    qrStatus.innerText = "Menyiapkan QR..."
    const blob = await renderStripBlob()
    const signedUrl = await uploadStripToSupabase(blob)
    stopCameraStream()
    await showQRCode(signedUrl)
  } catch (err) {
    console.error("Supabase upload error:", err)
    alert("Gagal upload foto: " + (err?.message || JSON.stringify(err)))
  } finally {
    isUploading = false
  }
}
