require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var initializeEditor = function() {
    event.stopPropagation();
    document.getElementById('captis').innerHTML += (
        '<div id="captis_editor"> \
            <div id="loading"><progress id="loading_segments" value="0"></progress></div> \
            <video id="edit_video" preload autoplay muted></video> \
            <div id="segment_cont"><div id="captis_editor_segments"></div></div> \
            <canvas id="segmentshot"></canvas> \
        </div>'
    );
    var video = document.getElementById('edit_video'),
        parts = document.getElementById('captis_editor_segments'),
        container = document.getElementById('segment_cont'),
        loader = document.getElementById('loading_segments'),
        loading = document.getElementById('loading'),
        canvas = document.getElementById('segmentshot'),
        ctx = canvas.getContext('2d');
        canvas.width = 130;
        canvas.height = 130;
    parts.innerHTML = '';
    video.src = window.videoURL;
    loader.setAttribute('max', window.segments.length - 1);
    video.onloadedmetadata = function () {
        var i = 0;
        var loop = setInterval(function() {
            //console.log(window.segments[i]);
            parts.innerHTML += (
                '<div class="segment_box" id="segment_'+ i +'"> \
                    <i class="segment_time">'+ window.formatDuration(window.segments[i].timestamp) +'</i> \
                </div>'
            );
            video.currentTime = window.segments[i].timestamp;
            ctx.drawImage(video, 0, 0, 130, 130);
            var image = canvas.toDataURL(),
                box = document.getElementById('segment_' + i);
            //console.log(image);
            box.style.backgroundImage = 'url(' + image + ')';
            loader.value = i;
            i++;
            if (i == window.segments.length) {
                //parts.style.height = 120 * window.segments.length + 'px';
                container.style.width = '130px';
                loading.style.display = 'none';
                video.style.display = 'block';
                video.pause();
                video.currentTime = 0;
                clearInterval(loop);
                var elements = document.getElementsByClassName('segment_box');
                for (var j = 0; j < elements.length; j++) {
                    elements[j].addEventListener('click', editorPlaySegment, false);
                }
                console.log(elements);
            };
        }, 100);
    };

}

var editorPlaySegment = function () {
    video = document.getElementById('edit_video');
    var index = this.id.split('_')[1];
    video.currentTime = window.segments[index].timestamp;
    video.muted = false;
    video.play();
}

exports.initializeEditor = initializeEditor;

},{}],2:[function(require,module,exports){
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
    Editor = require('./Editor'),
    channelData = [];

var captis = {stream: null,
    frames: [],
    toolbar: false,
    capturing: false,
    streaming: false,
    record: null,
    audio: {
        recordingSize: 0,
        sampleRate: 44100,
        recording: false,
        processor: null
    },
    impress: {
        step: null,
        isStep: false,
        segments: [],
        meta: {}
    },
    player: {
        objectUrl: null,
        ready: false,
        timeupdate: null,
        json: null,
        timestamps: [],
        slides: [],
        isOn: false,
        currentStep: null,
        activeStep: null,
        keypressed: false
    },
    segments: {
        ready: false
    }
}

function initializeToolbar (e) {
    if (e.ctrlKey && e.keyCode == 69) {
        captis.toolbar = true;
        document.getElementById('captis').innerHTML += (
            '<div id="toolbar"> \
                <i id="camera" class="fa fa-video-camera captis_icon"></i> \
                <i id="record" class="fa fa-circle"></i> \
                <i id="screen" class="fa fa-desktop captis_icon"></i> \
                <i id="save" class="fa fa-save captis_icon"></i> \
                <i id="update" class="fa fa-plus-square captis_icon"></i> \
                <i id="edit" class="fa fa-pencil-square captis_icon"></i> \
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
        document.getElementById('edit').addEventListener(
            'click',
            Editor.initializeEditor,
            false
        );
    }
}

function clearSpace () {
    document.getElementById('switch').removeEventListener(
        'click',
        closeToolbar,
        false
    );
    document.getElementById('edit').removeEventListener(
        'click',
        Editor.initializeEditor,
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
    if (captis.streaming) {
        captis.stream.stop();
        document.getElementById('live_stream').outerHTML = '';
        document.getElementById('timer').outerHTML = '';
        captis.streaming = false;
    }
    if (captis.capturing) {
        document.getElementById('polygon').outerHTML = '';
        captis.capturing = false;
    }
}


function closeToolbar (e) {
    event.stopPropagation();
    if ((e.ctrlKey && e.keyCode == 69) || e.target.id == 'switch') {
        clearSpace();
        captis.toolbar = false;
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
                    '<video id="live_stream" autoplay muted></video> \
                    <i id="timer"></i>'
                );
                document.getElementById('captis').innerHTML += (
                    '<canvas id="polygon"></canvas>'
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

function timeFormat (seconds) {
	var h = Math.floor(seconds/3600);
	var m = Math.floor((seconds - (h * 3600)) / 60);
	var s = Math.floor(seconds - (h * 3600) - (m * 60));
	h = h < 10 ? "0" + h : h;
	m = m < 10 ? "0" + m : m;
	s = s < 10 ? "0" + s : s;
	return h + ":" + m + ":" + s;
}

window.formatDuration = timeFormat;

function startRecording () {
    captis.audio.recording = true;
    event.stopPropagation();
    var video = document.getElementById('live_stream'),
        canvas = document.getElementById('polygon'),
        timer = document.getElementById('timer'),
        ctx = canvas.getContext('2d'),
        audioContext = new AudioContext(),
        gainNode = audioContext.createGain(),
        audioInput = audioContext.createMediaStreamSource(captis.stream),
        bufferSize = 1024,
        currentTime = new Date().getTime(),
        index = 0;
    audioInput.connect(gainNode);
    captis.audio.processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
    captis.capturing = true;
    captis.record = new Whammy.Video();
    var frameWidth = video.offsetWidth - 14,
        frameHeight = video.offsetHeight - 14;
    canvas.width = frameWidth;
    canvas.height = frameHeight;
    captis.audio.processor.onaudioprocess = function (e) {
        if (!captis.audio.recording) return;
        if (index%3 == 0) {
            ctx.drawImage(video, 0, 0, frameWidth, frameHeight);
            captis.record.add(ctx, 0);
            //console.log('video');
        }
        index++;
        var channel = e.inputBuffer.getChannelData(0);
        channelData.push(new Float32Array(channel));
        captis.audio.recordingSize += bufferSize;
        //console.log('audio');
    }
    video.addEventListener('timeupdate', function () {
        timer.innerHTML = timeFormat((new Date().getTime() - currentTime)/1000);
    }, false);
    captureSegments(video);
    gainNode.connect(captis.audio.processor);
    captis.audio.processor.connect(audioContext.destination);
    reloadEvents();
}

function captureSegments (video) {
    var nextStep = 0,
        prevStep = 0,
        stepId = null;
    window.onkeydown = function (e) {
        setTimeout(function () {
            //next slide
            if (e.keyCode == 39 && captis.impress.isStep) {
                if (nextStep > 0) {
                    captis.impress.meta[stepId] = nextStep;
                }
                nextStep = 0;
                prevStep = 0;
                captis.impress.isStep = false;
                captis.impress.segments.push(
                    {
                        timestamp: Math.floor(video.currentTime),
                        stepid: captis.impress.step,
                        next: nextStep,
                    }
                );
                return;
            }
            //next step
            if (e.keyCode == 39 && !captis.impress.isStep) {
                nextStep++;
                prevStep = 0;
                stepId = captis.impress.step;
                captis.impress.segments.push(
                    {
                        timestamp: Math.floor(video.currentTime),
                        stepid: captis.impress.step,
                        next: nextStep,
                    }
                );
                return;
            }
            //prev slide
            if (e.keyCode == 37 && captis.impress.isStep) {
                prevStep = 0;
                nextStep = 0;
                captis.impress.isStep = false;
                captis.impress.segments.push(
                    {
                        timestamp: Math.floor(video.currentTime),
                        stepid: captis.impress.step,
                        prev: prevStep,
                    }
                );
                return;
            }
            //prev step
            if (e.keyCode == 37 && !captis.impress.isStep) {
                prevStep++;
                nextStep = 0;
                captis.impress.segments.push(
                    {
                        timestamp: Math.floor(video.currentTime),
                        stepid: captis.impress.step,
                        prev: prevStep,
                    }
                );
                return;
            }
        }, 1000);
    };
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
    clearSpace();
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
    var blob = new Blob([view], {type: 'audio/wav'}),
        audioUrl = window.URL.createObjectURL(blob);
    document.getElementById('captis').innerHTML += (
        '<audio id="metadata"></audio>'
    );
    var audio = document.getElementById('metadata');
    audio.src = audioUrl;
    audio.onloadedmetadata = function () {
        var vidLen = Math.floor(audio.duration / captis.record.frames.length * 1000),
            differ = 0,
            duraTion = 0;
        for (var i = 0; i < captis.record.frames.length; i++) {
            differ += audio.duration / captis.record.frames.length * 1000 - vidLen;
            if (differ > 1) {
                duraTion = vidLen + 1;
                differ = differ - 1;
            } else { duraTion = vidLen }
            captis.record.frames[i].duration = duraTion;
        }
        var encodedFile = captis.record.compile(),
            //videoUrl = window.URL.createObjectURL(encodedFile),
            json = new Blob(
                [JSON.stringify({
                    meta: captis.impress.meta,
                    segments: captis.impress.segments
                })],
                {type: 'application/json'}
            ),
            //jsonUrl = window.URL.createObjectURL(json),
            formData = new FormData();
        formData.append('audio', blob, 'audio.wav');
        formData.append('video', encodedFile, 'video.webm');
        formData.append('data', json, 'captis.json');
        var request = new XMLHttpRequest();
        request.open('POST', 'http://localhost:3000/merge', true);
        request.onload = function () {
            if (request.status === 200) {
                location.reload();
            } else {
                console.log('Failed to upload');
            }
        }
        request.send(formData);
        // document.getElementById('toolbar').innerHTML += (
        //     '<a id="captislink" href="'+ videoUrl +'" download="video.webm"> \
        //         <i class="fa fa-file-video-o"></i> \
        //     </a> \
        //     <a id="captislink" href="'+ audioUrl +'" download="audio.wav"> \
        //         <i class="fa fa-file-audio-o"></i> \
        //     </a> \
        //     <a id="captislink" href="'+ jsonUrl +'" download="captis.json"> \
        //         <i class="fa fa-file-code-o"></i> \
        //     </a>'
        // );
        reloadEvents();
    }
}



//watching mode

function loadVideo () {
    var request = new XMLHttpRequest();
    request.open('GET', 'http://localhost:3000/workspace/captis.webm', true);
    request.responseType = "blob";
    request.onreadystatechange = function () {
        if (request.status === 200 && request.readyState == 4) {
            captis.player.ready = true;
            captis.player.objectUrl = window.URL.createObjectURL(this.response);
            window.videoURL = captis.player.objectUrl;
        }
    }
    request.send();
}

function loadSegments () {
    var request = new XMLHttpRequest();
    request.open('GET', 'http://localhost:3000/workspace/captis.json', true);
    request.onreadystatechange = function () {
        if (request.status === 200 && request.readyState == 4) {
            captis.segments.ready = true;
            captis.player.json = JSON.parse(this.response);
            window.segments = captis.player.json.segments;
            for (var i = 0; i < captis.player.json.segments.length; i++) {
                if (captis.player.slides.indexOf(captis.player.json.segments[i].stepid) == -1) {
                    captis.player.slides.push(captis.player.json.segments[i].stepid);
                }
                captis.player.timestamps.push(captis.player.json.segments[i].timestamp);
            }
        }
    }
    request.send();
}

function finishWatchingMode (e) {
    if (e.ctrlKey && e.keyCode == 87 && captis.player.ready) {
        captis.player.isOn = true;
        document.getElementById('player').outerHTML = '';
        document.removeEventListener('keyup', finishWatchingMode, false);
        document.addEventListener('keyup', watchingMode, false);
        location.reload();
    }
}

function seekSegments (time) {
    for (var i = 0; i < captis.player.timestamps.length; i++) {
        if (time < captis.player.timestamps[i]) {
            captis.player.currentStep = i - 1;
            break;
        }
        if (time > captis.player.timestamps[i] && (captis.player.timestamps.length - 1) == i) {
            captis.player.currentStep = i;
            break;
        }
    }
    if (captis.player.currentStep == -1) {
        impress().goto('overview');
        impress().next();
    } else {
        if (captis.player.activeStep != captis.player.currentStep) {
            var slide = captis.player.slides.indexOf(
                captis.player.json.segments[captis.player.currentStep].stepid
            );
            if (slide > 0) {
                impress().goto(captis.player.slides[slide - 1]);
                impress().next();
            } else {
                impress().goto('overview');
                impress().next();
                impress().next();
            }
            if (captis.player.json.segments[captis.player.currentStep].next > 0) {
                for (var i = 0; i < captis.player.json.segments[captis.player.currentStep].next; i++) {
                    impress().next();
                }
            }
            if (captis.player.json.segments[captis.player.currentStep].prev >= 0) {
                var step = captis.player.json.meta[
                    captis.player.json.segments[captis.player.currentStep].stepid
                ] - captis.player.json.segments[captis.player.currentStep].prev;
                for (var i = 0; i < step; i++) {
                    impress().next();
                }
            }
            captis.player.activeStep = captis.player.currentStep;
        }
    }
}

function controlSegments (e) {
    var video = document.getElementById('captis_made'),
        time = 0;
    if (e.keyCode == 39) {
        captis.player.keypressed = true;
        for (var i = 0; i < captis.player.timestamps.length; i++) {
            if (video.currentTime < captis.player.timestamps[i]) {
                time = captis.player.timestamps[i];
                break;
            }
        }
        video.currentTime = time;
    }
    if (e.keyCode == 37) {
        captis.player.keypressed = true;
        for (var i = 0; i < captis.player.timestamps.length; i++) {
            if (video.currentTime < captis.player.timestamps[i]) {
                if (i-2 < 0) {
                    time = 0;
                    break;
                } else {
                    time = captis.player.timestamps[i - 2];
                    break;
                }
            }
        }
        video.currentTime = time;
    }
}

function playVideo (e) {
    e.target.style.display = 'none';
    document.getElementById('pause').style.display = 'inline';
    document.addEventListener('keydown', controlSegments, false);
    document.getElementById('pause').addEventListener(
        'click',
        pauseVideo,
        false
    );
    var video = document.getElementById('captis_made'),
        timer = document.getElementById('ptimer'),
        buff = document.getElementById('pbuffer'),
        playbar = document.getElementById('playbar');
    video.play();
    captis.player.timeupdate = setInterval(function () {
        seekSegments(Math.floor(video.currentTime));
        timer.innerHTML = timeFormat(video.currentTime);
        buff.value = video.currentTime + 5;
        playbar.value = video.currentTime;
        if (video.ended) {videoOnEnd();}
    }, 1000);
}

function pauseVideo (e) {
    clearInterval(captis.player.timeupdate);
    var video = document.getElementById('captis_made');
    video.pause();
    document.getElementById('play').style.display = 'inline';
    e.target.style.display = 'none';
    document.getElementById('play').addEventListener(
        'click',
        playVideo,
        false
    );
}

function videoOnEnd () {
    var video = document.getElementById('captis_made'),
        timer = document.getElementById('ptimer'),
        buff = document.getElementById('pbuffer'),
        playbar = document.getElementById('playbar');
    video.currentTime = 0;
    timer.innerHTML = '00:00:00';
    buff.value = 0;
    playbar.value = 0;
    document.getElementById('play').style.display = 'inline';
    document.getElementById('pause').style.display = 'none';
    document.getElementById('play').addEventListener(
        'click',
        playVideo,
        false
    );
    clearInterval(captis.player.timeupdate);
}

function setVolume (e) {
    var video = document.getElementById('captis_made');
    video.volume = e.target.value;
    if (e.target.value == 1) {
        document.getElementById('highv').style.display = 'inline';
        document.getElementById('lowv').style.display = 'none';
        document.getElementById('offv').style.display = 'none';
    }
    if (e.target.value < 1 && e.target.value > 0) {
        document.getElementById('highv').style.display = 'none';
        document.getElementById('lowv').style.display = 'inline';
        document.getElementById('offv').style.display = 'none';
    }
    if (e.target.value == 0) {
        document.getElementById('highv').style.display = 'none';
        document.getElementById('lowv').style.display = 'none';
        document.getElementById('offv').style.display = 'inline';
    }
}

function seekVideo (e) {
    clearInterval(captis.player.timeupdate);
    var video = document.getElementById('captis_made'),
        buff = document.getElementById('pbuffer'),
        timer = document.getElementById('ptimer'),
        playbar = document.getElementById('playbar');
    video.pause();
    video.currentTime = e.target.value;
    video.play();
    captis.player.timeupdate = setInterval(function () {
        seekSegments(Math.floor(video.currentTime));
        timer.innerHTML = timeFormat(video.currentTime);
        buff.value = video.currentTime + 5;
        playbar.value = video.currentTime;
        if (video.ended) {videoOnEnd();}
    }, 1000);
}

function fullScreen (e) {
    var video = document.getElementById('captis_made');
    if (video.webkitRequestFullscreen) {
        e.target.style.display = "none";
        document.getElementById('exitfulls').style.display = "inline";
        video.webkitRequestFullscreen();
    }
}

function exitFullScreen (e) {
    if (document.webkitExitFullscreen) {
        document.getElementById('fulls').style.display = "inline";
        e.target.style.display = "none";
        document.webkitExitFullscreen();
    }
}

function watchingMode (e) {
    if (e.ctrlKey && e.keyCode == 87 && captis.player.ready && captis.segments.ready) {
        impress().goto(captis.player.json.segments[0].stepid);
        impress().prev();
        captis.player.isOn = true;
        if (captis.toolbar) {
            clearSpace();
        }
        document.getElementById('captis').innerHTML += (
            '<div id="player"> \
                <video id="captis_made" preload></video> \
                <div id="captis_controls"> \
                    <div id="captis_player"> \
                        <i id="play" class="fa fa-play captis_icon"></i> \
                        <i id="pause" class="fa fa-pause captis_icon"></i> \
                        <canvas id="segments"></canvas> \
                        <progress value="0" id="pbuffer"></progress> \
                        <input type="range" id="playbar" value="0"> \
                        <i id="ptimer">00:00:00</i> \
                        <i id="highv" class="fa fa-volume-up captis_icon"></i> \
                        <i id="lowv" class="fa fa-volume-down captis_icon"></i> \
                        <i id="offv" class="fa fa-volume-off captis_icon"></i> \
                        <input type="range" id="volume" min="0" max="1" step="0.1" value="1"> \
                        <i id="fulls" class="fa fa-eye captis_icon"></i> \
                        <i id="exitfulls" class="fa fa-eye-slash captis_icon"></i> \
                    </div> \
                </div> \
            </div>'
        );
        var video = document.getElementById('captis_made');
        video.src = captis.player.objectUrl;
        video.addEventListener('loadedmetadata', function () {
            document.getElementById('pbuffer').setAttribute(
                "max",
                Math.floor(video.duration)
            );
            document.getElementById('playbar').setAttribute(
                "max",
                Math.floor(video.duration)
            );
            var canvas = document.getElementById('segments'),
                ctx = canvas.getContext('2d'),
                ratio = canvas.width / video.duration,
                position = 0,
                segmentWidth = 0;
            document.getElementById('play').addEventListener(
                'click',
                playVideo,
                false
            );
            document.getElementById('exitfulls').addEventListener(
                'click',
                exitFullScreen,
                false
            );
            document.getElementById('fulls').addEventListener(
                'click',
                fullScreen,
                false
            );
            document.getElementById('volume').addEventListener(
                'change',
                setVolume,
                false
            );
            document.getElementById('playbar').addEventListener(
                'change',
                seekVideo,
                false
            );
            for (var i = 0; i < captis.player.timestamps.length; i++) {
                segmentWidth = Math.floor(captis.player.timestamps[i] * ratio) - 1;
                ctx.fillStyle = '#13AD87';
                ctx.fillRect(position, 0, segmentWidth, canvas.height);
                ctx.fillStyle = '#FFF';
                ctx.fillRect(segmentWidth, 0, 1, canvas.height);
                position = segmentWidth + 1;
            }
            document.removeEventListener('keyup', watchingMode, false);
            document.addEventListener('keyup', finishWatchingMode, false);
        });
    }
}

document.addEventListener('impress:stepenter', function (e) {
    captis.impress.isStep = true;
    captis.impress.step = e.target.id;
}, false);

document.addEventListener('keyup', initializeToolbar, false);
document.addEventListener('keyup', watchingMode, false);

loadVideo();
loadSegments();

},{"./Editor":1,"Whammy":"lZHMST"}],"fqJoPW":[function(require,module,exports){
(function (global){
(function browserifyShim(module, exports, define, browserify_shim__define__module__export__) {
var initializeEditor = function() {
    event.stopPropagation();
    document.getElementById('captis').innerHTML += (
        '<div id="captis_editor"> \
            <div id="loading"><progress id="loading_segments" value="0"></progress></div> \
            <video id="edit_video" preload autoplay muted></video> \
            <div id="segment_cont"><div id="captis_editor_segments"></div></div> \
            <canvas id="segmentshot"></canvas> \
        </div>'
    );
    var video = document.getElementById('edit_video'),
        parts = document.getElementById('captis_editor_segments'),
        container = document.getElementById('segment_cont'),
        loader = document.getElementById('loading_segments'),
        loading = document.getElementById('loading'),
        canvas = document.getElementById('segmentshot'),
        ctx = canvas.getContext('2d');
        canvas.width = 130;
        canvas.height = 130;
    parts.innerHTML = '';
    video.src = window.videoURL;
    loader.setAttribute('max', window.segments.length - 1);
    video.onloadedmetadata = function () {
        var i = 0;
        var loop = setInterval(function() {
            //console.log(window.segments[i]);
            parts.innerHTML += (
                '<div class="segment_box" id="segment_'+ i +'"> \
                    <i class="segment_time">'+ window.formatDuration(window.segments[i].timestamp) +'</i> \
                </div>'
            );
            video.currentTime = window.segments[i].timestamp;
            ctx.drawImage(video, 0, 0, 130, 130);
            var image = canvas.toDataURL(),
                box = document.getElementById('segment_' + i);
            //console.log(image);
            box.style.backgroundImage = 'url(' + image + ')';
            loader.value = i;
            i++;
            if (i == window.segments.length) {
                //parts.style.height = 120 * window.segments.length + 'px';
                container.style.width = '130px';
                loading.style.display = 'none';
                video.style.display = 'block';
                video.pause();
                video.currentTime = 0;
                clearInterval(loop);
                var elements = document.getElementsByClassName('segment_box');
                for (var j = 0; j < elements.length; j++) {
                    elements[j].addEventListener('click', editorPlaySegment, false);
                }
                console.log(elements);
            };
        }, 100);
    };

}

var editorPlaySegment = function () {
    video = document.getElementById('edit_video');
    var index = this.id.split('_')[1];
    video.currentTime = window.segments[index].timestamp;
    video.muted = false;
    video.play();
}

exports.initializeEditor = initializeEditor;

; browserify_shim__define__module__export__(typeof Editor != "undefined" ? Editor : window.Editor);

}).call(global, undefined, undefined, undefined, function defineExport(ex) { module.exports = ex; });

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],"Editor":[function(require,module,exports){
module.exports=require('fqJoPW');
},{}],"Whammy":[function(require,module,exports){
module.exports=require('lZHMST');
},{}],"lZHMST":[function(require,module,exports){
(function (global){
(function browserifyShim(module, exports, define, browserify_shim__define__module__export__) {
/*
    var vid = new Whammy.Video();
    vid.add(canvas or data url)
    vid.compile()
*/


var Whammy = (function(){
    // in this case, frames has a very specific meaning, which will be
    // detailed once i finish writing the code

    function toWebM(frames, outputAsArray){
        var info = checkFrames(frames);

        //max duration by cluster in milliseconds
        var CLUSTER_MAX_DURATION = 30000;

        var EBML = [
            {
                "id": 0x1a45dfa3, // EBML
                "data": [
                    {
                        "data": 1,
                        "id": 0x4286 // EBMLVersion
                    },
                    {
                        "data": 1,
                        "id": 0x42f7 // EBMLReadVersion
                    },
                    {
                        "data": 4,
                        "id": 0x42f2 // EBMLMaxIDLength
                    },
                    {
                        "data": 8,
                        "id": 0x42f3 // EBMLMaxSizeLength
                    },
                    {
                        "data": "webm",
                        "id": 0x4282 // DocType
                    },
                    {
                        "data": 2,
                        "id": 0x4287 // DocTypeVersion
                    },
                    {
                        "data": 2,
                        "id": 0x4285 // DocTypeReadVersion
                    }
                ]
            },
            {
                "id": 0x18538067, // Segment
                "data": [
                    {
                        "id": 0x1549a966, // Info
                        "data": [
                            {
                                "data": 1e6, //do things in millisecs (num of nanosecs for duration scale)
                                "id": 0x2ad7b1 // TimecodeScale
                            },
                            {
                                "data": "whammy",
                                "id": 0x4d80 // MuxingApp
                            },
                            {
                                "data": "whammy",
                                "id": 0x5741 // WritingApp
                            },
                            {
                                "data": doubleToString(info.duration),
                                "id": 0x4489 // Duration
                            }
                        ]
                    },
                    {
                        "id": 0x1654ae6b, // Tracks
                        "data": [
                            {
                                "id": 0xae, // TrackEntry
                                "data": [
                                    {
                                        "data": 1,
                                        "id": 0xd7 // TrackNumber
                                    },
                                    {
                                        "data": 1,
                                        "id": 0x63c5 // TrackUID
                                    },
                                    {
                                        "data": 0,
                                        "id": 0x9c // FlagLacing
                                    },
                                    {
                                        "data": "und",
                                        "id": 0x22b59c // Language
                                    },
                                    {
                                        "data": "V_VP8",
                                        "id": 0x86 // CodecID
                                    },
                                    {
                                        "data": "VP8",
                                        "id": 0x258688 // CodecName
                                    },
                                    {
                                        "data": 1,
                                        "id": 0x83 // TrackType
                                    },
                                    {
                                        "id": 0xe0,  // Video
                                        "data": [
                                            {
                                                "data": info.width,
                                                "id": 0xb0 // PixelWidth
                                            },
                                            {
                                                "data": info.height,
                                                "id": 0xba // PixelHeight
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    },

                    //cluster insertion point
                ]
            }
         ];


        //Generate clusters (max duration)
        var frameNumber = 0;
        var clusterTimecode = 0;
        while(frameNumber < frames.length){

            var clusterFrames = [];
            var clusterDuration = 0;
            do {
                clusterFrames.push(frames[frameNumber]);
                clusterDuration += frames[frameNumber].duration;
                frameNumber++;
            }while(frameNumber < frames.length && clusterDuration < CLUSTER_MAX_DURATION);

            var clusterCounter = 0;
            var cluster = {
                    "id": 0x1f43b675, // Cluster
                    "data": [
                        {
                            "data": clusterTimecode,
                            "id": 0xe7 // Timecode
                        }
                    ].concat(clusterFrames.map(function(webp){
                        var block = makeSimpleBlock({
                            discardable: 0,
                            frame: webp.data.slice(4),
                            invisible: 0,
                            keyframe: 1,
                            lacing: 0,
                            trackNum: 1,
                            timecode: Math.round(clusterCounter)
                        });
                        clusterCounter += webp.duration;
                        return {
                            data: block,
                            id: 0xa3
                        };
                    }))
                }

            //Add cluster to segment
            EBML[1].data.push(cluster);
            clusterTimecode += clusterDuration;
        }

        return generateEBML(EBML, outputAsArray)
    }

    // sums the lengths of all the frames and gets the duration, woo

    function checkFrames(frames){
        var width = frames[0].width,
            height = frames[0].height,
            duration = frames[0].duration;
        for(var i = 1; i < frames.length; i++){
            if(frames[i].width != width) throw "Frame " + (i + 1) + " has a different width";
            if(frames[i].height != height) throw "Frame " + (i + 1) + " has a different height";
            if(frames[i].duration < 0 || frames[i].duration > 0x7fff) throw "Frame " + (i + 1) + " has a weird duration (must be between 0 and 32767)";
            duration += frames[i].duration;
        }
        return {
            duration: duration,
            width: width,
            height: height
        };
    }


    function numToBuffer(num){
        var parts = [];
        while(num > 0){
            parts.push(num & 0xff)
            num = num >> 8
        }
        return new Uint8Array(parts.reverse());
    }

    function strToBuffer(str){
        // return new Blob([str]);

        var arr = new Uint8Array(str.length);
        for(var i = 0; i < str.length; i++){
            arr[i] = str.charCodeAt(i)
        }
        return arr;
        // this is slower
        // return new Uint8Array(str.split('').map(function(e){
        //  return e.charCodeAt(0)
        // }))
    }


    //sorry this is ugly, and sort of hard to understand exactly why this was done
    // at all really, but the reason is that there's some code below that i dont really
    // feel like understanding, and this is easier than using my brain.

    function bitsToBuffer(bits){
        var data = [];
        var pad = (bits.length % 8) ? (new Array(1 + 8 - (bits.length % 8))).join('0') : '';
        bits = pad + bits;
        for(var i = 0; i < bits.length; i+= 8){
            data.push(parseInt(bits.substr(i,8),2))
        }
        return new Uint8Array(data);
    }

    function generateEBML(json, outputAsArray){
        var ebml = [];
        for(var i = 0; i < json.length; i++){
            var data = json[i].data;
            if(typeof data == 'object') data = generateEBML(data, outputAsArray);
            if(typeof data == 'number') data = bitsToBuffer(data.toString(2));
            if(typeof data == 'string') data = strToBuffer(data);

            if(data.length){
                var z = z;
            }

            var len = data.size || data.byteLength || data.length;
            var zeroes = Math.ceil(Math.ceil(Math.log(len)/Math.log(2))/8);
            var size_str = len.toString(2);
            var padded = (new Array((zeroes * 7 + 7 + 1) - size_str.length)).join('0') + size_str;
            var size = (new Array(zeroes)).join('0') + '1' + padded;

            //i actually dont quite understand what went on up there, so I'm not really
            //going to fix this, i'm probably just going to write some hacky thing which
            //converts that string into a buffer-esque thing

            ebml.push(numToBuffer(json[i].id));
            ebml.push(bitsToBuffer(size));
            ebml.push(data)


        }

        //output as blob or byteArray
        if(outputAsArray){
            //convert ebml to an array
            var buffer = toFlatArray(ebml)
            return new Uint8Array(buffer);
        }else{
            return new Blob(ebml, {type: "video/webm"});
        }
    }

    function toFlatArray(arr, outBuffer){
        if(outBuffer == null){
            outBuffer = [];
        }
        for(var i = 0; i < arr.length; i++){
            if(typeof arr[i] == 'object'){
                //an array
                toFlatArray(arr[i], outBuffer)
            }else{
                //a simple element
                outBuffer.push(arr[i]);
            }
        }
        return outBuffer;
    }

    //woot, a function that's actually written for this project!
    //this parses some json markup and makes it into that binary magic
    //which can then get shoved into the matroska comtainer (peaceably)

    function makeSimpleBlock(data){
        var flags = 0;
        if (data.keyframe) flags |= 128;
        if (data.invisible) flags |= 8;
        if (data.lacing) flags |= (data.lacing << 1);
        if (data.discardable) flags |= 1;
        if (data.trackNum > 127) {
            throw "TrackNumber > 127 not supported";
        }
        var out = [data.trackNum | 0x80, data.timecode >> 8, data.timecode & 0xff, flags].map(function(e){
            return String.fromCharCode(e)
        }).join('') + data.frame;

        return out;
    }

    // here's something else taken verbatim from weppy, awesome rite?

    function parseWebP(riff){
        var VP8 = riff.RIFF[0].WEBP[0];

        var frame_start = VP8.indexOf('\x9d\x01\x2a'); //A VP8 keyframe starts with the 0x9d012a header
        for(var i = 0, c = []; i < 4; i++) c[i] = VP8.charCodeAt(frame_start + 3 + i);

        var width, horizontal_scale, height, vertical_scale, tmp;

        //the code below is literally copied verbatim from the bitstream spec
        tmp = (c[1] << 8) | c[0];
        width = tmp & 0x3FFF;
        horizontal_scale = tmp >> 14;
        tmp = (c[3] << 8) | c[2];
        height = tmp & 0x3FFF;
        vertical_scale = tmp >> 14;
        return {
            width: width,
            height: height,
            data: VP8,
            riff: riff
        }
    }

    // i think i'm going off on a riff by pretending this is some known
    // idiom which i'm making a casual and brilliant pun about, but since
    // i can't find anything on google which conforms to this idiomatic
    // usage, I'm assuming this is just a consequence of some psychotic
    // break which makes me make up puns. well, enough riff-raff (aha a
    // rescue of sorts), this function was ripped wholesale from weppy

    function parseRIFF(string){
        var offset = 0;
        var chunks = {};

        while (offset < string.length) {
            var id = string.substr(offset, 4);
            var len = parseInt(string.substr(offset + 4, 4).split('').map(function(i){
                var unpadded = i.charCodeAt(0).toString(2);
                return (new Array(8 - unpadded.length + 1)).join('0') + unpadded
            }).join(''),2);
            var data = string.substr(offset + 4 + 4, len);
            offset += 4 + 4 + len;
            chunks[id] = chunks[id] || [];

            if (id == 'RIFF' || id == 'LIST') {
                chunks[id].push(parseRIFF(data));
            } else {
                chunks[id].push(data);
            }
        }
        return chunks;
    }

    // here's a little utility function that acts as a utility for other functions
    // basically, the only purpose is for encoding "Duration", which is encoded as
    // a double (considerably more difficult to encode than an integer)
    function doubleToString(num){
        return [].slice.call(
            new Uint8Array(
                (
                    new Float64Array([num]) //create a float64 array
                ).buffer) //extract the array buffer
            , 0) // convert the Uint8Array into a regular array
            .map(function(e){ //since it's a regular array, we can now use map
                return String.fromCharCode(e) // encode all the bytes individually
            })
            .reverse() //correct the byte endianness (assume it's little endian for now)
            .join('') // join the bytes in holy matrimony as a string
    }

    function WhammyVideo(speed, quality){ // a more abstract-ish API
        this.frames = [];
        this.duration = 1000 / speed;
        this.quality = quality || 0.8;
    }

    WhammyVideo.prototype.add = function(frame, duration){
        if(typeof duration != 'undefined' && this.duration) throw "you can't pass a duration if the fps is set";
        if(typeof duration == 'undefined' && !this.duration) throw "if you don't have the fps set, you ned to have durations here."
        if('canvas' in frame){ //CanvasRenderingContext2D
            frame = frame.canvas;
        }
        if('toDataURL' in frame){
            frame = frame.toDataURL('image/webp', this.quality)
        }else if(typeof frame != "string"){
            throw "frame must be a a HTMLCanvasElement, a CanvasRenderingContext2D or a DataURI formatted string"
        }
        if (!(/^data:image\/webp;base64,/ig).test(frame)) {
            throw "Input must be formatted properly as a base64 encoded DataURI of type image/webp";
        }
        this.frames.push({
            image: frame,
            duration: duration || this.duration
        })
    }

    WhammyVideo.prototype.compile = function(outputAsArray){
        return new toWebM(this.frames.map(function(frame){
            var webp = parseWebP(parseRIFF(atob(frame.image.slice(23))));
            webp.duration = frame.duration;
            return webp;
        }), outputAsArray)
    }

    return {
        Video: WhammyVideo,
        fromImageArray: function(images, fps, outputAsArray){
            return toWebM(images.map(function(image){
                var webp = parseWebP(parseRIFF(atob(image.slice(23))))
                webp.duration = 1000 / fps;
                return webp;
            }), outputAsArray)
        },
        toWebM: toWebM
        // expose methods of madness
    }
})()

; browserify_shim__define__module__export__(typeof Whammy != "undefined" ? Whammy : window.Whammy);

}).call(global, undefined, undefined, undefined, function defineExport(ex) { module.exports = ex; });

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}]},{},[2])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvcGFzaGEvRGVza3RvcC9jYXB0aXMvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9Vc2Vycy9wYXNoYS9EZXNrdG9wL2NhcHRpcy9FZGl0b3IuanMiLCIvVXNlcnMvcGFzaGEvRGVza3RvcC9jYXB0aXMvY2FwdGlzLmpzIiwiL1VzZXJzL3Bhc2hhL0Rlc2t0b3AvY2FwdGlzL2VkaXRvci5qcyIsIi9Vc2Vycy9wYXNoYS9EZXNrdG9wL2NhcHRpcy92ZW5kb3Ivd2hhbW15Lm1pbi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaHVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7OztBQzFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgaW5pdGlhbGl6ZUVkaXRvciA9IGZ1bmN0aW9uKCkge1xuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYXB0aXMnKS5pbm5lckhUTUwgKz0gKFxuICAgICAgICAnPGRpdiBpZD1cImNhcHRpc19lZGl0b3JcIj4gXFxcbiAgICAgICAgICAgIDxkaXYgaWQ9XCJsb2FkaW5nXCI+PHByb2dyZXNzIGlkPVwibG9hZGluZ19zZWdtZW50c1wiIHZhbHVlPVwiMFwiPjwvcHJvZ3Jlc3M+PC9kaXY+IFxcXG4gICAgICAgICAgICA8dmlkZW8gaWQ9XCJlZGl0X3ZpZGVvXCIgcHJlbG9hZCBhdXRvcGxheSBtdXRlZD48L3ZpZGVvPiBcXFxuICAgICAgICAgICAgPGRpdiBpZD1cInNlZ21lbnRfY29udFwiPjxkaXYgaWQ9XCJjYXB0aXNfZWRpdG9yX3NlZ21lbnRzXCI+PC9kaXY+PC9kaXY+IFxcXG4gICAgICAgICAgICA8Y2FudmFzIGlkPVwic2VnbWVudHNob3RcIj48L2NhbnZhcz4gXFxcbiAgICAgICAgPC9kaXY+J1xuICAgICk7XG4gICAgdmFyIHZpZGVvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2VkaXRfdmlkZW8nKSxcbiAgICAgICAgcGFydHMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FwdGlzX2VkaXRvcl9zZWdtZW50cycpLFxuICAgICAgICBjb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2VnbWVudF9jb250JyksXG4gICAgICAgIGxvYWRlciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2FkaW5nX3NlZ21lbnRzJyksXG4gICAgICAgIGxvYWRpbmcgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9hZGluZycpLFxuICAgICAgICBjYW52YXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2VnbWVudHNob3QnKSxcbiAgICAgICAgY3R4ID0gY2FudmFzLmdldENvbnRleHQoJzJkJyk7XG4gICAgICAgIGNhbnZhcy53aWR0aCA9IDEzMDtcbiAgICAgICAgY2FudmFzLmhlaWdodCA9IDEzMDtcbiAgICBwYXJ0cy5pbm5lckhUTUwgPSAnJztcbiAgICB2aWRlby5zcmMgPSB3aW5kb3cudmlkZW9VUkw7XG4gICAgbG9hZGVyLnNldEF0dHJpYnV0ZSgnbWF4Jywgd2luZG93LnNlZ21lbnRzLmxlbmd0aCAtIDEpO1xuICAgIHZpZGVvLm9ubG9hZGVkbWV0YWRhdGEgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBpID0gMDtcbiAgICAgICAgdmFyIGxvb3AgPSBzZXRJbnRlcnZhbChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIC8vY29uc29sZS5sb2cod2luZG93LnNlZ21lbnRzW2ldKTtcbiAgICAgICAgICAgIHBhcnRzLmlubmVySFRNTCArPSAoXG4gICAgICAgICAgICAgICAgJzxkaXYgY2xhc3M9XCJzZWdtZW50X2JveFwiIGlkPVwic2VnbWVudF8nKyBpICsnXCI+IFxcXG4gICAgICAgICAgICAgICAgICAgIDxpIGNsYXNzPVwic2VnbWVudF90aW1lXCI+Jysgd2luZG93LmZvcm1hdER1cmF0aW9uKHdpbmRvdy5zZWdtZW50c1tpXS50aW1lc3RhbXApICsnPC9pPiBcXFxuICAgICAgICAgICAgICAgIDwvZGl2PidcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICB2aWRlby5jdXJyZW50VGltZSA9IHdpbmRvdy5zZWdtZW50c1tpXS50aW1lc3RhbXA7XG4gICAgICAgICAgICBjdHguZHJhd0ltYWdlKHZpZGVvLCAwLCAwLCAxMzAsIDEzMCk7XG4gICAgICAgICAgICB2YXIgaW1hZ2UgPSBjYW52YXMudG9EYXRhVVJMKCksXG4gICAgICAgICAgICAgICAgYm94ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NlZ21lbnRfJyArIGkpO1xuICAgICAgICAgICAgLy9jb25zb2xlLmxvZyhpbWFnZSk7XG4gICAgICAgICAgICBib3guc3R5bGUuYmFja2dyb3VuZEltYWdlID0gJ3VybCgnICsgaW1hZ2UgKyAnKSc7XG4gICAgICAgICAgICBsb2FkZXIudmFsdWUgPSBpO1xuICAgICAgICAgICAgaSsrO1xuICAgICAgICAgICAgaWYgKGkgPT0gd2luZG93LnNlZ21lbnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIC8vcGFydHMuc3R5bGUuaGVpZ2h0ID0gMTIwICogd2luZG93LnNlZ21lbnRzLmxlbmd0aCArICdweCc7XG4gICAgICAgICAgICAgICAgY29udGFpbmVyLnN0eWxlLndpZHRoID0gJzEzMHB4JztcbiAgICAgICAgICAgICAgICBsb2FkaW5nLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgICAgICAgICAgdmlkZW8uc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG4gICAgICAgICAgICAgICAgdmlkZW8ucGF1c2UoKTtcbiAgICAgICAgICAgICAgICB2aWRlby5jdXJyZW50VGltZSA9IDA7XG4gICAgICAgICAgICAgICAgY2xlYXJJbnRlcnZhbChsb29wKTtcbiAgICAgICAgICAgICAgICB2YXIgZWxlbWVudHMgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKCdzZWdtZW50X2JveCcpO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgZWxlbWVudHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudHNbal0uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBlZGl0b3JQbGF5U2VnbWVudCwgZmFsc2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlbGVtZW50cyk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9LCAxMDApO1xuICAgIH07XG5cbn1cblxudmFyIGVkaXRvclBsYXlTZWdtZW50ID0gZnVuY3Rpb24gKCkge1xuICAgIHZpZGVvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2VkaXRfdmlkZW8nKTtcbiAgICB2YXIgaW5kZXggPSB0aGlzLmlkLnNwbGl0KCdfJylbMV07XG4gICAgdmlkZW8uY3VycmVudFRpbWUgPSB3aW5kb3cuc2VnbWVudHNbaW5kZXhdLnRpbWVzdGFtcDtcbiAgICB2aWRlby5tdXRlZCA9IGZhbHNlO1xuICAgIHZpZGVvLnBsYXkoKTtcbn1cblxuZXhwb3J0cy5pbml0aWFsaXplRWRpdG9yID0gaW5pdGlhbGl6ZUVkaXRvcjtcbiIsIi8qKlxuKiBAYXV0aG9yIFBhc2hhIEJpbnlhdG92IDxwYXNoYUBiaW55YXRvdi5jb20+XG4qIEBjb3B5cmlnaHQgMjAxNCBQYXNoYSBCaW55YXRvdlxuKiBAbGljZW5zZSB7QGxpbmsgaHR0cHM6Ly9naXRodWIuY29tL2JpbnlhdG92L2NhcHRpcy5qcy9ibG9iL21hc3Rlci9MSUNFTlNFfE1JVCBMaWNlbnNlfVxuKi9cblxuLyoqXG4qL1xubmF2aWdhdG9yLmdldFVzZXJNZWRpYSA9IChcbiAgICBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhIHx8XG4gICAgbmF2aWdhdG9yLndlYmtpdEdldFVzZXJNZWRpYSB8fFxuICAgIG5hdmlnYXRvci5tb3pHZXRVc2VyTWVkaWEgfHxcbiAgICBuYXZpZ2F0b3IubXNHZXRVc2VyTWVkaWFcbik7XG5cbndpbmRvdy5VUkwgPSAoXG4gICAgd2luZG93LlVSTCB8fFxuICAgIHdpbmRvdy53ZWJraXRVUkwgfHxcbiAgICB3aW5kb3cubW96VVJMIHx8XG4gICAgd2luZG93Lm1zVVJMXG4pO1xuXG52YXIgQXVkaW9Db250ZXh0ID0gd2luZG93LkF1ZGlvQ29udGV4dCB8fCB3aW5kb3cud2Via2l0QXVkaW9Db250ZXh0LFxuICAgIFdoYW1teSA9IHJlcXVpcmUoJ1doYW1teScpLFxuICAgIEVkaXRvciA9IHJlcXVpcmUoJy4vRWRpdG9yJyksXG4gICAgY2hhbm5lbERhdGEgPSBbXTtcblxudmFyIGNhcHRpcyA9IHtzdHJlYW06IG51bGwsXG4gICAgZnJhbWVzOiBbXSxcbiAgICB0b29sYmFyOiBmYWxzZSxcbiAgICBjYXB0dXJpbmc6IGZhbHNlLFxuICAgIHN0cmVhbWluZzogZmFsc2UsXG4gICAgcmVjb3JkOiBudWxsLFxuICAgIGF1ZGlvOiB7XG4gICAgICAgIHJlY29yZGluZ1NpemU6IDAsXG4gICAgICAgIHNhbXBsZVJhdGU6IDQ0MTAwLFxuICAgICAgICByZWNvcmRpbmc6IGZhbHNlLFxuICAgICAgICBwcm9jZXNzb3I6IG51bGxcbiAgICB9LFxuICAgIGltcHJlc3M6IHtcbiAgICAgICAgc3RlcDogbnVsbCxcbiAgICAgICAgaXNTdGVwOiBmYWxzZSxcbiAgICAgICAgc2VnbWVudHM6IFtdLFxuICAgICAgICBtZXRhOiB7fVxuICAgIH0sXG4gICAgcGxheWVyOiB7XG4gICAgICAgIG9iamVjdFVybDogbnVsbCxcbiAgICAgICAgcmVhZHk6IGZhbHNlLFxuICAgICAgICB0aW1ldXBkYXRlOiBudWxsLFxuICAgICAgICBqc29uOiBudWxsLFxuICAgICAgICB0aW1lc3RhbXBzOiBbXSxcbiAgICAgICAgc2xpZGVzOiBbXSxcbiAgICAgICAgaXNPbjogZmFsc2UsXG4gICAgICAgIGN1cnJlbnRTdGVwOiBudWxsLFxuICAgICAgICBhY3RpdmVTdGVwOiBudWxsLFxuICAgICAgICBrZXlwcmVzc2VkOiBmYWxzZVxuICAgIH0sXG4gICAgc2VnbWVudHM6IHtcbiAgICAgICAgcmVhZHk6IGZhbHNlXG4gICAgfVxufVxuXG5mdW5jdGlvbiBpbml0aWFsaXplVG9vbGJhciAoZSkge1xuICAgIGlmIChlLmN0cmxLZXkgJiYgZS5rZXlDb2RlID09IDY5KSB7XG4gICAgICAgIGNhcHRpcy50b29sYmFyID0gdHJ1ZTtcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcHRpcycpLmlubmVySFRNTCArPSAoXG4gICAgICAgICAgICAnPGRpdiBpZD1cInRvb2xiYXJcIj4gXFxcbiAgICAgICAgICAgICAgICA8aSBpZD1cImNhbWVyYVwiIGNsYXNzPVwiZmEgZmEtdmlkZW8tY2FtZXJhIGNhcHRpc19pY29uXCI+PC9pPiBcXFxuICAgICAgICAgICAgICAgIDxpIGlkPVwicmVjb3JkXCIgY2xhc3M9XCJmYSBmYS1jaXJjbGVcIj48L2k+IFxcXG4gICAgICAgICAgICAgICAgPGkgaWQ9XCJzY3JlZW5cIiBjbGFzcz1cImZhIGZhLWRlc2t0b3AgY2FwdGlzX2ljb25cIj48L2k+IFxcXG4gICAgICAgICAgICAgICAgPGkgaWQ9XCJzYXZlXCIgY2xhc3M9XCJmYSBmYS1zYXZlIGNhcHRpc19pY29uXCI+PC9pPiBcXFxuICAgICAgICAgICAgICAgIDxpIGlkPVwidXBkYXRlXCIgY2xhc3M9XCJmYSBmYS1wbHVzLXNxdWFyZSBjYXB0aXNfaWNvblwiPjwvaT4gXFxcbiAgICAgICAgICAgICAgICA8aSBpZD1cImVkaXRcIiBjbGFzcz1cImZhIGZhLXBlbmNpbC1zcXVhcmUgY2FwdGlzX2ljb25cIj48L2k+IFxcXG4gICAgICAgICAgICAgICAgPGkgaWQ9XCJzd2l0Y2hcIiBjbGFzcz1cImZhIGZhLXBvd2VyLW9mZiBjYXB0aXNfaWNvblwiPjwvaT4gXFxcbiAgICAgICAgICAgIDwvZGl2PidcbiAgICAgICAgKTtcbiAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5dXAnLCBpbml0aWFsaXplVG9vbGJhciwgZmFsc2UpO1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXl1cCcsIGNsb3NlVG9vbGJhciwgZmFsc2UpO1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3dpdGNoJykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICdjbGljaycsXG4gICAgICAgICAgICBjbG9zZVRvb2xiYXIsXG4gICAgICAgICAgICBmYWxzZVxuICAgICAgICApO1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FtZXJhJykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICdjbGljaycsXG4gICAgICAgICAgICBtZWRpYVN0cmVhbSxcbiAgICAgICAgICAgIGZhbHNlXG4gICAgICAgICk7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdlZGl0JykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICdjbGljaycsXG4gICAgICAgICAgICBFZGl0b3IuaW5pdGlhbGl6ZUVkaXRvcixcbiAgICAgICAgICAgIGZhbHNlXG4gICAgICAgICk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBjbGVhclNwYWNlICgpIHtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3dpdGNoJykucmVtb3ZlRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgY2xvc2VUb29sYmFyLFxuICAgICAgICBmYWxzZVxuICAgICk7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2VkaXQnKS5yZW1vdmVFdmVudExpc3RlbmVyKFxuICAgICAgICAnY2xpY2snLFxuICAgICAgICBFZGl0b3IuaW5pdGlhbGl6ZUVkaXRvcixcbiAgICAgICAgZmFsc2VcbiAgICApO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYW1lcmEnKS5yZW1vdmVFdmVudExpc3RlbmVyKFxuICAgICAgICAnY2xpY2snLFxuICAgICAgICBjbG9zZVRvb2xiYXIsXG4gICAgICAgIGZhbHNlXG4gICAgKTtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndG9vbGJhcicpLm91dGVySFRNTCA9ICcnO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2tleXVwJywgY2xvc2VUb29sYmFyLCBmYWxzZSk7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLCBpbml0aWFsaXplVG9vbGJhciwgZmFsc2UpO1xuICAgIGlmIChjYXB0aXMuc3RyZWFtaW5nKSB7XG4gICAgICAgIGNhcHRpcy5zdHJlYW0uc3RvcCgpO1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGl2ZV9zdHJlYW0nKS5vdXRlckhUTUwgPSAnJztcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3RpbWVyJykub3V0ZXJIVE1MID0gJyc7XG4gICAgICAgIGNhcHRpcy5zdHJlYW1pbmcgPSBmYWxzZTtcbiAgICB9XG4gICAgaWYgKGNhcHRpcy5jYXB0dXJpbmcpIHtcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BvbHlnb24nKS5vdXRlckhUTUwgPSAnJztcbiAgICAgICAgY2FwdGlzLmNhcHR1cmluZyA9IGZhbHNlO1xuICAgIH1cbn1cblxuXG5mdW5jdGlvbiBjbG9zZVRvb2xiYXIgKGUpIHtcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBpZiAoKGUuY3RybEtleSAmJiBlLmtleUNvZGUgPT0gNjkpIHx8IGUudGFyZ2V0LmlkID09ICdzd2l0Y2gnKSB7XG4gICAgICAgIGNsZWFyU3BhY2UoKTtcbiAgICAgICAgY2FwdGlzLnRvb2xiYXIgPSBmYWxzZTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlbG9hZEV2ZW50cyAoKSB7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3N3aXRjaCcpLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICdjbGljaycsXG4gICAgICAgIGNsb3NlVG9vbGJhcixcbiAgICAgICAgZmFsc2VcbiAgICApO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzYXZlJykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgc2F2ZU1lZGlhLFxuICAgICAgICBmYWxzZVxuICAgICk7XG59XG5cbmZ1bmN0aW9uIG1lZGlhU3RyZWFtICgpIHtcbiAgICBpZiAobmF2aWdhdG9yLmdldFVzZXJNZWRpYSkge1xuICAgICAgICBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhIChcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB2aWRlbzogdHJ1ZSxcbiAgICAgICAgICAgICAgICBhdWRpbzogdHJ1ZVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZ1bmN0aW9uIChsb2NhbE1lZGlhU3RyZWFtKSB7XG4gICAgICAgICAgICAgICAgY2FwdGlzLnN0cmVhbSA9IGxvY2FsTWVkaWFTdHJlYW07XG4gICAgICAgICAgICAgICAgY2FwdGlzLnN0cmVhbWluZyA9IHRydWU7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcHRpcycpLmlubmVySFRNTCArPSAoXG4gICAgICAgICAgICAgICAgICAgICc8dmlkZW8gaWQ9XCJsaXZlX3N0cmVhbVwiIGF1dG9wbGF5IG11dGVkPjwvdmlkZW8+IFxcXG4gICAgICAgICAgICAgICAgICAgIDxpIGlkPVwidGltZXJcIj48L2k+J1xuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcHRpcycpLmlubmVySFRNTCArPSAoXG4gICAgICAgICAgICAgICAgICAgICc8Y2FudmFzIGlkPVwicG9seWdvblwiPjwvY2FudmFzPidcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsaXZlX3N0cmVhbScpLnNyYyA9IHdpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKGxvY2FsTWVkaWFTdHJlYW0pO1xuICAgICAgICAgICAgICAgIHJlbG9hZEV2ZW50cygpO1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZWNvcmQnKS5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgICAgICAgICAnY2xpY2snLFxuICAgICAgICAgICAgICAgICAgICBzdGFydFJlY29yZGluZyxcbiAgICAgICAgICAgICAgICAgICAgZmFsc2VcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiZ2V0VXNlck1lZGlhIG5vdCBzdXBwb3J0ZWRcIik7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB0aW1lRm9ybWF0IChzZWNvbmRzKSB7XG5cdHZhciBoID0gTWF0aC5mbG9vcihzZWNvbmRzLzM2MDApO1xuXHR2YXIgbSA9IE1hdGguZmxvb3IoKHNlY29uZHMgLSAoaCAqIDM2MDApKSAvIDYwKTtcblx0dmFyIHMgPSBNYXRoLmZsb29yKHNlY29uZHMgLSAoaCAqIDM2MDApIC0gKG0gKiA2MCkpO1xuXHRoID0gaCA8IDEwID8gXCIwXCIgKyBoIDogaDtcblx0bSA9IG0gPCAxMCA/IFwiMFwiICsgbSA6IG07XG5cdHMgPSBzIDwgMTAgPyBcIjBcIiArIHMgOiBzO1xuXHRyZXR1cm4gaCArIFwiOlwiICsgbSArIFwiOlwiICsgcztcbn1cblxud2luZG93LmZvcm1hdER1cmF0aW9uID0gdGltZUZvcm1hdDtcblxuZnVuY3Rpb24gc3RhcnRSZWNvcmRpbmcgKCkge1xuICAgIGNhcHRpcy5hdWRpby5yZWNvcmRpbmcgPSB0cnVlO1xuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIHZhciB2aWRlbyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsaXZlX3N0cmVhbScpLFxuICAgICAgICBjYW52YXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncG9seWdvbicpLFxuICAgICAgICB0aW1lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0aW1lcicpLFxuICAgICAgICBjdHggPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKSxcbiAgICAgICAgYXVkaW9Db250ZXh0ID0gbmV3IEF1ZGlvQ29udGV4dCgpLFxuICAgICAgICBnYWluTm9kZSA9IGF1ZGlvQ29udGV4dC5jcmVhdGVHYWluKCksXG4gICAgICAgIGF1ZGlvSW5wdXQgPSBhdWRpb0NvbnRleHQuY3JlYXRlTWVkaWFTdHJlYW1Tb3VyY2UoY2FwdGlzLnN0cmVhbSksXG4gICAgICAgIGJ1ZmZlclNpemUgPSAxMDI0LFxuICAgICAgICBjdXJyZW50VGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpLFxuICAgICAgICBpbmRleCA9IDA7XG4gICAgYXVkaW9JbnB1dC5jb25uZWN0KGdhaW5Ob2RlKTtcbiAgICBjYXB0aXMuYXVkaW8ucHJvY2Vzc29yID0gYXVkaW9Db250ZXh0LmNyZWF0ZVNjcmlwdFByb2Nlc3NvcihidWZmZXJTaXplLCAxLCAxKTtcbiAgICBjYXB0aXMuY2FwdHVyaW5nID0gdHJ1ZTtcbiAgICBjYXB0aXMucmVjb3JkID0gbmV3IFdoYW1teS5WaWRlbygpO1xuICAgIHZhciBmcmFtZVdpZHRoID0gdmlkZW8ub2Zmc2V0V2lkdGggLSAxNCxcbiAgICAgICAgZnJhbWVIZWlnaHQgPSB2aWRlby5vZmZzZXRIZWlnaHQgLSAxNDtcbiAgICBjYW52YXMud2lkdGggPSBmcmFtZVdpZHRoO1xuICAgIGNhbnZhcy5oZWlnaHQgPSBmcmFtZUhlaWdodDtcbiAgICBjYXB0aXMuYXVkaW8ucHJvY2Vzc29yLm9uYXVkaW9wcm9jZXNzID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgaWYgKCFjYXB0aXMuYXVkaW8ucmVjb3JkaW5nKSByZXR1cm47XG4gICAgICAgIGlmIChpbmRleCUzID09IDApIHtcbiAgICAgICAgICAgIGN0eC5kcmF3SW1hZ2UodmlkZW8sIDAsIDAsIGZyYW1lV2lkdGgsIGZyYW1lSGVpZ2h0KTtcbiAgICAgICAgICAgIGNhcHRpcy5yZWNvcmQuYWRkKGN0eCwgMCk7XG4gICAgICAgICAgICAvL2NvbnNvbGUubG9nKCd2aWRlbycpO1xuICAgICAgICB9XG4gICAgICAgIGluZGV4Kys7XG4gICAgICAgIHZhciBjaGFubmVsID0gZS5pbnB1dEJ1ZmZlci5nZXRDaGFubmVsRGF0YSgwKTtcbiAgICAgICAgY2hhbm5lbERhdGEucHVzaChuZXcgRmxvYXQzMkFycmF5KGNoYW5uZWwpKTtcbiAgICAgICAgY2FwdGlzLmF1ZGlvLnJlY29yZGluZ1NpemUgKz0gYnVmZmVyU2l6ZTtcbiAgICAgICAgLy9jb25zb2xlLmxvZygnYXVkaW8nKTtcbiAgICB9XG4gICAgdmlkZW8uYWRkRXZlbnRMaXN0ZW5lcigndGltZXVwZGF0ZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGltZXIuaW5uZXJIVE1MID0gdGltZUZvcm1hdCgobmV3IERhdGUoKS5nZXRUaW1lKCkgLSBjdXJyZW50VGltZSkvMTAwMCk7XG4gICAgfSwgZmFsc2UpO1xuICAgIGNhcHR1cmVTZWdtZW50cyh2aWRlbyk7XG4gICAgZ2Fpbk5vZGUuY29ubmVjdChjYXB0aXMuYXVkaW8ucHJvY2Vzc29yKTtcbiAgICBjYXB0aXMuYXVkaW8ucHJvY2Vzc29yLmNvbm5lY3QoYXVkaW9Db250ZXh0LmRlc3RpbmF0aW9uKTtcbiAgICByZWxvYWRFdmVudHMoKTtcbn1cblxuZnVuY3Rpb24gY2FwdHVyZVNlZ21lbnRzICh2aWRlbykge1xuICAgIHZhciBuZXh0U3RlcCA9IDAsXG4gICAgICAgIHByZXZTdGVwID0gMCxcbiAgICAgICAgc3RlcElkID0gbnVsbDtcbiAgICB3aW5kb3cub25rZXlkb3duID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAvL25leHQgc2xpZGVcbiAgICAgICAgICAgIGlmIChlLmtleUNvZGUgPT0gMzkgJiYgY2FwdGlzLmltcHJlc3MuaXNTdGVwKSB7XG4gICAgICAgICAgICAgICAgaWYgKG5leHRTdGVwID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBjYXB0aXMuaW1wcmVzcy5tZXRhW3N0ZXBJZF0gPSBuZXh0U3RlcDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbmV4dFN0ZXAgPSAwO1xuICAgICAgICAgICAgICAgIHByZXZTdGVwID0gMDtcbiAgICAgICAgICAgICAgICBjYXB0aXMuaW1wcmVzcy5pc1N0ZXAgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBjYXB0aXMuaW1wcmVzcy5zZWdtZW50cy5wdXNoKFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1lc3RhbXA6IE1hdGguZmxvb3IodmlkZW8uY3VycmVudFRpbWUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3RlcGlkOiBjYXB0aXMuaW1wcmVzcy5zdGVwLFxuICAgICAgICAgICAgICAgICAgICAgICAgbmV4dDogbmV4dFN0ZXAsXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vbmV4dCBzdGVwXG4gICAgICAgICAgICBpZiAoZS5rZXlDb2RlID09IDM5ICYmICFjYXB0aXMuaW1wcmVzcy5pc1N0ZXApIHtcbiAgICAgICAgICAgICAgICBuZXh0U3RlcCsrO1xuICAgICAgICAgICAgICAgIHByZXZTdGVwID0gMDtcbiAgICAgICAgICAgICAgICBzdGVwSWQgPSBjYXB0aXMuaW1wcmVzcy5zdGVwO1xuICAgICAgICAgICAgICAgIGNhcHRpcy5pbXByZXNzLnNlZ21lbnRzLnB1c2goXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogTWF0aC5mbG9vcih2aWRlby5jdXJyZW50VGltZSksXG4gICAgICAgICAgICAgICAgICAgICAgICBzdGVwaWQ6IGNhcHRpcy5pbXByZXNzLnN0ZXAsXG4gICAgICAgICAgICAgICAgICAgICAgICBuZXh0OiBuZXh0U3RlcCxcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy9wcmV2IHNsaWRlXG4gICAgICAgICAgICBpZiAoZS5rZXlDb2RlID09IDM3ICYmIGNhcHRpcy5pbXByZXNzLmlzU3RlcCkge1xuICAgICAgICAgICAgICAgIHByZXZTdGVwID0gMDtcbiAgICAgICAgICAgICAgICBuZXh0U3RlcCA9IDA7XG4gICAgICAgICAgICAgICAgY2FwdGlzLmltcHJlc3MuaXNTdGVwID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgY2FwdGlzLmltcHJlc3Muc2VnbWVudHMucHVzaChcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGltZXN0YW1wOiBNYXRoLmZsb29yKHZpZGVvLmN1cnJlbnRUaW1lKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0ZXBpZDogY2FwdGlzLmltcHJlc3Muc3RlcCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByZXY6IHByZXZTdGVwLFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvL3ByZXYgc3RlcFxuICAgICAgICAgICAgaWYgKGUua2V5Q29kZSA9PSAzNyAmJiAhY2FwdGlzLmltcHJlc3MuaXNTdGVwKSB7XG4gICAgICAgICAgICAgICAgcHJldlN0ZXArKztcbiAgICAgICAgICAgICAgICBuZXh0U3RlcCA9IDA7XG4gICAgICAgICAgICAgICAgY2FwdGlzLmltcHJlc3Muc2VnbWVudHMucHVzaChcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGltZXN0YW1wOiBNYXRoLmZsb29yKHZpZGVvLmN1cnJlbnRUaW1lKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0ZXBpZDogY2FwdGlzLmltcHJlc3Muc3RlcCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByZXY6IHByZXZTdGVwLFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIDEwMDApO1xuICAgIH07XG59XG5cbmZ1bmN0aW9uIG1lcmdlQnVmZmVycyAoY2hhbm5lbEJ1ZmZlciwgcmVjb3JkaW5nTGVuZ3RoKSB7XG4gICAgdmFyIHJlc3VsdCA9IG5ldyBGbG9hdDMyQXJyYXkocmVjb3JkaW5nTGVuZ3RoKSxcbiAgICAgICAgb2Zmc2V0ID0gMDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoYW5uZWxCdWZmZXIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGJ1ZmZlciA9IGNoYW5uZWxCdWZmZXJbaV07XG4gICAgICAgIHJlc3VsdC5zZXQoYnVmZmVyLCBvZmZzZXQpO1xuICAgICAgICBvZmZzZXQgKz0gYnVmZmVyLmxlbmd0aDtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gd3JpdGVVVEZCeXRlcyAodmlldywgb2Zmc2V0LCBzdHJpbmcpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHN0cmluZy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2aWV3LnNldFVpbnQ4KG9mZnNldCArIGksIHN0cmluZy5jaGFyQ29kZUF0KGkpKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGZsb2F0VG8xNkJpdFBDTShvdXRwdXQsIG9mZnNldCwgaW5wdXQpe1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGlucHV0Lmxlbmd0aDsgaSsrLCBvZmZzZXQrPTIpe1xuICAgIHZhciBzID0gTWF0aC5tYXgoLTEsIE1hdGgubWluKDEsIGlucHV0W2ldKSk7XG4gICAgb3V0cHV0LnNldEludDE2KG9mZnNldCwgcyA8IDAgPyBzICogMHg4MDAwIDogcyAqIDB4N0ZGRiwgdHJ1ZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gc2F2ZU1lZGlhICgpIHtcbiAgICBjYXB0aXMuYXVkaW8ucmVjb3JkaW5nID0gZmFsc2U7XG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgY2xlYXJTcGFjZSgpO1xuICAgIGNhcHRpcy5zdHJlYW0uc3RvcCgpO1xuICAgIHZhciBhdWRpb0RhdGEgPSBtZXJnZUJ1ZmZlcnMoY2hhbm5lbERhdGEsIGNhcHRpcy5hdWRpby5yZWNvcmRpbmdTaXplKSxcbiAgICAgICAgYnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKDQ0ICsgYXVkaW9EYXRhLmxlbmd0aCAqIDIpLFxuICAgICAgICB2aWV3ID0gbmV3IERhdGFWaWV3KGJ1ZmZlcik7XG4gICAgd3JpdGVVVEZCeXRlcyh2aWV3LCAwLCAnUklGRicpO1xuICAgIHZpZXcuc2V0VWludDMyKDQsIDMyICsgYXVkaW9EYXRhLmxlbmd0aCAqIDIsIHRydWUpO1xuICAgIHdyaXRlVVRGQnl0ZXModmlldywgOCwgJ1dBVkUnKTtcbiAgICB3cml0ZVVURkJ5dGVzKHZpZXcsIDEyLCAnZm10ICcpO1xuICAgIHZpZXcuc2V0VWludDMyKDE2LCAxNiwgdHJ1ZSk7XG4gICAgdmlldy5zZXRVaW50MTYoMjAsIDEsIHRydWUpO1xuICAgIHZpZXcuc2V0VWludDE2KDIyLCAxLCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQzMigyNCwgY2FwdGlzLmF1ZGlvLnNhbXBsZVJhdGUsIHRydWUpO1xuICAgIHZpZXcuc2V0VWludDMyKDI4LCBjYXB0aXMuYXVkaW8uc2FtcGxlUmF0ZSAqIDIsIHRydWUpO1xuICAgIHZpZXcuc2V0VWludDE2KDMyLCAyLCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQxNigzNCwgMTYsIHRydWUpO1xuICAgIHdyaXRlVVRGQnl0ZXModmlldywgMzYsICdkYXRhJyk7XG4gICAgdmlldy5zZXRVaW50MzIoNDAsIGF1ZGlvRGF0YS5sZW5ndGggKiAyLCB0cnVlKTtcbiAgICBmbG9hdFRvMTZCaXRQQ00odmlldywgNDQsIGF1ZGlvRGF0YSk7XG4gICAgdmFyIGJsb2IgPSBuZXcgQmxvYihbdmlld10sIHt0eXBlOiAnYXVkaW8vd2F2J30pLFxuICAgICAgICBhdWRpb1VybCA9IHdpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IpO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYXB0aXMnKS5pbm5lckhUTUwgKz0gKFxuICAgICAgICAnPGF1ZGlvIGlkPVwibWV0YWRhdGFcIj48L2F1ZGlvPidcbiAgICApO1xuICAgIHZhciBhdWRpbyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtZXRhZGF0YScpO1xuICAgIGF1ZGlvLnNyYyA9IGF1ZGlvVXJsO1xuICAgIGF1ZGlvLm9ubG9hZGVkbWV0YWRhdGEgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciB2aWRMZW4gPSBNYXRoLmZsb29yKGF1ZGlvLmR1cmF0aW9uIC8gY2FwdGlzLnJlY29yZC5mcmFtZXMubGVuZ3RoICogMTAwMCksXG4gICAgICAgICAgICBkaWZmZXIgPSAwLFxuICAgICAgICAgICAgZHVyYVRpb24gPSAwO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNhcHRpcy5yZWNvcmQuZnJhbWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBkaWZmZXIgKz0gYXVkaW8uZHVyYXRpb24gLyBjYXB0aXMucmVjb3JkLmZyYW1lcy5sZW5ndGggKiAxMDAwIC0gdmlkTGVuO1xuICAgICAgICAgICAgaWYgKGRpZmZlciA+IDEpIHtcbiAgICAgICAgICAgICAgICBkdXJhVGlvbiA9IHZpZExlbiArIDE7XG4gICAgICAgICAgICAgICAgZGlmZmVyID0gZGlmZmVyIC0gMTtcbiAgICAgICAgICAgIH0gZWxzZSB7IGR1cmFUaW9uID0gdmlkTGVuIH1cbiAgICAgICAgICAgIGNhcHRpcy5yZWNvcmQuZnJhbWVzW2ldLmR1cmF0aW9uID0gZHVyYVRpb247XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGVuY29kZWRGaWxlID0gY2FwdGlzLnJlY29yZC5jb21waWxlKCksXG4gICAgICAgICAgICAvL3ZpZGVvVXJsID0gd2luZG93LlVSTC5jcmVhdGVPYmplY3RVUkwoZW5jb2RlZEZpbGUpLFxuICAgICAgICAgICAganNvbiA9IG5ldyBCbG9iKFxuICAgICAgICAgICAgICAgIFtKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgIG1ldGE6IGNhcHRpcy5pbXByZXNzLm1ldGEsXG4gICAgICAgICAgICAgICAgICAgIHNlZ21lbnRzOiBjYXB0aXMuaW1wcmVzcy5zZWdtZW50c1xuICAgICAgICAgICAgICAgIH0pXSxcbiAgICAgICAgICAgICAgICB7dHlwZTogJ2FwcGxpY2F0aW9uL2pzb24nfVxuICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIC8vanNvblVybCA9IHdpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKGpzb24pLFxuICAgICAgICAgICAgZm9ybURhdGEgPSBuZXcgRm9ybURhdGEoKTtcbiAgICAgICAgZm9ybURhdGEuYXBwZW5kKCdhdWRpbycsIGJsb2IsICdhdWRpby53YXYnKTtcbiAgICAgICAgZm9ybURhdGEuYXBwZW5kKCd2aWRlbycsIGVuY29kZWRGaWxlLCAndmlkZW8ud2VibScpO1xuICAgICAgICBmb3JtRGF0YS5hcHBlbmQoJ2RhdGEnLCBqc29uLCAnY2FwdGlzLmpzb24nKTtcbiAgICAgICAgdmFyIHJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICAgICAgcmVxdWVzdC5vcGVuKCdQT1NUJywgJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMC9tZXJnZScsIHRydWUpO1xuICAgICAgICByZXF1ZXN0Lm9ubG9hZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChyZXF1ZXN0LnN0YXR1cyA9PT0gMjAwKSB7XG4gICAgICAgICAgICAgICAgbG9jYXRpb24ucmVsb2FkKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdGYWlsZWQgdG8gdXBsb2FkJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmVxdWVzdC5zZW5kKGZvcm1EYXRhKTtcbiAgICAgICAgLy8gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Rvb2xiYXInKS5pbm5lckhUTUwgKz0gKFxuICAgICAgICAvLyAgICAgJzxhIGlkPVwiY2FwdGlzbGlua1wiIGhyZWY9XCInKyB2aWRlb1VybCArJ1wiIGRvd25sb2FkPVwidmlkZW8ud2VibVwiPiBcXFxuICAgICAgICAvLyAgICAgICAgIDxpIGNsYXNzPVwiZmEgZmEtZmlsZS12aWRlby1vXCI+PC9pPiBcXFxuICAgICAgICAvLyAgICAgPC9hPiBcXFxuICAgICAgICAvLyAgICAgPGEgaWQ9XCJjYXB0aXNsaW5rXCIgaHJlZj1cIicrIGF1ZGlvVXJsICsnXCIgZG93bmxvYWQ9XCJhdWRpby53YXZcIj4gXFxcbiAgICAgICAgLy8gICAgICAgICA8aSBjbGFzcz1cImZhIGZhLWZpbGUtYXVkaW8tb1wiPjwvaT4gXFxcbiAgICAgICAgLy8gICAgIDwvYT4gXFxcbiAgICAgICAgLy8gICAgIDxhIGlkPVwiY2FwdGlzbGlua1wiIGhyZWY9XCInKyBqc29uVXJsICsnXCIgZG93bmxvYWQ9XCJjYXB0aXMuanNvblwiPiBcXFxuICAgICAgICAvLyAgICAgICAgIDxpIGNsYXNzPVwiZmEgZmEtZmlsZS1jb2RlLW9cIj48L2k+IFxcXG4gICAgICAgIC8vICAgICA8L2E+J1xuICAgICAgICAvLyApO1xuICAgICAgICByZWxvYWRFdmVudHMoKTtcbiAgICB9XG59XG5cblxuXG4vL3dhdGNoaW5nIG1vZGVcblxuZnVuY3Rpb24gbG9hZFZpZGVvICgpIHtcbiAgICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIHJlcXVlc3Qub3BlbignR0VUJywgJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMC93b3Jrc3BhY2UvY2FwdGlzLndlYm0nLCB0cnVlKTtcbiAgICByZXF1ZXN0LnJlc3BvbnNlVHlwZSA9IFwiYmxvYlwiO1xuICAgIHJlcXVlc3Qub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAocmVxdWVzdC5zdGF0dXMgPT09IDIwMCAmJiByZXF1ZXN0LnJlYWR5U3RhdGUgPT0gNCkge1xuICAgICAgICAgICAgY2FwdGlzLnBsYXllci5yZWFkeSA9IHRydWU7XG4gICAgICAgICAgICBjYXB0aXMucGxheWVyLm9iamVjdFVybCA9IHdpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKHRoaXMucmVzcG9uc2UpO1xuICAgICAgICAgICAgd2luZG93LnZpZGVvVVJMID0gY2FwdGlzLnBsYXllci5vYmplY3RVcmw7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmVxdWVzdC5zZW5kKCk7XG59XG5cbmZ1bmN0aW9uIGxvYWRTZWdtZW50cyAoKSB7XG4gICAgdmFyIHJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICByZXF1ZXN0Lm9wZW4oJ0dFVCcsICdodHRwOi8vbG9jYWxob3N0OjMwMDAvd29ya3NwYWNlL2NhcHRpcy5qc29uJywgdHJ1ZSk7XG4gICAgcmVxdWVzdC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmIChyZXF1ZXN0LnN0YXR1cyA9PT0gMjAwICYmIHJlcXVlc3QucmVhZHlTdGF0ZSA9PSA0KSB7XG4gICAgICAgICAgICBjYXB0aXMuc2VnbWVudHMucmVhZHkgPSB0cnVlO1xuICAgICAgICAgICAgY2FwdGlzLnBsYXllci5qc29uID0gSlNPTi5wYXJzZSh0aGlzLnJlc3BvbnNlKTtcbiAgICAgICAgICAgIHdpbmRvdy5zZWdtZW50cyA9IGNhcHRpcy5wbGF5ZXIuanNvbi5zZWdtZW50cztcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2FwdGlzLnBsYXllci5qc29uLnNlZ21lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNhcHRpcy5wbGF5ZXIuc2xpZGVzLmluZGV4T2YoY2FwdGlzLnBsYXllci5qc29uLnNlZ21lbnRzW2ldLnN0ZXBpZCkgPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FwdGlzLnBsYXllci5zbGlkZXMucHVzaChjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHNbaV0uc3RlcGlkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2FwdGlzLnBsYXllci50aW1lc3RhbXBzLnB1c2goY2FwdGlzLnBsYXllci5qc29uLnNlZ21lbnRzW2ldLnRpbWVzdGFtcCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmVxdWVzdC5zZW5kKCk7XG59XG5cbmZ1bmN0aW9uIGZpbmlzaFdhdGNoaW5nTW9kZSAoZSkge1xuICAgIGlmIChlLmN0cmxLZXkgJiYgZS5rZXlDb2RlID09IDg3ICYmIGNhcHRpcy5wbGF5ZXIucmVhZHkpIHtcbiAgICAgICAgY2FwdGlzLnBsYXllci5pc09uID0gdHJ1ZTtcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXllcicpLm91dGVySFRNTCA9ICcnO1xuICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdrZXl1cCcsIGZpbmlzaFdhdGNoaW5nTW9kZSwgZmFsc2UpO1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXl1cCcsIHdhdGNoaW5nTW9kZSwgZmFsc2UpO1xuICAgICAgICBsb2NhdGlvbi5yZWxvYWQoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHNlZWtTZWdtZW50cyAodGltZSkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2FwdGlzLnBsYXllci50aW1lc3RhbXBzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmICh0aW1lIDwgY2FwdGlzLnBsYXllci50aW1lc3RhbXBzW2ldKSB7XG4gICAgICAgICAgICBjYXB0aXMucGxheWVyLmN1cnJlbnRTdGVwID0gaSAtIDE7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBpZiAodGltZSA+IGNhcHRpcy5wbGF5ZXIudGltZXN0YW1wc1tpXSAmJiAoY2FwdGlzLnBsYXllci50aW1lc3RhbXBzLmxlbmd0aCAtIDEpID09IGkpIHtcbiAgICAgICAgICAgIGNhcHRpcy5wbGF5ZXIuY3VycmVudFN0ZXAgPSBpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKGNhcHRpcy5wbGF5ZXIuY3VycmVudFN0ZXAgPT0gLTEpIHtcbiAgICAgICAgaW1wcmVzcygpLmdvdG8oJ292ZXJ2aWV3Jyk7XG4gICAgICAgIGltcHJlc3MoKS5uZXh0KCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGNhcHRpcy5wbGF5ZXIuYWN0aXZlU3RlcCAhPSBjYXB0aXMucGxheWVyLmN1cnJlbnRTdGVwKSB7XG4gICAgICAgICAgICB2YXIgc2xpZGUgPSBjYXB0aXMucGxheWVyLnNsaWRlcy5pbmRleE9mKFxuICAgICAgICAgICAgICAgIGNhcHRpcy5wbGF5ZXIuanNvbi5zZWdtZW50c1tjYXB0aXMucGxheWVyLmN1cnJlbnRTdGVwXS5zdGVwaWRcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBpZiAoc2xpZGUgPiAwKSB7XG4gICAgICAgICAgICAgICAgaW1wcmVzcygpLmdvdG8oY2FwdGlzLnBsYXllci5zbGlkZXNbc2xpZGUgLSAxXSk7XG4gICAgICAgICAgICAgICAgaW1wcmVzcygpLm5leHQoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaW1wcmVzcygpLmdvdG8oJ292ZXJ2aWV3Jyk7XG4gICAgICAgICAgICAgICAgaW1wcmVzcygpLm5leHQoKTtcbiAgICAgICAgICAgICAgICBpbXByZXNzKCkubmV4dCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGNhcHRpcy5wbGF5ZXIuanNvbi5zZWdtZW50c1tjYXB0aXMucGxheWVyLmN1cnJlbnRTdGVwXS5uZXh0ID4gMCkge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2FwdGlzLnBsYXllci5qc29uLnNlZ21lbnRzW2NhcHRpcy5wbGF5ZXIuY3VycmVudFN0ZXBdLm5leHQ7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBpbXByZXNzKCkubmV4dCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHNbY2FwdGlzLnBsYXllci5jdXJyZW50U3RlcF0ucHJldiA+PSAwKSB7XG4gICAgICAgICAgICAgICAgdmFyIHN0ZXAgPSBjYXB0aXMucGxheWVyLmpzb24ubWV0YVtcbiAgICAgICAgICAgICAgICAgICAgY2FwdGlzLnBsYXllci5qc29uLnNlZ21lbnRzW2NhcHRpcy5wbGF5ZXIuY3VycmVudFN0ZXBdLnN0ZXBpZFxuICAgICAgICAgICAgICAgIF0gLSBjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHNbY2FwdGlzLnBsYXllci5jdXJyZW50U3RlcF0ucHJldjtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ZXA7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBpbXByZXNzKCkubmV4dCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhcHRpcy5wbGF5ZXIuYWN0aXZlU3RlcCA9IGNhcHRpcy5wbGF5ZXIuY3VycmVudFN0ZXA7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIGNvbnRyb2xTZWdtZW50cyAoZSkge1xuICAgIHZhciB2aWRlbyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYXB0aXNfbWFkZScpLFxuICAgICAgICB0aW1lID0gMDtcbiAgICBpZiAoZS5rZXlDb2RlID09IDM5KSB7XG4gICAgICAgIGNhcHRpcy5wbGF5ZXIua2V5cHJlc3NlZCA9IHRydWU7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2FwdGlzLnBsYXllci50aW1lc3RhbXBzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodmlkZW8uY3VycmVudFRpbWUgPCBjYXB0aXMucGxheWVyLnRpbWVzdGFtcHNbaV0pIHtcbiAgICAgICAgICAgICAgICB0aW1lID0gY2FwdGlzLnBsYXllci50aW1lc3RhbXBzW2ldO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHZpZGVvLmN1cnJlbnRUaW1lID0gdGltZTtcbiAgICB9XG4gICAgaWYgKGUua2V5Q29kZSA9PSAzNykge1xuICAgICAgICBjYXB0aXMucGxheWVyLmtleXByZXNzZWQgPSB0cnVlO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNhcHRpcy5wbGF5ZXIudGltZXN0YW1wcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHZpZGVvLmN1cnJlbnRUaW1lIDwgY2FwdGlzLnBsYXllci50aW1lc3RhbXBzW2ldKSB7XG4gICAgICAgICAgICAgICAgaWYgKGktMiA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZSA9IDA7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRpbWUgPSBjYXB0aXMucGxheWVyLnRpbWVzdGFtcHNbaSAtIDJdO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdmlkZW8uY3VycmVudFRpbWUgPSB0aW1lO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gcGxheVZpZGVvIChlKSB7XG4gICAgZS50YXJnZXQuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGF1c2UnKS5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZSc7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGNvbnRyb2xTZWdtZW50cywgZmFsc2UpO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwYXVzZScpLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICdjbGljaycsXG4gICAgICAgIHBhdXNlVmlkZW8sXG4gICAgICAgIGZhbHNlXG4gICAgKTtcbiAgICB2YXIgdmlkZW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FwdGlzX21hZGUnKSxcbiAgICAgICAgdGltZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncHRpbWVyJyksXG4gICAgICAgIGJ1ZmYgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGJ1ZmZlcicpLFxuICAgICAgICBwbGF5YmFyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXliYXInKTtcbiAgICB2aWRlby5wbGF5KCk7XG4gICAgY2FwdGlzLnBsYXllci50aW1ldXBkYXRlID0gc2V0SW50ZXJ2YWwoZnVuY3Rpb24gKCkge1xuICAgICAgICBzZWVrU2VnbWVudHMoTWF0aC5mbG9vcih2aWRlby5jdXJyZW50VGltZSkpO1xuICAgICAgICB0aW1lci5pbm5lckhUTUwgPSB0aW1lRm9ybWF0KHZpZGVvLmN1cnJlbnRUaW1lKTtcbiAgICAgICAgYnVmZi52YWx1ZSA9IHZpZGVvLmN1cnJlbnRUaW1lICsgNTtcbiAgICAgICAgcGxheWJhci52YWx1ZSA9IHZpZGVvLmN1cnJlbnRUaW1lO1xuICAgICAgICBpZiAodmlkZW8uZW5kZWQpIHt2aWRlb09uRW5kKCk7fVxuICAgIH0sIDEwMDApO1xufVxuXG5mdW5jdGlvbiBwYXVzZVZpZGVvIChlKSB7XG4gICAgY2xlYXJJbnRlcnZhbChjYXB0aXMucGxheWVyLnRpbWV1cGRhdGUpO1xuICAgIHZhciB2aWRlbyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYXB0aXNfbWFkZScpO1xuICAgIHZpZGVvLnBhdXNlKCk7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXknKS5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZSc7XG4gICAgZS50YXJnZXQuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheScpLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICdjbGljaycsXG4gICAgICAgIHBsYXlWaWRlbyxcbiAgICAgICAgZmFsc2VcbiAgICApO1xufVxuXG5mdW5jdGlvbiB2aWRlb09uRW5kICgpIHtcbiAgICB2YXIgdmlkZW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FwdGlzX21hZGUnKSxcbiAgICAgICAgdGltZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncHRpbWVyJyksXG4gICAgICAgIGJ1ZmYgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGJ1ZmZlcicpLFxuICAgICAgICBwbGF5YmFyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXliYXInKTtcbiAgICB2aWRlby5jdXJyZW50VGltZSA9IDA7XG4gICAgdGltZXIuaW5uZXJIVE1MID0gJzAwOjAwOjAwJztcbiAgICBidWZmLnZhbHVlID0gMDtcbiAgICBwbGF5YmFyLnZhbHVlID0gMDtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheScpLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lJztcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGF1c2UnKS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGF5JykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgcGxheVZpZGVvLFxuICAgICAgICBmYWxzZVxuICAgICk7XG4gICAgY2xlYXJJbnRlcnZhbChjYXB0aXMucGxheWVyLnRpbWV1cGRhdGUpO1xufVxuXG5mdW5jdGlvbiBzZXRWb2x1bWUgKGUpIHtcbiAgICB2YXIgdmlkZW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FwdGlzX21hZGUnKTtcbiAgICB2aWRlby52b2x1bWUgPSBlLnRhcmdldC52YWx1ZTtcbiAgICBpZiAoZS50YXJnZXQudmFsdWUgPT0gMSkge1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGlnaHYnKS5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZSc7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb3d2Jykuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ29mZnYnKS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgIH1cbiAgICBpZiAoZS50YXJnZXQudmFsdWUgPCAxICYmIGUudGFyZ2V0LnZhbHVlID4gMCkge1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGlnaHYnKS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG93dicpLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lJztcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ29mZnYnKS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgIH1cbiAgICBpZiAoZS50YXJnZXQudmFsdWUgPT0gMCkge1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGlnaHYnKS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG93dicpLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdvZmZ2Jykuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUnO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gc2Vla1ZpZGVvIChlKSB7XG4gICAgY2xlYXJJbnRlcnZhbChjYXB0aXMucGxheWVyLnRpbWV1cGRhdGUpO1xuICAgIHZhciB2aWRlbyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYXB0aXNfbWFkZScpLFxuICAgICAgICBidWZmID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BidWZmZXInKSxcbiAgICAgICAgdGltZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncHRpbWVyJyksXG4gICAgICAgIHBsYXliYXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheWJhcicpO1xuICAgIHZpZGVvLnBhdXNlKCk7XG4gICAgdmlkZW8uY3VycmVudFRpbWUgPSBlLnRhcmdldC52YWx1ZTtcbiAgICB2aWRlby5wbGF5KCk7XG4gICAgY2FwdGlzLnBsYXllci50aW1ldXBkYXRlID0gc2V0SW50ZXJ2YWwoZnVuY3Rpb24gKCkge1xuICAgICAgICBzZWVrU2VnbWVudHMoTWF0aC5mbG9vcih2aWRlby5jdXJyZW50VGltZSkpO1xuICAgICAgICB0aW1lci5pbm5lckhUTUwgPSB0aW1lRm9ybWF0KHZpZGVvLmN1cnJlbnRUaW1lKTtcbiAgICAgICAgYnVmZi52YWx1ZSA9IHZpZGVvLmN1cnJlbnRUaW1lICsgNTtcbiAgICAgICAgcGxheWJhci52YWx1ZSA9IHZpZGVvLmN1cnJlbnRUaW1lO1xuICAgICAgICBpZiAodmlkZW8uZW5kZWQpIHt2aWRlb09uRW5kKCk7fVxuICAgIH0sIDEwMDApO1xufVxuXG5mdW5jdGlvbiBmdWxsU2NyZWVuIChlKSB7XG4gICAgdmFyIHZpZGVvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcHRpc19tYWRlJyk7XG4gICAgaWYgKHZpZGVvLndlYmtpdFJlcXVlc3RGdWxsc2NyZWVuKSB7XG4gICAgICAgIGUudGFyZ2V0LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2V4aXRmdWxscycpLnN0eWxlLmRpc3BsYXkgPSBcImlubGluZVwiO1xuICAgICAgICB2aWRlby53ZWJraXRSZXF1ZXN0RnVsbHNjcmVlbigpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZXhpdEZ1bGxTY3JlZW4gKGUpIHtcbiAgICBpZiAoZG9jdW1lbnQud2Via2l0RXhpdEZ1bGxzY3JlZW4pIHtcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Z1bGxzJykuc3R5bGUuZGlzcGxheSA9IFwiaW5saW5lXCI7XG4gICAgICAgIGUudGFyZ2V0LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcbiAgICAgICAgZG9jdW1lbnQud2Via2l0RXhpdEZ1bGxzY3JlZW4oKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHdhdGNoaW5nTW9kZSAoZSkge1xuICAgIGlmIChlLmN0cmxLZXkgJiYgZS5rZXlDb2RlID09IDg3ICYmIGNhcHRpcy5wbGF5ZXIucmVhZHkgJiYgY2FwdGlzLnNlZ21lbnRzLnJlYWR5KSB7XG4gICAgICAgIGltcHJlc3MoKS5nb3RvKGNhcHRpcy5wbGF5ZXIuanNvbi5zZWdtZW50c1swXS5zdGVwaWQpO1xuICAgICAgICBpbXByZXNzKCkucHJldigpO1xuICAgICAgICBjYXB0aXMucGxheWVyLmlzT24gPSB0cnVlO1xuICAgICAgICBpZiAoY2FwdGlzLnRvb2xiYXIpIHtcbiAgICAgICAgICAgIGNsZWFyU3BhY2UoKTtcbiAgICAgICAgfVxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FwdGlzJykuaW5uZXJIVE1MICs9IChcbiAgICAgICAgICAgICc8ZGl2IGlkPVwicGxheWVyXCI+IFxcXG4gICAgICAgICAgICAgICAgPHZpZGVvIGlkPVwiY2FwdGlzX21hZGVcIiBwcmVsb2FkPjwvdmlkZW8+IFxcXG4gICAgICAgICAgICAgICAgPGRpdiBpZD1cImNhcHRpc19jb250cm9sc1wiPiBcXFxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGlkPVwiY2FwdGlzX3BsYXllclwiPiBcXFxuICAgICAgICAgICAgICAgICAgICAgICAgPGkgaWQ9XCJwbGF5XCIgY2xhc3M9XCJmYSBmYS1wbGF5IGNhcHRpc19pY29uXCI+PC9pPiBcXFxuICAgICAgICAgICAgICAgICAgICAgICAgPGkgaWQ9XCJwYXVzZVwiIGNsYXNzPVwiZmEgZmEtcGF1c2UgY2FwdGlzX2ljb25cIj48L2k+IFxcXG4gICAgICAgICAgICAgICAgICAgICAgICA8Y2FudmFzIGlkPVwic2VnbWVudHNcIj48L2NhbnZhcz4gXFxcbiAgICAgICAgICAgICAgICAgICAgICAgIDxwcm9ncmVzcyB2YWx1ZT1cIjBcIiBpZD1cInBidWZmZXJcIj48L3Byb2dyZXNzPiBcXFxuICAgICAgICAgICAgICAgICAgICAgICAgPGlucHV0IHR5cGU9XCJyYW5nZVwiIGlkPVwicGxheWJhclwiIHZhbHVlPVwiMFwiPiBcXFxuICAgICAgICAgICAgICAgICAgICAgICAgPGkgaWQ9XCJwdGltZXJcIj4wMDowMDowMDwvaT4gXFxcbiAgICAgICAgICAgICAgICAgICAgICAgIDxpIGlkPVwiaGlnaHZcIiBjbGFzcz1cImZhIGZhLXZvbHVtZS11cCBjYXB0aXNfaWNvblwiPjwvaT4gXFxcbiAgICAgICAgICAgICAgICAgICAgICAgIDxpIGlkPVwibG93dlwiIGNsYXNzPVwiZmEgZmEtdm9sdW1lLWRvd24gY2FwdGlzX2ljb25cIj48L2k+IFxcXG4gICAgICAgICAgICAgICAgICAgICAgICA8aSBpZD1cIm9mZnZcIiBjbGFzcz1cImZhIGZhLXZvbHVtZS1vZmYgY2FwdGlzX2ljb25cIj48L2k+IFxcXG4gICAgICAgICAgICAgICAgICAgICAgICA8aW5wdXQgdHlwZT1cInJhbmdlXCIgaWQ9XCJ2b2x1bWVcIiBtaW49XCIwXCIgbWF4PVwiMVwiIHN0ZXA9XCIwLjFcIiB2YWx1ZT1cIjFcIj4gXFxcbiAgICAgICAgICAgICAgICAgICAgICAgIDxpIGlkPVwiZnVsbHNcIiBjbGFzcz1cImZhIGZhLWV5ZSBjYXB0aXNfaWNvblwiPjwvaT4gXFxcbiAgICAgICAgICAgICAgICAgICAgICAgIDxpIGlkPVwiZXhpdGZ1bGxzXCIgY2xhc3M9XCJmYSBmYS1leWUtc2xhc2ggY2FwdGlzX2ljb25cIj48L2k+IFxcXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PiBcXFxuICAgICAgICAgICAgICAgIDwvZGl2PiBcXFxuICAgICAgICAgICAgPC9kaXY+J1xuICAgICAgICApO1xuICAgICAgICB2YXIgdmlkZW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FwdGlzX21hZGUnKTtcbiAgICAgICAgdmlkZW8uc3JjID0gY2FwdGlzLnBsYXllci5vYmplY3RVcmw7XG4gICAgICAgIHZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRlZG1ldGFkYXRhJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BidWZmZXInKS5zZXRBdHRyaWJ1dGUoXG4gICAgICAgICAgICAgICAgXCJtYXhcIixcbiAgICAgICAgICAgICAgICBNYXRoLmZsb29yKHZpZGVvLmR1cmF0aW9uKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGF5YmFyJykuc2V0QXR0cmlidXRlKFxuICAgICAgICAgICAgICAgIFwibWF4XCIsXG4gICAgICAgICAgICAgICAgTWF0aC5mbG9vcih2aWRlby5kdXJhdGlvbilcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICB2YXIgY2FudmFzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NlZ21lbnRzJyksXG4gICAgICAgICAgICAgICAgY3R4ID0gY2FudmFzLmdldENvbnRleHQoJzJkJyksXG4gICAgICAgICAgICAgICAgcmF0aW8gPSBjYW52YXMud2lkdGggLyB2aWRlby5kdXJhdGlvbixcbiAgICAgICAgICAgICAgICBwb3NpdGlvbiA9IDAsXG4gICAgICAgICAgICAgICAgc2VnbWVudFdpZHRoID0gMDtcbiAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGF5JykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICAgICAnY2xpY2snLFxuICAgICAgICAgICAgICAgIHBsYXlWaWRlbyxcbiAgICAgICAgICAgICAgICBmYWxzZVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdleGl0ZnVsbHMnKS5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgICAgICdjbGljaycsXG4gICAgICAgICAgICAgICAgZXhpdEZ1bGxTY3JlZW4sXG4gICAgICAgICAgICAgICAgZmFsc2VcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZnVsbHMnKS5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgICAgICdjbGljaycsXG4gICAgICAgICAgICAgICAgZnVsbFNjcmVlbixcbiAgICAgICAgICAgICAgICBmYWxzZVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd2b2x1bWUnKS5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgICAgICdjaGFuZ2UnLFxuICAgICAgICAgICAgICAgIHNldFZvbHVtZSxcbiAgICAgICAgICAgICAgICBmYWxzZVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGF5YmFyJykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICAgICAnY2hhbmdlJyxcbiAgICAgICAgICAgICAgICBzZWVrVmlkZW8sXG4gICAgICAgICAgICAgICAgZmFsc2VcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNhcHRpcy5wbGF5ZXIudGltZXN0YW1wcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHNlZ21lbnRXaWR0aCA9IE1hdGguZmxvb3IoY2FwdGlzLnBsYXllci50aW1lc3RhbXBzW2ldICogcmF0aW8pIC0gMTtcbiAgICAgICAgICAgICAgICBjdHguZmlsbFN0eWxlID0gJyMxM0FEODcnO1xuICAgICAgICAgICAgICAgIGN0eC5maWxsUmVjdChwb3NpdGlvbiwgMCwgc2VnbWVudFdpZHRoLCBjYW52YXMuaGVpZ2h0KTtcbiAgICAgICAgICAgICAgICBjdHguZmlsbFN0eWxlID0gJyNGRkYnO1xuICAgICAgICAgICAgICAgIGN0eC5maWxsUmVjdChzZWdtZW50V2lkdGgsIDAsIDEsIGNhbnZhcy5oZWlnaHQpO1xuICAgICAgICAgICAgICAgIHBvc2l0aW9uID0gc2VnbWVudFdpZHRoICsgMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2tleXVwJywgd2F0Y2hpbmdNb2RlLCBmYWxzZSk7XG4gICAgICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXl1cCcsIGZpbmlzaFdhdGNoaW5nTW9kZSwgZmFsc2UpO1xuICAgICAgICB9KTtcbiAgICB9XG59XG5cbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2ltcHJlc3M6c3RlcGVudGVyJywgZnVuY3Rpb24gKGUpIHtcbiAgICBjYXB0aXMuaW1wcmVzcy5pc1N0ZXAgPSB0cnVlO1xuICAgIGNhcHRpcy5pbXByZXNzLnN0ZXAgPSBlLnRhcmdldC5pZDtcbn0sIGZhbHNlKTtcblxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLCBpbml0aWFsaXplVG9vbGJhciwgZmFsc2UpO1xuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLCB3YXRjaGluZ01vZGUsIGZhbHNlKTtcblxubG9hZFZpZGVvKCk7XG5sb2FkU2VnbWVudHMoKTtcbiIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbihmdW5jdGlvbiBicm93c2VyaWZ5U2hpbShtb2R1bGUsIGV4cG9ydHMsIGRlZmluZSwgYnJvd3NlcmlmeV9zaGltX19kZWZpbmVfX21vZHVsZV9fZXhwb3J0X18pIHtcbnZhciBpbml0aWFsaXplRWRpdG9yID0gZnVuY3Rpb24oKSB7XG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcHRpcycpLmlubmVySFRNTCArPSAoXG4gICAgICAgICc8ZGl2IGlkPVwiY2FwdGlzX2VkaXRvclwiPiBcXFxuICAgICAgICAgICAgPGRpdiBpZD1cImxvYWRpbmdcIj48cHJvZ3Jlc3MgaWQ9XCJsb2FkaW5nX3NlZ21lbnRzXCIgdmFsdWU9XCIwXCI+PC9wcm9ncmVzcz48L2Rpdj4gXFxcbiAgICAgICAgICAgIDx2aWRlbyBpZD1cImVkaXRfdmlkZW9cIiBwcmVsb2FkIGF1dG9wbGF5IG11dGVkPjwvdmlkZW8+IFxcXG4gICAgICAgICAgICA8ZGl2IGlkPVwic2VnbWVudF9jb250XCI+PGRpdiBpZD1cImNhcHRpc19lZGl0b3Jfc2VnbWVudHNcIj48L2Rpdj48L2Rpdj4gXFxcbiAgICAgICAgICAgIDxjYW52YXMgaWQ9XCJzZWdtZW50c2hvdFwiPjwvY2FudmFzPiBcXFxuICAgICAgICA8L2Rpdj4nXG4gICAgKTtcbiAgICB2YXIgdmlkZW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZWRpdF92aWRlbycpLFxuICAgICAgICBwYXJ0cyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYXB0aXNfZWRpdG9yX3NlZ21lbnRzJyksXG4gICAgICAgIGNvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzZWdtZW50X2NvbnQnKSxcbiAgICAgICAgbG9hZGVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvYWRpbmdfc2VnbWVudHMnKSxcbiAgICAgICAgbG9hZGluZyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2FkaW5nJyksXG4gICAgICAgIGNhbnZhcyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzZWdtZW50c2hvdCcpLFxuICAgICAgICBjdHggPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcbiAgICAgICAgY2FudmFzLndpZHRoID0gMTMwO1xuICAgICAgICBjYW52YXMuaGVpZ2h0ID0gMTMwO1xuICAgIHBhcnRzLmlubmVySFRNTCA9ICcnO1xuICAgIHZpZGVvLnNyYyA9IHdpbmRvdy52aWRlb1VSTDtcbiAgICBsb2FkZXIuc2V0QXR0cmlidXRlKCdtYXgnLCB3aW5kb3cuc2VnbWVudHMubGVuZ3RoIC0gMSk7XG4gICAgdmlkZW8ub25sb2FkZWRtZXRhZGF0YSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGkgPSAwO1xuICAgICAgICB2YXIgbG9vcCA9IHNldEludGVydmFsKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgLy9jb25zb2xlLmxvZyh3aW5kb3cuc2VnbWVudHNbaV0pO1xuICAgICAgICAgICAgcGFydHMuaW5uZXJIVE1MICs9IChcbiAgICAgICAgICAgICAgICAnPGRpdiBjbGFzcz1cInNlZ21lbnRfYm94XCIgaWQ9XCJzZWdtZW50XycrIGkgKydcIj4gXFxcbiAgICAgICAgICAgICAgICAgICAgPGkgY2xhc3M9XCJzZWdtZW50X3RpbWVcIj4nKyB3aW5kb3cuZm9ybWF0RHVyYXRpb24od2luZG93LnNlZ21lbnRzW2ldLnRpbWVzdGFtcCkgKyc8L2k+IFxcXG4gICAgICAgICAgICAgICAgPC9kaXY+J1xuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHZpZGVvLmN1cnJlbnRUaW1lID0gd2luZG93LnNlZ21lbnRzW2ldLnRpbWVzdGFtcDtcbiAgICAgICAgICAgIGN0eC5kcmF3SW1hZ2UodmlkZW8sIDAsIDAsIDEzMCwgMTMwKTtcbiAgICAgICAgICAgIHZhciBpbWFnZSA9IGNhbnZhcy50b0RhdGFVUkwoKSxcbiAgICAgICAgICAgICAgICBib3ggPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2VnbWVudF8nICsgaSk7XG4gICAgICAgICAgICAvL2NvbnNvbGUubG9nKGltYWdlKTtcbiAgICAgICAgICAgIGJveC5zdHlsZS5iYWNrZ3JvdW5kSW1hZ2UgPSAndXJsKCcgKyBpbWFnZSArICcpJztcbiAgICAgICAgICAgIGxvYWRlci52YWx1ZSA9IGk7XG4gICAgICAgICAgICBpKys7XG4gICAgICAgICAgICBpZiAoaSA9PSB3aW5kb3cuc2VnbWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgLy9wYXJ0cy5zdHlsZS5oZWlnaHQgPSAxMjAgKiB3aW5kb3cuc2VnbWVudHMubGVuZ3RoICsgJ3B4JztcbiAgICAgICAgICAgICAgICBjb250YWluZXIuc3R5bGUud2lkdGggPSAnMTMwcHgnO1xuICAgICAgICAgICAgICAgIGxvYWRpbmcuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICAgICAgICAgICB2aWRlby5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcbiAgICAgICAgICAgICAgICB2aWRlby5wYXVzZSgpO1xuICAgICAgICAgICAgICAgIHZpZGVvLmN1cnJlbnRUaW1lID0gMDtcbiAgICAgICAgICAgICAgICBjbGVhckludGVydmFsKGxvb3ApO1xuICAgICAgICAgICAgICAgIHZhciBlbGVtZW50cyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoJ3NlZ21lbnRfYm94Jyk7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBlbGVtZW50cy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICBlbGVtZW50c1tqXS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGVkaXRvclBsYXlTZWdtZW50LCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGVsZW1lbnRzKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0sIDEwMCk7XG4gICAgfTtcblxufVxuXG52YXIgZWRpdG9yUGxheVNlZ21lbnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmlkZW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZWRpdF92aWRlbycpO1xuICAgIHZhciBpbmRleCA9IHRoaXMuaWQuc3BsaXQoJ18nKVsxXTtcbiAgICB2aWRlby5jdXJyZW50VGltZSA9IHdpbmRvdy5zZWdtZW50c1tpbmRleF0udGltZXN0YW1wO1xuICAgIHZpZGVvLm11dGVkID0gZmFsc2U7XG4gICAgdmlkZW8ucGxheSgpO1xufVxuXG5leHBvcnRzLmluaXRpYWxpemVFZGl0b3IgPSBpbml0aWFsaXplRWRpdG9yO1xuXG47IGJyb3dzZXJpZnlfc2hpbV9fZGVmaW5lX19tb2R1bGVfX2V4cG9ydF9fKHR5cGVvZiBFZGl0b3IgIT0gXCJ1bmRlZmluZWRcIiA/IEVkaXRvciA6IHdpbmRvdy5FZGl0b3IpO1xuXG59KS5jYWxsKGdsb2JhbCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgZnVuY3Rpb24gZGVmaW5lRXhwb3J0KGV4KSB7IG1vZHVsZS5leHBvcnRzID0gZXg7IH0pO1xuXG59KS5jYWxsKHRoaXMsdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KSIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbihmdW5jdGlvbiBicm93c2VyaWZ5U2hpbShtb2R1bGUsIGV4cG9ydHMsIGRlZmluZSwgYnJvd3NlcmlmeV9zaGltX19kZWZpbmVfX21vZHVsZV9fZXhwb3J0X18pIHtcbi8qXG4gICAgdmFyIHZpZCA9IG5ldyBXaGFtbXkuVmlkZW8oKTtcbiAgICB2aWQuYWRkKGNhbnZhcyBvciBkYXRhIHVybClcbiAgICB2aWQuY29tcGlsZSgpXG4qL1xuXG5cbnZhciBXaGFtbXkgPSAoZnVuY3Rpb24oKXtcbiAgICAvLyBpbiB0aGlzIGNhc2UsIGZyYW1lcyBoYXMgYSB2ZXJ5IHNwZWNpZmljIG1lYW5pbmcsIHdoaWNoIHdpbGwgYmVcbiAgICAvLyBkZXRhaWxlZCBvbmNlIGkgZmluaXNoIHdyaXRpbmcgdGhlIGNvZGVcblxuICAgIGZ1bmN0aW9uIHRvV2ViTShmcmFtZXMsIG91dHB1dEFzQXJyYXkpe1xuICAgICAgICB2YXIgaW5mbyA9IGNoZWNrRnJhbWVzKGZyYW1lcyk7XG5cbiAgICAgICAgLy9tYXggZHVyYXRpb24gYnkgY2x1c3RlciBpbiBtaWxsaXNlY29uZHNcbiAgICAgICAgdmFyIENMVVNURVJfTUFYX0RVUkFUSU9OID0gMzAwMDA7XG5cbiAgICAgICAgdmFyIEVCTUwgPSBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgXCJpZFwiOiAweDFhNDVkZmEzLCAvLyBFQk1MXG4gICAgICAgICAgICAgICAgXCJkYXRhXCI6IFtcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IDEsXG4gICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4NDI4NiAvLyBFQk1MVmVyc2lvblxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogMSxcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHg0MmY3IC8vIEVCTUxSZWFkVmVyc2lvblxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogNCxcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHg0MmYyIC8vIEVCTUxNYXhJRExlbmd0aFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogOCxcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHg0MmYzIC8vIEVCTUxNYXhTaXplTGVuZ3RoXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBcIndlYm1cIixcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHg0MjgyIC8vIERvY1R5cGVcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IDIsXG4gICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4NDI4NyAvLyBEb2NUeXBlVmVyc2lvblxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogMixcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHg0Mjg1IC8vIERvY1R5cGVSZWFkVmVyc2lvblxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBcImlkXCI6IDB4MTg1MzgwNjcsIC8vIFNlZ21lbnRcbiAgICAgICAgICAgICAgICBcImRhdGFcIjogW1xuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4MTU0OWE5NjYsIC8vIEluZm9cbiAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogMWU2LCAvL2RvIHRoaW5ncyBpbiBtaWxsaXNlY3MgKG51bSBvZiBuYW5vc2VjcyBmb3IgZHVyYXRpb24gc2NhbGUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHgyYWQ3YjEgLy8gVGltZWNvZGVTY2FsZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogXCJ3aGFtbXlcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDRkODAgLy8gTXV4aW5nQXBwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBcIndoYW1teVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4NTc0MSAvLyBXcml0aW5nQXBwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBkb3VibGVUb1N0cmluZyhpbmZvLmR1cmF0aW9uKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDQ0ODkgLy8gRHVyYXRpb25cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHgxNjU0YWU2YiwgLy8gVHJhY2tzXG4gICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweGFlLCAvLyBUcmFja0VudHJ5XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IDEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweGQ3IC8vIFRyYWNrTnVtYmVyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiAxLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHg2M2M1IC8vIFRyYWNrVUlEXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHg5YyAvLyBGbGFnTGFjaW5nXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBcInVuZFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHgyMmI1OWMgLy8gTGFuZ3VhZ2VcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IFwiVl9WUDhcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4ODYgLy8gQ29kZWNJRFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogXCJWUDhcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4MjU4Njg4IC8vIENvZGVjTmFtZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogMSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4ODMgLy8gVHJhY2tUeXBlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHhlMCwgIC8vIFZpZGVvXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IGluZm8ud2lkdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4YjAgLy8gUGl4ZWxXaWR0aFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogaW5mby5oZWlnaHQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4YmEgLy8gUGl4ZWxIZWlnaHRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgICAgICAvL2NsdXN0ZXIgaW5zZXJ0aW9uIHBvaW50XG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgfVxuICAgICAgICAgXTtcblxuXG4gICAgICAgIC8vR2VuZXJhdGUgY2x1c3RlcnMgKG1heCBkdXJhdGlvbilcbiAgICAgICAgdmFyIGZyYW1lTnVtYmVyID0gMDtcbiAgICAgICAgdmFyIGNsdXN0ZXJUaW1lY29kZSA9IDA7XG4gICAgICAgIHdoaWxlKGZyYW1lTnVtYmVyIDwgZnJhbWVzLmxlbmd0aCl7XG5cbiAgICAgICAgICAgIHZhciBjbHVzdGVyRnJhbWVzID0gW107XG4gICAgICAgICAgICB2YXIgY2x1c3RlckR1cmF0aW9uID0gMDtcbiAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgICBjbHVzdGVyRnJhbWVzLnB1c2goZnJhbWVzW2ZyYW1lTnVtYmVyXSk7XG4gICAgICAgICAgICAgICAgY2x1c3RlckR1cmF0aW9uICs9IGZyYW1lc1tmcmFtZU51bWJlcl0uZHVyYXRpb247XG4gICAgICAgICAgICAgICAgZnJhbWVOdW1iZXIrKztcbiAgICAgICAgICAgIH13aGlsZShmcmFtZU51bWJlciA8IGZyYW1lcy5sZW5ndGggJiYgY2x1c3RlckR1cmF0aW9uIDwgQ0xVU1RFUl9NQVhfRFVSQVRJT04pO1xuXG4gICAgICAgICAgICB2YXIgY2x1c3RlckNvdW50ZXIgPSAwO1xuICAgICAgICAgICAgdmFyIGNsdXN0ZXIgPSB7XG4gICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHgxZjQzYjY3NSwgLy8gQ2x1c3RlclxuICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogW1xuICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBjbHVzdGVyVGltZWNvZGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweGU3IC8vIFRpbWVjb2RlXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIF0uY29uY2F0KGNsdXN0ZXJGcmFtZXMubWFwKGZ1bmN0aW9uKHdlYnApe1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGJsb2NrID0gbWFrZVNpbXBsZUJsb2NrKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkaXNjYXJkYWJsZTogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcmFtZTogd2VicC5kYXRhLnNsaWNlKDQpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGludmlzaWJsZTogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXlmcmFtZTogMSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWNpbmc6IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJhY2tOdW06IDEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGltZWNvZGU6IE1hdGgucm91bmQoY2x1c3RlckNvdW50ZXIpXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsdXN0ZXJDb3VudGVyICs9IHdlYnAuZHVyYXRpb247XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IGJsb2NrLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlkOiAweGEzXG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICB9KSlcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vQWRkIGNsdXN0ZXIgdG8gc2VnbWVudFxuICAgICAgICAgICAgRUJNTFsxXS5kYXRhLnB1c2goY2x1c3Rlcik7XG4gICAgICAgICAgICBjbHVzdGVyVGltZWNvZGUgKz0gY2x1c3RlckR1cmF0aW9uO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGdlbmVyYXRlRUJNTChFQk1MLCBvdXRwdXRBc0FycmF5KVxuICAgIH1cblxuICAgIC8vIHN1bXMgdGhlIGxlbmd0aHMgb2YgYWxsIHRoZSBmcmFtZXMgYW5kIGdldHMgdGhlIGR1cmF0aW9uLCB3b29cblxuICAgIGZ1bmN0aW9uIGNoZWNrRnJhbWVzKGZyYW1lcyl7XG4gICAgICAgIHZhciB3aWR0aCA9IGZyYW1lc1swXS53aWR0aCxcbiAgICAgICAgICAgIGhlaWdodCA9IGZyYW1lc1swXS5oZWlnaHQsXG4gICAgICAgICAgICBkdXJhdGlvbiA9IGZyYW1lc1swXS5kdXJhdGlvbjtcbiAgICAgICAgZm9yKHZhciBpID0gMTsgaSA8IGZyYW1lcy5sZW5ndGg7IGkrKyl7XG4gICAgICAgICAgICBpZihmcmFtZXNbaV0ud2lkdGggIT0gd2lkdGgpIHRocm93IFwiRnJhbWUgXCIgKyAoaSArIDEpICsgXCIgaGFzIGEgZGlmZmVyZW50IHdpZHRoXCI7XG4gICAgICAgICAgICBpZihmcmFtZXNbaV0uaGVpZ2h0ICE9IGhlaWdodCkgdGhyb3cgXCJGcmFtZSBcIiArIChpICsgMSkgKyBcIiBoYXMgYSBkaWZmZXJlbnQgaGVpZ2h0XCI7XG4gICAgICAgICAgICBpZihmcmFtZXNbaV0uZHVyYXRpb24gPCAwIHx8IGZyYW1lc1tpXS5kdXJhdGlvbiA+IDB4N2ZmZikgdGhyb3cgXCJGcmFtZSBcIiArIChpICsgMSkgKyBcIiBoYXMgYSB3ZWlyZCBkdXJhdGlvbiAobXVzdCBiZSBiZXR3ZWVuIDAgYW5kIDMyNzY3KVwiO1xuICAgICAgICAgICAgZHVyYXRpb24gKz0gZnJhbWVzW2ldLmR1cmF0aW9uO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBkdXJhdGlvbjogZHVyYXRpb24sXG4gICAgICAgICAgICB3aWR0aDogd2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IGhlaWdodFxuICAgICAgICB9O1xuICAgIH1cblxuXG4gICAgZnVuY3Rpb24gbnVtVG9CdWZmZXIobnVtKXtcbiAgICAgICAgdmFyIHBhcnRzID0gW107XG4gICAgICAgIHdoaWxlKG51bSA+IDApe1xuICAgICAgICAgICAgcGFydHMucHVzaChudW0gJiAweGZmKVxuICAgICAgICAgICAgbnVtID0gbnVtID4+IDhcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkocGFydHMucmV2ZXJzZSgpKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzdHJUb0J1ZmZlcihzdHIpe1xuICAgICAgICAvLyByZXR1cm4gbmV3IEJsb2IoW3N0cl0pO1xuXG4gICAgICAgIHZhciBhcnIgPSBuZXcgVWludDhBcnJheShzdHIubGVuZ3RoKTtcbiAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKyl7XG4gICAgICAgICAgICBhcnJbaV0gPSBzdHIuY2hhckNvZGVBdChpKVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhcnI7XG4gICAgICAgIC8vIHRoaXMgaXMgc2xvd2VyXG4gICAgICAgIC8vIHJldHVybiBuZXcgVWludDhBcnJheShzdHIuc3BsaXQoJycpLm1hcChmdW5jdGlvbihlKXtcbiAgICAgICAgLy8gIHJldHVybiBlLmNoYXJDb2RlQXQoMClcbiAgICAgICAgLy8gfSkpXG4gICAgfVxuXG5cbiAgICAvL3NvcnJ5IHRoaXMgaXMgdWdseSwgYW5kIHNvcnQgb2YgaGFyZCB0byB1bmRlcnN0YW5kIGV4YWN0bHkgd2h5IHRoaXMgd2FzIGRvbmVcbiAgICAvLyBhdCBhbGwgcmVhbGx5LCBidXQgdGhlIHJlYXNvbiBpcyB0aGF0IHRoZXJlJ3Mgc29tZSBjb2RlIGJlbG93IHRoYXQgaSBkb250IHJlYWxseVxuICAgIC8vIGZlZWwgbGlrZSB1bmRlcnN0YW5kaW5nLCBhbmQgdGhpcyBpcyBlYXNpZXIgdGhhbiB1c2luZyBteSBicmFpbi5cblxuICAgIGZ1bmN0aW9uIGJpdHNUb0J1ZmZlcihiaXRzKXtcbiAgICAgICAgdmFyIGRhdGEgPSBbXTtcbiAgICAgICAgdmFyIHBhZCA9IChiaXRzLmxlbmd0aCAlIDgpID8gKG5ldyBBcnJheSgxICsgOCAtIChiaXRzLmxlbmd0aCAlIDgpKSkuam9pbignMCcpIDogJyc7XG4gICAgICAgIGJpdHMgPSBwYWQgKyBiaXRzO1xuICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgYml0cy5sZW5ndGg7IGkrPSA4KXtcbiAgICAgICAgICAgIGRhdGEucHVzaChwYXJzZUludChiaXRzLnN1YnN0cihpLDgpLDIpKVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXcgVWludDhBcnJheShkYXRhKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZW5lcmF0ZUVCTUwoanNvbiwgb3V0cHV0QXNBcnJheSl7XG4gICAgICAgIHZhciBlYm1sID0gW107XG4gICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBqc29uLmxlbmd0aDsgaSsrKXtcbiAgICAgICAgICAgIHZhciBkYXRhID0ganNvbltpXS5kYXRhO1xuICAgICAgICAgICAgaWYodHlwZW9mIGRhdGEgPT0gJ29iamVjdCcpIGRhdGEgPSBnZW5lcmF0ZUVCTUwoZGF0YSwgb3V0cHV0QXNBcnJheSk7XG4gICAgICAgICAgICBpZih0eXBlb2YgZGF0YSA9PSAnbnVtYmVyJykgZGF0YSA9IGJpdHNUb0J1ZmZlcihkYXRhLnRvU3RyaW5nKDIpKTtcbiAgICAgICAgICAgIGlmKHR5cGVvZiBkYXRhID09ICdzdHJpbmcnKSBkYXRhID0gc3RyVG9CdWZmZXIoZGF0YSk7XG5cbiAgICAgICAgICAgIGlmKGRhdGEubGVuZ3RoKXtcbiAgICAgICAgICAgICAgICB2YXIgeiA9IHo7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBsZW4gPSBkYXRhLnNpemUgfHwgZGF0YS5ieXRlTGVuZ3RoIHx8IGRhdGEubGVuZ3RoO1xuICAgICAgICAgICAgdmFyIHplcm9lcyA9IE1hdGguY2VpbChNYXRoLmNlaWwoTWF0aC5sb2cobGVuKS9NYXRoLmxvZygyKSkvOCk7XG4gICAgICAgICAgICB2YXIgc2l6ZV9zdHIgPSBsZW4udG9TdHJpbmcoMik7XG4gICAgICAgICAgICB2YXIgcGFkZGVkID0gKG5ldyBBcnJheSgoemVyb2VzICogNyArIDcgKyAxKSAtIHNpemVfc3RyLmxlbmd0aCkpLmpvaW4oJzAnKSArIHNpemVfc3RyO1xuICAgICAgICAgICAgdmFyIHNpemUgPSAobmV3IEFycmF5KHplcm9lcykpLmpvaW4oJzAnKSArICcxJyArIHBhZGRlZDtcblxuICAgICAgICAgICAgLy9pIGFjdHVhbGx5IGRvbnQgcXVpdGUgdW5kZXJzdGFuZCB3aGF0IHdlbnQgb24gdXAgdGhlcmUsIHNvIEknbSBub3QgcmVhbGx5XG4gICAgICAgICAgICAvL2dvaW5nIHRvIGZpeCB0aGlzLCBpJ20gcHJvYmFibHkganVzdCBnb2luZyB0byB3cml0ZSBzb21lIGhhY2t5IHRoaW5nIHdoaWNoXG4gICAgICAgICAgICAvL2NvbnZlcnRzIHRoYXQgc3RyaW5nIGludG8gYSBidWZmZXItZXNxdWUgdGhpbmdcblxuICAgICAgICAgICAgZWJtbC5wdXNoKG51bVRvQnVmZmVyKGpzb25baV0uaWQpKTtcbiAgICAgICAgICAgIGVibWwucHVzaChiaXRzVG9CdWZmZXIoc2l6ZSkpO1xuICAgICAgICAgICAgZWJtbC5wdXNoKGRhdGEpXG5cblxuICAgICAgICB9XG5cbiAgICAgICAgLy9vdXRwdXQgYXMgYmxvYiBvciBieXRlQXJyYXlcbiAgICAgICAgaWYob3V0cHV0QXNBcnJheSl7XG4gICAgICAgICAgICAvL2NvbnZlcnQgZWJtbCB0byBhbiBhcnJheVxuICAgICAgICAgICAgdmFyIGJ1ZmZlciA9IHRvRmxhdEFycmF5KGVibWwpXG4gICAgICAgICAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyKTtcbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICByZXR1cm4gbmV3IEJsb2IoZWJtbCwge3R5cGU6IFwidmlkZW8vd2VibVwifSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiB0b0ZsYXRBcnJheShhcnIsIG91dEJ1ZmZlcil7XG4gICAgICAgIGlmKG91dEJ1ZmZlciA9PSBudWxsKXtcbiAgICAgICAgICAgIG91dEJ1ZmZlciA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBhcnIubGVuZ3RoOyBpKyspe1xuICAgICAgICAgICAgaWYodHlwZW9mIGFycltpXSA9PSAnb2JqZWN0Jyl7XG4gICAgICAgICAgICAgICAgLy9hbiBhcnJheVxuICAgICAgICAgICAgICAgIHRvRmxhdEFycmF5KGFycltpXSwgb3V0QnVmZmVyKVxuICAgICAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICAgICAgLy9hIHNpbXBsZSBlbGVtZW50XG4gICAgICAgICAgICAgICAgb3V0QnVmZmVyLnB1c2goYXJyW2ldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb3V0QnVmZmVyO1xuICAgIH1cblxuICAgIC8vd29vdCwgYSBmdW5jdGlvbiB0aGF0J3MgYWN0dWFsbHkgd3JpdHRlbiBmb3IgdGhpcyBwcm9qZWN0IVxuICAgIC8vdGhpcyBwYXJzZXMgc29tZSBqc29uIG1hcmt1cCBhbmQgbWFrZXMgaXQgaW50byB0aGF0IGJpbmFyeSBtYWdpY1xuICAgIC8vd2hpY2ggY2FuIHRoZW4gZ2V0IHNob3ZlZCBpbnRvIHRoZSBtYXRyb3NrYSBjb210YWluZXIgKHBlYWNlYWJseSlcblxuICAgIGZ1bmN0aW9uIG1ha2VTaW1wbGVCbG9jayhkYXRhKXtcbiAgICAgICAgdmFyIGZsYWdzID0gMDtcbiAgICAgICAgaWYgKGRhdGEua2V5ZnJhbWUpIGZsYWdzIHw9IDEyODtcbiAgICAgICAgaWYgKGRhdGEuaW52aXNpYmxlKSBmbGFncyB8PSA4O1xuICAgICAgICBpZiAoZGF0YS5sYWNpbmcpIGZsYWdzIHw9IChkYXRhLmxhY2luZyA8PCAxKTtcbiAgICAgICAgaWYgKGRhdGEuZGlzY2FyZGFibGUpIGZsYWdzIHw9IDE7XG4gICAgICAgIGlmIChkYXRhLnRyYWNrTnVtID4gMTI3KSB7XG4gICAgICAgICAgICB0aHJvdyBcIlRyYWNrTnVtYmVyID4gMTI3IG5vdCBzdXBwb3J0ZWRcIjtcbiAgICAgICAgfVxuICAgICAgICB2YXIgb3V0ID0gW2RhdGEudHJhY2tOdW0gfCAweDgwLCBkYXRhLnRpbWVjb2RlID4+IDgsIGRhdGEudGltZWNvZGUgJiAweGZmLCBmbGFnc10ubWFwKGZ1bmN0aW9uKGUpe1xuICAgICAgICAgICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUoZSlcbiAgICAgICAgfSkuam9pbignJykgKyBkYXRhLmZyYW1lO1xuXG4gICAgICAgIHJldHVybiBvdXQ7XG4gICAgfVxuXG4gICAgLy8gaGVyZSdzIHNvbWV0aGluZyBlbHNlIHRha2VuIHZlcmJhdGltIGZyb20gd2VwcHksIGF3ZXNvbWUgcml0ZT9cblxuICAgIGZ1bmN0aW9uIHBhcnNlV2ViUChyaWZmKXtcbiAgICAgICAgdmFyIFZQOCA9IHJpZmYuUklGRlswXS5XRUJQWzBdO1xuXG4gICAgICAgIHZhciBmcmFtZV9zdGFydCA9IFZQOC5pbmRleE9mKCdcXHg5ZFxceDAxXFx4MmEnKTsgLy9BIFZQOCBrZXlmcmFtZSBzdGFydHMgd2l0aCB0aGUgMHg5ZDAxMmEgaGVhZGVyXG4gICAgICAgIGZvcih2YXIgaSA9IDAsIGMgPSBbXTsgaSA8IDQ7IGkrKykgY1tpXSA9IFZQOC5jaGFyQ29kZUF0KGZyYW1lX3N0YXJ0ICsgMyArIGkpO1xuXG4gICAgICAgIHZhciB3aWR0aCwgaG9yaXpvbnRhbF9zY2FsZSwgaGVpZ2h0LCB2ZXJ0aWNhbF9zY2FsZSwgdG1wO1xuXG4gICAgICAgIC8vdGhlIGNvZGUgYmVsb3cgaXMgbGl0ZXJhbGx5IGNvcGllZCB2ZXJiYXRpbSBmcm9tIHRoZSBiaXRzdHJlYW0gc3BlY1xuICAgICAgICB0bXAgPSAoY1sxXSA8PCA4KSB8IGNbMF07XG4gICAgICAgIHdpZHRoID0gdG1wICYgMHgzRkZGO1xuICAgICAgICBob3Jpem9udGFsX3NjYWxlID0gdG1wID4+IDE0O1xuICAgICAgICB0bXAgPSAoY1szXSA8PCA4KSB8IGNbMl07XG4gICAgICAgIGhlaWdodCA9IHRtcCAmIDB4M0ZGRjtcbiAgICAgICAgdmVydGljYWxfc2NhbGUgPSB0bXAgPj4gMTQ7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB3aWR0aDogd2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IGhlaWdodCxcbiAgICAgICAgICAgIGRhdGE6IFZQOCxcbiAgICAgICAgICAgIHJpZmY6IHJpZmZcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGkgdGhpbmsgaSdtIGdvaW5nIG9mZiBvbiBhIHJpZmYgYnkgcHJldGVuZGluZyB0aGlzIGlzIHNvbWUga25vd25cbiAgICAvLyBpZGlvbSB3aGljaCBpJ20gbWFraW5nIGEgY2FzdWFsIGFuZCBicmlsbGlhbnQgcHVuIGFib3V0LCBidXQgc2luY2VcbiAgICAvLyBpIGNhbid0IGZpbmQgYW55dGhpbmcgb24gZ29vZ2xlIHdoaWNoIGNvbmZvcm1zIHRvIHRoaXMgaWRpb21hdGljXG4gICAgLy8gdXNhZ2UsIEknbSBhc3N1bWluZyB0aGlzIGlzIGp1c3QgYSBjb25zZXF1ZW5jZSBvZiBzb21lIHBzeWNob3RpY1xuICAgIC8vIGJyZWFrIHdoaWNoIG1ha2VzIG1lIG1ha2UgdXAgcHVucy4gd2VsbCwgZW5vdWdoIHJpZmYtcmFmZiAoYWhhIGFcbiAgICAvLyByZXNjdWUgb2Ygc29ydHMpLCB0aGlzIGZ1bmN0aW9uIHdhcyByaXBwZWQgd2hvbGVzYWxlIGZyb20gd2VwcHlcblxuICAgIGZ1bmN0aW9uIHBhcnNlUklGRihzdHJpbmcpe1xuICAgICAgICB2YXIgb2Zmc2V0ID0gMDtcbiAgICAgICAgdmFyIGNodW5rcyA9IHt9O1xuXG4gICAgICAgIHdoaWxlIChvZmZzZXQgPCBzdHJpbmcubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgaWQgPSBzdHJpbmcuc3Vic3RyKG9mZnNldCwgNCk7XG4gICAgICAgICAgICB2YXIgbGVuID0gcGFyc2VJbnQoc3RyaW5nLnN1YnN0cihvZmZzZXQgKyA0LCA0KS5zcGxpdCgnJykubWFwKGZ1bmN0aW9uKGkpe1xuICAgICAgICAgICAgICAgIHZhciB1bnBhZGRlZCA9IGkuY2hhckNvZGVBdCgwKS50b1N0cmluZygyKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gKG5ldyBBcnJheSg4IC0gdW5wYWRkZWQubGVuZ3RoICsgMSkpLmpvaW4oJzAnKSArIHVucGFkZGVkXG4gICAgICAgICAgICB9KS5qb2luKCcnKSwyKTtcbiAgICAgICAgICAgIHZhciBkYXRhID0gc3RyaW5nLnN1YnN0cihvZmZzZXQgKyA0ICsgNCwgbGVuKTtcbiAgICAgICAgICAgIG9mZnNldCArPSA0ICsgNCArIGxlbjtcbiAgICAgICAgICAgIGNodW5rc1tpZF0gPSBjaHVua3NbaWRdIHx8IFtdO1xuXG4gICAgICAgICAgICBpZiAoaWQgPT0gJ1JJRkYnIHx8IGlkID09ICdMSVNUJykge1xuICAgICAgICAgICAgICAgIGNodW5rc1tpZF0ucHVzaChwYXJzZVJJRkYoZGF0YSkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjaHVua3NbaWRdLnB1c2goZGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNodW5rcztcbiAgICB9XG5cbiAgICAvLyBoZXJlJ3MgYSBsaXR0bGUgdXRpbGl0eSBmdW5jdGlvbiB0aGF0IGFjdHMgYXMgYSB1dGlsaXR5IGZvciBvdGhlciBmdW5jdGlvbnNcbiAgICAvLyBiYXNpY2FsbHksIHRoZSBvbmx5IHB1cnBvc2UgaXMgZm9yIGVuY29kaW5nIFwiRHVyYXRpb25cIiwgd2hpY2ggaXMgZW5jb2RlZCBhc1xuICAgIC8vIGEgZG91YmxlIChjb25zaWRlcmFibHkgbW9yZSBkaWZmaWN1bHQgdG8gZW5jb2RlIHRoYW4gYW4gaW50ZWdlcilcbiAgICBmdW5jdGlvbiBkb3VibGVUb1N0cmluZyhudW0pe1xuICAgICAgICByZXR1cm4gW10uc2xpY2UuY2FsbChcbiAgICAgICAgICAgIG5ldyBVaW50OEFycmF5KFxuICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgbmV3IEZsb2F0NjRBcnJheShbbnVtXSkgLy9jcmVhdGUgYSBmbG9hdDY0IGFycmF5XG4gICAgICAgICAgICAgICAgKS5idWZmZXIpIC8vZXh0cmFjdCB0aGUgYXJyYXkgYnVmZmVyXG4gICAgICAgICAgICAsIDApIC8vIGNvbnZlcnQgdGhlIFVpbnQ4QXJyYXkgaW50byBhIHJlZ3VsYXIgYXJyYXlcbiAgICAgICAgICAgIC5tYXAoZnVuY3Rpb24oZSl7IC8vc2luY2UgaXQncyBhIHJlZ3VsYXIgYXJyYXksIHdlIGNhbiBub3cgdXNlIG1hcFxuICAgICAgICAgICAgICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKGUpIC8vIGVuY29kZSBhbGwgdGhlIGJ5dGVzIGluZGl2aWR1YWxseVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5yZXZlcnNlKCkgLy9jb3JyZWN0IHRoZSBieXRlIGVuZGlhbm5lc3MgKGFzc3VtZSBpdCdzIGxpdHRsZSBlbmRpYW4gZm9yIG5vdylcbiAgICAgICAgICAgIC5qb2luKCcnKSAvLyBqb2luIHRoZSBieXRlcyBpbiBob2x5IG1hdHJpbW9ueSBhcyBhIHN0cmluZ1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIFdoYW1teVZpZGVvKHNwZWVkLCBxdWFsaXR5KXsgLy8gYSBtb3JlIGFic3RyYWN0LWlzaCBBUElcbiAgICAgICAgdGhpcy5mcmFtZXMgPSBbXTtcbiAgICAgICAgdGhpcy5kdXJhdGlvbiA9IDEwMDAgLyBzcGVlZDtcbiAgICAgICAgdGhpcy5xdWFsaXR5ID0gcXVhbGl0eSB8fCAwLjg7XG4gICAgfVxuXG4gICAgV2hhbW15VmlkZW8ucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKGZyYW1lLCBkdXJhdGlvbil7XG4gICAgICAgIGlmKHR5cGVvZiBkdXJhdGlvbiAhPSAndW5kZWZpbmVkJyAmJiB0aGlzLmR1cmF0aW9uKSB0aHJvdyBcInlvdSBjYW4ndCBwYXNzIGEgZHVyYXRpb24gaWYgdGhlIGZwcyBpcyBzZXRcIjtcbiAgICAgICAgaWYodHlwZW9mIGR1cmF0aW9uID09ICd1bmRlZmluZWQnICYmICF0aGlzLmR1cmF0aW9uKSB0aHJvdyBcImlmIHlvdSBkb24ndCBoYXZlIHRoZSBmcHMgc2V0LCB5b3UgbmVkIHRvIGhhdmUgZHVyYXRpb25zIGhlcmUuXCJcbiAgICAgICAgaWYoJ2NhbnZhcycgaW4gZnJhbWUpeyAvL0NhbnZhc1JlbmRlcmluZ0NvbnRleHQyRFxuICAgICAgICAgICAgZnJhbWUgPSBmcmFtZS5jYW52YXM7XG4gICAgICAgIH1cbiAgICAgICAgaWYoJ3RvRGF0YVVSTCcgaW4gZnJhbWUpe1xuICAgICAgICAgICAgZnJhbWUgPSBmcmFtZS50b0RhdGFVUkwoJ2ltYWdlL3dlYnAnLCB0aGlzLnF1YWxpdHkpXG4gICAgICAgIH1lbHNlIGlmKHR5cGVvZiBmcmFtZSAhPSBcInN0cmluZ1wiKXtcbiAgICAgICAgICAgIHRocm93IFwiZnJhbWUgbXVzdCBiZSBhIGEgSFRNTENhbnZhc0VsZW1lbnQsIGEgQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEIG9yIGEgRGF0YVVSSSBmb3JtYXR0ZWQgc3RyaW5nXCJcbiAgICAgICAgfVxuICAgICAgICBpZiAoISgvXmRhdGE6aW1hZ2VcXC93ZWJwO2Jhc2U2NCwvaWcpLnRlc3QoZnJhbWUpKSB7XG4gICAgICAgICAgICB0aHJvdyBcIklucHV0IG11c3QgYmUgZm9ybWF0dGVkIHByb3Blcmx5IGFzIGEgYmFzZTY0IGVuY29kZWQgRGF0YVVSSSBvZiB0eXBlIGltYWdlL3dlYnBcIjtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmZyYW1lcy5wdXNoKHtcbiAgICAgICAgICAgIGltYWdlOiBmcmFtZSxcbiAgICAgICAgICAgIGR1cmF0aW9uOiBkdXJhdGlvbiB8fCB0aGlzLmR1cmF0aW9uXG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgV2hhbW15VmlkZW8ucHJvdG90eXBlLmNvbXBpbGUgPSBmdW5jdGlvbihvdXRwdXRBc0FycmF5KXtcbiAgICAgICAgcmV0dXJuIG5ldyB0b1dlYk0odGhpcy5mcmFtZXMubWFwKGZ1bmN0aW9uKGZyYW1lKXtcbiAgICAgICAgICAgIHZhciB3ZWJwID0gcGFyc2VXZWJQKHBhcnNlUklGRihhdG9iKGZyYW1lLmltYWdlLnNsaWNlKDIzKSkpKTtcbiAgICAgICAgICAgIHdlYnAuZHVyYXRpb24gPSBmcmFtZS5kdXJhdGlvbjtcbiAgICAgICAgICAgIHJldHVybiB3ZWJwO1xuICAgICAgICB9KSwgb3V0cHV0QXNBcnJheSlcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBWaWRlbzogV2hhbW15VmlkZW8sXG4gICAgICAgIGZyb21JbWFnZUFycmF5OiBmdW5jdGlvbihpbWFnZXMsIGZwcywgb3V0cHV0QXNBcnJheSl7XG4gICAgICAgICAgICByZXR1cm4gdG9XZWJNKGltYWdlcy5tYXAoZnVuY3Rpb24oaW1hZ2Upe1xuICAgICAgICAgICAgICAgIHZhciB3ZWJwID0gcGFyc2VXZWJQKHBhcnNlUklGRihhdG9iKGltYWdlLnNsaWNlKDIzKSkpKVxuICAgICAgICAgICAgICAgIHdlYnAuZHVyYXRpb24gPSAxMDAwIC8gZnBzO1xuICAgICAgICAgICAgICAgIHJldHVybiB3ZWJwO1xuICAgICAgICAgICAgfSksIG91dHB1dEFzQXJyYXkpXG4gICAgICAgIH0sXG4gICAgICAgIHRvV2ViTTogdG9XZWJNXG4gICAgICAgIC8vIGV4cG9zZSBtZXRob2RzIG9mIG1hZG5lc3NcbiAgICB9XG59KSgpXG5cbjsgYnJvd3NlcmlmeV9zaGltX19kZWZpbmVfX21vZHVsZV9fZXhwb3J0X18odHlwZW9mIFdoYW1teSAhPSBcInVuZGVmaW5lZFwiID8gV2hhbW15IDogd2luZG93LldoYW1teSk7XG5cbn0pLmNhbGwoZ2xvYmFsLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBmdW5jdGlvbiBkZWZpbmVFeHBvcnQoZXgpIHsgbW9kdWxlLmV4cG9ydHMgPSBleDsgfSk7XG5cbn0pLmNhbGwodGhpcyx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pIl19
