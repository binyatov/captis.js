/**
* @author Pasha Binyatov <pasha@binyatov.com>
* @copyright 2014 Pasha Binyatov
* @license {@link https://github.com/binyatov/captis.js/blob/master/LICENSE|MIT License}
*/

/**
*/
navigator.getUserMedia = (
    navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia
);

window.URL = (
    window.URL ||
    window.webkitURL ||
    window.mozURL ||
    window.msURL
);

var AudioContext = window.AudioContext || window.webkitAudioContext,
    Whammy = require('Whammy'),
    channelData = [];

var captis = {stream: null,
    frames: [],
    animation: null,
    startTime: 0,
    endTime: 0,
    capturing: false,
    streaming: false,
    record: null,
    audio: {
        recordingSize: 0,
        sampleRate: 44100,
        recording: false,
        processor: null
    }
}

function initializeToolbar (e) {
    if (e.ctrlKey && e.keyCode == 69) {
        document.getElementById('captis').innerHTML += (
            '<div id="toolbar"> \
                <i id="camera" class="fa fa-video-camera captis_icon"></i> \
                <i id="record" class="fa fa-circle"></i> \
                <i id="screen" class="fa fa-desktop captis_icon"></i> \
                <i id="save" class="fa fa-save captis_icon"></i> \
                <i id="edit" class="fa fa-edit captis_icon"></i> \
                <i id="update" class="fa fa-refresh captis_icon"></i> \
                <i id="switch" class="fa fa-power-off captis_icon"></i> \
            </div>'
        );
        document.removeEventListener('keyup', initializeToolbar, false);
        document.addEventListener('keyup', closeToolbar, false);
        document.getElementById('switch').addEventListener(
            'click',
            closeToolbar,
            false
        );
        document.getElementById('camera').addEventListener(
            'click',
            mediaStream,
            false
        );
    }
}

function closeToolbar (e) {
    event.stopPropagation();
    if ((e.ctrlKey && e.keyCode == 69) || e.target.id == 'switch') {
        if (captis.streaming) {
            captis.stream.stop();
            document.getElementById('live_stream').outerHTML = '';
            captis.streaming = false;
        }
        if (captis.capturing) {
            clearInterval(captis.animation);
            document.getElementById('polygon').outerHTML = '';
            captis.capturing = false;
        }
        document.getElementById('switch').removeEventListener(
            'click',
            closeToolbar,
            false
        );
        document.getElementById('camera').removeEventListener(
            'click',
            closeToolbar,
            false
        );
        document.getElementById('toolbar').outerHTML = '';
        document.removeEventListener('keyup', closeToolbar, false);
        document.addEventListener('keyup', initializeToolbar, false);
    }
}

function reloadEvents () {
    document.getElementById('switch').addEventListener(
        'click',
        closeToolbar,
        false
    );
    document.getElementById('save').addEventListener(
        'click',
        saveMedia,
        false
    );
}

function mediaStream () {
    if (navigator.getUserMedia) {
        navigator.getUserMedia (
            {
                video: true,
                audio: true
            },
            function (localMediaStream) {
                captis.stream = localMediaStream;
                captis.streaming = true;
                document.getElementById('captis').innerHTML += (
                    '<video id="live_stream" autoplay muted></video>'
                );
                document.getElementById('live_stream').src = window.URL.createObjectURL(localMediaStream);
                reloadEvents();
                document.getElementById('record').addEventListener(
                    'click',
                    startRecording,
                    false
                );
            },
            function (err) {
                console.log(err);
            }
        );
    } else {
        console.log("getUserMedia not supported");
    }
}

function startRecording () {
    captis.audio.recording = true;
    event.stopPropagation();
    document.getElementById('captis').innerHTML += (
        '<canvas id="polygon"></canvas>'
    );
    var video = document.getElementById('live_stream'),
        canvas = document.getElementById('polygon'),
        ctx = canvas.getContext('2d'),
        audioContext = new AudioContext(),
        gainNode = audioContext.createGain(),
        audioInput = audioContext.createMediaStreamSource(captis.stream),
        bufferSize = 1024;
    audioInput.connect(gainNode);
    captis.audio.processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
    captis.capturing = true;
    captis.record = new Whammy.Video(20, 1);
    var frameWidth = video.offsetWidth - 14,
        frameHeight = video.offsetHeight - 14;
    canvas.width = frameWidth;
    canvas.height = frameHeight;
    captis.startTime = new Date().getTime();
    captis.animation = setInterval(function () {
        ctx.drawImage(video, 0, 0, frameWidth, frameHeight);
        captis.record.add(ctx);
    }, 1000/20);
    captis.audio.processor.onaudioprocess = function (e) {
        if (!captis.audio.recording) return;
        var channel = e.inputBuffer.getChannelData(0);
        channelData.push(new Float32Array(channel));
        captis.audio.recordingSize += bufferSize;
    }
    gainNode.connect(captis.audio.processor);
    captis.audio.processor.connect(audioContext.destination);
    reloadEvents();
}

function mergeBuffers (channelBuffer, recordingLength) {
    var result = new Float32Array(recordingLength),
        offset = 0;
    for (var i = 0; i < channelBuffer.length; i++) {
        var buffer = channelBuffer[i];
        result.set(buffer, offset);
        offset += buffer.length;
    }
    return result;
}

function writeUTFBytes (view, offset, string) {
    for (var i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function floatTo16BitPCM(output, offset, input){
  for (var i = 0; i < input.length; i++, offset+=2){
    var s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

function saveMedia () {
    captis.audio.recording = false;
    event.stopPropagation();
    captis.stream.stop();
    var audioData = mergeBuffers(channelData, captis.audio.recordingSize),
        buffer = new ArrayBuffer(44 + audioData.length * 2),
        view = new DataView(buffer);
    writeUTFBytes(view, 0, 'RIFF');
    view.setUint32(4, 32 + audioData.length * 2, true);
    writeUTFBytes(view, 8, 'WAVE');
    writeUTFBytes(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, captis.audio.sampleRate, true);
    view.setUint32(28, captis.audio.sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeUTFBytes(view, 36, 'data');
    view.setUint32(40, audioData.length * 2, true);
    floatTo16BitPCM(view, 44, audioData);
    var encodedFile = captis.record.compile(),
        videoUrl = window.URL.createObjectURL(encodedFile),
        blob = new Blob([view], {type: 'audio/wav'}),
        audioUrl = window.URL.createObjectURL(blob);
    document.getElementById('toolbar').innerHTML += (
        '<a href="'+ videoUrl +'" download="video.webm"> \
            <i class="fa fa-file-video-o"></i> \
        </a> \
        <a href="'+ audioUrl +'" download="audio.wav"> \
            <i class="fa fa-file-audio-o"></i> \
        </a> \
        <a href="'+ ' ' +'" download="captis.json"> \
            <i class="fa fa-file-code-o"></i> \
        </a>'
    );
}






document.addEventListener('keyup', initializeToolbar, false);
