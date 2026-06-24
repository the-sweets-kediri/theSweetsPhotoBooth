let video = document.getElementById("video")
let strip = document.getElementById("photos")
let counter = document.getElementById("countdown")
let retakeBtn = document.getElementById("retakeBtn")

const sessionDuration = 120000
const photoDelay = 7
const MAX_PHOTOS = 3
const QR_SCREEN_TIMEOUT = 20000
const SIGNED_URL_TTL_SECONDS = 600
const EXPORT_SCALE = Math.max(6, Math.ceil((window.devicePixelRatio || 1) * 3))

const SUPABASE_URL = "https://ayalafmqetfunliexrng.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5YWxhZm1xZXRmdW5saWV4cm5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDM3MjMsImV4cCI6MjA5NzgxOTcyM30.hbBHLllj5eJLFSkK-CIb32Zxu1a4oitTPqZ-81fMg-U"
const BUCKET_NAME = "Photobooth"

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const CAMERA_CONSTRAINTS = {
  audio: false,
  video: {
    facingMode: "user",
    width: { ideal: 4096 },
    height: { ideal: 2160 },
    frameRate: { ideal: 30, max: 60 }
  }
}

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
  "Tag us @thesweetlab",
  "See you again!",
  "Bring your friends next time",
  "Sweet memories start here"
]

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
  } else if(percent <= 50){
    top.style.width = "100%"
    right.style.height = ((percent - 25) / 25) * 100 + "%"
  } else if(percent <= 75){
    top.style.width = "100%"
    right.style.height = "100%"
    bottom.style.width = ((percent - 50) / 25) * 100 + "%"
  } else {
    top.style.width = "100%"
    right.style.height = "100%"
    bottom.style.width = "100%"
    left.style.height = ((percent - 75) / 25) * 100 + "%"
  }

  if(percent > 90){
    const opacity = Math.sin(Date.now() / 100) > 0 ? 1 : 0.3
    top.style.opacity = opacity
    right.style.opacity = opacity
    bottom.style.opacity = opacity
    left.style.opacity = opacity
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

function clearQRScreen(){
  const qrCanvas = document.getElementById("qrCanvas")
  const qrStatus = document.getElementById("qrStatus")
  const downloadLink = document.getElementById("downloadLink")

  clearTimeout(qrResetTimeout)
  qrResetTimeout = null

  if(qrCanvas){
    const ctx = qrCanvas.getContext("2d")
    ctx.clearRect(0, 0, qrCanvas.width, qrCanvas.height)
  }

  if(qrStatus){
    qrStatus.innerText = "Menyiapkan link download..."
  }

  if(downloadLink){
    downloadLink.href = "#"
    downloadLink.innerText = "Buka foto"
  }
}

function stopCameraStream(){
  const stream = video.srcObject
  if(!stream) return

  stream.getTracks().forEach(track => track.stop())
  video.srcObject = null
}

function returnToStartScreen(){
  isSessionActive = false
  capturing = false
  isUploading = false
  counter.innerText = ""

  cancelAnimationFrame(animationFrame)
  resetProgressBar()
  clearQRScreen()
  stopCameraStream()
  showScreen("startScreen")
}

function stopSessionForce(){
  returnToStartScreen()
}

function updateDateTime(){
  const el = document.getElementById("datetime")
  if(!el) return

  const now = new Date()
  const months = [
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec"
  ]

  const day = now.getDate()
  const month = months[now.getMonth()]
  const year = now.getFullYear()
  const hours = now.getHours().toString().padStart(2, "0")
  const mins = now.getMinutes().toString().padStart(2, "0")

  el.innerText = `${day} ${month} ${year} | ${hours}:${mins}`
}

function showScreen(id){
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"))
  document.getElementById(id).classList.add("active")
}

function setRandomCaption(){
  const random = captions[Math.floor(Math.random() * captions.length)]
  const el1 = document.getElementById("randomCaption")
  if(el1){
    el1.innerText = random
  }

  const random2 = captions2[Math.floor(Math.random() * captions2.length)]
  const el2 = document.getElementById("randomCaption2")
  if(el2){
    el2.innerText = random2
  }
}

function goInstruction(){
  showScreen("instructionScreen")
}

async function startSession(){
  showScreen("cameraScreen")
  resetSession()
  updateRetakeUI()
  updateDateTime()

  try{
    await startCamera()
    startSessionTimer()
    setTimeout(() => {
      startCapture()
    }, 500)
  }catch(err){
    console.error(err)
    alert("Kamera tidak bisa diakses")
    showScreen("startScreen")
  }
}

async function startCamera(){
  if(video.srcObject) return

  const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS)
  video.srcObject = stream

  await new Promise(resolve => {
    if(video.readyState >= 2){
      resolve()
      return
    }
    video.onloadedmetadata = () => resolve()
  })

  await video.play()
}

function resetSession(){
  retakeLeft = 2
  updateRetakeUI()
  strip.innerHTML = ""
  isSessionActive = false
  capturing = false
  isUploading = false
  counter.innerText = ""
  updateDateTime()
  clearQRScreen()
}

async function startCapture(){
  if(capturing || isUploading) return

  capturing = true
  isSessionActive = true
  setRandomCaption()
  strip.innerHTML = ""

  for(let i = 0; i < MAX_PHOTOS; i++){
    if(!isSessionActive) break

    await countdown(photoDelay)

    if(!isSessionActive) break

    let canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    let ctx = canvas.getContext("2d")
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    let img = canvas.toDataURL("image/png")
    let image = document.createElement("img")
    image.src = img
    image.alt = `Photo ${i + 1}`
    strip.appendChild(image)

    flash()
  }

  capturing = false
}

function flash(){
  let f = document.createElement("div")
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

function retake(){
  if(retakeLeft <= 0){
    alert("Kesempatan habis")
    return
  }

  if(isUploading) return

  retakeLeft--
  updateRetakeUI()
  startCapture()
}

function updateRetakeUI(){
  retakeBtn.innerText = "🔁 Coba Lagi (" + retakeLeft + ")"
}

async function createStripBlob(){
  const stripEl = document.getElementById("strip")
  const exportClone = stripEl.cloneNode(true)
  const exportWrapper = document.createElement("div")

  exportClone.id = "stripExportClone"
  exportClone.style.position = "static"
  exportClone.style.width = getComputedStyle(stripEl).width
  exportClone.style.boxShadow = "none"
  exportClone.style.filter = "none"

  exportWrapper.style.position = "fixed"
  exportWrapper.style.left = "-10000px"
  exportWrapper.style.top = "0"
  exportWrapper.style.background = "#ffffff"
  exportWrapper.style.padding = "0"
  exportWrapper.style.zIndex = "-1"
  exportWrapper.appendChild(exportClone)
  document.body.appendChild(exportWrapper)

  try{
    if(document.fonts && document.fonts.ready){
      await document.fonts.ready
    }

    const canvas = await html2canvas(exportClone, {
      backgroundColor: "#ffffff",
      scale: EXPORT_SCALE,
      useCORS: true,
      logging: false
    })

    return await new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if(!blob){
          reject(new Error("Gagal membuat file foto"))
          return
        }
        resolve(blob)
      }, "image/png")
    })
  } finally {
    exportWrapper.remove()
  }
}

async function uploadStripToSupabase(blob){
  const filePath = `strips/strip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`

  const { error: uploadError } = await supabaseClient
    .storage
    .from(BUCKET_NAME)
    .upload(filePath, blob, {
      contentType: "image/png",
      upsert: false
    })

  if(uploadError) throw uploadError

  const { data: signedData, error: signedError } = await supabaseClient
    .storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS)

  if(signedError) throw signedError
  if(!signedData || !signedData.signedUrl){
    throw new Error("Signed URL tidak tersedia")
  }

  return signedData.signedUrl
}

async function showQRCode(downloadUrl){
  const qrCanvas = document.getElementById("qrCanvas")
  const qrStatus = document.getElementById("qrStatus")
  const downloadLink = document.getElementById("downloadLink")

  await QRCode.toCanvas(qrCanvas, downloadUrl, {
    width: 280,
    margin: 2,
    errorCorrectionLevel: "H"
  })

  qrStatus.innerText = "Scan QR ini untuk buka dan download foto kamu"
  downloadLink.href = downloadUrl
  downloadLink.innerText = "Buka foto"

  stopCameraStream()
  showScreen("qrScreen")

  clearTimeout(qrResetTimeout)
  qrResetTimeout = setTimeout(() => {
    stopSessionForce()
  }, QR_SCREEN_TIMEOUT)
}

async function printStrip(){
  if(isUploading) return

  const photoCount = strip.querySelectorAll("img").length
  if(capturing || photoCount < MAX_PHOTOS){
    alert("Tunggu sampai 3 foto selesai diambil dulu ya")
    return
  }

  if(!confirm("Sudah puas?")) return

  const qrStatus = document.getElementById("qrStatus")
  const qrCanvas = document.getElementById("qrCanvas")
  const downloadLink = document.getElementById("downloadLink")

  try{
    isUploading = true
    isSessionActive = false
    counter.innerText = ""
    cancelAnimationFrame(animationFrame)
    resetProgressBar()

    if(qrCanvas){
      const ctx = qrCanvas.getContext("2d")
      ctx.clearRect(0, 0, qrCanvas.width, qrCanvas.height)
    }
    if(downloadLink){
      downloadLink.href = "#"
      downloadLink.innerText = "Menyiapkan..."
    }
    if(qrStatus){
      qrStatus.innerText = "Mengunggah foto resolusi tinggi..."
    }

    showScreen("qrScreen")

    const blob = await createStripBlob()
    const signedUrl = await uploadStripToSupabase(blob)
    await showQRCode(signedUrl)
  }catch(err){
    console.error("Supabase upload error:", err)
    alert("Gagal upload foto: " + (err.message || JSON.stringify(err)))
    showScreen("cameraScreen")
  }finally{
    isUploading = false
  }
}

function stopSession(){
  if(!confirm("Yakin berhenti?")) return
  returnToStartScreen()
}

function resetProgressBar(){
  const top = document.getElementById("progressTop")
  const right = document.getElementById("progressRight")
  const bottom = document.getElementById("progressBottom")
  const left = document.getElementById("progressLeft")

  top.style.width = "0%"
  right.style.height = "0%"
  bottom.style.width = "0%"
  left.style.height = "0%"

  top.style.opacity = 1
  right.style.opacity = 1
  bottom.style.opacity = 1
  left.style.opacity = 1
}

function countdown(sec){
  return new Promise(resolve => {
    let i = sec
    counter.innerText = i

    let timer = setInterval(() => {
      if(!isSessionActive){
        clearInterval(timer)
        counter.innerText = ""
        resolve()
        return
      }

      i--
      counter.innerText = i

      if(i <= 0){
        clearInterval(timer)
        counter.innerText = ""
        resolve()
      }
    }, 1000)
  })
}
