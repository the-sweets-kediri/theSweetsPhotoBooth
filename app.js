const SUPABASE_URL = "https://ayalafmqetfunliexrng.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5YWxhZm1xZXRmdW5saWV4cm5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDM3MjMsImV4cCI6MjA5NzgxOTcyM30.hbBHLllj5eJLFSkK-CIb32Zxu1a4oitTPqZ-81fMg-U"
const BUCKET_NAME = "Photobooth"
const EXPORT_SCALE = 6
const QR_TIMEOUT_MS = 20000

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

let video = document.getElementById("video")
let strip = document.getElementById("photos")
let counter = document.getElementById("countdown")
let retakeBtn = document.getElementById("retakeBtn")

const sessionDuration = 120000
const photoDelay = 7
let retakeLeft = 2
let sessionStartTime = null
let animationFrame = null
let capturing = false
let isSessionActive = false
let isUploading = false
const MAX_PHOTOS = 3

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

function showScreen(id){
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"))
  document.getElementById(id).classList.add("active")
}

function goInstruction(){
  showScreen("instructionScreen")
}

function setRandomCaption(){
  const el1 = document.getElementById("randomCaption")
  const el2 = document.getElementById("randomCaption2")
  if(el1) el1.innerText = captions[Math.floor(Math.random() * captions.length)]
  if(el2) el2.innerText = captions2[Math.floor(Math.random() * captions2.length)]
}

function updateDateTime(){
  const el = document.getElementById("datetime")
  if(!el) return
  const now = new Date()
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  const day = now.getDate()
  const month = months[now.getMonth()]
  const year = now.getFullYear()
  const hours = now.getHours().toString().padStart(2, "0")
  const mins = now.getMinutes().toString().padStart(2, "0")
  el.innerText = `${day} ${month} ${year} | ${hours}:${mins}`
}

function updateRetakeUI(){
  retakeBtn.innerText = `🔁 Coba Lagi (${retakeLeft})`
}

function resetProgressBar(){
  document.getElementById("progressTop").style.width = "0%"
  document.getElementById("progressRight").style.height = "0%"
  document.getElementById("progressBottom").style.width = "0%"
  document.getElementById("progressLeft").style.height = "0%"
}

function updateProgressSmooth(elapsed){
  const percent = Math.min(1, elapsed / sessionDuration) * 100
  const top = document.getElementById("progressTop")
  const right = document.getElementById("progressRight")
  const bottom = document.getElementById("progressBottom")
  const left = document.getElementById("progressLeft")

  top.style.width = "0%"
  right.style.height = "0%"
  bottom.style.width = "0%"
  left.style.height = "0%"

  if(percent <= 25){
    top.style.width = `${(percent / 25) * 100}%`
  } else if(percent <= 50){
    top.style.width = "100%"
    right.style.height = `${((percent - 25) / 25) * 100}%`
  } else if(percent <= 75){
    top.style.width = "100%"
    right.style.height = "100%"
    bottom.style.width = `${((percent - 50) / 25) * 100}%`
  } else {
    top.style.width = "100%"
    right.style.height = "100%"
    bottom.style.width = "100%"
    left.style.height = `${((percent - 75) / 25) * 100}%`
  }

  if(percent > 90){
    const flash = Math.sin(Date.now() / 100) > 0 ? 1 : 0.3
    top.style.opacity = flash
    right.style.opacity = flash
    bottom.style.opacity = flash
    left.style.opacity = flash
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

function startSessionTimer(){
  cancelAnimationFrame(animationFrame)
  sessionStartTime = Date.now()
  runTimer()
}

function runTimer(){
  const now = Date.now()
  const elapsed = now - sessionStartTime
  const remaining = sessionDuration - elapsed
  updateProgressSmooth(elapsed)

  if(remaining <= 0){
    cancelAnimationFrame(animationFrame)
    alert("Waktu habis")
    stopSessionForce()
    return
  }

  animationFrame = requestAnimationFrame(runTimer)
}

function resetSession(){
  retakeLeft = 2
  strip.innerHTML = ""
  isSessionActive = false
  capturing = false
  updateRetakeUI()
  updateDateTime()
  resetProgressBar()
}

function stopCameraStream(){
  const stream = video.srcObject
  if(!stream) return
  stream.getTracks().forEach(track => track.stop())
  video.srcObject = null
}

async function startCamera(){
  const existingStream = video.srcObject
  if(existingStream){
    const hasLiveTrack = existingStream.getVideoTracks().some(track => track.readyState === "live")
    if(hasLiveTrack){
      if(video.readyState >= 2){
        await video.play()
      }
      return
    }
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user",
      width: { ideal: 3840 },
      height: { ideal: 2160 },
      frameRate: { ideal: 30, max: 60 }
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

    if(video.readyState >= 1 && video.videoWidth && video.videoHeight){
      onReady()
      return
    }

    video.onloadedmetadata = onReady
  })
}

async function startSession(){
  showScreen("cameraScreen")
  resetSession()

  try {
    await startCamera()
  } catch (err) {
    console.error("Camera start failed:", err)
    alert("Kamera gagal dibuka. Pastikan izin kamera diizinkan dan halaman dibuka via HTTPS / localhost.")
    showScreen("instructionScreen")
    return
  }

  updateDateTime()
  startSessionTimer()
  startCapture()
}

function countdown(sec){
  return new Promise(resolve => {
    let i = sec
    counter.innerText = i
    const timer = setInterval(() => {
      if(!isSessionActive){
        clearInterval(timer)
        counter.innerText = ""
        resolve()
        return
      }

      i--
      counter.innerText = i > 0 ? i : ""

      if(i <= 0){
        clearInterval(timer)
        resolve()
      }
    }, 1000)
  })
}

function flash(){
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

async function startCapture(){
  if(capturing) return

  capturing = true
  isSessionActive = true
  setRandomCaption()
  strip.innerHTML = ""

  for(let i = 0; i < MAX_PHOTOS; i++){
    if(!isSessionActive) break
    await countdown(photoDelay)
    if(!isSessionActive) break

    if(!video.videoWidth || !video.videoHeight){
      alert("Kamera belum siap. Coba mulai lagi.")
      break
    }

    const canvas = document.createElement("canvas")
    const width = video.videoWidth || 1920
    const height = video.videoHeight || 1080
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext("2d")
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(video, 0, 0, width, height)

    const img = canvas.toDataURL("image/png")
    const image = document.createElement("img")
    image.src = img
    strip.appendChild(image)
    flash()
  }

  capturing = false
}

function retake(){
  if(retakeLeft <= 0){
    alert("Kesempatan habis")
    return
  }

  retakeLeft--
  updateRetakeUI()
  startCapture()
}

function stopSession(){
  if(!confirm("Yakin berhenti?")) return
  stopSessionForce()
}

function stopSessionForce(){
  isSessionActive = false
  capturing = false
  counter.innerText = ""
  cancelAnimationFrame(animationFrame)
  resetProgressBar()
  stopCameraStream()
  showScreen("startScreen")
}

async function stripToBlob(){
  const stripEl = document.getElementById("strip")
  const canvas = await html2canvas(stripEl, {
    backgroundColor: "#ffffff",
    scale: EXPORT_SCALE,
    useCORS: true,
    logging: false
  })

  return await new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if(!blob) return reject(new Error("Gagal membuat image akhir"))
      resolve(blob)
    }, "image/png", 1)
  })
}

async function uploadStripToSupabase(blob){
  const filePath = `strips/${crypto.randomUUID()}.png`

  const { error: uploadError } = await supabaseClient
    .storage
    .from(BUCKET_NAME)
    .upload(filePath, blob, {
      contentType: "image/png",
      upsert: false
    })

  if(uploadError) throw uploadError

  const { data, error: signedError } = await supabaseClient
    .storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, 60 * 15)

  if(signedError) throw signedError

  return data.signedUrl
}

async function showQRCode(url){
  const qrCanvas = document.getElementById("qrCanvas")
  const qrStatus = document.getElementById("qrStatus")
  const downloadLink = document.getElementById("downloadLink")

  qrStatus.innerText = "Scan QR untuk simpan foto"
  downloadLink.href = url
  downloadLink.innerText = "Buka foto"

  await QRCode.toCanvas(qrCanvas, url, {
    width: 260,
    margin: 2,
    color: {
      dark: "#7a0044",
      light: "#ffffff"
    }
  })

  showScreen("qrScreen")

  setTimeout(() => {
    stopSessionForce()
  }, QR_TIMEOUT_MS)
}

async function printStrip(){
  if(isUploading) return
  if(strip.children.length === 0){
    alert("Belum ada foto untuk diupload.")
    return
  }
  if(!confirm("Sudah puas?")) return

  try {
    isUploading = true
    const qrStatus = document.getElementById("qrStatus")
    qrStatus.innerText = "Mengupload foto..."

    isSessionActive = false
    capturing = false
    counter.innerText = ""
    cancelAnimationFrame(animationFrame)

    const blob = await stripToBlob()
    const signedUrl = await uploadStripToSupabase(blob)
    stopCameraStream()
    await showQRCode(signedUrl)
  } catch (err) {
    console.error("Supabase upload error:", err)
    alert("Gagal upload foto: " + (err.message || JSON.stringify(err)))
  } finally {
    isUploading = false
  }
}

updateDateTime()
