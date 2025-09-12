const bgAudio = document.getElementById('bg-audio')
const lyricsLine = document.getElementById('lyrics-line')
const webcamVideo = document.getElementById('webcam-video')
const startBtn = document.getElementById('start-btn')
const stopBtn = document.getElementById('stop-btn')
const downloadLink = document.getElementById('download-link')

let lyrics = []
let currentLyricIndex = 0
let lyricsInterval
let mediaRecorder
let recordedChunks = []
let stream
let mixedStream

async function loadLyrics() {
    const response = await fetch('lyrics.json')
    lyrics = await response.json()
}

function updateLyrics(currentTime) {
    if (currentLyricIndex < lyrics.length - 1 && currentTime >= lyrics[currentLyricIndex + 1].time) {
        currentLyricIndex++
    }
    const text = lyrics[currentLyricIndex] ? lyrics[currentLyricIndex].text : ''
    lyricsLine.textContent = text
    if (text) {
        lyricsLine.classList.add('active')
    } else {
        lyricsLine.classList.remove('active')
    }
}

async function startRecording() {
    startBtn.disabled = true
    stopBtn.disabled = false
    downloadLink.style.display = 'none'
    currentLyricIndex = 0
    lyricsLine.classList.add('active')

    bgAudio.currentTime = 0
    await bgAudio.play()

    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    webcamVideo.srcObject = stream

    const audioContext = new AudioContext()

    const sourceMic = audioContext.createMediaStreamSource(stream)

    const sourceBg = audioContext.createMediaElementSource(bgAudio)

    const gainMic = audioContext.createGain()
    const gainBg = audioContext.createGain()

    gainMic.gain.value = 1
    gainBg.gain.value = 0.3

    sourceMic.connect(gainMic)
    sourceBg.connect(gainBg)

    const destination = audioContext.createMediaStreamDestination()

    gainMic.connect(destination)
    gainBg.connect(destination)

    const canvas = document.createElement('canvas')
    const videoTrack = stream.getVideoTracks()[0]
    const settings = videoTrack.getSettings()
    canvas.width = settings.width || 480
    canvas.height = settings.height || 360
    const ctx = canvas.getContext('2d')

    function drawFrame() {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(webcamVideo, 0, 0, canvas.width, canvas.height)

        ctx.font = '30px Arial'
        ctx.fillStyle = 'red'
        ctx.textAlign = 'center'
        ctx.fillText(lyrics[currentLyricIndex] ? lyrics[currentLyricIndex].text : '', canvas.width / 2, canvas.height - 40)

        requestAnimationFrame(drawFrame)
    }
    drawFrame()

    mixedStream = new MediaStream()

    const canvasStream = canvas.captureStream(30)
    canvasStream.getVideoTracks().forEach((track) => mixedStream.addTrack(track))

    destination.stream.getAudioTracks().forEach((track) => mixedStream.addTrack(track))

    mediaRecorder = new MediaRecorder(mixedStream, { mimeType: 'video/webm' })

    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
            recordedChunks.push(e.data)
        }
    }

    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' })
        recordedChunks = []

        const url = URL.createObjectURL(blob)
        downloadLink.href = url
        downloadLink.download = 'karaoke-video.webm'
        downloadLink.style.display = 'inline'
        downloadLink.textContent = 'Download Video'
    }

    mediaRecorder.start()

    lyricsInterval = setInterval(() => {
        updateLyrics(bgAudio.currentTime)
    }, 100)
}

function stopRecording() {
    startBtn.disabled = false
    stopBtn.disabled = true

    clearInterval(lyricsInterval)
    lyricsLine.classList.remove('active')
    lyricsLine.textContent = ''

    mediaRecorder.stop()
    stream.getTracks().forEach((track) => track.stop())
    bgAudio.pause()
    bgAudio.currentTime = 0
}

startBtn.addEventListener('click', startRecording)
stopBtn.addEventListener('click', stopRecording)

loadLyrics()