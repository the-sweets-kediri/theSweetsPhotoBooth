let video = document.getElementById("video")
let strip = document.getElementById("photos")
let counter = document.getElementById("countdown")
let retakeBtn = document.getElementById("retakeBtn")

const sessionDuration = 120000 // in ms
const photoDelay = 7 //in sec
let retakeLeft=2

let sessionStartTime = null
let animationFrame = null

let capturing=false
let isSessionActive=false


let sessionTime = 180
let timerInterval = null

const MAX_PHOTOS=3
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

  // RESET dulu
  top.style.width = "0%"
  right.style.height = "0%"
  bottom.style.width = "0%"
  left.style.height = "0%"

  if(percent <= 25){
    // kiri atas → kanan atas
    top.style.width = (percent / 25) * 100 + "%"
  }
  else if(percent <= 50){
    top.style.width = "100%"
    right.style.height = ((percent - 25) / 25) * 100 + "%"
  }
  else if(percent <= 75){
    top.style.width = "100%"
    right.style.height = "100%"
    bottom.style.width = ((percent - 50) / 25) * 100 + "%"
  }
  else{
    top.style.width = "100%"
    right.style.height = "100%"
    bottom.style.width = "100%"
    left.style.height = ((percent - 75) / 25) * 100 + "%"
  }
if(percent > 90){
  top.style.opacity = (Math.sin(Date.now()/100) > 0 ? 1 : 0.3)
  right.style.opacity = (Math.sin(Date.now()/100) > 0 ? 1 : 0.3)
  bottom.style.opacity = (Math.sin(Date.now()/100) > 0 ? 1 : 0.3)
  left.style.opacity = (Math.sin(Date.now()/100) > 0 ? 1 : 0.3)
}
  // 🎨 WARNA GRADUAL (HIJAU → MERAH)
  const r = Math.floor(46 + (231-46) * (percent/100))
  const g = Math.floor(204 - (204-76) * (percent/100))
  const b = Math.floor(113 - (113-60) * (percent/100))

  const color = `rgb(${r},${g},${b})`

  top.style.background = color
  right.style.background = color
  bottom.style.background = color
  left.style.background = color
}

function stopSessionForce(){
  isSessionActive = false
  capturing = false
  counter.innerText = ""
  cancelAnimationFrame(animationFrame)
  stopCameraStream()
  resetProgressBar()
  showScreen("startScreen")
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

  const hours = now.getHours().toString().padStart(2,'0')
  const mins = now.getMinutes().toString().padStart(2,'0')

  el.innerText = `${day} ${month} ${year} | ${hours}:${mins}`
}

// SCREEN
function showScreen(id){
document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"))
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

// CAMERA
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
      width: { ideal: 1920 },
      height: { ideal: 1080 }
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

function stopCameraStream(){
  const stream = video.srcObject
  if(!stream) return

  stream.getTracks().forEach(track => track.stop())
  video.srcObject = null
}

// RESET
function resetSession(){
retakeLeft=2
updateRetakeUI()
strip.innerHTML=""
isSessionActive=false
updateDateTime()
}

// CAPTURE
async function startCapture(){

if(capturing) return

if(!video.videoWidth || !video.videoHeight){
  alert("Kamera belum siap. Coba mulai lagi.")
  return
}

capturing=true
isSessionActive=true
setRandomCaption() 
strip.innerHTML=""

for(let i=0;i<MAX_PHOTOS;i++){

if(!isSessionActive) break

await countdown(photoDelay)

if(!isSessionActive) break

let canvas=document.createElement("canvas")
canvas.width=video.videoWidth || 1280
canvas.height=video.videoHeight || 720

let ctx = canvas.getContext("2d")
ctx.imageSmoothingEnabled = true
ctx.imageSmoothingQuality = "high"
ctx.drawImage(video,0,0,canvas.width,canvas.height)

let img=canvas.toDataURL("image/png")

let image=document.createElement("img")
image.src=img
strip.appendChild(image)

flash()
}

capturing=false
}

// FLASH
function flash(){
let f=document.createElement("div")
f.style.position="fixed"
f.style.top=0
f.style.left=0
f.style.width="100%"
f.style.height="100%"
f.style.background="white"
f.style.zIndex=9999
document.body.appendChild(f)
setTimeout(()=>f.remove(),120)
}

// RETAKE
function retake(){

if(retakeLeft<=0){
alert("Kesempatan habis")
return
}

retakeLeft--
updateRetakeUI()
startCapture()
}

function updateRetakeUI(){
retakeBtn.innerText="🔁 Coba Lagi ("+retakeLeft+")"
}

// PRINT
function printStrip(){
if(!confirm("Sudah puas?")) return
    window.print()
}

// STOP (FIXED TOTAL)
function stopSession(){

  if(!confirm("Yakin berhenti?")) return

  isSessionActive = false
  capturing = false
  counter.innerText = ""

  cancelAnimationFrame(animationFrame)
  stopCameraStream()
  resetProgressBar()   

  showScreen("startScreen")
}

function resetProgressBar(){

  document.getElementById("progressTop").style.width = "0%"
  document.getElementById("progressRight").style.height = "0%"
  document.getElementById("progressBottom").style.width = "0%"
  document.getElementById("progressLeft").style.height = "0%"

}

// COUNTDOWN (STOP SAFE)
function countdown(sec){

return new Promise(resolve=>{

let i=sec
counter.innerText=i

let timer=setInterval(()=>{

if(!isSessionActive){
clearInterval(timer)
counter.innerText=""
resolve()
return
}

i--
counter.innerText=i

if(i<=0){
clearInterval(timer)
counter.innerText=""
resolve()
}

},1000)

})
}
