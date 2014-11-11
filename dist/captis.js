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
    console.log(window.segments);
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
                //console.log(elements);
            };
        }, 100);
    };
    window.reloadEvents();

}

var editorPlaySegment = function () {
    video = document.getElementById('edit_video');
    var index = parseInt(this.id.split('_')[1]);
    window.segment = index;
    window.canUpdate = true;
    video.currentTime = window.segments[index].timestamp;
    video.muted = false;
    impress().goto('overview');
    impress().goto(window.segments[index].stepid);
    //TODO: All cases
    if (window.segments[index].next) {
        for (var i = 0; i < window.segments[index].next; i++) {
            impress().next();
        }
    }
    if (window.segments[index].prev) {
        for (var i = 0; i < window.segments[index].prev; i++) {
            impress().prev();
        }
    }
    console.log(window.slides, window.segments[index]);
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
        window.canUpdate = false;
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
    document.getElementById('camera').addEventListener(
        'click',
        mediaStream,
        false
    );
}

window.reloadEvents = reloadEvents;

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
                if (window.canUpdate) { document.getElementById('edit_video').outerHTML = ''; }
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
                    segments: captis.impress.segments,
                    duration: timeFormat(audio.duration),
                })],
                {type: 'application/json'}
            ),
            //jsonUrl = window.URL.createObjectURL(json),
            formData = new FormData();
        if (window.canUpdate) {
            json = new Blob(
                [JSON.stringify({
                    meta: captis.player.json.meta,
                    segments: defineShift(Math.floor(audio.duration)),
                    duration: captis.player.json.duration,
                    update: [timeFormat(captis.player.json.segments[window.segment].timestamp),
                        timeFormat(captis.player.json.segments[window.segment + 1].timestamp)
                    ]
                })],
                {type: 'application/json'}
            );
            formData.append('audio', blob, 'audio.wav');
            formData.append('video', encodedFile, 'video.webm');
            formData.append('data', json, 'captis_new.json');
            var request = new XMLHttpRequest();
            request.open('POST', 'http://localhost:3000/update', true);
            request.onload = function () {
                if (request.status === 200) {
                    location.reload();
                } else {
                    console.log('Failed to upload');
                }
            }
            request.send(formData);
        } else {
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
        }
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
        //reloadEvents();
    }
}

function defineShift (duration) {
    console.log(duration);
    var timeDiff = captis.player.json.segments[window.segment + 1].timestamp -
        captis.player.json.segments[window.segment].timestamp,
        shift = 0;
    if (duration < timeDiff) {
        shift = timeDiff - duration;
        for (var i = 0; i < captis.player.json.segments.length; i++) {
            if (i <= window.segment) { continue; }
            captis.player.json.segments[i].timestamp =
                captis.player.json.segments[i].timestamp - shift;
        }
        return captis.player.json.segments;
    }
    if (duartion > timeDiff) {
        shift = duartion - timeDiff;
        return shift;
    }
    return shift;
}

//watching mode

function loadVideo () {
    var request = new XMLHttpRequest();
    request.open('GET', 'http://localhost:3000/media/captis.webm', true);
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
    request.open('GET', 'http://localhost:3000/media/captis.json', true);
    request.onreadystatechange = function () {
        if (request.status === 200 && request.readyState == 4) {
            captis.segments.ready = true;
            captis.player.json = JSON.parse(this.response);
            window.segments = captis.player.json.segments;
            window.slides = captis.player.json.meta;
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
    console.log(window.segments);
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
                //console.log(elements);
            };
        }, 100);
    };
    window.reloadEvents();

}

var editorPlaySegment = function () {
    video = document.getElementById('edit_video');
    var index = parseInt(this.id.split('_')[1]);
    window.segment = index;
    window.canUpdate = true;
    video.currentTime = window.segments[index].timestamp;
    video.muted = false;
    impress().goto('overview');
    impress().goto(window.segments[index].stepid);
    //TODO: All cases
    if (window.segments[index].next) {
        for (var i = 0; i < window.segments[index].next; i++) {
            impress().next();
        }
    }
    if (window.segments[index].prev) {
        for (var i = 0; i < window.segments[index].prev; i++) {
            impress().prev();
        }
    }
    console.log(window.slides, window.segments[index]);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvcGFzaGEvRGVza3RvcC9jYXB0aXMvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9Vc2Vycy9wYXNoYS9EZXNrdG9wL2NhcHRpcy9FZGl0b3IuanMiLCIvVXNlcnMvcGFzaGEvRGVza3RvcC9jYXB0aXMvY2FwdGlzLmpzIiwiL1VzZXJzL3Bhc2hhL0Rlc2t0b3AvY2FwdGlzL2VkaXRvci5qcyIsIi9Vc2Vycy9wYXNoYS9EZXNrdG9wL2NhcHRpcy92ZW5kb3Ivd2hhbW15Lm1pbi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6eEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7QUM3RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIGluaXRpYWxpemVFZGl0b3IgPSBmdW5jdGlvbigpIHtcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FwdGlzJykuaW5uZXJIVE1MICs9IChcbiAgICAgICAgJzxkaXYgaWQ9XCJjYXB0aXNfZWRpdG9yXCI+IFxcXG4gICAgICAgICAgICA8ZGl2IGlkPVwibG9hZGluZ1wiPjxwcm9ncmVzcyBpZD1cImxvYWRpbmdfc2VnbWVudHNcIiB2YWx1ZT1cIjBcIj48L3Byb2dyZXNzPjwvZGl2PiBcXFxuICAgICAgICAgICAgPHZpZGVvIGlkPVwiZWRpdF92aWRlb1wiIHByZWxvYWQgYXV0b3BsYXkgbXV0ZWQ+PC92aWRlbz4gXFxcbiAgICAgICAgICAgIDxkaXYgaWQ9XCJzZWdtZW50X2NvbnRcIj48ZGl2IGlkPVwiY2FwdGlzX2VkaXRvcl9zZWdtZW50c1wiPjwvZGl2PjwvZGl2PiBcXFxuICAgICAgICAgICAgPGNhbnZhcyBpZD1cInNlZ21lbnRzaG90XCI+PC9jYW52YXM+IFxcXG4gICAgICAgIDwvZGl2PidcbiAgICApO1xuICAgIHZhciB2aWRlbyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdlZGl0X3ZpZGVvJyksXG4gICAgICAgIHBhcnRzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcHRpc19lZGl0b3Jfc2VnbWVudHMnKSxcbiAgICAgICAgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NlZ21lbnRfY29udCcpLFxuICAgICAgICBsb2FkZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9hZGluZ19zZWdtZW50cycpLFxuICAgICAgICBsb2FkaW5nID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvYWRpbmcnKSxcbiAgICAgICAgY2FudmFzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NlZ21lbnRzaG90JyksXG4gICAgICAgIGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuICAgICAgICBjYW52YXMud2lkdGggPSAxMzA7XG4gICAgICAgIGNhbnZhcy5oZWlnaHQgPSAxMzA7XG4gICAgcGFydHMuaW5uZXJIVE1MID0gJyc7XG4gICAgdmlkZW8uc3JjID0gd2luZG93LnZpZGVvVVJMO1xuICAgIGNvbnNvbGUubG9nKHdpbmRvdy5zZWdtZW50cyk7XG4gICAgbG9hZGVyLnNldEF0dHJpYnV0ZSgnbWF4Jywgd2luZG93LnNlZ21lbnRzLmxlbmd0aCAtIDEpO1xuICAgIHZpZGVvLm9ubG9hZGVkbWV0YWRhdGEgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBpID0gMDtcbiAgICAgICAgdmFyIGxvb3AgPSBzZXRJbnRlcnZhbChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIC8vY29uc29sZS5sb2cod2luZG93LnNlZ21lbnRzW2ldKTtcbiAgICAgICAgICAgIHBhcnRzLmlubmVySFRNTCArPSAoXG4gICAgICAgICAgICAgICAgJzxkaXYgY2xhc3M9XCJzZWdtZW50X2JveFwiIGlkPVwic2VnbWVudF8nKyBpICsnXCI+IFxcXG4gICAgICAgICAgICAgICAgICAgIDxpIGNsYXNzPVwic2VnbWVudF90aW1lXCI+Jysgd2luZG93LmZvcm1hdER1cmF0aW9uKHdpbmRvdy5zZWdtZW50c1tpXS50aW1lc3RhbXApICsnPC9pPiBcXFxuICAgICAgICAgICAgICAgIDwvZGl2PidcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICB2aWRlby5jdXJyZW50VGltZSA9IHdpbmRvdy5zZWdtZW50c1tpXS50aW1lc3RhbXA7XG4gICAgICAgICAgICBjdHguZHJhd0ltYWdlKHZpZGVvLCAwLCAwLCAxMzAsIDEzMCk7XG4gICAgICAgICAgICB2YXIgaW1hZ2UgPSBjYW52YXMudG9EYXRhVVJMKCksXG4gICAgICAgICAgICAgICAgYm94ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NlZ21lbnRfJyArIGkpO1xuICAgICAgICAgICAgLy9jb25zb2xlLmxvZyhpbWFnZSk7XG4gICAgICAgICAgICBib3guc3R5bGUuYmFja2dyb3VuZEltYWdlID0gJ3VybCgnICsgaW1hZ2UgKyAnKSc7XG4gICAgICAgICAgICBsb2FkZXIudmFsdWUgPSBpO1xuICAgICAgICAgICAgaSsrO1xuICAgICAgICAgICAgaWYgKGkgPT0gd2luZG93LnNlZ21lbnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIC8vcGFydHMuc3R5bGUuaGVpZ2h0ID0gMTIwICogd2luZG93LnNlZ21lbnRzLmxlbmd0aCArICdweCc7XG4gICAgICAgICAgICAgICAgY29udGFpbmVyLnN0eWxlLndpZHRoID0gJzEzMHB4JztcbiAgICAgICAgICAgICAgICBsb2FkaW5nLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgICAgICAgICAgdmlkZW8uc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG4gICAgICAgICAgICAgICAgdmlkZW8ucGF1c2UoKTtcbiAgICAgICAgICAgICAgICB2aWRlby5jdXJyZW50VGltZSA9IDA7XG4gICAgICAgICAgICAgICAgY2xlYXJJbnRlcnZhbChsb29wKTtcbiAgICAgICAgICAgICAgICB2YXIgZWxlbWVudHMgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKCdzZWdtZW50X2JveCcpO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgZWxlbWVudHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudHNbal0uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBlZGl0b3JQbGF5U2VnbWVudCwgZmFsc2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKGVsZW1lbnRzKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0sIDEwMCk7XG4gICAgfTtcbiAgICB3aW5kb3cucmVsb2FkRXZlbnRzKCk7XG5cbn1cblxudmFyIGVkaXRvclBsYXlTZWdtZW50ID0gZnVuY3Rpb24gKCkge1xuICAgIHZpZGVvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2VkaXRfdmlkZW8nKTtcbiAgICB2YXIgaW5kZXggPSBwYXJzZUludCh0aGlzLmlkLnNwbGl0KCdfJylbMV0pO1xuICAgIHdpbmRvdy5zZWdtZW50ID0gaW5kZXg7XG4gICAgd2luZG93LmNhblVwZGF0ZSA9IHRydWU7XG4gICAgdmlkZW8uY3VycmVudFRpbWUgPSB3aW5kb3cuc2VnbWVudHNbaW5kZXhdLnRpbWVzdGFtcDtcbiAgICB2aWRlby5tdXRlZCA9IGZhbHNlO1xuICAgIGltcHJlc3MoKS5nb3RvKCdvdmVydmlldycpO1xuICAgIGltcHJlc3MoKS5nb3RvKHdpbmRvdy5zZWdtZW50c1tpbmRleF0uc3RlcGlkKTtcbiAgICAvL1RPRE86IEFsbCBjYXNlc1xuICAgIGlmICh3aW5kb3cuc2VnbWVudHNbaW5kZXhdLm5leHQpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB3aW5kb3cuc2VnbWVudHNbaW5kZXhdLm5leHQ7IGkrKykge1xuICAgICAgICAgICAgaW1wcmVzcygpLm5leHQoKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAod2luZG93LnNlZ21lbnRzW2luZGV4XS5wcmV2KSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgd2luZG93LnNlZ21lbnRzW2luZGV4XS5wcmV2OyBpKyspIHtcbiAgICAgICAgICAgIGltcHJlc3MoKS5wcmV2KCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgY29uc29sZS5sb2cod2luZG93LnNsaWRlcywgd2luZG93LnNlZ21lbnRzW2luZGV4XSk7XG4gICAgdmlkZW8ucGxheSgpO1xuXG59XG5cbmV4cG9ydHMuaW5pdGlhbGl6ZUVkaXRvciA9IGluaXRpYWxpemVFZGl0b3I7XG4iLCIvKipcbiogQGF1dGhvciBQYXNoYSBCaW55YXRvdiA8cGFzaGFAYmlueWF0b3YuY29tPlxuKiBAY29weXJpZ2h0IDIwMTQgUGFzaGEgQmlueWF0b3ZcbiogQGxpY2Vuc2Uge0BsaW5rIGh0dHBzOi8vZ2l0aHViLmNvbS9iaW55YXRvdi9jYXB0aXMuanMvYmxvYi9tYXN0ZXIvTElDRU5TRXxNSVQgTGljZW5zZX1cbiovXG5cbi8qKlxuKi9cbm5hdmlnYXRvci5nZXRVc2VyTWVkaWEgPSAoXG4gICAgbmF2aWdhdG9yLmdldFVzZXJNZWRpYSB8fFxuICAgIG5hdmlnYXRvci53ZWJraXRHZXRVc2VyTWVkaWEgfHxcbiAgICBuYXZpZ2F0b3IubW96R2V0VXNlck1lZGlhIHx8XG4gICAgbmF2aWdhdG9yLm1zR2V0VXNlck1lZGlhXG4pO1xuXG53aW5kb3cuVVJMID0gKFxuICAgIHdpbmRvdy5VUkwgfHxcbiAgICB3aW5kb3cud2Via2l0VVJMIHx8XG4gICAgd2luZG93Lm1velVSTCB8fFxuICAgIHdpbmRvdy5tc1VSTFxuKTtcblxudmFyIEF1ZGlvQ29udGV4dCA9IHdpbmRvdy5BdWRpb0NvbnRleHQgfHwgd2luZG93LndlYmtpdEF1ZGlvQ29udGV4dCxcbiAgICBXaGFtbXkgPSByZXF1aXJlKCdXaGFtbXknKSxcbiAgICBFZGl0b3IgPSByZXF1aXJlKCcuL0VkaXRvcicpLFxuICAgIGNoYW5uZWxEYXRhID0gW107XG5cbnZhciBjYXB0aXMgPSB7c3RyZWFtOiBudWxsLFxuICAgIGZyYW1lczogW10sXG4gICAgdG9vbGJhcjogZmFsc2UsXG4gICAgY2FwdHVyaW5nOiBmYWxzZSxcbiAgICBzdHJlYW1pbmc6IGZhbHNlLFxuICAgIHJlY29yZDogbnVsbCxcbiAgICBhdWRpbzoge1xuICAgICAgICByZWNvcmRpbmdTaXplOiAwLFxuICAgICAgICBzYW1wbGVSYXRlOiA0NDEwMCxcbiAgICAgICAgcmVjb3JkaW5nOiBmYWxzZSxcbiAgICAgICAgcHJvY2Vzc29yOiBudWxsXG4gICAgfSxcbiAgICBpbXByZXNzOiB7XG4gICAgICAgIHN0ZXA6IG51bGwsXG4gICAgICAgIGlzU3RlcDogZmFsc2UsXG4gICAgICAgIHNlZ21lbnRzOiBbXSxcbiAgICAgICAgbWV0YToge31cbiAgICB9LFxuICAgIHBsYXllcjoge1xuICAgICAgICBvYmplY3RVcmw6IG51bGwsXG4gICAgICAgIHJlYWR5OiBmYWxzZSxcbiAgICAgICAgdGltZXVwZGF0ZTogbnVsbCxcbiAgICAgICAganNvbjogbnVsbCxcbiAgICAgICAgdGltZXN0YW1wczogW10sXG4gICAgICAgIHNsaWRlczogW10sXG4gICAgICAgIGlzT246IGZhbHNlLFxuICAgICAgICBjdXJyZW50U3RlcDogbnVsbCxcbiAgICAgICAgYWN0aXZlU3RlcDogbnVsbCxcbiAgICAgICAga2V5cHJlc3NlZDogZmFsc2VcbiAgICB9LFxuICAgIHNlZ21lbnRzOiB7XG4gICAgICAgIHJlYWR5OiBmYWxzZVxuICAgIH1cbn1cblxuZnVuY3Rpb24gaW5pdGlhbGl6ZVRvb2xiYXIgKGUpIHtcbiAgICBpZiAoZS5jdHJsS2V5ICYmIGUua2V5Q29kZSA9PSA2OSkge1xuICAgICAgICBjYXB0aXMudG9vbGJhciA9IHRydWU7XG4gICAgICAgIHdpbmRvdy5jYW5VcGRhdGUgPSBmYWxzZTtcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcHRpcycpLmlubmVySFRNTCArPSAoXG4gICAgICAgICAgICAnPGRpdiBpZD1cInRvb2xiYXJcIj4gXFxcbiAgICAgICAgICAgICAgICA8aSBpZD1cImNhbWVyYVwiIGNsYXNzPVwiZmEgZmEtdmlkZW8tY2FtZXJhIGNhcHRpc19pY29uXCI+PC9pPiBcXFxuICAgICAgICAgICAgICAgIDxpIGlkPVwicmVjb3JkXCIgY2xhc3M9XCJmYSBmYS1jaXJjbGVcIj48L2k+IFxcXG4gICAgICAgICAgICAgICAgPGkgaWQ9XCJzY3JlZW5cIiBjbGFzcz1cImZhIGZhLWRlc2t0b3AgY2FwdGlzX2ljb25cIj48L2k+IFxcXG4gICAgICAgICAgICAgICAgPGkgaWQ9XCJzYXZlXCIgY2xhc3M9XCJmYSBmYS1zYXZlIGNhcHRpc19pY29uXCI+PC9pPiBcXFxuICAgICAgICAgICAgICAgIDxpIGlkPVwidXBkYXRlXCIgY2xhc3M9XCJmYSBmYS1wbHVzLXNxdWFyZSBjYXB0aXNfaWNvblwiPjwvaT4gXFxcbiAgICAgICAgICAgICAgICA8aSBpZD1cImVkaXRcIiBjbGFzcz1cImZhIGZhLXBlbmNpbC1zcXVhcmUgY2FwdGlzX2ljb25cIj48L2k+IFxcXG4gICAgICAgICAgICAgICAgPGkgaWQ9XCJzd2l0Y2hcIiBjbGFzcz1cImZhIGZhLXBvd2VyLW9mZiBjYXB0aXNfaWNvblwiPjwvaT4gXFxcbiAgICAgICAgICAgIDwvZGl2PidcbiAgICAgICAgKTtcbiAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5dXAnLCBpbml0aWFsaXplVG9vbGJhciwgZmFsc2UpO1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXl1cCcsIGNsb3NlVG9vbGJhciwgZmFsc2UpO1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3dpdGNoJykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICdjbGljaycsXG4gICAgICAgICAgICBjbG9zZVRvb2xiYXIsXG4gICAgICAgICAgICBmYWxzZVxuICAgICAgICApO1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FtZXJhJykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICdjbGljaycsXG4gICAgICAgICAgICBtZWRpYVN0cmVhbSxcbiAgICAgICAgICAgIGZhbHNlXG4gICAgICAgICk7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdlZGl0JykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICdjbGljaycsXG4gICAgICAgICAgICBFZGl0b3IuaW5pdGlhbGl6ZUVkaXRvcixcbiAgICAgICAgICAgIGZhbHNlXG4gICAgICAgICk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBjbGVhclNwYWNlICgpIHtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3dpdGNoJykucmVtb3ZlRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgY2xvc2VUb29sYmFyLFxuICAgICAgICBmYWxzZVxuICAgICk7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2VkaXQnKS5yZW1vdmVFdmVudExpc3RlbmVyKFxuICAgICAgICAnY2xpY2snLFxuICAgICAgICBFZGl0b3IuaW5pdGlhbGl6ZUVkaXRvcixcbiAgICAgICAgZmFsc2VcbiAgICApO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYW1lcmEnKS5yZW1vdmVFdmVudExpc3RlbmVyKFxuICAgICAgICAnY2xpY2snLFxuICAgICAgICBjbG9zZVRvb2xiYXIsXG4gICAgICAgIGZhbHNlXG4gICAgKTtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndG9vbGJhcicpLm91dGVySFRNTCA9ICcnO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2tleXVwJywgY2xvc2VUb29sYmFyLCBmYWxzZSk7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLCBpbml0aWFsaXplVG9vbGJhciwgZmFsc2UpO1xuICAgIGlmIChjYXB0aXMuc3RyZWFtaW5nKSB7XG4gICAgICAgIGNhcHRpcy5zdHJlYW0uc3RvcCgpO1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGl2ZV9zdHJlYW0nKS5vdXRlckhUTUwgPSAnJztcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3RpbWVyJykub3V0ZXJIVE1MID0gJyc7XG4gICAgICAgIGNhcHRpcy5zdHJlYW1pbmcgPSBmYWxzZTtcbiAgICB9XG4gICAgaWYgKGNhcHRpcy5jYXB0dXJpbmcpIHtcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BvbHlnb24nKS5vdXRlckhUTUwgPSAnJztcbiAgICAgICAgY2FwdGlzLmNhcHR1cmluZyA9IGZhbHNlO1xuICAgIH1cbn1cblxuXG5mdW5jdGlvbiBjbG9zZVRvb2xiYXIgKGUpIHtcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBpZiAoKGUuY3RybEtleSAmJiBlLmtleUNvZGUgPT0gNjkpIHx8IGUudGFyZ2V0LmlkID09ICdzd2l0Y2gnKSB7XG4gICAgICAgIGNsZWFyU3BhY2UoKTtcbiAgICAgICAgY2FwdGlzLnRvb2xiYXIgPSBmYWxzZTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlbG9hZEV2ZW50cyAoKSB7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3N3aXRjaCcpLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICdjbGljaycsXG4gICAgICAgIGNsb3NlVG9vbGJhcixcbiAgICAgICAgZmFsc2VcbiAgICApO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzYXZlJykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgc2F2ZU1lZGlhLFxuICAgICAgICBmYWxzZVxuICAgICk7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhbWVyYScpLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICdjbGljaycsXG4gICAgICAgIG1lZGlhU3RyZWFtLFxuICAgICAgICBmYWxzZVxuICAgICk7XG59XG5cbndpbmRvdy5yZWxvYWRFdmVudHMgPSByZWxvYWRFdmVudHM7XG5cbmZ1bmN0aW9uIG1lZGlhU3RyZWFtICgpIHtcbiAgICBpZiAobmF2aWdhdG9yLmdldFVzZXJNZWRpYSkge1xuICAgICAgICBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhIChcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB2aWRlbzogdHJ1ZSxcbiAgICAgICAgICAgICAgICBhdWRpbzogdHJ1ZVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZ1bmN0aW9uIChsb2NhbE1lZGlhU3RyZWFtKSB7XG4gICAgICAgICAgICAgICAgY2FwdGlzLnN0cmVhbSA9IGxvY2FsTWVkaWFTdHJlYW07XG4gICAgICAgICAgICAgICAgY2FwdGlzLnN0cmVhbWluZyA9IHRydWU7XG4gICAgICAgICAgICAgICAgaWYgKHdpbmRvdy5jYW5VcGRhdGUpIHsgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2VkaXRfdmlkZW8nKS5vdXRlckhUTUwgPSAnJzsgfVxuICAgICAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYXB0aXMnKS5pbm5lckhUTUwgKz0gKFxuICAgICAgICAgICAgICAgICAgICAnPHZpZGVvIGlkPVwibGl2ZV9zdHJlYW1cIiBhdXRvcGxheSBtdXRlZD48L3ZpZGVvPiBcXFxuICAgICAgICAgICAgICAgICAgICA8aSBpZD1cInRpbWVyXCI+PC9pPidcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYXB0aXMnKS5pbm5lckhUTUwgKz0gKFxuICAgICAgICAgICAgICAgICAgICAnPGNhbnZhcyBpZD1cInBvbHlnb25cIj48L2NhbnZhcz4nXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGl2ZV9zdHJlYW0nKS5zcmMgPSB3aW5kb3cuVVJMLmNyZWF0ZU9iamVjdFVSTChsb2NhbE1lZGlhU3RyZWFtKTtcbiAgICAgICAgICAgICAgICByZWxvYWRFdmVudHMoKTtcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVjb3JkJykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgICAgICAgICAgICAgc3RhcnRSZWNvcmRpbmcsXG4gICAgICAgICAgICAgICAgICAgIGZhbHNlXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZyhcImdldFVzZXJNZWRpYSBub3Qgc3VwcG9ydGVkXCIpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gdGltZUZvcm1hdCAoc2Vjb25kcykge1xuXHR2YXIgaCA9IE1hdGguZmxvb3Ioc2Vjb25kcy8zNjAwKTtcblx0dmFyIG0gPSBNYXRoLmZsb29yKChzZWNvbmRzIC0gKGggKiAzNjAwKSkgLyA2MCk7XG5cdHZhciBzID0gTWF0aC5mbG9vcihzZWNvbmRzIC0gKGggKiAzNjAwKSAtIChtICogNjApKTtcblx0aCA9IGggPCAxMCA/IFwiMFwiICsgaCA6IGg7XG5cdG0gPSBtIDwgMTAgPyBcIjBcIiArIG0gOiBtO1xuXHRzID0gcyA8IDEwID8gXCIwXCIgKyBzIDogcztcblx0cmV0dXJuIGggKyBcIjpcIiArIG0gKyBcIjpcIiArIHM7XG59XG5cbndpbmRvdy5mb3JtYXREdXJhdGlvbiA9IHRpbWVGb3JtYXQ7XG5cbmZ1bmN0aW9uIHN0YXJ0UmVjb3JkaW5nICgpIHtcbiAgICBjYXB0aXMuYXVkaW8ucmVjb3JkaW5nID0gdHJ1ZTtcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICB2YXIgdmlkZW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGl2ZV9zdHJlYW0nKSxcbiAgICAgICAgY2FudmFzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BvbHlnb24nKSxcbiAgICAgICAgdGltZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndGltZXInKSxcbiAgICAgICAgY3R4ID0gY2FudmFzLmdldENvbnRleHQoJzJkJyksXG4gICAgICAgIGF1ZGlvQ29udGV4dCA9IG5ldyBBdWRpb0NvbnRleHQoKSxcbiAgICAgICAgZ2Fpbk5vZGUgPSBhdWRpb0NvbnRleHQuY3JlYXRlR2FpbigpLFxuICAgICAgICBhdWRpb0lucHV0ID0gYXVkaW9Db250ZXh0LmNyZWF0ZU1lZGlhU3RyZWFtU291cmNlKGNhcHRpcy5zdHJlYW0pLFxuICAgICAgICBidWZmZXJTaXplID0gMTAyNCxcbiAgICAgICAgY3VycmVudFRpbWUgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKSxcbiAgICAgICAgaW5kZXggPSAwO1xuICAgIGF1ZGlvSW5wdXQuY29ubmVjdChnYWluTm9kZSk7XG4gICAgY2FwdGlzLmF1ZGlvLnByb2Nlc3NvciA9IGF1ZGlvQ29udGV4dC5jcmVhdGVTY3JpcHRQcm9jZXNzb3IoYnVmZmVyU2l6ZSwgMSwgMSk7XG4gICAgY2FwdGlzLmNhcHR1cmluZyA9IHRydWU7XG4gICAgY2FwdGlzLnJlY29yZCA9IG5ldyBXaGFtbXkuVmlkZW8oKTtcbiAgICB2YXIgZnJhbWVXaWR0aCA9IHZpZGVvLm9mZnNldFdpZHRoIC0gMTQsXG4gICAgICAgIGZyYW1lSGVpZ2h0ID0gdmlkZW8ub2Zmc2V0SGVpZ2h0IC0gMTQ7XG4gICAgY2FudmFzLndpZHRoID0gZnJhbWVXaWR0aDtcbiAgICBjYW52YXMuaGVpZ2h0ID0gZnJhbWVIZWlnaHQ7XG4gICAgY2FwdGlzLmF1ZGlvLnByb2Nlc3Nvci5vbmF1ZGlvcHJvY2VzcyA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIGlmICghY2FwdGlzLmF1ZGlvLnJlY29yZGluZykgcmV0dXJuO1xuICAgICAgICBpZiAoaW5kZXglMyA9PSAwKSB7XG4gICAgICAgICAgICBjdHguZHJhd0ltYWdlKHZpZGVvLCAwLCAwLCBmcmFtZVdpZHRoLCBmcmFtZUhlaWdodCk7XG4gICAgICAgICAgICBjYXB0aXMucmVjb3JkLmFkZChjdHgsIDApO1xuICAgICAgICAgICAgLy9jb25zb2xlLmxvZygndmlkZW8nKTtcbiAgICAgICAgfVxuICAgICAgICBpbmRleCsrO1xuICAgICAgICB2YXIgY2hhbm5lbCA9IGUuaW5wdXRCdWZmZXIuZ2V0Q2hhbm5lbERhdGEoMCk7XG4gICAgICAgIGNoYW5uZWxEYXRhLnB1c2gobmV3IEZsb2F0MzJBcnJheShjaGFubmVsKSk7XG4gICAgICAgIGNhcHRpcy5hdWRpby5yZWNvcmRpbmdTaXplICs9IGJ1ZmZlclNpemU7XG4gICAgICAgIC8vY29uc29sZS5sb2coJ2F1ZGlvJyk7XG4gICAgfVxuICAgIHZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ3RpbWV1cGRhdGUnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRpbWVyLmlubmVySFRNTCA9IHRpbWVGb3JtYXQoKG5ldyBEYXRlKCkuZ2V0VGltZSgpIC0gY3VycmVudFRpbWUpLzEwMDApO1xuICAgIH0sIGZhbHNlKTtcbiAgICBjYXB0dXJlU2VnbWVudHModmlkZW8pO1xuICAgIGdhaW5Ob2RlLmNvbm5lY3QoY2FwdGlzLmF1ZGlvLnByb2Nlc3Nvcik7XG4gICAgY2FwdGlzLmF1ZGlvLnByb2Nlc3Nvci5jb25uZWN0KGF1ZGlvQ29udGV4dC5kZXN0aW5hdGlvbik7XG4gICAgcmVsb2FkRXZlbnRzKCk7XG59XG5cbmZ1bmN0aW9uIGNhcHR1cmVTZWdtZW50cyAodmlkZW8pIHtcbiAgICB2YXIgbmV4dFN0ZXAgPSAwLFxuICAgICAgICBwcmV2U3RlcCA9IDAsXG4gICAgICAgIHN0ZXBJZCA9IG51bGw7XG4gICAgd2luZG93Lm9ua2V5ZG93biA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgLy9uZXh0IHNsaWRlXG4gICAgICAgICAgICBpZiAoZS5rZXlDb2RlID09IDM5ICYmIGNhcHRpcy5pbXByZXNzLmlzU3RlcCkge1xuICAgICAgICAgICAgICAgIGlmIChuZXh0U3RlcCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgY2FwdGlzLmltcHJlc3MubWV0YVtzdGVwSWRdID0gbmV4dFN0ZXA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG5leHRTdGVwID0gMDtcbiAgICAgICAgICAgICAgICBwcmV2U3RlcCA9IDA7XG4gICAgICAgICAgICAgICAgY2FwdGlzLmltcHJlc3MuaXNTdGVwID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgY2FwdGlzLmltcHJlc3Muc2VnbWVudHMucHVzaChcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGltZXN0YW1wOiBNYXRoLmZsb29yKHZpZGVvLmN1cnJlbnRUaW1lKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0ZXBpZDogY2FwdGlzLmltcHJlc3Muc3RlcCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5leHQ6IG5leHRTdGVwLFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvL25leHQgc3RlcFxuICAgICAgICAgICAgaWYgKGUua2V5Q29kZSA9PSAzOSAmJiAhY2FwdGlzLmltcHJlc3MuaXNTdGVwKSB7XG4gICAgICAgICAgICAgICAgbmV4dFN0ZXArKztcbiAgICAgICAgICAgICAgICBwcmV2U3RlcCA9IDA7XG4gICAgICAgICAgICAgICAgc3RlcElkID0gY2FwdGlzLmltcHJlc3Muc3RlcDtcbiAgICAgICAgICAgICAgICBjYXB0aXMuaW1wcmVzcy5zZWdtZW50cy5wdXNoKFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1lc3RhbXA6IE1hdGguZmxvb3IodmlkZW8uY3VycmVudFRpbWUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3RlcGlkOiBjYXB0aXMuaW1wcmVzcy5zdGVwLFxuICAgICAgICAgICAgICAgICAgICAgICAgbmV4dDogbmV4dFN0ZXAsXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vcHJldiBzbGlkZVxuICAgICAgICAgICAgaWYgKGUua2V5Q29kZSA9PSAzNyAmJiBjYXB0aXMuaW1wcmVzcy5pc1N0ZXApIHtcbiAgICAgICAgICAgICAgICBwcmV2U3RlcCA9IDA7XG4gICAgICAgICAgICAgICAgbmV4dFN0ZXAgPSAwO1xuICAgICAgICAgICAgICAgIGNhcHRpcy5pbXByZXNzLmlzU3RlcCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGNhcHRpcy5pbXByZXNzLnNlZ21lbnRzLnB1c2goXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogTWF0aC5mbG9vcih2aWRlby5jdXJyZW50VGltZSksXG4gICAgICAgICAgICAgICAgICAgICAgICBzdGVwaWQ6IGNhcHRpcy5pbXByZXNzLnN0ZXAsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcmV2OiBwcmV2U3RlcCxcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy9wcmV2IHN0ZXBcbiAgICAgICAgICAgIGlmIChlLmtleUNvZGUgPT0gMzcgJiYgIWNhcHRpcy5pbXByZXNzLmlzU3RlcCkge1xuICAgICAgICAgICAgICAgIHByZXZTdGVwKys7XG4gICAgICAgICAgICAgICAgbmV4dFN0ZXAgPSAwO1xuICAgICAgICAgICAgICAgIGNhcHRpcy5pbXByZXNzLnNlZ21lbnRzLnB1c2goXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogTWF0aC5mbG9vcih2aWRlby5jdXJyZW50VGltZSksXG4gICAgICAgICAgICAgICAgICAgICAgICBzdGVwaWQ6IGNhcHRpcy5pbXByZXNzLnN0ZXAsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcmV2OiBwcmV2U3RlcCxcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LCAxMDAwKTtcbiAgICB9O1xufVxuXG5mdW5jdGlvbiBtZXJnZUJ1ZmZlcnMgKGNoYW5uZWxCdWZmZXIsIHJlY29yZGluZ0xlbmd0aCkge1xuICAgIHZhciByZXN1bHQgPSBuZXcgRmxvYXQzMkFycmF5KHJlY29yZGluZ0xlbmd0aCksXG4gICAgICAgIG9mZnNldCA9IDA7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGFubmVsQnVmZmVyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBidWZmZXIgPSBjaGFubmVsQnVmZmVyW2ldO1xuICAgICAgICByZXN1bHQuc2V0KGJ1ZmZlciwgb2Zmc2V0KTtcbiAgICAgICAgb2Zmc2V0ICs9IGJ1ZmZlci5sZW5ndGg7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIHdyaXRlVVRGQnl0ZXMgKHZpZXcsIG9mZnNldCwgc3RyaW5nKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHJpbmcubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmlldy5zZXRVaW50OChvZmZzZXQgKyBpLCBzdHJpbmcuY2hhckNvZGVBdChpKSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBmbG9hdFRvMTZCaXRQQ00ob3V0cHV0LCBvZmZzZXQsIGlucHV0KXtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBpbnB1dC5sZW5ndGg7IGkrKywgb2Zmc2V0Kz0yKXtcbiAgICB2YXIgcyA9IE1hdGgubWF4KC0xLCBNYXRoLm1pbigxLCBpbnB1dFtpXSkpO1xuICAgIG91dHB1dC5zZXRJbnQxNihvZmZzZXQsIHMgPCAwID8gcyAqIDB4ODAwMCA6IHMgKiAweDdGRkYsIHRydWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHNhdmVNZWRpYSAoKSB7XG4gICAgY2FwdGlzLmF1ZGlvLnJlY29yZGluZyA9IGZhbHNlO1xuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGNsZWFyU3BhY2UoKTtcbiAgICBjYXB0aXMuc3RyZWFtLnN0b3AoKTtcbiAgICB2YXIgYXVkaW9EYXRhID0gbWVyZ2VCdWZmZXJzKGNoYW5uZWxEYXRhLCBjYXB0aXMuYXVkaW8ucmVjb3JkaW5nU2l6ZSksXG4gICAgICAgIGJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcig0NCArIGF1ZGlvRGF0YS5sZW5ndGggKiAyKSxcbiAgICAgICAgdmlldyA9IG5ldyBEYXRhVmlldyhidWZmZXIpO1xuICAgIHdyaXRlVVRGQnl0ZXModmlldywgMCwgJ1JJRkYnKTtcbiAgICB2aWV3LnNldFVpbnQzMig0LCAzMiArIGF1ZGlvRGF0YS5sZW5ndGggKiAyLCB0cnVlKTtcbiAgICB3cml0ZVVURkJ5dGVzKHZpZXcsIDgsICdXQVZFJyk7XG4gICAgd3JpdGVVVEZCeXRlcyh2aWV3LCAxMiwgJ2ZtdCAnKTtcbiAgICB2aWV3LnNldFVpbnQzMigxNiwgMTYsIHRydWUpO1xuICAgIHZpZXcuc2V0VWludDE2KDIwLCAxLCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQxNigyMiwgMSwgdHJ1ZSk7XG4gICAgdmlldy5zZXRVaW50MzIoMjQsIGNhcHRpcy5hdWRpby5zYW1wbGVSYXRlLCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQzMigyOCwgY2FwdGlzLmF1ZGlvLnNhbXBsZVJhdGUgKiAyLCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQxNigzMiwgMiwgdHJ1ZSk7XG4gICAgdmlldy5zZXRVaW50MTYoMzQsIDE2LCB0cnVlKTtcbiAgICB3cml0ZVVURkJ5dGVzKHZpZXcsIDM2LCAnZGF0YScpO1xuICAgIHZpZXcuc2V0VWludDMyKDQwLCBhdWRpb0RhdGEubGVuZ3RoICogMiwgdHJ1ZSk7XG4gICAgZmxvYXRUbzE2Qml0UENNKHZpZXcsIDQ0LCBhdWRpb0RhdGEpO1xuICAgIHZhciBibG9iID0gbmV3IEJsb2IoW3ZpZXddLCB7dHlwZTogJ2F1ZGlvL3dhdid9KSxcbiAgICAgICAgYXVkaW9VcmwgPSB3aW5kb3cuVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FwdGlzJykuaW5uZXJIVE1MICs9IChcbiAgICAgICAgJzxhdWRpbyBpZD1cIm1ldGFkYXRhXCI+PC9hdWRpbz4nXG4gICAgKTtcbiAgICB2YXIgYXVkaW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbWV0YWRhdGEnKTtcbiAgICBhdWRpby5zcmMgPSBhdWRpb1VybDtcbiAgICBhdWRpby5vbmxvYWRlZG1ldGFkYXRhID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgdmlkTGVuID0gTWF0aC5mbG9vcihhdWRpby5kdXJhdGlvbiAvIGNhcHRpcy5yZWNvcmQuZnJhbWVzLmxlbmd0aCAqIDEwMDApLFxuICAgICAgICAgICAgZGlmZmVyID0gMCxcbiAgICAgICAgICAgIGR1cmFUaW9uID0gMDtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjYXB0aXMucmVjb3JkLmZyYW1lcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgZGlmZmVyICs9IGF1ZGlvLmR1cmF0aW9uIC8gY2FwdGlzLnJlY29yZC5mcmFtZXMubGVuZ3RoICogMTAwMCAtIHZpZExlbjtcbiAgICAgICAgICAgIGlmIChkaWZmZXIgPiAxKSB7XG4gICAgICAgICAgICAgICAgZHVyYVRpb24gPSB2aWRMZW4gKyAxO1xuICAgICAgICAgICAgICAgIGRpZmZlciA9IGRpZmZlciAtIDE7XG4gICAgICAgICAgICB9IGVsc2UgeyBkdXJhVGlvbiA9IHZpZExlbiB9XG4gICAgICAgICAgICBjYXB0aXMucmVjb3JkLmZyYW1lc1tpXS5kdXJhdGlvbiA9IGR1cmFUaW9uO1xuICAgICAgICB9XG4gICAgICAgIHZhciBlbmNvZGVkRmlsZSA9IGNhcHRpcy5yZWNvcmQuY29tcGlsZSgpLFxuICAgICAgICAgICAgLy92aWRlb1VybCA9IHdpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKGVuY29kZWRGaWxlKSxcbiAgICAgICAgICAgIGpzb24gPSBuZXcgQmxvYihcbiAgICAgICAgICAgICAgICBbSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICBtZXRhOiBjYXB0aXMuaW1wcmVzcy5tZXRhLFxuICAgICAgICAgICAgICAgICAgICBzZWdtZW50czogY2FwdGlzLmltcHJlc3Muc2VnbWVudHMsXG4gICAgICAgICAgICAgICAgICAgIGR1cmF0aW9uOiB0aW1lRm9ybWF0KGF1ZGlvLmR1cmF0aW9uKSxcbiAgICAgICAgICAgICAgICB9KV0sXG4gICAgICAgICAgICAgICAge3R5cGU6ICdhcHBsaWNhdGlvbi9qc29uJ31cbiAgICAgICAgICAgICksXG4gICAgICAgICAgICAvL2pzb25VcmwgPSB3aW5kb3cuVVJMLmNyZWF0ZU9iamVjdFVSTChqc29uKSxcbiAgICAgICAgICAgIGZvcm1EYXRhID0gbmV3IEZvcm1EYXRhKCk7XG4gICAgICAgIGlmICh3aW5kb3cuY2FuVXBkYXRlKSB7XG4gICAgICAgICAgICBqc29uID0gbmV3IEJsb2IoXG4gICAgICAgICAgICAgICAgW0pTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgbWV0YTogY2FwdGlzLnBsYXllci5qc29uLm1ldGEsXG4gICAgICAgICAgICAgICAgICAgIHNlZ21lbnRzOiBkZWZpbmVTaGlmdChNYXRoLmZsb29yKGF1ZGlvLmR1cmF0aW9uKSksXG4gICAgICAgICAgICAgICAgICAgIGR1cmF0aW9uOiBjYXB0aXMucGxheWVyLmpzb24uZHVyYXRpb24sXG4gICAgICAgICAgICAgICAgICAgIHVwZGF0ZTogW3RpbWVGb3JtYXQoY2FwdGlzLnBsYXllci5qc29uLnNlZ21lbnRzW3dpbmRvdy5zZWdtZW50XS50aW1lc3RhbXApLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGltZUZvcm1hdChjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHNbd2luZG93LnNlZ21lbnQgKyAxXS50aW1lc3RhbXApXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICB9KV0sXG4gICAgICAgICAgICAgICAge3R5cGU6ICdhcHBsaWNhdGlvbi9qc29uJ31cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBmb3JtRGF0YS5hcHBlbmQoJ2F1ZGlvJywgYmxvYiwgJ2F1ZGlvLndhdicpO1xuICAgICAgICAgICAgZm9ybURhdGEuYXBwZW5kKCd2aWRlbycsIGVuY29kZWRGaWxlLCAndmlkZW8ud2VibScpO1xuICAgICAgICAgICAgZm9ybURhdGEuYXBwZW5kKCdkYXRhJywganNvbiwgJ2NhcHRpc19uZXcuanNvbicpO1xuICAgICAgICAgICAgdmFyIHJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICAgICAgICAgIHJlcXVlc3Qub3BlbignUE9TVCcsICdodHRwOi8vbG9jYWxob3N0OjMwMDAvdXBkYXRlJywgdHJ1ZSk7XG4gICAgICAgICAgICByZXF1ZXN0Lm9ubG9hZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBpZiAocmVxdWVzdC5zdGF0dXMgPT09IDIwMCkge1xuICAgICAgICAgICAgICAgICAgICBsb2NhdGlvbi5yZWxvYWQoKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnRmFpbGVkIHRvIHVwbG9hZCcpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlcXVlc3Quc2VuZChmb3JtRGF0YSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmb3JtRGF0YS5hcHBlbmQoJ2F1ZGlvJywgYmxvYiwgJ2F1ZGlvLndhdicpO1xuICAgICAgICAgICAgZm9ybURhdGEuYXBwZW5kKCd2aWRlbycsIGVuY29kZWRGaWxlLCAndmlkZW8ud2VibScpO1xuICAgICAgICAgICAgZm9ybURhdGEuYXBwZW5kKCdkYXRhJywganNvbiwgJ2NhcHRpcy5qc29uJyk7XG4gICAgICAgICAgICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgICAgICAgcmVxdWVzdC5vcGVuKCdQT1NUJywgJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMC9tZXJnZScsIHRydWUpO1xuICAgICAgICAgICAgcmVxdWVzdC5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgaWYgKHJlcXVlc3Quc3RhdHVzID09PSAyMDApIHtcbiAgICAgICAgICAgICAgICAgICAgbG9jYXRpb24ucmVsb2FkKCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0ZhaWxlZCB0byB1cGxvYWQnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXF1ZXN0LnNlbmQoZm9ybURhdGEpO1xuICAgICAgICB9XG4gICAgICAgIC8vIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0b29sYmFyJykuaW5uZXJIVE1MICs9IChcbiAgICAgICAgLy8gICAgICc8YSBpZD1cImNhcHRpc2xpbmtcIiBocmVmPVwiJysgdmlkZW9VcmwgKydcIiBkb3dubG9hZD1cInZpZGVvLndlYm1cIj4gXFxcbiAgICAgICAgLy8gICAgICAgICA8aSBjbGFzcz1cImZhIGZhLWZpbGUtdmlkZW8tb1wiPjwvaT4gXFxcbiAgICAgICAgLy8gICAgIDwvYT4gXFxcbiAgICAgICAgLy8gICAgIDxhIGlkPVwiY2FwdGlzbGlua1wiIGhyZWY9XCInKyBhdWRpb1VybCArJ1wiIGRvd25sb2FkPVwiYXVkaW8ud2F2XCI+IFxcXG4gICAgICAgIC8vICAgICAgICAgPGkgY2xhc3M9XCJmYSBmYS1maWxlLWF1ZGlvLW9cIj48L2k+IFxcXG4gICAgICAgIC8vICAgICA8L2E+IFxcXG4gICAgICAgIC8vICAgICA8YSBpZD1cImNhcHRpc2xpbmtcIiBocmVmPVwiJysganNvblVybCArJ1wiIGRvd25sb2FkPVwiY2FwdGlzLmpzb25cIj4gXFxcbiAgICAgICAgLy8gICAgICAgICA8aSBjbGFzcz1cImZhIGZhLWZpbGUtY29kZS1vXCI+PC9pPiBcXFxuICAgICAgICAvLyAgICAgPC9hPidcbiAgICAgICAgLy8gKTtcbiAgICAgICAgLy9yZWxvYWRFdmVudHMoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRlZmluZVNoaWZ0IChkdXJhdGlvbikge1xuICAgIGNvbnNvbGUubG9nKGR1cmF0aW9uKTtcbiAgICB2YXIgdGltZURpZmYgPSBjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHNbd2luZG93LnNlZ21lbnQgKyAxXS50aW1lc3RhbXAgLVxuICAgICAgICBjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHNbd2luZG93LnNlZ21lbnRdLnRpbWVzdGFtcCxcbiAgICAgICAgc2hpZnQgPSAwO1xuICAgIGlmIChkdXJhdGlvbiA8IHRpbWVEaWZmKSB7XG4gICAgICAgIHNoaWZ0ID0gdGltZURpZmYgLSBkdXJhdGlvbjtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChpIDw9IHdpbmRvdy5zZWdtZW50KSB7IGNvbnRpbnVlOyB9XG4gICAgICAgICAgICBjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHNbaV0udGltZXN0YW1wID1cbiAgICAgICAgICAgICAgICBjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHNbaV0udGltZXN0YW1wIC0gc2hpZnQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNhcHRpcy5wbGF5ZXIuanNvbi5zZWdtZW50cztcbiAgICB9XG4gICAgaWYgKGR1YXJ0aW9uID4gdGltZURpZmYpIHtcbiAgICAgICAgc2hpZnQgPSBkdWFydGlvbiAtIHRpbWVEaWZmO1xuICAgICAgICByZXR1cm4gc2hpZnQ7XG4gICAgfVxuICAgIHJldHVybiBzaGlmdDtcbn1cblxuLy93YXRjaGluZyBtb2RlXG5cbmZ1bmN0aW9uIGxvYWRWaWRlbyAoKSB7XG4gICAgdmFyIHJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICByZXF1ZXN0Lm9wZW4oJ0dFVCcsICdodHRwOi8vbG9jYWxob3N0OjMwMDAvbWVkaWEvY2FwdGlzLndlYm0nLCB0cnVlKTtcbiAgICByZXF1ZXN0LnJlc3BvbnNlVHlwZSA9IFwiYmxvYlwiO1xuICAgIHJlcXVlc3Qub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAocmVxdWVzdC5zdGF0dXMgPT09IDIwMCAmJiByZXF1ZXN0LnJlYWR5U3RhdGUgPT0gNCkge1xuICAgICAgICAgICAgY2FwdGlzLnBsYXllci5yZWFkeSA9IHRydWU7XG4gICAgICAgICAgICBjYXB0aXMucGxheWVyLm9iamVjdFVybCA9IHdpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKHRoaXMucmVzcG9uc2UpO1xuICAgICAgICAgICAgd2luZG93LnZpZGVvVVJMID0gY2FwdGlzLnBsYXllci5vYmplY3RVcmw7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmVxdWVzdC5zZW5kKCk7XG59XG5cbmZ1bmN0aW9uIGxvYWRTZWdtZW50cyAoKSB7XG4gICAgdmFyIHJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICByZXF1ZXN0Lm9wZW4oJ0dFVCcsICdodHRwOi8vbG9jYWxob3N0OjMwMDAvbWVkaWEvY2FwdGlzLmpzb24nLCB0cnVlKTtcbiAgICByZXF1ZXN0Lm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHJlcXVlc3Quc3RhdHVzID09PSAyMDAgJiYgcmVxdWVzdC5yZWFkeVN0YXRlID09IDQpIHtcbiAgICAgICAgICAgIGNhcHRpcy5zZWdtZW50cy5yZWFkeSA9IHRydWU7XG4gICAgICAgICAgICBjYXB0aXMucGxheWVyLmpzb24gPSBKU09OLnBhcnNlKHRoaXMucmVzcG9uc2UpO1xuICAgICAgICAgICAgd2luZG93LnNlZ21lbnRzID0gY2FwdGlzLnBsYXllci5qc29uLnNlZ21lbnRzO1xuICAgICAgICAgICAgd2luZG93LnNsaWRlcyA9IGNhcHRpcy5wbGF5ZXIuanNvbi5tZXRhO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoY2FwdGlzLnBsYXllci5zbGlkZXMuaW5kZXhPZihjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHNbaV0uc3RlcGlkKSA9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICBjYXB0aXMucGxheWVyLnNsaWRlcy5wdXNoKGNhcHRpcy5wbGF5ZXIuanNvbi5zZWdtZW50c1tpXS5zdGVwaWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXB0aXMucGxheWVyLnRpbWVzdGFtcHMucHVzaChjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHNbaV0udGltZXN0YW1wKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICByZXF1ZXN0LnNlbmQoKTtcbn1cblxuZnVuY3Rpb24gZmluaXNoV2F0Y2hpbmdNb2RlIChlKSB7XG4gICAgaWYgKGUuY3RybEtleSAmJiBlLmtleUNvZGUgPT0gODcgJiYgY2FwdGlzLnBsYXllci5yZWFkeSkge1xuICAgICAgICBjYXB0aXMucGxheWVyLmlzT24gPSB0cnVlO1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheWVyJykub3V0ZXJIVE1MID0gJyc7XG4gICAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2tleXVwJywgZmluaXNoV2F0Y2hpbmdNb2RlLCBmYWxzZSk7XG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleXVwJywgd2F0Y2hpbmdNb2RlLCBmYWxzZSk7XG4gICAgICAgIGxvY2F0aW9uLnJlbG9hZCgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gc2Vla1NlZ21lbnRzICh0aW1lKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjYXB0aXMucGxheWVyLnRpbWVzdGFtcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKHRpbWUgPCBjYXB0aXMucGxheWVyLnRpbWVzdGFtcHNbaV0pIHtcbiAgICAgICAgICAgIGNhcHRpcy5wbGF5ZXIuY3VycmVudFN0ZXAgPSBpIC0gMTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aW1lID4gY2FwdGlzLnBsYXllci50aW1lc3RhbXBzW2ldICYmIChjYXB0aXMucGxheWVyLnRpbWVzdGFtcHMubGVuZ3RoIC0gMSkgPT0gaSkge1xuICAgICAgICAgICAgY2FwdGlzLnBsYXllci5jdXJyZW50U3RlcCA9IGk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoY2FwdGlzLnBsYXllci5jdXJyZW50U3RlcCA9PSAtMSkge1xuICAgICAgICBpbXByZXNzKCkuZ290bygnb3ZlcnZpZXcnKTtcbiAgICAgICAgaW1wcmVzcygpLm5leHQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoY2FwdGlzLnBsYXllci5hY3RpdmVTdGVwICE9IGNhcHRpcy5wbGF5ZXIuY3VycmVudFN0ZXApIHtcbiAgICAgICAgICAgIHZhciBzbGlkZSA9IGNhcHRpcy5wbGF5ZXIuc2xpZGVzLmluZGV4T2YoXG4gICAgICAgICAgICAgICAgY2FwdGlzLnBsYXllci5qc29uLnNlZ21lbnRzW2NhcHRpcy5wbGF5ZXIuY3VycmVudFN0ZXBdLnN0ZXBpZFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGlmIChzbGlkZSA+IDApIHtcbiAgICAgICAgICAgICAgICBpbXByZXNzKCkuZ290byhjYXB0aXMucGxheWVyLnNsaWRlc1tzbGlkZSAtIDFdKTtcbiAgICAgICAgICAgICAgICBpbXByZXNzKCkubmV4dCgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpbXByZXNzKCkuZ290bygnb3ZlcnZpZXcnKTtcbiAgICAgICAgICAgICAgICBpbXByZXNzKCkubmV4dCgpO1xuICAgICAgICAgICAgICAgIGltcHJlc3MoKS5uZXh0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoY2FwdGlzLnBsYXllci5qc29uLnNlZ21lbnRzW2NhcHRpcy5wbGF5ZXIuY3VycmVudFN0ZXBdLm5leHQgPiAwKSB7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHNbY2FwdGlzLnBsYXllci5jdXJyZW50U3RlcF0ubmV4dDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGltcHJlc3MoKS5uZXh0KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGNhcHRpcy5wbGF5ZXIuanNvbi5zZWdtZW50c1tjYXB0aXMucGxheWVyLmN1cnJlbnRTdGVwXS5wcmV2ID49IDApIHtcbiAgICAgICAgICAgICAgICB2YXIgc3RlcCA9IGNhcHRpcy5wbGF5ZXIuanNvbi5tZXRhW1xuICAgICAgICAgICAgICAgICAgICBjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHNbY2FwdGlzLnBsYXllci5jdXJyZW50U3RlcF0uc3RlcGlkXG4gICAgICAgICAgICAgICAgXSAtIGNhcHRpcy5wbGF5ZXIuanNvbi5zZWdtZW50c1tjYXB0aXMucGxheWVyLmN1cnJlbnRTdGVwXS5wcmV2O1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc3RlcDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGltcHJlc3MoKS5uZXh0KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FwdGlzLnBsYXllci5hY3RpdmVTdGVwID0gY2FwdGlzLnBsYXllci5jdXJyZW50U3RlcDtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gY29udHJvbFNlZ21lbnRzIChlKSB7XG4gICAgdmFyIHZpZGVvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcHRpc19tYWRlJyksXG4gICAgICAgIHRpbWUgPSAwO1xuICAgIGlmIChlLmtleUNvZGUgPT0gMzkpIHtcbiAgICAgICAgY2FwdGlzLnBsYXllci5rZXlwcmVzc2VkID0gdHJ1ZTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjYXB0aXMucGxheWVyLnRpbWVzdGFtcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh2aWRlby5jdXJyZW50VGltZSA8IGNhcHRpcy5wbGF5ZXIudGltZXN0YW1wc1tpXSkge1xuICAgICAgICAgICAgICAgIHRpbWUgPSBjYXB0aXMucGxheWVyLnRpbWVzdGFtcHNbaV07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdmlkZW8uY3VycmVudFRpbWUgPSB0aW1lO1xuICAgIH1cbiAgICBpZiAoZS5rZXlDb2RlID09IDM3KSB7XG4gICAgICAgIGNhcHRpcy5wbGF5ZXIua2V5cHJlc3NlZCA9IHRydWU7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2FwdGlzLnBsYXllci50aW1lc3RhbXBzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodmlkZW8uY3VycmVudFRpbWUgPCBjYXB0aXMucGxheWVyLnRpbWVzdGFtcHNbaV0pIHtcbiAgICAgICAgICAgICAgICBpZiAoaS0yIDwgMCkge1xuICAgICAgICAgICAgICAgICAgICB0aW1lID0gMDtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZSA9IGNhcHRpcy5wbGF5ZXIudGltZXN0YW1wc1tpIC0gMl07XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB2aWRlby5jdXJyZW50VGltZSA9IHRpbWU7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBwbGF5VmlkZW8gKGUpIHtcbiAgICBlLnRhcmdldC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwYXVzZScpLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lJztcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgY29udHJvbFNlZ21lbnRzLCBmYWxzZSk7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BhdXNlJykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgcGF1c2VWaWRlbyxcbiAgICAgICAgZmFsc2VcbiAgICApO1xuICAgIHZhciB2aWRlbyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYXB0aXNfbWFkZScpLFxuICAgICAgICB0aW1lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwdGltZXInKSxcbiAgICAgICAgYnVmZiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwYnVmZmVyJyksXG4gICAgICAgIHBsYXliYXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheWJhcicpO1xuICAgIHZpZGVvLnBsYXkoKTtcbiAgICBjYXB0aXMucGxheWVyLnRpbWV1cGRhdGUgPSBzZXRJbnRlcnZhbChmdW5jdGlvbiAoKSB7XG4gICAgICAgIHNlZWtTZWdtZW50cyhNYXRoLmZsb29yKHZpZGVvLmN1cnJlbnRUaW1lKSk7XG4gICAgICAgIHRpbWVyLmlubmVySFRNTCA9IHRpbWVGb3JtYXQodmlkZW8uY3VycmVudFRpbWUpO1xuICAgICAgICBidWZmLnZhbHVlID0gdmlkZW8uY3VycmVudFRpbWUgKyA1O1xuICAgICAgICBwbGF5YmFyLnZhbHVlID0gdmlkZW8uY3VycmVudFRpbWU7XG4gICAgICAgIGlmICh2aWRlby5lbmRlZCkge3ZpZGVvT25FbmQoKTt9XG4gICAgfSwgMTAwMCk7XG59XG5cbmZ1bmN0aW9uIHBhdXNlVmlkZW8gKGUpIHtcbiAgICBjbGVhckludGVydmFsKGNhcHRpcy5wbGF5ZXIudGltZXVwZGF0ZSk7XG4gICAgdmFyIHZpZGVvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcHRpc19tYWRlJyk7XG4gICAgdmlkZW8ucGF1c2UoKTtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheScpLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lJztcbiAgICBlLnRhcmdldC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGF5JykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgcGxheVZpZGVvLFxuICAgICAgICBmYWxzZVxuICAgICk7XG59XG5cbmZ1bmN0aW9uIHZpZGVvT25FbmQgKCkge1xuICAgIHZhciB2aWRlbyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYXB0aXNfbWFkZScpLFxuICAgICAgICB0aW1lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwdGltZXInKSxcbiAgICAgICAgYnVmZiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwYnVmZmVyJyksXG4gICAgICAgIHBsYXliYXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheWJhcicpO1xuICAgIHZpZGVvLmN1cnJlbnRUaW1lID0gMDtcbiAgICB0aW1lci5pbm5lckhUTUwgPSAnMDA6MDA6MDAnO1xuICAgIGJ1ZmYudmFsdWUgPSAwO1xuICAgIHBsYXliYXIudmFsdWUgPSAwO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGF5Jykuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUnO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwYXVzZScpLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXknKS5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAnY2xpY2snLFxuICAgICAgICBwbGF5VmlkZW8sXG4gICAgICAgIGZhbHNlXG4gICAgKTtcbiAgICBjbGVhckludGVydmFsKGNhcHRpcy5wbGF5ZXIudGltZXVwZGF0ZSk7XG59XG5cbmZ1bmN0aW9uIHNldFZvbHVtZSAoZSkge1xuICAgIHZhciB2aWRlbyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYXB0aXNfbWFkZScpO1xuICAgIHZpZGVvLnZvbHVtZSA9IGUudGFyZ2V0LnZhbHVlO1xuICAgIGlmIChlLnRhcmdldC52YWx1ZSA9PSAxKSB7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoaWdodicpLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lJztcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvd3YnKS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnb2ZmdicpLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgfVxuICAgIGlmIChlLnRhcmdldC52YWx1ZSA8IDEgJiYgZS50YXJnZXQudmFsdWUgPiAwKSB7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoaWdodicpLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb3d2Jykuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUnO1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnb2ZmdicpLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgfVxuICAgIGlmIChlLnRhcmdldC52YWx1ZSA9PSAwKSB7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoaWdodicpLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb3d2Jykuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ29mZnYnKS5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZSc7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBzZWVrVmlkZW8gKGUpIHtcbiAgICBjbGVhckludGVydmFsKGNhcHRpcy5wbGF5ZXIudGltZXVwZGF0ZSk7XG4gICAgdmFyIHZpZGVvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcHRpc19tYWRlJyksXG4gICAgICAgIGJ1ZmYgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGJ1ZmZlcicpLFxuICAgICAgICB0aW1lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwdGltZXInKSxcbiAgICAgICAgcGxheWJhciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGF5YmFyJyk7XG4gICAgdmlkZW8ucGF1c2UoKTtcbiAgICB2aWRlby5jdXJyZW50VGltZSA9IGUudGFyZ2V0LnZhbHVlO1xuICAgIHZpZGVvLnBsYXkoKTtcbiAgICBjYXB0aXMucGxheWVyLnRpbWV1cGRhdGUgPSBzZXRJbnRlcnZhbChmdW5jdGlvbiAoKSB7XG4gICAgICAgIHNlZWtTZWdtZW50cyhNYXRoLmZsb29yKHZpZGVvLmN1cnJlbnRUaW1lKSk7XG4gICAgICAgIHRpbWVyLmlubmVySFRNTCA9IHRpbWVGb3JtYXQodmlkZW8uY3VycmVudFRpbWUpO1xuICAgICAgICBidWZmLnZhbHVlID0gdmlkZW8uY3VycmVudFRpbWUgKyA1O1xuICAgICAgICBwbGF5YmFyLnZhbHVlID0gdmlkZW8uY3VycmVudFRpbWU7XG4gICAgICAgIGlmICh2aWRlby5lbmRlZCkge3ZpZGVvT25FbmQoKTt9XG4gICAgfSwgMTAwMCk7XG59XG5cbmZ1bmN0aW9uIGZ1bGxTY3JlZW4gKGUpIHtcbiAgICB2YXIgdmlkZW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FwdGlzX21hZGUnKTtcbiAgICBpZiAodmlkZW8ud2Via2l0UmVxdWVzdEZ1bGxzY3JlZW4pIHtcbiAgICAgICAgZS50YXJnZXQuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZXhpdGZ1bGxzJykuc3R5bGUuZGlzcGxheSA9IFwiaW5saW5lXCI7XG4gICAgICAgIHZpZGVvLndlYmtpdFJlcXVlc3RGdWxsc2NyZWVuKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBleGl0RnVsbFNjcmVlbiAoZSkge1xuICAgIGlmIChkb2N1bWVudC53ZWJraXRFeGl0RnVsbHNjcmVlbikge1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZnVsbHMnKS5zdHlsZS5kaXNwbGF5ID0gXCJpbmxpbmVcIjtcbiAgICAgICAgZS50YXJnZXQuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuICAgICAgICBkb2N1bWVudC53ZWJraXRFeGl0RnVsbHNjcmVlbigpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gd2F0Y2hpbmdNb2RlIChlKSB7XG4gICAgaWYgKGUuY3RybEtleSAmJiBlLmtleUNvZGUgPT0gODcgJiYgY2FwdGlzLnBsYXllci5yZWFkeSAmJiBjYXB0aXMuc2VnbWVudHMucmVhZHkpIHtcbiAgICAgICAgaW1wcmVzcygpLmdvdG8oY2FwdGlzLnBsYXllci5qc29uLnNlZ21lbnRzWzBdLnN0ZXBpZCk7XG4gICAgICAgIGltcHJlc3MoKS5wcmV2KCk7XG4gICAgICAgIGNhcHRpcy5wbGF5ZXIuaXNPbiA9IHRydWU7XG4gICAgICAgIGlmIChjYXB0aXMudG9vbGJhcikge1xuICAgICAgICAgICAgY2xlYXJTcGFjZSgpO1xuICAgICAgICB9XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYXB0aXMnKS5pbm5lckhUTUwgKz0gKFxuICAgICAgICAgICAgJzxkaXYgaWQ9XCJwbGF5ZXJcIj4gXFxcbiAgICAgICAgICAgICAgICA8dmlkZW8gaWQ9XCJjYXB0aXNfbWFkZVwiIHByZWxvYWQ+PC92aWRlbz4gXFxcbiAgICAgICAgICAgICAgICA8ZGl2IGlkPVwiY2FwdGlzX2NvbnRyb2xzXCI+IFxcXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgaWQ9XCJjYXB0aXNfcGxheWVyXCI+IFxcXG4gICAgICAgICAgICAgICAgICAgICAgICA8aSBpZD1cInBsYXlcIiBjbGFzcz1cImZhIGZhLXBsYXkgY2FwdGlzX2ljb25cIj48L2k+IFxcXG4gICAgICAgICAgICAgICAgICAgICAgICA8aSBpZD1cInBhdXNlXCIgY2xhc3M9XCJmYSBmYS1wYXVzZSBjYXB0aXNfaWNvblwiPjwvaT4gXFxcbiAgICAgICAgICAgICAgICAgICAgICAgIDxjYW52YXMgaWQ9XCJzZWdtZW50c1wiPjwvY2FudmFzPiBcXFxuICAgICAgICAgICAgICAgICAgICAgICAgPHByb2dyZXNzIHZhbHVlPVwiMFwiIGlkPVwicGJ1ZmZlclwiPjwvcHJvZ3Jlc3M+IFxcXG4gICAgICAgICAgICAgICAgICAgICAgICA8aW5wdXQgdHlwZT1cInJhbmdlXCIgaWQ9XCJwbGF5YmFyXCIgdmFsdWU9XCIwXCI+IFxcXG4gICAgICAgICAgICAgICAgICAgICAgICA8aSBpZD1cInB0aW1lclwiPjAwOjAwOjAwPC9pPiBcXFxuICAgICAgICAgICAgICAgICAgICAgICAgPGkgaWQ9XCJoaWdodlwiIGNsYXNzPVwiZmEgZmEtdm9sdW1lLXVwIGNhcHRpc19pY29uXCI+PC9pPiBcXFxuICAgICAgICAgICAgICAgICAgICAgICAgPGkgaWQ9XCJsb3d2XCIgY2xhc3M9XCJmYSBmYS12b2x1bWUtZG93biBjYXB0aXNfaWNvblwiPjwvaT4gXFxcbiAgICAgICAgICAgICAgICAgICAgICAgIDxpIGlkPVwib2ZmdlwiIGNsYXNzPVwiZmEgZmEtdm9sdW1lLW9mZiBjYXB0aXNfaWNvblwiPjwvaT4gXFxcbiAgICAgICAgICAgICAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwicmFuZ2VcIiBpZD1cInZvbHVtZVwiIG1pbj1cIjBcIiBtYXg9XCIxXCIgc3RlcD1cIjAuMVwiIHZhbHVlPVwiMVwiPiBcXFxuICAgICAgICAgICAgICAgICAgICAgICAgPGkgaWQ9XCJmdWxsc1wiIGNsYXNzPVwiZmEgZmEtZXllIGNhcHRpc19pY29uXCI+PC9pPiBcXFxuICAgICAgICAgICAgICAgICAgICAgICAgPGkgaWQ9XCJleGl0ZnVsbHNcIiBjbGFzcz1cImZhIGZhLWV5ZS1zbGFzaCBjYXB0aXNfaWNvblwiPjwvaT4gXFxcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+IFxcXG4gICAgICAgICAgICAgICAgPC9kaXY+IFxcXG4gICAgICAgICAgICA8L2Rpdj4nXG4gICAgICAgICk7XG4gICAgICAgIHZhciB2aWRlbyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYXB0aXNfbWFkZScpO1xuICAgICAgICB2aWRlby5zcmMgPSBjYXB0aXMucGxheWVyLm9iamVjdFVybDtcbiAgICAgICAgdmlkZW8uYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGJ1ZmZlcicpLnNldEF0dHJpYnV0ZShcbiAgICAgICAgICAgICAgICBcIm1heFwiLFxuICAgICAgICAgICAgICAgIE1hdGguZmxvb3IodmlkZW8uZHVyYXRpb24pXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXliYXInKS5zZXRBdHRyaWJ1dGUoXG4gICAgICAgICAgICAgICAgXCJtYXhcIixcbiAgICAgICAgICAgICAgICBNYXRoLmZsb29yKHZpZGVvLmR1cmF0aW9uKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHZhciBjYW52YXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2VnbWVudHMnKSxcbiAgICAgICAgICAgICAgICBjdHggPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKSxcbiAgICAgICAgICAgICAgICByYXRpbyA9IGNhbnZhcy53aWR0aCAvIHZpZGVvLmR1cmF0aW9uLFxuICAgICAgICAgICAgICAgIHBvc2l0aW9uID0gMCxcbiAgICAgICAgICAgICAgICBzZWdtZW50V2lkdGggPSAwO1xuICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXknKS5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgICAgICdjbGljaycsXG4gICAgICAgICAgICAgICAgcGxheVZpZGVvLFxuICAgICAgICAgICAgICAgIGZhbHNlXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2V4aXRmdWxscycpLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgICAgICAgICBleGl0RnVsbFNjcmVlbixcbiAgICAgICAgICAgICAgICBmYWxzZVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmdWxscycpLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgICAgICAgICBmdWxsU2NyZWVuLFxuICAgICAgICAgICAgICAgIGZhbHNlXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3ZvbHVtZScpLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgICAgICAgJ2NoYW5nZScsXG4gICAgICAgICAgICAgICAgc2V0Vm9sdW1lLFxuICAgICAgICAgICAgICAgIGZhbHNlXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXliYXInKS5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgICAgICdjaGFuZ2UnLFxuICAgICAgICAgICAgICAgIHNlZWtWaWRlbyxcbiAgICAgICAgICAgICAgICBmYWxzZVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2FwdGlzLnBsYXllci50aW1lc3RhbXBzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgc2VnbWVudFdpZHRoID0gTWF0aC5mbG9vcihjYXB0aXMucGxheWVyLnRpbWVzdGFtcHNbaV0gKiByYXRpbykgLSAxO1xuICAgICAgICAgICAgICAgIGN0eC5maWxsU3R5bGUgPSAnIzEzQUQ4Nyc7XG4gICAgICAgICAgICAgICAgY3R4LmZpbGxSZWN0KHBvc2l0aW9uLCAwLCBzZWdtZW50V2lkdGgsIGNhbnZhcy5oZWlnaHQpO1xuICAgICAgICAgICAgICAgIGN0eC5maWxsU3R5bGUgPSAnI0ZGRic7XG4gICAgICAgICAgICAgICAgY3R4LmZpbGxSZWN0KHNlZ21lbnRXaWR0aCwgMCwgMSwgY2FudmFzLmhlaWdodCk7XG4gICAgICAgICAgICAgICAgcG9zaXRpb24gPSBzZWdtZW50V2lkdGggKyAxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5dXAnLCB3YXRjaGluZ01vZGUsIGZhbHNlKTtcbiAgICAgICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleXVwJywgZmluaXNoV2F0Y2hpbmdNb2RlLCBmYWxzZSk7XG4gICAgICAgIH0pO1xuICAgIH1cbn1cblxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignaW1wcmVzczpzdGVwZW50ZXInLCBmdW5jdGlvbiAoZSkge1xuICAgIGNhcHRpcy5pbXByZXNzLmlzU3RlcCA9IHRydWU7XG4gICAgY2FwdGlzLmltcHJlc3Muc3RlcCA9IGUudGFyZ2V0LmlkO1xufSwgZmFsc2UpO1xuXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXl1cCcsIGluaXRpYWxpemVUb29sYmFyLCBmYWxzZSk7XG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXl1cCcsIHdhdGNoaW5nTW9kZSwgZmFsc2UpO1xuXG5sb2FkVmlkZW8oKTtcbmxvYWRTZWdtZW50cygpO1xuIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuKGZ1bmN0aW9uIGJyb3dzZXJpZnlTaGltKG1vZHVsZSwgZXhwb3J0cywgZGVmaW5lLCBicm93c2VyaWZ5X3NoaW1fX2RlZmluZV9fbW9kdWxlX19leHBvcnRfXykge1xudmFyIGluaXRpYWxpemVFZGl0b3IgPSBmdW5jdGlvbigpIHtcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FwdGlzJykuaW5uZXJIVE1MICs9IChcbiAgICAgICAgJzxkaXYgaWQ9XCJjYXB0aXNfZWRpdG9yXCI+IFxcXG4gICAgICAgICAgICA8ZGl2IGlkPVwibG9hZGluZ1wiPjxwcm9ncmVzcyBpZD1cImxvYWRpbmdfc2VnbWVudHNcIiB2YWx1ZT1cIjBcIj48L3Byb2dyZXNzPjwvZGl2PiBcXFxuICAgICAgICAgICAgPHZpZGVvIGlkPVwiZWRpdF92aWRlb1wiIHByZWxvYWQgYXV0b3BsYXkgbXV0ZWQ+PC92aWRlbz4gXFxcbiAgICAgICAgICAgIDxkaXYgaWQ9XCJzZWdtZW50X2NvbnRcIj48ZGl2IGlkPVwiY2FwdGlzX2VkaXRvcl9zZWdtZW50c1wiPjwvZGl2PjwvZGl2PiBcXFxuICAgICAgICAgICAgPGNhbnZhcyBpZD1cInNlZ21lbnRzaG90XCI+PC9jYW52YXM+IFxcXG4gICAgICAgIDwvZGl2PidcbiAgICApO1xuICAgIHZhciB2aWRlbyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdlZGl0X3ZpZGVvJyksXG4gICAgICAgIHBhcnRzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcHRpc19lZGl0b3Jfc2VnbWVudHMnKSxcbiAgICAgICAgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NlZ21lbnRfY29udCcpLFxuICAgICAgICBsb2FkZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9hZGluZ19zZWdtZW50cycpLFxuICAgICAgICBsb2FkaW5nID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvYWRpbmcnKSxcbiAgICAgICAgY2FudmFzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NlZ21lbnRzaG90JyksXG4gICAgICAgIGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuICAgICAgICBjYW52YXMud2lkdGggPSAxMzA7XG4gICAgICAgIGNhbnZhcy5oZWlnaHQgPSAxMzA7XG4gICAgcGFydHMuaW5uZXJIVE1MID0gJyc7XG4gICAgdmlkZW8uc3JjID0gd2luZG93LnZpZGVvVVJMO1xuICAgIGNvbnNvbGUubG9nKHdpbmRvdy5zZWdtZW50cyk7XG4gICAgbG9hZGVyLnNldEF0dHJpYnV0ZSgnbWF4Jywgd2luZG93LnNlZ21lbnRzLmxlbmd0aCAtIDEpO1xuICAgIHZpZGVvLm9ubG9hZGVkbWV0YWRhdGEgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBpID0gMDtcbiAgICAgICAgdmFyIGxvb3AgPSBzZXRJbnRlcnZhbChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIC8vY29uc29sZS5sb2cod2luZG93LnNlZ21lbnRzW2ldKTtcbiAgICAgICAgICAgIHBhcnRzLmlubmVySFRNTCArPSAoXG4gICAgICAgICAgICAgICAgJzxkaXYgY2xhc3M9XCJzZWdtZW50X2JveFwiIGlkPVwic2VnbWVudF8nKyBpICsnXCI+IFxcXG4gICAgICAgICAgICAgICAgICAgIDxpIGNsYXNzPVwic2VnbWVudF90aW1lXCI+Jysgd2luZG93LmZvcm1hdER1cmF0aW9uKHdpbmRvdy5zZWdtZW50c1tpXS50aW1lc3RhbXApICsnPC9pPiBcXFxuICAgICAgICAgICAgICAgIDwvZGl2PidcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICB2aWRlby5jdXJyZW50VGltZSA9IHdpbmRvdy5zZWdtZW50c1tpXS50aW1lc3RhbXA7XG4gICAgICAgICAgICBjdHguZHJhd0ltYWdlKHZpZGVvLCAwLCAwLCAxMzAsIDEzMCk7XG4gICAgICAgICAgICB2YXIgaW1hZ2UgPSBjYW52YXMudG9EYXRhVVJMKCksXG4gICAgICAgICAgICAgICAgYm94ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NlZ21lbnRfJyArIGkpO1xuICAgICAgICAgICAgLy9jb25zb2xlLmxvZyhpbWFnZSk7XG4gICAgICAgICAgICBib3guc3R5bGUuYmFja2dyb3VuZEltYWdlID0gJ3VybCgnICsgaW1hZ2UgKyAnKSc7XG4gICAgICAgICAgICBsb2FkZXIudmFsdWUgPSBpO1xuICAgICAgICAgICAgaSsrO1xuICAgICAgICAgICAgaWYgKGkgPT0gd2luZG93LnNlZ21lbnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIC8vcGFydHMuc3R5bGUuaGVpZ2h0ID0gMTIwICogd2luZG93LnNlZ21lbnRzLmxlbmd0aCArICdweCc7XG4gICAgICAgICAgICAgICAgY29udGFpbmVyLnN0eWxlLndpZHRoID0gJzEzMHB4JztcbiAgICAgICAgICAgICAgICBsb2FkaW5nLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgICAgICAgICAgdmlkZW8uc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG4gICAgICAgICAgICAgICAgdmlkZW8ucGF1c2UoKTtcbiAgICAgICAgICAgICAgICB2aWRlby5jdXJyZW50VGltZSA9IDA7XG4gICAgICAgICAgICAgICAgY2xlYXJJbnRlcnZhbChsb29wKTtcbiAgICAgICAgICAgICAgICB2YXIgZWxlbWVudHMgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKCdzZWdtZW50X2JveCcpO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgZWxlbWVudHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudHNbal0uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBlZGl0b3JQbGF5U2VnbWVudCwgZmFsc2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKGVsZW1lbnRzKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0sIDEwMCk7XG4gICAgfTtcbiAgICB3aW5kb3cucmVsb2FkRXZlbnRzKCk7XG5cbn1cblxudmFyIGVkaXRvclBsYXlTZWdtZW50ID0gZnVuY3Rpb24gKCkge1xuICAgIHZpZGVvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2VkaXRfdmlkZW8nKTtcbiAgICB2YXIgaW5kZXggPSBwYXJzZUludCh0aGlzLmlkLnNwbGl0KCdfJylbMV0pO1xuICAgIHdpbmRvdy5zZWdtZW50ID0gaW5kZXg7XG4gICAgd2luZG93LmNhblVwZGF0ZSA9IHRydWU7XG4gICAgdmlkZW8uY3VycmVudFRpbWUgPSB3aW5kb3cuc2VnbWVudHNbaW5kZXhdLnRpbWVzdGFtcDtcbiAgICB2aWRlby5tdXRlZCA9IGZhbHNlO1xuICAgIGltcHJlc3MoKS5nb3RvKCdvdmVydmlldycpO1xuICAgIGltcHJlc3MoKS5nb3RvKHdpbmRvdy5zZWdtZW50c1tpbmRleF0uc3RlcGlkKTtcbiAgICAvL1RPRE86IEFsbCBjYXNlc1xuICAgIGlmICh3aW5kb3cuc2VnbWVudHNbaW5kZXhdLm5leHQpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB3aW5kb3cuc2VnbWVudHNbaW5kZXhdLm5leHQ7IGkrKykge1xuICAgICAgICAgICAgaW1wcmVzcygpLm5leHQoKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAod2luZG93LnNlZ21lbnRzW2luZGV4XS5wcmV2KSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgd2luZG93LnNlZ21lbnRzW2luZGV4XS5wcmV2OyBpKyspIHtcbiAgICAgICAgICAgIGltcHJlc3MoKS5wcmV2KCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgY29uc29sZS5sb2cod2luZG93LnNsaWRlcywgd2luZG93LnNlZ21lbnRzW2luZGV4XSk7XG4gICAgdmlkZW8ucGxheSgpO1xuXG59XG5cbmV4cG9ydHMuaW5pdGlhbGl6ZUVkaXRvciA9IGluaXRpYWxpemVFZGl0b3I7XG5cbjsgYnJvd3NlcmlmeV9zaGltX19kZWZpbmVfX21vZHVsZV9fZXhwb3J0X18odHlwZW9mIEVkaXRvciAhPSBcInVuZGVmaW5lZFwiID8gRWRpdG9yIDogd2luZG93LkVkaXRvcik7XG5cbn0pLmNhbGwoZ2xvYmFsLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBmdW5jdGlvbiBkZWZpbmVFeHBvcnQoZXgpIHsgbW9kdWxlLmV4cG9ydHMgPSBleDsgfSk7XG5cbn0pLmNhbGwodGhpcyx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuKGZ1bmN0aW9uIGJyb3dzZXJpZnlTaGltKG1vZHVsZSwgZXhwb3J0cywgZGVmaW5lLCBicm93c2VyaWZ5X3NoaW1fX2RlZmluZV9fbW9kdWxlX19leHBvcnRfXykge1xuLypcbiAgICB2YXIgdmlkID0gbmV3IFdoYW1teS5WaWRlbygpO1xuICAgIHZpZC5hZGQoY2FudmFzIG9yIGRhdGEgdXJsKVxuICAgIHZpZC5jb21waWxlKClcbiovXG5cblxudmFyIFdoYW1teSA9IChmdW5jdGlvbigpe1xuICAgIC8vIGluIHRoaXMgY2FzZSwgZnJhbWVzIGhhcyBhIHZlcnkgc3BlY2lmaWMgbWVhbmluZywgd2hpY2ggd2lsbCBiZVxuICAgIC8vIGRldGFpbGVkIG9uY2UgaSBmaW5pc2ggd3JpdGluZyB0aGUgY29kZVxuXG4gICAgZnVuY3Rpb24gdG9XZWJNKGZyYW1lcywgb3V0cHV0QXNBcnJheSl7XG4gICAgICAgIHZhciBpbmZvID0gY2hlY2tGcmFtZXMoZnJhbWVzKTtcblxuICAgICAgICAvL21heCBkdXJhdGlvbiBieSBjbHVzdGVyIGluIG1pbGxpc2Vjb25kc1xuICAgICAgICB2YXIgQ0xVU1RFUl9NQVhfRFVSQVRJT04gPSAzMDAwMDtcblxuICAgICAgICB2YXIgRUJNTCA9IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBcImlkXCI6IDB4MWE0NWRmYTMsIC8vIEVCTUxcbiAgICAgICAgICAgICAgICBcImRhdGFcIjogW1xuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogMSxcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHg0Mjg2IC8vIEVCTUxWZXJzaW9uXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiAxLFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDQyZjcgLy8gRUJNTFJlYWRWZXJzaW9uXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiA0LFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDQyZjIgLy8gRUJNTE1heElETGVuZ3RoXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiA4LFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDQyZjMgLy8gRUJNTE1heFNpemVMZW5ndGhcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IFwid2VibVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDQyODIgLy8gRG9jVHlwZVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogMixcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHg0Mjg3IC8vIERvY1R5cGVWZXJzaW9uXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiAyLFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDQyODUgLy8gRG9jVHlwZVJlYWRWZXJzaW9uXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIFwiaWRcIjogMHgxODUzODA2NywgLy8gU2VnbWVudFxuICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBbXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHgxNTQ5YTk2NiwgLy8gSW5mb1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiAxZTYsIC8vZG8gdGhpbmdzIGluIG1pbGxpc2VjcyAobnVtIG9mIG5hbm9zZWNzIGZvciBkdXJhdGlvbiBzY2FsZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDJhZDdiMSAvLyBUaW1lY29kZVNjYWxlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBcIndoYW1teVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4NGQ4MCAvLyBNdXhpbmdBcHBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IFwid2hhbW15XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHg1NzQxIC8vIFdyaXRpbmdBcHBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IGRvdWJsZVRvU3RyaW5nKGluZm8uZHVyYXRpb24pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4NDQ4OSAvLyBEdXJhdGlvblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDE2NTRhZTZiLCAvLyBUcmFja3NcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4YWUsIC8vIFRyYWNrRW50cnlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogMSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4ZDcgLy8gVHJhY2tOdW1iZXJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IDEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDYzYzUgLy8gVHJhY2tVSURcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDljIC8vIEZsYWdMYWNpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IFwidW5kXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDIyYjU5YyAvLyBMYW5ndWFnZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogXCJWX1ZQOFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHg4NiAvLyBDb2RlY0lEXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBcIlZQOFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHgyNTg2ODggLy8gQ29kZWNOYW1lXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiAxLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHg4MyAvLyBUcmFja1R5cGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweGUwLCAgLy8gVmlkZW9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogaW5mby53aWR0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHhiMCAvLyBQaXhlbFdpZHRoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBpbmZvLmhlaWdodCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHhiYSAvLyBQaXhlbEhlaWdodFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgICAgICAgIC8vY2x1c3RlciBpbnNlcnRpb24gcG9pbnRcbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9XG4gICAgICAgICBdO1xuXG5cbiAgICAgICAgLy9HZW5lcmF0ZSBjbHVzdGVycyAobWF4IGR1cmF0aW9uKVxuICAgICAgICB2YXIgZnJhbWVOdW1iZXIgPSAwO1xuICAgICAgICB2YXIgY2x1c3RlclRpbWVjb2RlID0gMDtcbiAgICAgICAgd2hpbGUoZnJhbWVOdW1iZXIgPCBmcmFtZXMubGVuZ3RoKXtcblxuICAgICAgICAgICAgdmFyIGNsdXN0ZXJGcmFtZXMgPSBbXTtcbiAgICAgICAgICAgIHZhciBjbHVzdGVyRHVyYXRpb24gPSAwO1xuICAgICAgICAgICAgZG8ge1xuICAgICAgICAgICAgICAgIGNsdXN0ZXJGcmFtZXMucHVzaChmcmFtZXNbZnJhbWVOdW1iZXJdKTtcbiAgICAgICAgICAgICAgICBjbHVzdGVyRHVyYXRpb24gKz0gZnJhbWVzW2ZyYW1lTnVtYmVyXS5kdXJhdGlvbjtcbiAgICAgICAgICAgICAgICBmcmFtZU51bWJlcisrO1xuICAgICAgICAgICAgfXdoaWxlKGZyYW1lTnVtYmVyIDwgZnJhbWVzLmxlbmd0aCAmJiBjbHVzdGVyRHVyYXRpb24gPCBDTFVTVEVSX01BWF9EVVJBVElPTik7XG5cbiAgICAgICAgICAgIHZhciBjbHVzdGVyQ291bnRlciA9IDA7XG4gICAgICAgICAgICB2YXIgY2x1c3RlciA9IHtcbiAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDFmNDNiNjc1LCAvLyBDbHVzdGVyXG4gICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IGNsdXN0ZXJUaW1lY29kZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4ZTcgLy8gVGltZWNvZGVcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgXS5jb25jYXQoY2x1c3RlckZyYW1lcy5tYXAoZnVuY3Rpb24od2VicCl7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgYmxvY2sgPSBtYWtlU2ltcGxlQmxvY2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpc2NhcmRhYmxlOiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lOiB3ZWJwLmRhdGEuc2xpY2UoNCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW52aXNpYmxlOiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleWZyYW1lOiAxLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhY2luZzogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cmFja051bTogMSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aW1lY29kZTogTWF0aC5yb3VuZChjbHVzdGVyQ291bnRlcilcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2x1c3RlckNvdW50ZXIgKz0gd2VicC5kdXJhdGlvbjtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YTogYmxvY2ssXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWQ6IDB4YTNcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIH0pKVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy9BZGQgY2x1c3RlciB0byBzZWdtZW50XG4gICAgICAgICAgICBFQk1MWzFdLmRhdGEucHVzaChjbHVzdGVyKTtcbiAgICAgICAgICAgIGNsdXN0ZXJUaW1lY29kZSArPSBjbHVzdGVyRHVyYXRpb247XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZ2VuZXJhdGVFQk1MKEVCTUwsIG91dHB1dEFzQXJyYXkpXG4gICAgfVxuXG4gICAgLy8gc3VtcyB0aGUgbGVuZ3RocyBvZiBhbGwgdGhlIGZyYW1lcyBhbmQgZ2V0cyB0aGUgZHVyYXRpb24sIHdvb1xuXG4gICAgZnVuY3Rpb24gY2hlY2tGcmFtZXMoZnJhbWVzKXtcbiAgICAgICAgdmFyIHdpZHRoID0gZnJhbWVzWzBdLndpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0ID0gZnJhbWVzWzBdLmhlaWdodCxcbiAgICAgICAgICAgIGR1cmF0aW9uID0gZnJhbWVzWzBdLmR1cmF0aW9uO1xuICAgICAgICBmb3IodmFyIGkgPSAxOyBpIDwgZnJhbWVzLmxlbmd0aDsgaSsrKXtcbiAgICAgICAgICAgIGlmKGZyYW1lc1tpXS53aWR0aCAhPSB3aWR0aCkgdGhyb3cgXCJGcmFtZSBcIiArIChpICsgMSkgKyBcIiBoYXMgYSBkaWZmZXJlbnQgd2lkdGhcIjtcbiAgICAgICAgICAgIGlmKGZyYW1lc1tpXS5oZWlnaHQgIT0gaGVpZ2h0KSB0aHJvdyBcIkZyYW1lIFwiICsgKGkgKyAxKSArIFwiIGhhcyBhIGRpZmZlcmVudCBoZWlnaHRcIjtcbiAgICAgICAgICAgIGlmKGZyYW1lc1tpXS5kdXJhdGlvbiA8IDAgfHwgZnJhbWVzW2ldLmR1cmF0aW9uID4gMHg3ZmZmKSB0aHJvdyBcIkZyYW1lIFwiICsgKGkgKyAxKSArIFwiIGhhcyBhIHdlaXJkIGR1cmF0aW9uIChtdXN0IGJlIGJldHdlZW4gMCBhbmQgMzI3NjcpXCI7XG4gICAgICAgICAgICBkdXJhdGlvbiArPSBmcmFtZXNbaV0uZHVyYXRpb247XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGR1cmF0aW9uOiBkdXJhdGlvbixcbiAgICAgICAgICAgIHdpZHRoOiB3aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogaGVpZ2h0XG4gICAgICAgIH07XG4gICAgfVxuXG5cbiAgICBmdW5jdGlvbiBudW1Ub0J1ZmZlcihudW0pe1xuICAgICAgICB2YXIgcGFydHMgPSBbXTtcbiAgICAgICAgd2hpbGUobnVtID4gMCl7XG4gICAgICAgICAgICBwYXJ0cy5wdXNoKG51bSAmIDB4ZmYpXG4gICAgICAgICAgICBudW0gPSBudW0gPj4gOFxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXcgVWludDhBcnJheShwYXJ0cy5yZXZlcnNlKCkpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHN0clRvQnVmZmVyKHN0cil7XG4gICAgICAgIC8vIHJldHVybiBuZXcgQmxvYihbc3RyXSk7XG5cbiAgICAgICAgdmFyIGFyciA9IG5ldyBVaW50OEFycmF5KHN0ci5sZW5ndGgpO1xuICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKXtcbiAgICAgICAgICAgIGFycltpXSA9IHN0ci5jaGFyQ29kZUF0KGkpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGFycjtcbiAgICAgICAgLy8gdGhpcyBpcyBzbG93ZXJcbiAgICAgICAgLy8gcmV0dXJuIG5ldyBVaW50OEFycmF5KHN0ci5zcGxpdCgnJykubWFwKGZ1bmN0aW9uKGUpe1xuICAgICAgICAvLyAgcmV0dXJuIGUuY2hhckNvZGVBdCgwKVxuICAgICAgICAvLyB9KSlcbiAgICB9XG5cblxuICAgIC8vc29ycnkgdGhpcyBpcyB1Z2x5LCBhbmQgc29ydCBvZiBoYXJkIHRvIHVuZGVyc3RhbmQgZXhhY3RseSB3aHkgdGhpcyB3YXMgZG9uZVxuICAgIC8vIGF0IGFsbCByZWFsbHksIGJ1dCB0aGUgcmVhc29uIGlzIHRoYXQgdGhlcmUncyBzb21lIGNvZGUgYmVsb3cgdGhhdCBpIGRvbnQgcmVhbGx5XG4gICAgLy8gZmVlbCBsaWtlIHVuZGVyc3RhbmRpbmcsIGFuZCB0aGlzIGlzIGVhc2llciB0aGFuIHVzaW5nIG15IGJyYWluLlxuXG4gICAgZnVuY3Rpb24gYml0c1RvQnVmZmVyKGJpdHMpe1xuICAgICAgICB2YXIgZGF0YSA9IFtdO1xuICAgICAgICB2YXIgcGFkID0gKGJpdHMubGVuZ3RoICUgOCkgPyAobmV3IEFycmF5KDEgKyA4IC0gKGJpdHMubGVuZ3RoICUgOCkpKS5qb2luKCcwJykgOiAnJztcbiAgICAgICAgYml0cyA9IHBhZCArIGJpdHM7XG4gICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBiaXRzLmxlbmd0aDsgaSs9IDgpe1xuICAgICAgICAgICAgZGF0YS5wdXNoKHBhcnNlSW50KGJpdHMuc3Vic3RyKGksOCksMikpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ldyBVaW50OEFycmF5KGRhdGEpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdlbmVyYXRlRUJNTChqc29uLCBvdXRwdXRBc0FycmF5KXtcbiAgICAgICAgdmFyIGVibWwgPSBbXTtcbiAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IGpzb24ubGVuZ3RoOyBpKyspe1xuICAgICAgICAgICAgdmFyIGRhdGEgPSBqc29uW2ldLmRhdGE7XG4gICAgICAgICAgICBpZih0eXBlb2YgZGF0YSA9PSAnb2JqZWN0JykgZGF0YSA9IGdlbmVyYXRlRUJNTChkYXRhLCBvdXRwdXRBc0FycmF5KTtcbiAgICAgICAgICAgIGlmKHR5cGVvZiBkYXRhID09ICdudW1iZXInKSBkYXRhID0gYml0c1RvQnVmZmVyKGRhdGEudG9TdHJpbmcoMikpO1xuICAgICAgICAgICAgaWYodHlwZW9mIGRhdGEgPT0gJ3N0cmluZycpIGRhdGEgPSBzdHJUb0J1ZmZlcihkYXRhKTtcblxuICAgICAgICAgICAgaWYoZGF0YS5sZW5ndGgpe1xuICAgICAgICAgICAgICAgIHZhciB6ID0gejtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGxlbiA9IGRhdGEuc2l6ZSB8fCBkYXRhLmJ5dGVMZW5ndGggfHwgZGF0YS5sZW5ndGg7XG4gICAgICAgICAgICB2YXIgemVyb2VzID0gTWF0aC5jZWlsKE1hdGguY2VpbChNYXRoLmxvZyhsZW4pL01hdGgubG9nKDIpKS84KTtcbiAgICAgICAgICAgIHZhciBzaXplX3N0ciA9IGxlbi50b1N0cmluZygyKTtcbiAgICAgICAgICAgIHZhciBwYWRkZWQgPSAobmV3IEFycmF5KCh6ZXJvZXMgKiA3ICsgNyArIDEpIC0gc2l6ZV9zdHIubGVuZ3RoKSkuam9pbignMCcpICsgc2l6ZV9zdHI7XG4gICAgICAgICAgICB2YXIgc2l6ZSA9IChuZXcgQXJyYXkoemVyb2VzKSkuam9pbignMCcpICsgJzEnICsgcGFkZGVkO1xuXG4gICAgICAgICAgICAvL2kgYWN0dWFsbHkgZG9udCBxdWl0ZSB1bmRlcnN0YW5kIHdoYXQgd2VudCBvbiB1cCB0aGVyZSwgc28gSSdtIG5vdCByZWFsbHlcbiAgICAgICAgICAgIC8vZ29pbmcgdG8gZml4IHRoaXMsIGknbSBwcm9iYWJseSBqdXN0IGdvaW5nIHRvIHdyaXRlIHNvbWUgaGFja3kgdGhpbmcgd2hpY2hcbiAgICAgICAgICAgIC8vY29udmVydHMgdGhhdCBzdHJpbmcgaW50byBhIGJ1ZmZlci1lc3F1ZSB0aGluZ1xuXG4gICAgICAgICAgICBlYm1sLnB1c2gobnVtVG9CdWZmZXIoanNvbltpXS5pZCkpO1xuICAgICAgICAgICAgZWJtbC5wdXNoKGJpdHNUb0J1ZmZlcihzaXplKSk7XG4gICAgICAgICAgICBlYm1sLnB1c2goZGF0YSlcblxuXG4gICAgICAgIH1cblxuICAgICAgICAvL291dHB1dCBhcyBibG9iIG9yIGJ5dGVBcnJheVxuICAgICAgICBpZihvdXRwdXRBc0FycmF5KXtcbiAgICAgICAgICAgIC8vY29udmVydCBlYm1sIHRvIGFuIGFycmF5XG4gICAgICAgICAgICB2YXIgYnVmZmVyID0gdG9GbGF0QXJyYXkoZWJtbClcbiAgICAgICAgICAgIHJldHVybiBuZXcgVWludDhBcnJheShidWZmZXIpO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIHJldHVybiBuZXcgQmxvYihlYm1sLCB7dHlwZTogXCJ2aWRlby93ZWJtXCJ9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHRvRmxhdEFycmF5KGFyciwgb3V0QnVmZmVyKXtcbiAgICAgICAgaWYob3V0QnVmZmVyID09IG51bGwpe1xuICAgICAgICAgICAgb3V0QnVmZmVyID0gW107XG4gICAgICAgIH1cbiAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkrKyl7XG4gICAgICAgICAgICBpZih0eXBlb2YgYXJyW2ldID09ICdvYmplY3QnKXtcbiAgICAgICAgICAgICAgICAvL2FuIGFycmF5XG4gICAgICAgICAgICAgICAgdG9GbGF0QXJyYXkoYXJyW2ldLCBvdXRCdWZmZXIpXG4gICAgICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgICAgICAvL2Egc2ltcGxlIGVsZW1lbnRcbiAgICAgICAgICAgICAgICBvdXRCdWZmZXIucHVzaChhcnJbaV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvdXRCdWZmZXI7XG4gICAgfVxuXG4gICAgLy93b290LCBhIGZ1bmN0aW9uIHRoYXQncyBhY3R1YWxseSB3cml0dGVuIGZvciB0aGlzIHByb2plY3QhXG4gICAgLy90aGlzIHBhcnNlcyBzb21lIGpzb24gbWFya3VwIGFuZCBtYWtlcyBpdCBpbnRvIHRoYXQgYmluYXJ5IG1hZ2ljXG4gICAgLy93aGljaCBjYW4gdGhlbiBnZXQgc2hvdmVkIGludG8gdGhlIG1hdHJvc2thIGNvbXRhaW5lciAocGVhY2VhYmx5KVxuXG4gICAgZnVuY3Rpb24gbWFrZVNpbXBsZUJsb2NrKGRhdGEpe1xuICAgICAgICB2YXIgZmxhZ3MgPSAwO1xuICAgICAgICBpZiAoZGF0YS5rZXlmcmFtZSkgZmxhZ3MgfD0gMTI4O1xuICAgICAgICBpZiAoZGF0YS5pbnZpc2libGUpIGZsYWdzIHw9IDg7XG4gICAgICAgIGlmIChkYXRhLmxhY2luZykgZmxhZ3MgfD0gKGRhdGEubGFjaW5nIDw8IDEpO1xuICAgICAgICBpZiAoZGF0YS5kaXNjYXJkYWJsZSkgZmxhZ3MgfD0gMTtcbiAgICAgICAgaWYgKGRhdGEudHJhY2tOdW0gPiAxMjcpIHtcbiAgICAgICAgICAgIHRocm93IFwiVHJhY2tOdW1iZXIgPiAxMjcgbm90IHN1cHBvcnRlZFwiO1xuICAgICAgICB9XG4gICAgICAgIHZhciBvdXQgPSBbZGF0YS50cmFja051bSB8IDB4ODAsIGRhdGEudGltZWNvZGUgPj4gOCwgZGF0YS50aW1lY29kZSAmIDB4ZmYsIGZsYWdzXS5tYXAoZnVuY3Rpb24oZSl7XG4gICAgICAgICAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZShlKVxuICAgICAgICB9KS5qb2luKCcnKSArIGRhdGEuZnJhbWU7XG5cbiAgICAgICAgcmV0dXJuIG91dDtcbiAgICB9XG5cbiAgICAvLyBoZXJlJ3Mgc29tZXRoaW5nIGVsc2UgdGFrZW4gdmVyYmF0aW0gZnJvbSB3ZXBweSwgYXdlc29tZSByaXRlP1xuXG4gICAgZnVuY3Rpb24gcGFyc2VXZWJQKHJpZmYpe1xuICAgICAgICB2YXIgVlA4ID0gcmlmZi5SSUZGWzBdLldFQlBbMF07XG5cbiAgICAgICAgdmFyIGZyYW1lX3N0YXJ0ID0gVlA4LmluZGV4T2YoJ1xceDlkXFx4MDFcXHgyYScpOyAvL0EgVlA4IGtleWZyYW1lIHN0YXJ0cyB3aXRoIHRoZSAweDlkMDEyYSBoZWFkZXJcbiAgICAgICAgZm9yKHZhciBpID0gMCwgYyA9IFtdOyBpIDwgNDsgaSsrKSBjW2ldID0gVlA4LmNoYXJDb2RlQXQoZnJhbWVfc3RhcnQgKyAzICsgaSk7XG5cbiAgICAgICAgdmFyIHdpZHRoLCBob3Jpem9udGFsX3NjYWxlLCBoZWlnaHQsIHZlcnRpY2FsX3NjYWxlLCB0bXA7XG5cbiAgICAgICAgLy90aGUgY29kZSBiZWxvdyBpcyBsaXRlcmFsbHkgY29waWVkIHZlcmJhdGltIGZyb20gdGhlIGJpdHN0cmVhbSBzcGVjXG4gICAgICAgIHRtcCA9IChjWzFdIDw8IDgpIHwgY1swXTtcbiAgICAgICAgd2lkdGggPSB0bXAgJiAweDNGRkY7XG4gICAgICAgIGhvcml6b250YWxfc2NhbGUgPSB0bXAgPj4gMTQ7XG4gICAgICAgIHRtcCA9IChjWzNdIDw8IDgpIHwgY1syXTtcbiAgICAgICAgaGVpZ2h0ID0gdG1wICYgMHgzRkZGO1xuICAgICAgICB2ZXJ0aWNhbF9zY2FsZSA9IHRtcCA+PiAxNDtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHdpZHRoOiB3aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogaGVpZ2h0LFxuICAgICAgICAgICAgZGF0YTogVlA4LFxuICAgICAgICAgICAgcmlmZjogcmlmZlxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gaSB0aGluayBpJ20gZ29pbmcgb2ZmIG9uIGEgcmlmZiBieSBwcmV0ZW5kaW5nIHRoaXMgaXMgc29tZSBrbm93blxuICAgIC8vIGlkaW9tIHdoaWNoIGknbSBtYWtpbmcgYSBjYXN1YWwgYW5kIGJyaWxsaWFudCBwdW4gYWJvdXQsIGJ1dCBzaW5jZVxuICAgIC8vIGkgY2FuJ3QgZmluZCBhbnl0aGluZyBvbiBnb29nbGUgd2hpY2ggY29uZm9ybXMgdG8gdGhpcyBpZGlvbWF0aWNcbiAgICAvLyB1c2FnZSwgSSdtIGFzc3VtaW5nIHRoaXMgaXMganVzdCBhIGNvbnNlcXVlbmNlIG9mIHNvbWUgcHN5Y2hvdGljXG4gICAgLy8gYnJlYWsgd2hpY2ggbWFrZXMgbWUgbWFrZSB1cCBwdW5zLiB3ZWxsLCBlbm91Z2ggcmlmZi1yYWZmIChhaGEgYVxuICAgIC8vIHJlc2N1ZSBvZiBzb3J0cyksIHRoaXMgZnVuY3Rpb24gd2FzIHJpcHBlZCB3aG9sZXNhbGUgZnJvbSB3ZXBweVxuXG4gICAgZnVuY3Rpb24gcGFyc2VSSUZGKHN0cmluZyl7XG4gICAgICAgIHZhciBvZmZzZXQgPSAwO1xuICAgICAgICB2YXIgY2h1bmtzID0ge307XG5cbiAgICAgICAgd2hpbGUgKG9mZnNldCA8IHN0cmluZy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHZhciBpZCA9IHN0cmluZy5zdWJzdHIob2Zmc2V0LCA0KTtcbiAgICAgICAgICAgIHZhciBsZW4gPSBwYXJzZUludChzdHJpbmcuc3Vic3RyKG9mZnNldCArIDQsIDQpLnNwbGl0KCcnKS5tYXAoZnVuY3Rpb24oaSl7XG4gICAgICAgICAgICAgICAgdmFyIHVucGFkZGVkID0gaS5jaGFyQ29kZUF0KDApLnRvU3RyaW5nKDIpO1xuICAgICAgICAgICAgICAgIHJldHVybiAobmV3IEFycmF5KDggLSB1bnBhZGRlZC5sZW5ndGggKyAxKSkuam9pbignMCcpICsgdW5wYWRkZWRcbiAgICAgICAgICAgIH0pLmpvaW4oJycpLDIpO1xuICAgICAgICAgICAgdmFyIGRhdGEgPSBzdHJpbmcuc3Vic3RyKG9mZnNldCArIDQgKyA0LCBsZW4pO1xuICAgICAgICAgICAgb2Zmc2V0ICs9IDQgKyA0ICsgbGVuO1xuICAgICAgICAgICAgY2h1bmtzW2lkXSA9IGNodW5rc1tpZF0gfHwgW107XG5cbiAgICAgICAgICAgIGlmIChpZCA9PSAnUklGRicgfHwgaWQgPT0gJ0xJU1QnKSB7XG4gICAgICAgICAgICAgICAgY2h1bmtzW2lkXS5wdXNoKHBhcnNlUklGRihkYXRhKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNodW5rc1tpZF0ucHVzaChkYXRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY2h1bmtzO1xuICAgIH1cblxuICAgIC8vIGhlcmUncyBhIGxpdHRsZSB1dGlsaXR5IGZ1bmN0aW9uIHRoYXQgYWN0cyBhcyBhIHV0aWxpdHkgZm9yIG90aGVyIGZ1bmN0aW9uc1xuICAgIC8vIGJhc2ljYWxseSwgdGhlIG9ubHkgcHVycG9zZSBpcyBmb3IgZW5jb2RpbmcgXCJEdXJhdGlvblwiLCB3aGljaCBpcyBlbmNvZGVkIGFzXG4gICAgLy8gYSBkb3VibGUgKGNvbnNpZGVyYWJseSBtb3JlIGRpZmZpY3VsdCB0byBlbmNvZGUgdGhhbiBhbiBpbnRlZ2VyKVxuICAgIGZ1bmN0aW9uIGRvdWJsZVRvU3RyaW5nKG51bSl7XG4gICAgICAgIHJldHVybiBbXS5zbGljZS5jYWxsKFxuICAgICAgICAgICAgbmV3IFVpbnQ4QXJyYXkoXG4gICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICBuZXcgRmxvYXQ2NEFycmF5KFtudW1dKSAvL2NyZWF0ZSBhIGZsb2F0NjQgYXJyYXlcbiAgICAgICAgICAgICAgICApLmJ1ZmZlcikgLy9leHRyYWN0IHRoZSBhcnJheSBidWZmZXJcbiAgICAgICAgICAgICwgMCkgLy8gY29udmVydCB0aGUgVWludDhBcnJheSBpbnRvIGEgcmVndWxhciBhcnJheVxuICAgICAgICAgICAgLm1hcChmdW5jdGlvbihlKXsgLy9zaW5jZSBpdCdzIGEgcmVndWxhciBhcnJheSwgd2UgY2FuIG5vdyB1c2UgbWFwXG4gICAgICAgICAgICAgICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUoZSkgLy8gZW5jb2RlIGFsbCB0aGUgYnl0ZXMgaW5kaXZpZHVhbGx5XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLnJldmVyc2UoKSAvL2NvcnJlY3QgdGhlIGJ5dGUgZW5kaWFubmVzcyAoYXNzdW1lIGl0J3MgbGl0dGxlIGVuZGlhbiBmb3Igbm93KVxuICAgICAgICAgICAgLmpvaW4oJycpIC8vIGpvaW4gdGhlIGJ5dGVzIGluIGhvbHkgbWF0cmltb255IGFzIGEgc3RyaW5nXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gV2hhbW15VmlkZW8oc3BlZWQsIHF1YWxpdHkpeyAvLyBhIG1vcmUgYWJzdHJhY3QtaXNoIEFQSVxuICAgICAgICB0aGlzLmZyYW1lcyA9IFtdO1xuICAgICAgICB0aGlzLmR1cmF0aW9uID0gMTAwMCAvIHNwZWVkO1xuICAgICAgICB0aGlzLnF1YWxpdHkgPSBxdWFsaXR5IHx8IDAuODtcbiAgICB9XG5cbiAgICBXaGFtbXlWaWRlby5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oZnJhbWUsIGR1cmF0aW9uKXtcbiAgICAgICAgaWYodHlwZW9mIGR1cmF0aW9uICE9ICd1bmRlZmluZWQnICYmIHRoaXMuZHVyYXRpb24pIHRocm93IFwieW91IGNhbid0IHBhc3MgYSBkdXJhdGlvbiBpZiB0aGUgZnBzIGlzIHNldFwiO1xuICAgICAgICBpZih0eXBlb2YgZHVyYXRpb24gPT0gJ3VuZGVmaW5lZCcgJiYgIXRoaXMuZHVyYXRpb24pIHRocm93IFwiaWYgeW91IGRvbid0IGhhdmUgdGhlIGZwcyBzZXQsIHlvdSBuZWQgdG8gaGF2ZSBkdXJhdGlvbnMgaGVyZS5cIlxuICAgICAgICBpZignY2FudmFzJyBpbiBmcmFtZSl7IC8vQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEXG4gICAgICAgICAgICBmcmFtZSA9IGZyYW1lLmNhbnZhcztcbiAgICAgICAgfVxuICAgICAgICBpZigndG9EYXRhVVJMJyBpbiBmcmFtZSl7XG4gICAgICAgICAgICBmcmFtZSA9IGZyYW1lLnRvRGF0YVVSTCgnaW1hZ2Uvd2VicCcsIHRoaXMucXVhbGl0eSlcbiAgICAgICAgfWVsc2UgaWYodHlwZW9mIGZyYW1lICE9IFwic3RyaW5nXCIpe1xuICAgICAgICAgICAgdGhyb3cgXCJmcmFtZSBtdXN0IGJlIGEgYSBIVE1MQ2FudmFzRWxlbWVudCwgYSBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQgb3IgYSBEYXRhVVJJIGZvcm1hdHRlZCBzdHJpbmdcIlxuICAgICAgICB9XG4gICAgICAgIGlmICghKC9eZGF0YTppbWFnZVxcL3dlYnA7YmFzZTY0LC9pZykudGVzdChmcmFtZSkpIHtcbiAgICAgICAgICAgIHRocm93IFwiSW5wdXQgbXVzdCBiZSBmb3JtYXR0ZWQgcHJvcGVybHkgYXMgYSBiYXNlNjQgZW5jb2RlZCBEYXRhVVJJIG9mIHR5cGUgaW1hZ2Uvd2VicFwiO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZnJhbWVzLnB1c2goe1xuICAgICAgICAgICAgaW1hZ2U6IGZyYW1lLFxuICAgICAgICAgICAgZHVyYXRpb246IGR1cmF0aW9uIHx8IHRoaXMuZHVyYXRpb25cbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICBXaGFtbXlWaWRlby5wcm90b3R5cGUuY29tcGlsZSA9IGZ1bmN0aW9uKG91dHB1dEFzQXJyYXkpe1xuICAgICAgICByZXR1cm4gbmV3IHRvV2ViTSh0aGlzLmZyYW1lcy5tYXAoZnVuY3Rpb24oZnJhbWUpe1xuICAgICAgICAgICAgdmFyIHdlYnAgPSBwYXJzZVdlYlAocGFyc2VSSUZGKGF0b2IoZnJhbWUuaW1hZ2Uuc2xpY2UoMjMpKSkpO1xuICAgICAgICAgICAgd2VicC5kdXJhdGlvbiA9IGZyYW1lLmR1cmF0aW9uO1xuICAgICAgICAgICAgcmV0dXJuIHdlYnA7XG4gICAgICAgIH0pLCBvdXRwdXRBc0FycmF5KVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIFZpZGVvOiBXaGFtbXlWaWRlbyxcbiAgICAgICAgZnJvbUltYWdlQXJyYXk6IGZ1bmN0aW9uKGltYWdlcywgZnBzLCBvdXRwdXRBc0FycmF5KXtcbiAgICAgICAgICAgIHJldHVybiB0b1dlYk0oaW1hZ2VzLm1hcChmdW5jdGlvbihpbWFnZSl7XG4gICAgICAgICAgICAgICAgdmFyIHdlYnAgPSBwYXJzZVdlYlAocGFyc2VSSUZGKGF0b2IoaW1hZ2Uuc2xpY2UoMjMpKSkpXG4gICAgICAgICAgICAgICAgd2VicC5kdXJhdGlvbiA9IDEwMDAgLyBmcHM7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHdlYnA7XG4gICAgICAgICAgICB9KSwgb3V0cHV0QXNBcnJheSlcbiAgICAgICAgfSxcbiAgICAgICAgdG9XZWJNOiB0b1dlYk1cbiAgICAgICAgLy8gZXhwb3NlIG1ldGhvZHMgb2YgbWFkbmVzc1xuICAgIH1cbn0pKClcblxuOyBicm93c2VyaWZ5X3NoaW1fX2RlZmluZV9fbW9kdWxlX19leHBvcnRfXyh0eXBlb2YgV2hhbW15ICE9IFwidW5kZWZpbmVkXCIgPyBXaGFtbXkgOiB3aW5kb3cuV2hhbW15KTtcblxufSkuY2FsbChnbG9iYWwsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGZ1bmN0aW9uIGRlZmluZUV4cG9ydChleCkgeyBtb2R1bGUuZXhwb3J0cyA9IGV4OyB9KTtcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSkiXX0=
