const SUPABASE_URL = "https://ayalafmqetfunliexrng.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5YWxhZm1xZXRmdW5saWV4cm5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDM3MjMsImV4cCI6MjA5NzgxOTcyM30.hbBHLllj5eJLFSkK-CIb32Zxu1a4oitTPqZ-81fMg-U"
const BUCKET_NAME = "Photobooth"
const SIGNED_URL_TTL_SECONDS = 60 * 10
const EXPORT_STRIP_WIDTH = 720
const EXPORT_SCALE = 3

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const video = document.getElementById("video")
const strip = document.getElementById("photos")
const counter = document.getElementById("countdown")
const retakeBtn = document.getElementById("retakeBtn")
const qrCanvas = document.getElementById("qrCanvas")
const qrStatus = document.getElementById("qrStatus")
const downloadLink = document.getElementById("downloadLink")

const sessionDuration = 120000
const photoDelay = 7
const MAX_PHOTOS = 3

let retakeLeft = 2
let sessionStartTime = null
let animationFrame = null
let capturing = false
let isSessionActive = false
let isUploading = false
let qrResetTimeout = null

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

function goInstruction(){
  clearQrResetTimeout()
  showScreen("instructionScreen")
}

function showScreen(id){
  document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"))
  document.getElementById(id).classList.add("active")
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

function setRandomCaption(){
  const random = captions[Math.floor(Math.random() * captions.length)]
  const random2 = captions2[Math.floor(Math.random() * captions2.length)]
  const el1 = document.getElementById("randomCaption")
  const el2 = document.getElementById("randomCaption2")

  if(el1) el1.innerText = random
  if(el2) el2.innerText = random2
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

function clearQrResetTimeout(){
  if(qrResetTimeout){
    clearTimeout(qrResetTimeout)
    qrResetTimeout = null
  }
}

function stopCameraStream(){
  const stream = video.srcObject
  if(!stream) return
  stream.getTracks().forEach((track) => track.stop())
  video.srcObject = null
}

function resetSession(){
  retakeLeft = 2
  updateRetakeUI()
  strip.innerHTML = ""
  counter.innerText = ""
  isSessionActive = false
  capturing = false
  isUploading = false
  updateDateTime()
  setRandomCaption()
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
    top.style.width = (percent / 25) * 100 + "%"
  }else if(percent <= 50){
    top.style.width = "100%"
    right.style.height = ((percent - 25) / 25) * 100 + "%"
  }else if(percent <= 75){
    top.style.width = "100%"
    right.style.height = "100%"
    bottom.style.width = ((percent - 50) / 25) * 100 + "%"
  }else{
    top.style.width = "100%"
    right.style.height = "100%"
    bottom.style.width = "100%"
    left.style.height = ((percent - 75) / 25) * 100 + "%"
  }

  if(percent > 90){
    const blink = Math.sin(Date.now() / 100) > 0 ? 1 : 0.3
    top.style.opacity = blink
    right.style.opacity = blink
    bottom.style.opacity = blink
    left.style.opacity = blink
  }else{
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

async function startSession(){
  clearQrResetTimeout()
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

  startSessionTimer()
  startCapture()
}

async function startCamera(){
  const existingStream = video.srcObject
  if(existingStream){
    const hasLiveTrack = existingStream.getVideoTracks().some((track) => track.readyState === "live")
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
      frameRate: { ideal: 30, max: 30 }
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

async function countdown(sec){
  return new Promise((resolve) => {
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
  if(!video.videoWidth || !video.videoHeight){
    alert("Kamera belum siap. Coba mulai lagi.")
    return
  }

  capturing = true
  isSessionActive = true
  setRandomCaption()
  strip.innerHTML = ""

  for(let i = 0; i < MAX_PHOTOS; i++){
    if(!isSessionActive) break

    await countdown(photoDelay)
    if(!isSessionActive) break

    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth || 1920
    canvas.height = video.videoHeight || 1080

    const ctx = canvas.getContext("2d")
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

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

  if(capturing || isUploading) return

  retakeLeft--
  updateRetakeUI()
  startCapture()
}

function stopSession(){
  if(!confirm("Yakin berhenti?")) return
  stopSessionForce()
}

function stopSessionForce(){
  clearQrResetTimeout()
  isSessionActive = false
  capturing = false
  isUploading = false
  counter.innerText = ""
  cancelAnimationFrame(animationFrame)
  resetProgressBar()
  stopCameraStream()
  showScreen("startScreen")
}

async function wait(ms){
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function exportStripToBlob(){
  const stripWrapper = document.getElementById("strip")
  const clone = stripWrapper.cloneNode(true)
  clone.id = "stripExportClone"
  clone.style.width = `${EXPORT_STRIP_WIDTH}px`
  clone.style.maxWidth = `${EXPORT_STRIP_WIDTH}px`
  clone.style.position = "fixed"
  clone.style.left = "-10000px"
  clone.style.top = "0"
  clone.style.opacity = "1"
  clone.style.pointerEvents = "none"
  clone.style.boxShadow = "none"
  clone.style.borderRadius = "0"
  clone.style.padding = "24px"
  clone.style.fontSize = "28px"
  clone.style.lineHeight = "1.35"
  clone.querySelectorAll("img").forEach((img) => {
    img.style.width = "100%"
    img.style.display = "block"
    img.style.filter = "none"
    img.style.marginBottom = "10px"
  })

  document.body.appendChild(clone)

  try {
    const canvas = await html2canvas(clone, {
      backgroundColor: "#ffffff",
      scale: EXPORT_SCALE,
      useCORS: true,
      logging: false
    })

    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if(!blob){
          reject(new Error("Gagal membuat image dari strip"))
          return
        }
        resolve(blob)
      }, "image/png")
    })
  } finally {
    clone.remove()
  }
}

async function uploadStripToSupabase(blob){
  const filePath = `strips/${Date.now()}-${crypto.randomUUID()}.png`
  console.log("Uploading to Supabase", { bucket: BUCKET_NAME, filePath, supabaseUrl: SUPABASE_URL })

  const { error: uploadError } = await supabaseClient
    .storage
    .from(BUCKET_NAME)
    .upload(filePath, blob, {
      cacheControl: "3600",
      contentType: "image/png",
      upsert: false
    })

  if(uploadError) throw uploadError

  for(let attempt = 0; attempt < 4; attempt++){
    const { data, error } = await supabaseClient
      .storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS, {
        download: `${Date.now()}-the-sweets.png`
      })

    if(!error && data?.signedUrl){
      return data.signedUrl
    }

    if(attempt === 3){
      throw error || new Error("Gagal membuat signed URL")
    }

    await wait(600)
  }
}

async function showQRCode(url){
  qrStatus.innerText = "Scan QR untuk simpan foto"
  downloadLink.href = url
  downloadLink.innerText = "Download foto"

  const size = 280
  qrCanvas.width = size
  qrCanvas.height = size

  await QRCode.toCanvas(qrCanvas, url, {
    width: size,
    margin: 2,
    color: {
      dark: "#9c005c",
      light: "#ffffff"
    }
  })

  showScreen("qrScreen")
  clearQrResetTimeout()
  qrResetTimeout = setTimeout(() => {
    stopSessionForce()
  }, 20000)
}

async function printStrip(){
  if(isUploading || capturing) return
  if(strip.children.length < MAX_PHOTOS){
    alert("Foto belum lengkap.")
    return
  }
  if(!confirm("Sudah puas?")) return

  try {
    isUploading = true
    isSessionActive = false
    counter.innerText = ""
    qrStatus.innerText = "Mengupload foto..."

    const blob = await exportStripToBlob()
    const signedUrl = await uploadStripToSupabase(blob)

    stopCameraStream()
    await showQRCode(signedUrl)
  } catch (err) {
    console.error("Supabase upload error:", err)
    const message = err?.message || err?.error_description || JSON.stringify(err)
    alert(`Gagal upload foto: ${message}`)
    showScreen("cameraScreen")
  } finally {
    isUploading = false
  }
}

updateDateTime()
setRandomCaption()
