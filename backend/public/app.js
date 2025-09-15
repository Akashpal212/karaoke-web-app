const startBtn = document.getElementById('start-btn')
const stopBtn = document.getElementById('stop-btn')
const downloadLink = document.getElementById('download-link')

let lyrics = []
let currentLyricIndex = 0
let mediaRecorder
let recordedChunks = []
let stream
let mixedStream
let liveCanvas
let ctx
let audioContext
let webcamVideo
let bgAudioElement

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600

async function loadLyrics() {
    const response = await fetch('lyrics.json')
    lyrics = await response.json()
}

function stopRecording() {
    startBtn.disabled = false
    stopBtn.disabled = true

    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop()
    }
    
    if (stream) {
        stream.getTracks().forEach(track => track.stop())
        stream = null
    }
    
    if (audioContext) {
        audioContext.close()
        audioContext = null
    }
    
    if (bgAudioElement) {
        bgAudioElement.pause()
        bgAudioElement.currentTime = 0
        bgAudioElement.remove()
        bgAudioElement = null
    } 
    
    if (liveCanvas) {
        liveCanvas.remove()
        liveCanvas = null
    } 
    
    if (webcamVideo) {
        webcamVideo.remove()
        webcamVideo = null
    } 
    
    currentLyricIndex = 0
}

function wrapText(context, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ')
    let line = ''
    let lines = []

    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' '
        const metrics = context.measureText(testLine)
        const testWidth = metrics.width
        if (testWidth > maxWidth && n > 0) {
            lines.push(line)
            line = words[n] + ' '
        } else {
            line = testLine
        }
    }
    lines.push(line)

    for (let i = 0; i < lines.length; i++) {
        context.fillText(lines[i], x, y - (lines.length - 1 - i) * lineHeight)
    }
}

function drawFrame() {
    if (!webcamVideo || webcamVideo.readyState < 2) {
        requestAnimationFrame(drawFrame)
        return
    }
        
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    ctx.drawImage(webcamVideo, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
        
    while (currentLyricIndex < lyrics.length - 1 && bgAudioElement.currentTime >= lyrics[currentLyricIndex + 1].time) {
        currentLyricIndex++
    }
        
    const currentText = lyrics[currentLyricIndex] ? lyrics[currentLyricIndex].text : ''
    ctx.font = '40px Arial'
    ctx.fillStyle = 'white'
    ctx.textAlign = 'center'
    ctx.shadowColor = 'black'
    ctx.shadowBlur = 6
    ctx.lineWidth = 3
    ctx.strokeStyle = 'black'
        
    const maxWidth = CANVAS_WIDTH - 40
    const lineHeight = 40
    wrapText(ctx, currentText, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 100, maxWidth, lineHeight)
        
    requestAnimationFrame(drawFrame)
}

async function startRecording() {
    startBtn.disabled = true
    stopBtn.disabled = false
    downloadLink.style.display = 'none'
    recordedChunks = []
    currentLyricIndex = 0

    content.style.maxHeight = null
    content.style.padding = "0 15px"
    
    if (liveCanvas) { liveCanvas.remove(); liveCanvas = null }
    if (webcamVideo) { webcamVideo.remove(); webcamVideo = null }
    if (bgAudioElement) { bgAudioElement.pause(); bgAudioElement.remove(); bgAudioElement = null }
    if (audioContext) { audioContext.close(); audioContext = null }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null }
    
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    } catch (err) {
        alert('Camera and microphone access are required.')
        startBtn.disabled = false
        stopBtn.disabled = true
        return
    }
    
    audioContext = new AudioContext()
    if (audioContext.state === 'suspended') await audioContext.resume()
        
    liveCanvas = document.createElement('canvas')
    liveCanvas.width = CANVAS_WIDTH
    liveCanvas.height = CANVAS_HEIGHT
    liveCanvas.style.display = 'block'
    liveCanvas.style.margin = '20px auto'
    document.body.insertBefore(liveCanvas, document.getElementById('controls'))
    ctx = liveCanvas.getContext('2d')
    
    webcamVideo = document.createElement('video')
    webcamVideo.srcObject = stream
    webcamVideo.muted = true
    webcamVideo.playsInline = true
    webcamVideo.style.display = 'none'
    document.body.appendChild(webcamVideo)
    await webcamVideo.play()
    
    const originalAudio = document.getElementById('bg-audio')
    bgAudioElement = originalAudio.cloneNode(true)
    bgAudioElement.style.display = 'none'
    document.body.appendChild(bgAudioElement)
    await bgAudioElement.play().catch(err => console.error("Error playing bg audio:", err))
    
    const sourceMic = audioContext.createMediaStreamSource(stream)
    const sourceBg = audioContext.createMediaElementSource(bgAudioElement)
    
    const gainMic = audioContext.createGain()
    const gainBg = audioContext.createGain()
    gainMic.gain.value = 3
    gainBg.gain.value = 0.2
    
    sourceMic.connect(gainMic)
    sourceBg.connect(gainBg)
    
    const destination = audioContext.createMediaStreamDestination()
    gainMic.connect(destination)
    gainBg.connect(destination)
    gainBg.connect(audioContext.destination)
    
    drawFrame()
    
    mixedStream = new MediaStream()
    const canvasStream = liveCanvas.captureStream(30)
    canvasStream.getVideoTracks().forEach(track => mixedStream.addTrack(track))
    destination.stream.getAudioTracks().forEach(track => mixedStream.addTrack(track))
    
    mediaRecorder = new MediaRecorder(mixedStream, { mimeType: 'video/webm' })
    mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) recordedChunks.push(e.data)
    }
    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' })
        const url = URL.createObjectURL(blob)
        downloadLink.href = url
        downloadLink.download = 'karaoke-video.webm'
        downloadLink.style.display = 'inline'
        downloadLink.textContent = 'Download Video'
    }
    
    mediaRecorder.start()
    
    bgAudioElement.addEventListener('ended', () => {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            stopRecording()
            alert('Karaoke session ended. Download your video.')
        }
    }, { once: true })
}

startBtn.disabled = false
stopBtn.disabled = true
startBtn.addEventListener('click', startRecording)
stopBtn.addEventListener('click', stopRecording)

loadLyrics()

const toggleBtn = document.getElementById("info-toggle")
const content = document.getElementById("info-content")

toggleBtn.addEventListener("click", () => {
  if (content.style.maxHeight) {
    content.style.maxHeight = null
    content.style.padding = "0 15px"
  } else {
    content.style.maxHeight = content.scrollHeight + "px"
    content.style.padding = "15px"
  }
})