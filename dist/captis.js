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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvcGFzaGEvRGVza3RvcC9jYXB0aXMvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9Vc2Vycy9wYXNoYS9EZXNrdG9wL2NhcHRpcy9FZGl0b3IuanMiLCIvVXNlcnMvcGFzaGEvRGVza3RvcC9jYXB0aXMvY2FwdGlzLmpzIiwiL1VzZXJzL3Bhc2hhL0Rlc2t0b3AvY2FwdGlzL2VkaXRvci5qcyIsIi9Vc2Vycy9wYXNoYS9EZXNrdG9wL2NhcHRpcy92ZW5kb3Ivd2hhbW15Lm1pbi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6eEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7QUM3RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIGluaXRpYWxpemVFZGl0b3IgPSBmdW5jdGlvbigpIHtcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FwdGlzJykuaW5uZXJIVE1MICs9IChcbiAgICAgICAgJzxkaXYgaWQ9XCJjYXB0aXNfZWRpdG9yXCI+IFxcXG4gICAgICAgICAgICA8ZGl2IGlkPVwibG9hZGluZ1wiPjxwcm9ncmVzcyBpZD1cImxvYWRpbmdfc2VnbWVudHNcIiB2YWx1ZT1cIjBcIj48L3Byb2dyZXNzPjwvZGl2PiBcXFxuICAgICAgICAgICAgPHZpZGVvIGlkPVwiZWRpdF92aWRlb1wiIHByZWxvYWQgYXV0b3BsYXkgbXV0ZWQ+PC92aWRlbz4gXFxcbiAgICAgICAgICAgIDxkaXYgaWQ9XCJzZWdtZW50X2NvbnRcIj48ZGl2IGlkPVwiY2FwdGlzX2VkaXRvcl9zZWdtZW50c1wiPjwvZGl2PjwvZGl2PiBcXFxuICAgICAgICAgICAgPGNhbnZhcyBpZD1cInNlZ21lbnRzaG90XCI+PC9jYW52YXM+IFxcXG4gICAgICAgIDwvZGl2PidcbiAgICApO1xuICAgIHZhciB2aWRlbyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdlZGl0X3ZpZGVvJyksXG4gICAgICAgIHBhcnRzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcHRpc19lZGl0b3Jfc2VnbWVudHMnKSxcbiAgICAgICAgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NlZ21lbnRfY29udCcpLFxuICAgICAgICBsb2FkZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9hZGluZ19zZWdtZW50cycpLFxuICAgICAgICBsb2FkaW5nID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvYWRpbmcnKSxcbiAgICAgICAgY2FudmFzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NlZ21lbnRzaG90JyksXG4gICAgICAgIGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuICAgICAgICBjYW52YXMud2lkdGggPSAxMzA7XG4gICAgICAgIGNhbnZhcy5oZWlnaHQgPSAxMzA7XG4gICAgcGFydHMuaW5uZXJIVE1MID0gJyc7XG4gICAgdmlkZW8uc3JjID0gd2luZG93LnZpZGVvVVJMO1xuICAgIGNvbnNvbGUubG9nKHdpbmRvdy5zZWdtZW50cyk7XG4gICAgbG9hZGVyLnNldEF0dHJpYnV0ZSgnbWF4Jywgd2luZG93LnNlZ21lbnRzLmxlbmd0aCAtIDEpO1xuICAgIHZpZGVvLm9ubG9hZGVkbWV0YWRhdGEgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBpID0gMDtcbiAgICAgICAgdmFyIGxvb3AgPSBzZXRJbnRlcnZhbChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIC8vY29uc29sZS5sb2cod2luZG93LnNlZ21lbnRzW2ldKTtcbiAgICAgICAgICAgIHBhcnRzLmlubmVySFRNTCArPSAoXG4gICAgICAgICAgICAgICAgJzxkaXYgY2xhc3M9XCJzZWdtZW50X2JveFwiIGlkPVwic2VnbWVudF8nKyBpICsnXCI+IFxcXG4gICAgICAgICAgICAgICAgICAgIDxpIGNsYXNzPVwic2VnbWVudF90aW1lXCI+Jysgd2luZG93LmZvcm1hdER1cmF0aW9uKHdpbmRvdy5zZWdtZW50c1tpXS50aW1lc3RhbXApICsnPC9pPiBcXFxuICAgICAgICAgICAgICAgIDwvZGl2PidcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICB2aWRlby5jdXJyZW50VGltZSA9IHdpbmRvdy5zZWdtZW50c1tpXS50aW1lc3RhbXA7XG4gICAgICAgICAgICBjdHguZHJhd0ltYWdlKHZpZGVvLCAwLCAwLCAxMzAsIDEzMCk7XG4gICAgICAgICAgICB2YXIgaW1hZ2UgPSBjYW52YXMudG9EYXRhVVJMKCksXG4gICAgICAgICAgICAgICAgYm94ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NlZ21lbnRfJyArIGkpO1xuICAgICAgICAgICAgLy9jb25zb2xlLmxvZyhpbWFnZSk7XG4gICAgICAgICAgICBib3guc3R5bGUuYmFja2dyb3VuZEltYWdlID0gJ3VybCgnICsgaW1hZ2UgKyAnKSc7XG4gICAgICAgICAgICBsb2FkZXIudmFsdWUgPSBpO1xuICAgICAgICAgICAgaSsrO1xuICAgICAgICAgICAgaWYgKGkgPT0gd2luZG93LnNlZ21lbnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIC8vcGFydHMuc3R5bGUuaGVpZ2h0ID0gMTIwICogd2luZG93LnNlZ21lbnRzLmxlbmd0aCArICdweCc7XG4gICAgICAgICAgICAgICAgY29udGFpbmVyLnN0eWxlLndpZHRoID0gJzEzMHB4JztcbiAgICAgICAgICAgICAgICBsb2FkaW5nLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgICAgICAgICAgdmlkZW8uc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG4gICAgICAgICAgICAgICAgdmlkZW8ucGF1c2UoKTtcbiAgICAgICAgICAgICAgICB2aWRlby5jdXJyZW50VGltZSA9IDA7XG4gICAgICAgICAgICAgICAgY2xlYXJJbnRlcnZhbChsb29wKTtcbiAgICAgICAgICAgICAgICB2YXIgZWxlbWVudHMgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKCdzZWdtZW50X2JveCcpO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgZWxlbWVudHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudHNbal0uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBlZGl0b3JQbGF5U2VnbWVudCwgZmFsc2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKGVsZW1lbnRzKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0sIDEwMCk7XG4gICAgfTtcbiAgICB3aW5kb3cucmVsb2FkRXZlbnRzKCk7XG5cbn1cblxudmFyIGVkaXRvclBsYXlTZWdtZW50ID0gZnVuY3Rpb24gKCkge1xuICAgIHZpZGVvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2VkaXRfdmlkZW8nKTtcbiAgICB2YXIgaW5kZXggPSBwYXJzZUludCh0aGlzLmlkLnNwbGl0KCdfJylbMV0pO1xuICAgIHdpbmRvdy5zZWdtZW50ID0gaW5kZXg7XG4gICAgd2luZG93LmNhblVwZGF0ZSA9IHRydWU7XG4gICAgdmlkZW8uY3VycmVudFRpbWUgPSB3aW5kb3cuc2VnbWVudHNbaW5kZXhdLnRpbWVzdGFtcDtcbiAgICB2aWRlby5tdXRlZCA9IGZhbHNlO1xuICAgIGltcHJlc3MoKS5nb3RvKCdvdmVydmlldycpO1xuICAgIGltcHJlc3MoKS5nb3RvKHdpbmRvdy5zZWdtZW50c1tpbmRleF0uc3RlcGlkKTtcbiAgICAvL1RPRE86IEFsbCBjYXNlc1xuICAgIGlmICh3aW5kb3cuc2VnbWVudHNbaW5kZXhdLm5leHQpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB3aW5kb3cuc2VnbWVudHNbaW5kZXhdLm5leHQ7IGkrKykge1xuICAgICAgICAgICAgaW1wcmVzcygpLm5leHQoKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAod2luZG93LnNlZ21lbnRzW2luZGV4XS5wcmV2KSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgd2luZG93LnNlZ21lbnRzW2luZGV4XS5wcmV2OyBpKyspIHtcbiAgICAgICAgICAgIGltcHJlc3MoKS5wcmV2KCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgY29uc29sZS5sb2cod2luZG93LnNsaWRlcywgd2luZG93LnNlZ21lbnRzW2luZGV4XSk7XG4gICAgdmlkZW8ucGxheSgpO1xuXG59XG5cbmV4cG9ydHMuaW5pdGlhbGl6ZUVkaXRvciA9IGluaXRpYWxpemVFZGl0b3I7XG4iLCIvKipcbiogQGF1dGhvciBQYXNoYSBCaW55YXRvdiA8cGFzaGFAYmlueWF0b3YuY29tPlxuKiBAY29weXJpZ2h0IDIwMTQgUGFzaGEgQmlueWF0b3ZcbiogQGxpY2Vuc2Uge0BsaW5rIGh0dHBzOi8vZ2l0aHViLmNvbS9iaW55YXRvdi9jYXB0aXMuanMvYmxvYi9tYXN0ZXIvTElDRU5TRXxNSVQgTGljZW5zZX1cbiovXG5cbi8qKlxuKi9cbm5hdmlnYXRvci5nZXRVc2VyTWVkaWEgPSAoXG4gICAgbmF2aWdhdG9yLmdldFVzZXJNZWRpYSB8fFxuICAgIG5hdmlnYXRvci53ZWJraXRHZXRVc2VyTWVkaWEgfHxcbiAgICBuYXZpZ2F0b3IubW96R2V0VXNlck1lZGlhIHx8XG4gICAgbmF2aWdhdG9yLm1zR2V0VXNlck1lZGlhXG4pO1xuXG53aW5kb3cuVVJMID0gKFxuICAgIHdpbmRvdy5VUkwgfHxcbiAgICB3aW5kb3cud2Via2l0VVJMIHx8XG4gICAgd2luZG93Lm1velVSTCB8fFxuICAgIHdpbmRvdy5tc1VSTFxuKTtcblxudmFyIEF1ZGlvQ29udGV4dCA9IHdpbmRvdy5BdWRpb0NvbnRleHQgfHwgd2luZG93LndlYmtpdEF1ZGlvQ29udGV4dCxcbiAgICBXaGFtbXkgPSByZXF1aXJlKCdXaGFtbXknKSxcbiAgICBFZGl0b3IgPSByZXF1aXJlKCcuL0VkaXRvcicpLFxuICAgIGNoYW5uZWxEYXRhID0gW107XG5cbnZhciBjYXB0aXMgPSB7c3RyZWFtOiBudWxsLFxuICAgIGZyYW1lczogW10sXG4gICAgdG9vbGJhcjogZmFsc2UsXG4gICAgY2FwdHVyaW5nOiBmYWxzZSxcbiAgICBzdHJlYW1pbmc6IGZhbHNlLFxuICAgIHJlY29yZDogbnVsbCxcbiAgICBhdWRpbzoge1xuICAgICAgICByZWNvcmRpbmdTaXplOiAwLFxuICAgICAgICBzYW1wbGVSYXRlOiA0NDEwMCxcbiAgICAgICAgcmVjb3JkaW5nOiBmYWxzZSxcbiAgICAgICAgcHJvY2Vzc29yOiBudWxsXG4gICAgfSxcbiAgICBpbXByZXNzOiB7XG4gICAgICAgIHN0ZXA6IG51bGwsXG4gICAgICAgIGlzU3RlcDogZmFsc2UsXG4gICAgICAgIHNlZ21lbnRzOiBbXSxcbiAgICAgICAgbWV0YToge31cbiAgICB9LFxuICAgIHBsYXllcjoge1xuICAgICAgICBvYmplY3RVcmw6IG51bGwsXG4gICAgICAgIHJlYWR5OiBmYWxzZSxcbiAgICAgICAgdGltZXVwZGF0ZTogbnVsbCxcbiAgICAgICAganNvbjogbnVsbCxcbiAgICAgICAgdGltZXN0YW1wczogW10sXG4gICAgICAgIHNsaWRlczogW10sXG4gICAgICAgIGlzT246IGZhbHNlLFxuICAgICAgICBjdXJyZW50U3RlcDogbnVsbCxcbiAgICAgICAgYWN0aXZlU3RlcDogbnVsbCxcbiAgICAgICAga2V5cHJlc3NlZDogZmFsc2VcbiAgICB9LFxuICAgIHNlZ21lbnRzOiB7XG4gICAgICAgIHJlYWR5OiBmYWxzZVxuICAgIH1cbn1cblxuZnVuY3Rpb24gaW5pdGlhbGl6ZVRvb2xiYXIgKGUpIHtcbiAgICBpZiAoZS5jdHJsS2V5ICYmIGUua2V5Q29kZSA9PSA2OSkge1xuICAgICAgICBjYXB0aXMudG9vbGJhciA9IHRydWU7XG4gICAgICAgIHdpbmRvdy5jYW5VcGRhdGUgPSBmYWxzZTtcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcHRpcycpLmlubmVySFRNTCArPSAoXG4gICAgICAgICAgICAnPGRpdiBpZD1cInRvb2xiYXJcIj4gXFxcbiAgICAgICAgICAgICAgICA8aSBpZD1cImNhbWVyYVwiIGNsYXNzPVwiZmEgZmEtdmlkZW8tY2FtZXJhIGNhcHRpc19pY29uXCI+PC9pPiBcXFxuICAgICAgICAgICAgICAgIDxpIGlkPVwicmVjb3JkXCIgY2xhc3M9XCJmYSBmYS1jaXJjbGVcIj48L2k+IFxcXG4gICAgICAgICAgICAgICAgPGkgaWQ9XCJzY3JlZW5cIiBjbGFzcz1cImZhIGZhLWRlc2t0b3AgY2FwdGlzX2ljb25cIj48L2k+IFxcXG4gICAgICAgICAgICAgICAgPGkgaWQ9XCJzYXZlXCIgY2xhc3M9XCJmYSBmYS1zYXZlIGNhcHRpc19pY29uXCI+PC9pPiBcXFxuICAgICAgICAgICAgICAgIDxpIGlkPVwidXBkYXRlXCIgY2xhc3M9XCJmYSBmYS1wbHVzLXNxdWFyZSBjYXB0aXNfaWNvblwiPjwvaT4gXFxcbiAgICAgICAgICAgICAgICA8aSBpZD1cImVkaXRcIiBjbGFzcz1cImZhIGZhLXBlbmNpbC1zcXVhcmUgY2FwdGlzX2ljb25cIj48L2k+IFxcXG4gICAgICAgICAgICAgICAgPGkgaWQ9XCJzd2l0Y2hcIiBjbGFzcz1cImZhIGZhLXBvd2VyLW9mZiBjYXB0aXNfaWNvblwiPjwvaT4gXFxcbiAgICAgICAgICAgIDwvZGl2PidcbiAgICAgICAgKTtcbiAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5dXAnLCBpbml0aWFsaXplVG9vbGJhciwgZmFsc2UpO1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXl1cCcsIGNsb3NlVG9vbGJhciwgZmFsc2UpO1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3dpdGNoJykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICdjbGljaycsXG4gICAgICAgICAgICBjbG9zZVRvb2xiYXIsXG4gICAgICAgICAgICBmYWxzZVxuICAgICAgICApO1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FtZXJhJykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICdjbGljaycsXG4gICAgICAgICAgICBtZWRpYVN0cmVhbSxcbiAgICAgICAgICAgIGZhbHNlXG4gICAgICAgICk7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdlZGl0JykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICdjbGljaycsXG4gICAgICAgICAgICBFZGl0b3IuaW5pdGlhbGl6ZUVkaXRvcixcbiAgICAgICAgICAgIGZhbHNlXG4gICAgICAgICk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBjbGVhclNwYWNlICgpIHtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3dpdGNoJykucmVtb3ZlRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgY2xvc2VUb29sYmFyLFxuICAgICAgICBmYWxzZVxuICAgICk7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2VkaXQnKS5yZW1vdmVFdmVudExpc3RlbmVyKFxuICAgICAgICAnY2xpY2snLFxuICAgICAgICBFZGl0b3IuaW5pdGlhbGl6ZUVkaXRvcixcbiAgICAgICAgZmFsc2VcbiAgICApO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYW1lcmEnKS5yZW1vdmVFdmVudExpc3RlbmVyKFxuICAgICAgICAnY2xpY2snLFxuICAgICAgICBjbG9zZVRvb2xiYXIsXG4gICAgICAgIGZhbHNlXG4gICAgKTtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndG9vbGJhcicpLm91dGVySFRNTCA9ICcnO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2tleXVwJywgY2xvc2VUb29sYmFyLCBmYWxzZSk7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLCBpbml0aWFsaXplVG9vbGJhciwgZmFsc2UpO1xuICAgIGlmIChjYXB0aXMuc3RyZWFtaW5nKSB7XG4gICAgICAgIGNhcHRpcy5zdHJlYW0uc3RvcCgpO1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGl2ZV9zdHJlYW0nKS5vdXRlckhUTUwgPSAnJztcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3RpbWVyJykub3V0ZXJIVE1MID0gJyc7XG4gICAgICAgIGNhcHRpcy5zdHJlYW1pbmcgPSBmYWxzZTtcbiAgICB9XG4gICAgaWYgKGNhcHRpcy5jYXB0dXJpbmcpIHtcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BvbHlnb24nKS5vdXRlckhUTUwgPSAnJztcbiAgICAgICAgY2FwdGlzLmNhcHR1cmluZyA9IGZhbHNlO1xuICAgIH1cbn1cblxuXG5mdW5jdGlvbiBjbG9zZVRvb2xiYXIgKGUpIHtcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBpZiAoKGUuY3RybEtleSAmJiBlLmtleUNvZGUgPT0gNjkpIHx8IGUudGFyZ2V0LmlkID09ICdzd2l0Y2gnKSB7XG4gICAgICAgIGNsZWFyU3BhY2UoKTtcbiAgICAgICAgY2FwdGlzLnRvb2xiYXIgPSBmYWxzZTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlbG9hZEV2ZW50cyAoKSB7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3N3aXRjaCcpLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICdjbGljaycsXG4gICAgICAgIGNsb3NlVG9vbGJhcixcbiAgICAgICAgZmFsc2VcbiAgICApO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzYXZlJykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgc2F2ZU1lZGlhLFxuICAgICAgICBmYWxzZVxuICAgICk7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhbWVyYScpLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICdjbGljaycsXG4gICAgICAgIG1lZGlhU3RyZWFtLFxuICAgICAgICBmYWxzZVxuICAgICk7XG59XG5cbndpbmRvdy5yZWxvYWRFdmVudHMgPSByZWxvYWRFdmVudHM7XG5cbmZ1bmN0aW9uIG1lZGlhU3RyZWFtICgpIHtcbiAgICBpZiAobmF2aWdhdG9yLmdldFVzZXJNZWRpYSkge1xuICAgICAgICBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhIChcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB2aWRlbzogdHJ1ZSxcbiAgICAgICAgICAgICAgICBhdWRpbzogdHJ1ZVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZ1bmN0aW9uIChsb2NhbE1lZGlhU3RyZWFtKSB7XG4gICAgICAgICAgICAgICAgY2FwdGlzLnN0cmVhbSA9IGxvY2FsTWVkaWFTdHJlYW07XG4gICAgICAgICAgICAgICAgY2FwdGlzLnN0cmVhbWluZyA9IHRydWU7XG4gICAgICAgICAgICAgICAgaWYgKHdpbmRvdy5jYW5VcGRhdGUpIHsgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2VkaXRfdmlkZW8nKS5vdXRlckhUTUwgPSAnJzsgfVxuICAgICAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYXB0aXMnKS5pbm5lckhUTUwgKz0gKFxuICAgICAgICAgICAgICAgICAgICAnPHZpZGVvIGlkPVwibGl2ZV9zdHJlYW1cIiBhdXRvcGxheSBtdXRlZD48L3ZpZGVvPiBcXFxuICAgICAgICAgICAgICAgICAgICA8aSBpZD1cInRpbWVyXCI+PC9pPidcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYXB0aXMnKS5pbm5lckhUTUwgKz0gKFxuICAgICAgICAgICAgICAgICAgICAnPGNhbnZhcyBpZD1cInBvbHlnb25cIj48L2NhbnZhcz4nXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGl2ZV9zdHJlYW0nKS5zcmMgPSB3aW5kb3cuVVJMLmNyZWF0ZU9iamVjdFVSTChsb2NhbE1lZGlhU3RyZWFtKTtcbiAgICAgICAgICAgICAgICByZWxvYWRFdmVudHMoKTtcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVjb3JkJykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgICAgICAgICAgICAgc3RhcnRSZWNvcmRpbmcsXG4gICAgICAgICAgICAgICAgICAgIGZhbHNlXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZyhcImdldFVzZXJNZWRpYSBub3Qgc3VwcG9ydGVkXCIpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gdGltZUZvcm1hdCAoc2Vjb25kcykge1xuXHR2YXIgaCA9IE1hdGguZmxvb3Ioc2Vjb25kcy8zNjAwKTtcblx0dmFyIG0gPSBNYXRoLmZsb29yKChzZWNvbmRzIC0gKGggKiAzNjAwKSkgLyA2MCk7XG5cdHZhciBzID0gTWF0aC5mbG9vcihzZWNvbmRzIC0gKGggKiAzNjAwKSAtIChtICogNjApKTtcblx0aCA9IGggPCAxMCA/IFwiMFwiICsgaCA6IGg7XG5cdG0gPSBtIDwgMTAgPyBcIjBcIiArIG0gOiBtO1xuXHRzID0gcyA8IDEwID8gXCIwXCIgKyBzIDogcztcblx0cmV0dXJuIGggKyBcIjpcIiArIG0gKyBcIjpcIiArIHM7XG59XG5cbndpbmRvdy5mb3JtYXREdXJhdGlvbiA9IHRpbWVGb3JtYXQ7XG5cbmZ1bmN0aW9uIHN0YXJ0UmVjb3JkaW5nICgpIHtcbiAgICBjYXB0aXMuYXVkaW8ucmVjb3JkaW5nID0gdHJ1ZTtcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICB2YXIgdmlkZW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGl2ZV9zdHJlYW0nKSxcbiAgICAgICAgY2FudmFzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BvbHlnb24nKSxcbiAgICAgICAgdGltZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndGltZXInKSxcbiAgICAgICAgY3R4ID0gY2FudmFzLmdldENvbnRleHQoJzJkJyksXG4gICAgICAgIGF1ZGlvQ29udGV4dCA9IG5ldyBBdWRpb0NvbnRleHQoKSxcbiAgICAgICAgZ2Fpbk5vZGUgPSBhdWRpb0NvbnRleHQuY3JlYXRlR2FpbigpLFxuICAgICAgICBhdWRpb0lucHV0ID0gYXVkaW9Db250ZXh0LmNyZWF0ZU1lZGlhU3RyZWFtU291cmNlKGNhcHRpcy5zdHJlYW0pLFxuICAgICAgICBidWZmZXJTaXplID0gMTAyNCxcbiAgICAgICAgY3VycmVudFRpbWUgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKSxcbiAgICAgICAgaW5kZXggPSAwO1xuICAgIGF1ZGlvSW5wdXQuY29ubmVjdChnYWluTm9kZSk7XG4gICAgY2FwdGlzLmF1ZGlvLnByb2Nlc3NvciA9IGF1ZGlvQ29udGV4dC5jcmVhdGVTY3JpcHRQcm9jZXNzb3IoYnVmZmVyU2l6ZSwgMSwgMSk7XG4gICAgY2FwdGlzLmNhcHR1cmluZyA9IHRydWU7XG4gICAgY2FwdGlzLnJlY29yZCA9IG5ldyBXaGFtbXkuVmlkZW8oKTtcbiAgICB2YXIgZnJhbWVXaWR0aCA9IHZpZGVvLm9mZnNldFdpZHRoIC0gMTQsXG4gICAgICAgIGZyYW1lSGVpZ2h0ID0gdmlkZW8ub2Zmc2V0SGVpZ2h0IC0gMTQ7XG4gICAgY2FudmFzLndpZHRoID0gZnJhbWVXaWR0aDtcbiAgICBjYW52YXMuaGVpZ2h0ID0gZnJhbWVIZWlnaHQ7XG4gICAgY2FwdGlzLmF1ZGlvLnByb2Nlc3Nvci5vbmF1ZGlvcHJvY2VzcyA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIGlmICghY2FwdGlzLmF1ZGlvLnJlY29yZGluZykgcmV0dXJuO1xuICAgICAgICBpZiAoaW5kZXglMyA9PSAwKSB7XG4gICAgICAgICAgICBjdHguZHJhd0ltYWdlKHZpZGVvLCAwLCAwLCBmcmFtZVdpZHRoLCBmcmFtZUhlaWdodCk7XG4gICAgICAgICAgICBjYXB0aXMucmVjb3JkLmFkZChjdHgsIDApO1xuICAgICAgICAgICAgLy9jb25zb2xlLmxvZygndmlkZW8nKTtcbiAgICAgICAgfVxuICAgICAgICBpbmRleCsrO1xuICAgICAgICB2YXIgY2hhbm5lbCA9IGUuaW5wdXRCdWZmZXIuZ2V0Q2hhbm5lbERhdGEoMCk7XG4gICAgICAgIGNoYW5uZWxEYXRhLnB1c2gobmV3IEZsb2F0MzJBcnJheShjaGFubmVsKSk7XG4gICAgICAgIGNhcHRpcy5hdWRpby5yZWNvcmRpbmdTaXplICs9IGJ1ZmZlclNpemU7XG4gICAgICAgIC8vY29uc29sZS5sb2coJ2F1ZGlvJyk7XG4gICAgfVxuICAgIHZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ3RpbWV1cGRhdGUnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRpbWVyLmlubmVySFRNTCA9IHRpbWVGb3JtYXQoKG5ldyBEYXRlKCkuZ2V0VGltZSgpIC0gY3VycmVudFRpbWUpLzEwMDApO1xuICAgIH0sIGZhbHNlKTtcbiAgICBjYXB0dXJlU2VnbWVudHModmlkZW8pO1xuICAgIGdhaW5Ob2RlLmNvbm5lY3QoY2FwdGlzLmF1ZGlvLnByb2Nlc3Nvcik7XG4gICAgY2FwdGlzLmF1ZGlvLnByb2Nlc3Nvci5jb25uZWN0KGF1ZGlvQ29udGV4dC5kZXN0aW5hdGlvbik7XG4gICAgcmVsb2FkRXZlbnRzKCk7XG59XG5cbmZ1bmN0aW9uIGNhcHR1cmVTZWdtZW50cyAodmlkZW8pIHtcbiAgICB2YXIgbmV4dFN0ZXAgPSAwLFxuICAgICAgICBwcmV2U3RlcCA9IDAsXG4gICAgICAgIHN0ZXBJZCA9IG51bGw7XG4gICAgd2luZG93Lm9ua2V5ZG93biA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgLy9uZXh0IHNsaWRlXG4gICAgICAgICAgICBpZiAoZS5rZXlDb2RlID09IDM5ICYmIGNhcHRpcy5pbXByZXNzLmlzU3RlcCkge1xuICAgICAgICAgICAgICAgIGlmIChuZXh0U3RlcCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgY2FwdGlzLmltcHJlc3MubWV0YVtzdGVwSWRdID0gbmV4dFN0ZXA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG5leHRTdGVwID0gMDtcbiAgICAgICAgICAgICAgICBwcmV2U3RlcCA9IDA7XG4gICAgICAgICAgICAgICAgY2FwdGlzLmltcHJlc3MuaXNTdGVwID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgY2FwdGlzLmltcHJlc3Muc2VnbWVudHMucHVzaChcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGltZXN0YW1wOiBNYXRoLmZsb29yKHZpZGVvLmN1cnJlbnRUaW1lKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0ZXBpZDogY2FwdGlzLmltcHJlc3Muc3RlcCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5leHQ6IG5leHRTdGVwLFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvL25leHQgc3RlcFxuICAgICAgICAgICAgaWYgKGUua2V5Q29kZSA9PSAzOSAmJiAhY2FwdGlzLmltcHJlc3MuaXNTdGVwKSB7XG4gICAgICAgICAgICAgICAgbmV4dFN0ZXArKztcbiAgICAgICAgICAgICAgICBwcmV2U3RlcCA9IDA7XG4gICAgICAgICAgICAgICAgc3RlcElkID0gY2FwdGlzLmltcHJlc3Muc3RlcDtcbiAgICAgICAgICAgICAgICBjYXB0aXMuaW1wcmVzcy5zZWdtZW50cy5wdXNoKFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1lc3RhbXA6IE1hdGguZmxvb3IodmlkZW8uY3VycmVudFRpbWUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3RlcGlkOiBjYXB0aXMuaW1wcmVzcy5zdGVwLFxuICAgICAgICAgICAgICAgICAgICAgICAgbmV4dDogbmV4dFN0ZXAsXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vcHJldiBzbGlkZVxuICAgICAgICAgICAgaWYgKGUua2V5Q29kZSA9PSAzNyAmJiBjYXB0aXMuaW1wcmVzcy5pc1N0ZXApIHtcbiAgICAgICAgICAgICAgICBwcmV2U3RlcCA9IDA7XG4gICAgICAgICAgICAgICAgbmV4dFN0ZXAgPSAwO1xuICAgICAgICAgICAgICAgIGNhcHRpcy5pbXByZXNzLmlzU3RlcCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGNhcHRpcy5pbXByZXNzLnNlZ21lbnRzLnB1c2goXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogTWF0aC5mbG9vcih2aWRlby5jdXJyZW50VGltZSksXG4gICAgICAgICAgICAgICAgICAgICAgICBzdGVwaWQ6IGNhcHRpcy5pbXByZXNzLnN0ZXAsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcmV2OiBwcmV2U3RlcCxcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy9wcmV2IHN0ZXBcbiAgICAgICAgICAgIGlmIChlLmtleUNvZGUgPT0gMzcgJiYgIWNhcHRpcy5pbXByZXNzLmlzU3RlcCkge1xuICAgICAgICAgICAgICAgIHByZXZTdGVwKys7XG4gICAgICAgICAgICAgICAgbmV4dFN0ZXAgPSAwO1xuICAgICAgICAgICAgICAgIGNhcHRpcy5pbXByZXNzLnNlZ21lbnRzLnB1c2goXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogTWF0aC5mbG9vcih2aWRlby5jdXJyZW50VGltZSksXG4gICAgICAgICAgICAgICAgICAgICAgICBzdGVwaWQ6IGNhcHRpcy5pbXByZXNzLnN0ZXAsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcmV2OiBwcmV2U3RlcCxcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LCAxMDAwKTtcbiAgICB9O1xufVxuXG5mdW5jdGlvbiBtZXJnZUJ1ZmZlcnMgKGNoYW5uZWxCdWZmZXIsIHJlY29yZGluZ0xlbmd0aCkge1xuICAgIHZhciByZXN1bHQgPSBuZXcgRmxvYXQzMkFycmF5KHJlY29yZGluZ0xlbmd0aCksXG4gICAgICAgIG9mZnNldCA9IDA7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGFubmVsQnVmZmVyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBidWZmZXIgPSBjaGFubmVsQnVmZmVyW2ldO1xuICAgICAgICByZXN1bHQuc2V0KGJ1ZmZlciwgb2Zmc2V0KTtcbiAgICAgICAgb2Zmc2V0ICs9IGJ1ZmZlci5sZW5ndGg7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIHdyaXRlVVRGQnl0ZXMgKHZpZXcsIG9mZnNldCwgc3RyaW5nKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHJpbmcubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmlldy5zZXRVaW50OChvZmZzZXQgKyBpLCBzdHJpbmcuY2hhckNvZGVBdChpKSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBmbG9hdFRvMTZCaXRQQ00ob3V0cHV0LCBvZmZzZXQsIGlucHV0KXtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBpbnB1dC5sZW5ndGg7IGkrKywgb2Zmc2V0Kz0yKXtcbiAgICB2YXIgcyA9IE1hdGgubWF4KC0xLCBNYXRoLm1pbigxLCBpbnB1dFtpXSkpO1xuICAgIG91dHB1dC5zZXRJbnQxNihvZmZzZXQsIHMgPCAwID8gcyAqIDB4ODAwMCA6IHMgKiAweDdGRkYsIHRydWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHNhdmVNZWRpYSAoKSB7XG4gICAgY2FwdGlzLmF1ZGlvLnJlY29yZGluZyA9IGZhbHNlO1xuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGNsZWFyU3BhY2UoKTtcbiAgICBjYXB0aXMuc3RyZWFtLnN0b3AoKTtcbiAgICB2YXIgYXVkaW9EYXRhID0gbWVyZ2VCdWZmZXJzKGNoYW5uZWxEYXRhLCBjYXB0aXMuYXVkaW8ucmVjb3JkaW5nU2l6ZSksXG4gICAgICAgIGJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcig0NCArIGF1ZGlvRGF0YS5sZW5ndGggKiAyKSxcbiAgICAgICAgdmlldyA9IG5ldyBEYXRhVmlldyhidWZmZXIpO1xuICAgIHdyaXRlVVRGQnl0ZXModmlldywgMCwgJ1JJRkYnKTtcbiAgICB2aWV3LnNldFVpbnQzMig0LCAzMiArIGF1ZGlvRGF0YS5sZW5ndGggKiAyLCB0cnVlKTtcbiAgICB3cml0ZVVURkJ5dGVzKHZpZXcsIDgsICdXQVZFJyk7XG4gICAgd3JpdGVVVEZCeXRlcyh2aWV3LCAxMiwgJ2ZtdCAnKTtcbiAgICB2aWV3LnNldFVpbnQzMigxNiwgMTYsIHRydWUpO1xuICAgIHZpZXcuc2V0VWludDE2KDIwLCAxLCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQxNigyMiwgMSwgdHJ1ZSk7XG4gICAgdmlldy5zZXRVaW50MzIoMjQsIGNhcHRpcy5hdWRpby5zYW1wbGVSYXRlLCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQzMigyOCwgY2FwdGlzLmF1ZGlvLnNhbXBsZVJhdGUgKiAyLCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQxNigzMiwgMiwgdHJ1ZSk7XG4gICAgdmlldy5zZXRVaW50MTYoMzQsIDE2LCB0cnVlKTtcbiAgICB3cml0ZVVURkJ5dGVzKHZpZXcsIDM2LCAnZGF0YScpO1xuICAgIHZpZXcuc2V0VWludDMyKDQwLCBhdWRpb0RhdGEubGVuZ3RoICogMiwgdHJ1ZSk7XG4gICAgZmxvYXRUbzE2Qml0UENNKHZpZXcsIDQ0LCBhdWRpb0RhdGEpO1xuICAgIHZhciBibG9iID0gbmV3IEJsb2IoW3ZpZXddLCB7dHlwZTogJ2F1ZGlvL3dhdid9KSxcbiAgICAgICAgYXVkaW9VcmwgPSB3aW5kb3cuVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FwdGlzJykuaW5uZXJIVE1MICs9IChcbiAgICAgICAgJzxhdWRpbyBpZD1cIm1ldGFkYXRhXCI+PC9hdWRpbz4nXG4gICAgKTtcbiAgICB2YXIgYXVkaW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbWV0YWRhdGEnKTtcbiAgICBhdWRpby5zcmMgPSBhdWRpb1VybDtcbiAgICBhdWRpby5vbmxvYWRlZG1ldGFkYXRhID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgdmlkTGVuID0gTWF0aC5mbG9vcihhdWRpby5kdXJhdGlvbiAvIGNhcHRpcy5yZWNvcmQuZnJhbWVzLmxlbmd0aCAqIDEwMDApLFxuICAgICAgICAgICAgZGlmZmVyID0gMCxcbiAgICAgICAgICAgIGR1cmFUaW9uID0gMDtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjYXB0aXMucmVjb3JkLmZyYW1lcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgZGlmZmVyICs9IGF1ZGlvLmR1cmF0aW9uIC8gY2FwdGlzLnJlY29yZC5mcmFtZXMubGVuZ3RoICogMTAwMCAtIHZpZExlbjtcbiAgICAgICAgICAgIGlmIChkaWZmZXIgPiAxKSB7XG4gICAgICAgICAgICAgICAgZHVyYVRpb24gPSB2aWRMZW4gKyAxO1xuICAgICAgICAgICAgICAgIGRpZmZlciA9IGRpZmZlciAtIDE7XG4gICAgICAgICAgICB9IGVsc2UgeyBkdXJhVGlvbiA9IHZpZExlbiB9XG4gICAgICAgICAgICBjYXB0aXMucmVjb3JkLmZyYW1lc1tpXS5kdXJhdGlvbiA9IGR1cmFUaW9uO1xuICAgICAgICB9XG4gICAgICAgIHZhciBlbmNvZGVkRmlsZSA9IGNhcHRpcy5yZWNvcmQuY29tcGlsZSgpLFxuICAgICAgICAgICAgLy92aWRlb1VybCA9IHdpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKGVuY29kZWRGaWxlKSxcbiAgICAgICAgICAgIGpzb24gPSBuZXcgQmxvYihcbiAgICAgICAgICAgICAgICBbSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICBtZXRhOiBjYXB0aXMuaW1wcmVzcy5tZXRhLFxuICAgICAgICAgICAgICAgICAgICBzZWdtZW50czogY2FwdGlzLmltcHJlc3Muc2VnbWVudHMsXG4gICAgICAgICAgICAgICAgICAgIGR1cmF0aW9uOiB0aW1lRm9ybWF0KGF1ZGlvLmR1cmF0aW9uKSxcbiAgICAgICAgICAgICAgICB9KV0sXG4gICAgICAgICAgICAgICAge3R5cGU6ICdhcHBsaWNhdGlvbi9qc29uJ31cbiAgICAgICAgICAgICksXG4gICAgICAgICAgICAvL2pzb25VcmwgPSB3aW5kb3cuVVJMLmNyZWF0ZU9iamVjdFVSTChqc29uKSxcbiAgICAgICAgICAgIGZvcm1EYXRhID0gbmV3IEZvcm1EYXRhKCk7XG4gICAgICAgIGlmICh3aW5kb3cuY2FuVXBkYXRlKSB7XG4gICAgICAgICAgICBqc29uID0gbmV3IEJsb2IoXG4gICAgICAgICAgICAgICAgW0pTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgbWV0YTogY2FwdGlzLnBsYXllci5qc29uLm1ldGEsXG4gICAgICAgICAgICAgICAgICAgIHNlZ21lbnRzOiBkZWZpbmVTaGlmdChNYXRoLmZsb29yKGF1ZGlvLmR1cmF0aW9uKSksXG4gICAgICAgICAgICAgICAgICAgIGR1cmF0aW9uOiBjYXB0aXMucGxheWVyLmpzb24uZHVyYXRpb24sXG4gICAgICAgICAgICAgICAgICAgIHVwZGF0ZTogW3RpbWVGb3JtYXQoY2FwdGlzLnBsYXllci5qc29uLnNlZ21lbnRzW3dpbmRvdy5zZWdtZW50XS50aW1lc3RhbXApLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGltZUZvcm1hdChjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHNbd2luZG93LnNlZ21lbnQgKyAxXS50aW1lc3RhbXApXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICB9KV0sXG4gICAgICAgICAgICAgICAge3R5cGU6ICdhcHBsaWNhdGlvbi9qc29uJ31cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBmb3JtRGF0YS5hcHBlbmQoJ2F1ZGlvJywgYmxvYiwgJ2F1ZGlvLndhdicpO1xuICAgICAgICAgICAgZm9ybURhdGEuYXBwZW5kKCd2aWRlbycsIGVuY29kZWRGaWxlLCAndmlkZW8ud2VibScpO1xuICAgICAgICAgICAgZm9ybURhdGEuYXBwZW5kKCdkYXRhJywganNvbiwgJ2NhcHRpc19uZXcuanNvbicpO1xuICAgICAgICAgICAgdmFyIHJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICAgICAgICAgIHJlcXVlc3Qub3BlbignUE9TVCcsICdodHRwOi8vbG9jYWxob3N0OjMwMDAvdXBkYXRlJywgdHJ1ZSk7XG4gICAgICAgICAgICByZXF1ZXN0Lm9ubG9hZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBpZiAocmVxdWVzdC5zdGF0dXMgPT09IDIwMCkge1xuICAgICAgICAgICAgICAgICAgICBsb2NhdGlvbi5yZWxvYWQoKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnRmFpbGVkIHRvIHVwbG9hZCcpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlcXVlc3Quc2VuZChmb3JtRGF0YSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmb3JtRGF0YS5hcHBlbmQoJ2F1ZGlvJywgYmxvYiwgJ2F1ZGlvLndhdicpO1xuICAgICAgICAgICAgZm9ybURhdGEuYXBwZW5kKCd2aWRlbycsIGVuY29kZWRGaWxlLCAndmlkZW8ud2VibScpO1xuICAgICAgICAgICAgZm9ybURhdGEuYXBwZW5kKCdkYXRhJywganNvbiwgJ2NhcHRpcy5qc29uJyk7XG4gICAgICAgICAgICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgICAgICAgcmVxdWVzdC5vcGVuKCdQT1NUJywgJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMC9tZXJnZScsIHRydWUpO1xuICAgICAgICAgICAgcmVxdWVzdC5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgaWYgKHJlcXVlc3Quc3RhdHVzID09PSAyMDApIHtcbiAgICAgICAgICAgICAgICAgICAgbG9jYXRpb24ucmVsb2FkKCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0ZhaWxlZCB0byB1cGxvYWQnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXF1ZXN0LnNlbmQoZm9ybURhdGEpO1xuICAgICAgICB9XG4gICAgICAgIC8vIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0b29sYmFyJykuaW5uZXJIVE1MICs9IChcbiAgICAgICAgLy8gICAgICc8YSBpZD1cImNhcHRpc2xpbmtcIiBocmVmPVwiJysgdmlkZW9VcmwgKydcIiBkb3dubG9hZD1cInZpZGVvLndlYm1cIj4gXFxcbiAgICAgICAgLy8gICAgICAgICA8aSBjbGFzcz1cImZhIGZhLWZpbGUtdmlkZW8tb1wiPjwvaT4gXFxcbiAgICAgICAgLy8gICAgIDwvYT4gXFxcbiAgICAgICAgLy8gICAgIDxhIGlkPVwiY2FwdGlzbGlua1wiIGhyZWY9XCInKyBhdWRpb1VybCArJ1wiIGRvd25sb2FkPVwiYXVkaW8ud2F2XCI+IFxcXG4gICAgICAgIC8vICAgICAgICAgPGkgY2xhc3M9XCJmYSBmYS1maWxlLWF1ZGlvLW9cIj48L2k+IFxcXG4gICAgICAgIC8vICAgICA8L2E+IFxcXG4gICAgICAgIC8vICAgICA8YSBpZD1cImNhcHRpc2xpbmtcIiBocmVmPVwiJysganNvblVybCArJ1wiIGRvd25sb2FkPVwiY2FwdGlzLmpzb25cIj4gXFxcbiAgICAgICAgLy8gICAgICAgICA8aSBjbGFzcz1cImZhIGZhLWZpbGUtY29kZS1vXCI+PC9pPiBcXFxuICAgICAgICAvLyAgICAgPC9hPidcbiAgICAgICAgLy8gKTtcbiAgICAgICAgLy9yZWxvYWRFdmVudHMoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRlZmluZVNoaWZ0IChkdXJhdGlvbikge1xuICAgIGNvbnNvbGUubG9nKGR1cmF0aW9uKTtcbiAgICB2YXIgdGltZURpZmYgPSBjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHNbd2luZG93LnNlZ21lbnQgKyAxXS50aW1lc3RhbXAgLVxuICAgICAgICBjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHNbd2luZG93LnNlZ21lbnRdLnRpbWVzdGFtcCxcbiAgICAgICAgc2hpZnQgPSAwO1xuICAgIGlmIChkdXJhdGlvbiA8IHRpbWVEaWZmKSB7XG4gICAgICAgIHNoaWZ0ID0gdGltZURpZmYgLSBkdXJhdGlvbjtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChpIDw9IHdpbmRvdy5zZWdtZW50KSB7IGNvbnRpbnVlOyB9XG4gICAgICAgICAgICBjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHNbaV0udGltZXN0YW1wID1cbiAgICAgICAgICAgICAgICBjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHNbaV0udGltZXN0YW1wIC0gc2hpZnQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNhcHRpcy5wbGF5ZXIuanNvbi5zZWdtZW50cztcbiAgICB9XG4gICAgaWYgKGR1YXJ0aW9uID4gdGltZURpZmYpIHtcbiAgICAgICAgc2hpZnQgPSBkdWFydGlvbiAtIHRpbWVEaWZmO1xuICAgICAgICByZXR1cm4gc2hpZnQ7XG4gICAgfVxuICAgIHJldHVybiBzaGlmdDtcbn1cblxuLy93YXRjaGluZyBtb2RlXG5cbmZ1bmN0aW9uIGxvYWRWaWRlbyAoKSB7XG4gICAgdmFyIHJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICByZXF1ZXN0Lm9wZW4oJ0dFVCcsICdodHRwOi8vbG9jYWxob3N0OjMwMDAvd29ya3NwYWNlL2NhcHRpcy53ZWJtJywgdHJ1ZSk7XG4gICAgcmVxdWVzdC5yZXNwb25zZVR5cGUgPSBcImJsb2JcIjtcbiAgICByZXF1ZXN0Lm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHJlcXVlc3Quc3RhdHVzID09PSAyMDAgJiYgcmVxdWVzdC5yZWFkeVN0YXRlID09IDQpIHtcbiAgICAgICAgICAgIGNhcHRpcy5wbGF5ZXIucmVhZHkgPSB0cnVlO1xuICAgICAgICAgICAgY2FwdGlzLnBsYXllci5vYmplY3RVcmwgPSB3aW5kb3cuVVJMLmNyZWF0ZU9iamVjdFVSTCh0aGlzLnJlc3BvbnNlKTtcbiAgICAgICAgICAgIHdpbmRvdy52aWRlb1VSTCA9IGNhcHRpcy5wbGF5ZXIub2JqZWN0VXJsO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJlcXVlc3Quc2VuZCgpO1xufVxuXG5mdW5jdGlvbiBsb2FkU2VnbWVudHMgKCkge1xuICAgIHZhciByZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgcmVxdWVzdC5vcGVuKCdHRVQnLCAnaHR0cDovL2xvY2FsaG9zdDozMDAwL3dvcmtzcGFjZS9jYXB0aXMuanNvbicsIHRydWUpO1xuICAgIHJlcXVlc3Qub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAocmVxdWVzdC5zdGF0dXMgPT09IDIwMCAmJiByZXF1ZXN0LnJlYWR5U3RhdGUgPT0gNCkge1xuICAgICAgICAgICAgY2FwdGlzLnNlZ21lbnRzLnJlYWR5ID0gdHJ1ZTtcbiAgICAgICAgICAgIGNhcHRpcy5wbGF5ZXIuanNvbiA9IEpTT04ucGFyc2UodGhpcy5yZXNwb25zZSk7XG4gICAgICAgICAgICB3aW5kb3cuc2VnbWVudHMgPSBjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHM7XG4gICAgICAgICAgICB3aW5kb3cuc2xpZGVzID0gY2FwdGlzLnBsYXllci5qc29uLm1ldGE7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNhcHRpcy5wbGF5ZXIuanNvbi5zZWdtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmIChjYXB0aXMucGxheWVyLnNsaWRlcy5pbmRleE9mKGNhcHRpcy5wbGF5ZXIuanNvbi5zZWdtZW50c1tpXS5zdGVwaWQpID09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhcHRpcy5wbGF5ZXIuc2xpZGVzLnB1c2goY2FwdGlzLnBsYXllci5qc29uLnNlZ21lbnRzW2ldLnN0ZXBpZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhcHRpcy5wbGF5ZXIudGltZXN0YW1wcy5wdXNoKGNhcHRpcy5wbGF5ZXIuanNvbi5zZWdtZW50c1tpXS50aW1lc3RhbXApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIHJlcXVlc3Quc2VuZCgpO1xufVxuXG5mdW5jdGlvbiBmaW5pc2hXYXRjaGluZ01vZGUgKGUpIHtcbiAgICBpZiAoZS5jdHJsS2V5ICYmIGUua2V5Q29kZSA9PSA4NyAmJiBjYXB0aXMucGxheWVyLnJlYWR5KSB7XG4gICAgICAgIGNhcHRpcy5wbGF5ZXIuaXNPbiA9IHRydWU7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGF5ZXInKS5vdXRlckhUTUwgPSAnJztcbiAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5dXAnLCBmaW5pc2hXYXRjaGluZ01vZGUsIGZhbHNlKTtcbiAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLCB3YXRjaGluZ01vZGUsIGZhbHNlKTtcbiAgICAgICAgbG9jYXRpb24ucmVsb2FkKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBzZWVrU2VnbWVudHMgKHRpbWUpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNhcHRpcy5wbGF5ZXIudGltZXN0YW1wcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAodGltZSA8IGNhcHRpcy5wbGF5ZXIudGltZXN0YW1wc1tpXSkge1xuICAgICAgICAgICAgY2FwdGlzLnBsYXllci5jdXJyZW50U3RlcCA9IGkgLSAxO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRpbWUgPiBjYXB0aXMucGxheWVyLnRpbWVzdGFtcHNbaV0gJiYgKGNhcHRpcy5wbGF5ZXIudGltZXN0YW1wcy5sZW5ndGggLSAxKSA9PSBpKSB7XG4gICAgICAgICAgICBjYXB0aXMucGxheWVyLmN1cnJlbnRTdGVwID0gaTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChjYXB0aXMucGxheWVyLmN1cnJlbnRTdGVwID09IC0xKSB7XG4gICAgICAgIGltcHJlc3MoKS5nb3RvKCdvdmVydmlldycpO1xuICAgICAgICBpbXByZXNzKCkubmV4dCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChjYXB0aXMucGxheWVyLmFjdGl2ZVN0ZXAgIT0gY2FwdGlzLnBsYXllci5jdXJyZW50U3RlcCkge1xuICAgICAgICAgICAgdmFyIHNsaWRlID0gY2FwdGlzLnBsYXllci5zbGlkZXMuaW5kZXhPZihcbiAgICAgICAgICAgICAgICBjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHNbY2FwdGlzLnBsYXllci5jdXJyZW50U3RlcF0uc3RlcGlkXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgaWYgKHNsaWRlID4gMCkge1xuICAgICAgICAgICAgICAgIGltcHJlc3MoKS5nb3RvKGNhcHRpcy5wbGF5ZXIuc2xpZGVzW3NsaWRlIC0gMV0pO1xuICAgICAgICAgICAgICAgIGltcHJlc3MoKS5uZXh0KCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGltcHJlc3MoKS5nb3RvKCdvdmVydmlldycpO1xuICAgICAgICAgICAgICAgIGltcHJlc3MoKS5uZXh0KCk7XG4gICAgICAgICAgICAgICAgaW1wcmVzcygpLm5leHQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHNbY2FwdGlzLnBsYXllci5jdXJyZW50U3RlcF0ubmV4dCA+IDApIHtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNhcHRpcy5wbGF5ZXIuanNvbi5zZWdtZW50c1tjYXB0aXMucGxheWVyLmN1cnJlbnRTdGVwXS5uZXh0OyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaW1wcmVzcygpLm5leHQoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoY2FwdGlzLnBsYXllci5qc29uLnNlZ21lbnRzW2NhcHRpcy5wbGF5ZXIuY3VycmVudFN0ZXBdLnByZXYgPj0gMCkge1xuICAgICAgICAgICAgICAgIHZhciBzdGVwID0gY2FwdGlzLnBsYXllci5qc29uLm1ldGFbXG4gICAgICAgICAgICAgICAgICAgIGNhcHRpcy5wbGF5ZXIuanNvbi5zZWdtZW50c1tjYXB0aXMucGxheWVyLmN1cnJlbnRTdGVwXS5zdGVwaWRcbiAgICAgICAgICAgICAgICBdIC0gY2FwdGlzLnBsYXllci5qc29uLnNlZ21lbnRzW2NhcHRpcy5wbGF5ZXIuY3VycmVudFN0ZXBdLnByZXY7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdGVwOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaW1wcmVzcygpLm5leHQoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXB0aXMucGxheWVyLmFjdGl2ZVN0ZXAgPSBjYXB0aXMucGxheWVyLmN1cnJlbnRTdGVwO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiBjb250cm9sU2VnbWVudHMgKGUpIHtcbiAgICB2YXIgdmlkZW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FwdGlzX21hZGUnKSxcbiAgICAgICAgdGltZSA9IDA7XG4gICAgaWYgKGUua2V5Q29kZSA9PSAzOSkge1xuICAgICAgICBjYXB0aXMucGxheWVyLmtleXByZXNzZWQgPSB0cnVlO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNhcHRpcy5wbGF5ZXIudGltZXN0YW1wcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHZpZGVvLmN1cnJlbnRUaW1lIDwgY2FwdGlzLnBsYXllci50aW1lc3RhbXBzW2ldKSB7XG4gICAgICAgICAgICAgICAgdGltZSA9IGNhcHRpcy5wbGF5ZXIudGltZXN0YW1wc1tpXTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB2aWRlby5jdXJyZW50VGltZSA9IHRpbWU7XG4gICAgfVxuICAgIGlmIChlLmtleUNvZGUgPT0gMzcpIHtcbiAgICAgICAgY2FwdGlzLnBsYXllci5rZXlwcmVzc2VkID0gdHJ1ZTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjYXB0aXMucGxheWVyLnRpbWVzdGFtcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh2aWRlby5jdXJyZW50VGltZSA8IGNhcHRpcy5wbGF5ZXIudGltZXN0YW1wc1tpXSkge1xuICAgICAgICAgICAgICAgIGlmIChpLTIgPCAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHRpbWUgPSAwO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aW1lID0gY2FwdGlzLnBsYXllci50aW1lc3RhbXBzW2kgLSAyXTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHZpZGVvLmN1cnJlbnRUaW1lID0gdGltZTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHBsYXlWaWRlbyAoZSkge1xuICAgIGUudGFyZ2V0LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BhdXNlJykuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUnO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBjb250cm9sU2VnbWVudHMsIGZhbHNlKTtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGF1c2UnKS5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAnY2xpY2snLFxuICAgICAgICBwYXVzZVZpZGVvLFxuICAgICAgICBmYWxzZVxuICAgICk7XG4gICAgdmFyIHZpZGVvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcHRpc19tYWRlJyksXG4gICAgICAgIHRpbWVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3B0aW1lcicpLFxuICAgICAgICBidWZmID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BidWZmZXInKSxcbiAgICAgICAgcGxheWJhciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGF5YmFyJyk7XG4gICAgdmlkZW8ucGxheSgpO1xuICAgIGNhcHRpcy5wbGF5ZXIudGltZXVwZGF0ZSA9IHNldEludGVydmFsKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc2Vla1NlZ21lbnRzKE1hdGguZmxvb3IodmlkZW8uY3VycmVudFRpbWUpKTtcbiAgICAgICAgdGltZXIuaW5uZXJIVE1MID0gdGltZUZvcm1hdCh2aWRlby5jdXJyZW50VGltZSk7XG4gICAgICAgIGJ1ZmYudmFsdWUgPSB2aWRlby5jdXJyZW50VGltZSArIDU7XG4gICAgICAgIHBsYXliYXIudmFsdWUgPSB2aWRlby5jdXJyZW50VGltZTtcbiAgICAgICAgaWYgKHZpZGVvLmVuZGVkKSB7dmlkZW9PbkVuZCgpO31cbiAgICB9LCAxMDAwKTtcbn1cblxuZnVuY3Rpb24gcGF1c2VWaWRlbyAoZSkge1xuICAgIGNsZWFySW50ZXJ2YWwoY2FwdGlzLnBsYXllci50aW1ldXBkYXRlKTtcbiAgICB2YXIgdmlkZW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FwdGlzX21hZGUnKTtcbiAgICB2aWRlby5wYXVzZSgpO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGF5Jykuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUnO1xuICAgIGUudGFyZ2V0LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXknKS5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAnY2xpY2snLFxuICAgICAgICBwbGF5VmlkZW8sXG4gICAgICAgIGZhbHNlXG4gICAgKTtcbn1cblxuZnVuY3Rpb24gdmlkZW9PbkVuZCAoKSB7XG4gICAgdmFyIHZpZGVvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcHRpc19tYWRlJyksXG4gICAgICAgIHRpbWVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3B0aW1lcicpLFxuICAgICAgICBidWZmID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BidWZmZXInKSxcbiAgICAgICAgcGxheWJhciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGF5YmFyJyk7XG4gICAgdmlkZW8uY3VycmVudFRpbWUgPSAwO1xuICAgIHRpbWVyLmlubmVySFRNTCA9ICcwMDowMDowMCc7XG4gICAgYnVmZi52YWx1ZSA9IDA7XG4gICAgcGxheWJhci52YWx1ZSA9IDA7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXknKS5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZSc7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BhdXNlJykuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheScpLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICdjbGljaycsXG4gICAgICAgIHBsYXlWaWRlbyxcbiAgICAgICAgZmFsc2VcbiAgICApO1xuICAgIGNsZWFySW50ZXJ2YWwoY2FwdGlzLnBsYXllci50aW1ldXBkYXRlKTtcbn1cblxuZnVuY3Rpb24gc2V0Vm9sdW1lIChlKSB7XG4gICAgdmFyIHZpZGVvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcHRpc19tYWRlJyk7XG4gICAgdmlkZW8udm9sdW1lID0gZS50YXJnZXQudmFsdWU7XG4gICAgaWYgKGUudGFyZ2V0LnZhbHVlID09IDEpIHtcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hpZ2h2Jykuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUnO1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG93dicpLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdvZmZ2Jykuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICB9XG4gICAgaWYgKGUudGFyZ2V0LnZhbHVlIDwgMSAmJiBlLnRhcmdldC52YWx1ZSA+IDApIHtcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hpZ2h2Jykuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvd3YnKS5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZSc7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdvZmZ2Jykuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICB9XG4gICAgaWYgKGUudGFyZ2V0LnZhbHVlID09IDApIHtcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hpZ2h2Jykuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvd3YnKS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnb2ZmdicpLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lJztcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHNlZWtWaWRlbyAoZSkge1xuICAgIGNsZWFySW50ZXJ2YWwoY2FwdGlzLnBsYXllci50aW1ldXBkYXRlKTtcbiAgICB2YXIgdmlkZW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FwdGlzX21hZGUnKSxcbiAgICAgICAgYnVmZiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwYnVmZmVyJyksXG4gICAgICAgIHRpbWVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3B0aW1lcicpLFxuICAgICAgICBwbGF5YmFyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXliYXInKTtcbiAgICB2aWRlby5wYXVzZSgpO1xuICAgIHZpZGVvLmN1cnJlbnRUaW1lID0gZS50YXJnZXQudmFsdWU7XG4gICAgdmlkZW8ucGxheSgpO1xuICAgIGNhcHRpcy5wbGF5ZXIudGltZXVwZGF0ZSA9IHNldEludGVydmFsKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc2Vla1NlZ21lbnRzKE1hdGguZmxvb3IodmlkZW8uY3VycmVudFRpbWUpKTtcbiAgICAgICAgdGltZXIuaW5uZXJIVE1MID0gdGltZUZvcm1hdCh2aWRlby5jdXJyZW50VGltZSk7XG4gICAgICAgIGJ1ZmYudmFsdWUgPSB2aWRlby5jdXJyZW50VGltZSArIDU7XG4gICAgICAgIHBsYXliYXIudmFsdWUgPSB2aWRlby5jdXJyZW50VGltZTtcbiAgICAgICAgaWYgKHZpZGVvLmVuZGVkKSB7dmlkZW9PbkVuZCgpO31cbiAgICB9LCAxMDAwKTtcbn1cblxuZnVuY3Rpb24gZnVsbFNjcmVlbiAoZSkge1xuICAgIHZhciB2aWRlbyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYXB0aXNfbWFkZScpO1xuICAgIGlmICh2aWRlby53ZWJraXRSZXF1ZXN0RnVsbHNjcmVlbikge1xuICAgICAgICBlLnRhcmdldC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdleGl0ZnVsbHMnKS5zdHlsZS5kaXNwbGF5ID0gXCJpbmxpbmVcIjtcbiAgICAgICAgdmlkZW8ud2Via2l0UmVxdWVzdEZ1bGxzY3JlZW4oKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGV4aXRGdWxsU2NyZWVuIChlKSB7XG4gICAgaWYgKGRvY3VtZW50LndlYmtpdEV4aXRGdWxsc2NyZWVuKSB7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmdWxscycpLnN0eWxlLmRpc3BsYXkgPSBcImlubGluZVwiO1xuICAgICAgICBlLnRhcmdldC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgICAgIGRvY3VtZW50LndlYmtpdEV4aXRGdWxsc2NyZWVuKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB3YXRjaGluZ01vZGUgKGUpIHtcbiAgICBpZiAoZS5jdHJsS2V5ICYmIGUua2V5Q29kZSA9PSA4NyAmJiBjYXB0aXMucGxheWVyLnJlYWR5ICYmIGNhcHRpcy5zZWdtZW50cy5yZWFkeSkge1xuICAgICAgICBpbXByZXNzKCkuZ290byhjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHNbMF0uc3RlcGlkKTtcbiAgICAgICAgaW1wcmVzcygpLnByZXYoKTtcbiAgICAgICAgY2FwdGlzLnBsYXllci5pc09uID0gdHJ1ZTtcbiAgICAgICAgaWYgKGNhcHRpcy50b29sYmFyKSB7XG4gICAgICAgICAgICBjbGVhclNwYWNlKCk7XG4gICAgICAgIH1cbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcHRpcycpLmlubmVySFRNTCArPSAoXG4gICAgICAgICAgICAnPGRpdiBpZD1cInBsYXllclwiPiBcXFxuICAgICAgICAgICAgICAgIDx2aWRlbyBpZD1cImNhcHRpc19tYWRlXCIgcHJlbG9hZD48L3ZpZGVvPiBcXFxuICAgICAgICAgICAgICAgIDxkaXYgaWQ9XCJjYXB0aXNfY29udHJvbHNcIj4gXFxcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBpZD1cImNhcHRpc19wbGF5ZXJcIj4gXFxcbiAgICAgICAgICAgICAgICAgICAgICAgIDxpIGlkPVwicGxheVwiIGNsYXNzPVwiZmEgZmEtcGxheSBjYXB0aXNfaWNvblwiPjwvaT4gXFxcbiAgICAgICAgICAgICAgICAgICAgICAgIDxpIGlkPVwicGF1c2VcIiBjbGFzcz1cImZhIGZhLXBhdXNlIGNhcHRpc19pY29uXCI+PC9pPiBcXFxuICAgICAgICAgICAgICAgICAgICAgICAgPGNhbnZhcyBpZD1cInNlZ21lbnRzXCI+PC9jYW52YXM+IFxcXG4gICAgICAgICAgICAgICAgICAgICAgICA8cHJvZ3Jlc3MgdmFsdWU9XCIwXCIgaWQ9XCJwYnVmZmVyXCI+PC9wcm9ncmVzcz4gXFxcbiAgICAgICAgICAgICAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwicmFuZ2VcIiBpZD1cInBsYXliYXJcIiB2YWx1ZT1cIjBcIj4gXFxcbiAgICAgICAgICAgICAgICAgICAgICAgIDxpIGlkPVwicHRpbWVyXCI+MDA6MDA6MDA8L2k+IFxcXG4gICAgICAgICAgICAgICAgICAgICAgICA8aSBpZD1cImhpZ2h2XCIgY2xhc3M9XCJmYSBmYS12b2x1bWUtdXAgY2FwdGlzX2ljb25cIj48L2k+IFxcXG4gICAgICAgICAgICAgICAgICAgICAgICA8aSBpZD1cImxvd3ZcIiBjbGFzcz1cImZhIGZhLXZvbHVtZS1kb3duIGNhcHRpc19pY29uXCI+PC9pPiBcXFxuICAgICAgICAgICAgICAgICAgICAgICAgPGkgaWQ9XCJvZmZ2XCIgY2xhc3M9XCJmYSBmYS12b2x1bWUtb2ZmIGNhcHRpc19pY29uXCI+PC9pPiBcXFxuICAgICAgICAgICAgICAgICAgICAgICAgPGlucHV0IHR5cGU9XCJyYW5nZVwiIGlkPVwidm9sdW1lXCIgbWluPVwiMFwiIG1heD1cIjFcIiBzdGVwPVwiMC4xXCIgdmFsdWU9XCIxXCI+IFxcXG4gICAgICAgICAgICAgICAgICAgICAgICA8aSBpZD1cImZ1bGxzXCIgY2xhc3M9XCJmYSBmYS1leWUgY2FwdGlzX2ljb25cIj48L2k+IFxcXG4gICAgICAgICAgICAgICAgICAgICAgICA8aSBpZD1cImV4aXRmdWxsc1wiIGNsYXNzPVwiZmEgZmEtZXllLXNsYXNoIGNhcHRpc19pY29uXCI+PC9pPiBcXFxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj4gXFxcbiAgICAgICAgICAgICAgICA8L2Rpdj4gXFxcbiAgICAgICAgICAgIDwvZGl2PidcbiAgICAgICAgKTtcbiAgICAgICAgdmFyIHZpZGVvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcHRpc19tYWRlJyk7XG4gICAgICAgIHZpZGVvLnNyYyA9IGNhcHRpcy5wbGF5ZXIub2JqZWN0VXJsO1xuICAgICAgICB2aWRlby5hZGRFdmVudExpc3RlbmVyKCdsb2FkZWRtZXRhZGF0YScsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwYnVmZmVyJykuc2V0QXR0cmlidXRlKFxuICAgICAgICAgICAgICAgIFwibWF4XCIsXG4gICAgICAgICAgICAgICAgTWF0aC5mbG9vcih2aWRlby5kdXJhdGlvbilcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheWJhcicpLnNldEF0dHJpYnV0ZShcbiAgICAgICAgICAgICAgICBcIm1heFwiLFxuICAgICAgICAgICAgICAgIE1hdGguZmxvb3IodmlkZW8uZHVyYXRpb24pXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgdmFyIGNhbnZhcyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzZWdtZW50cycpLFxuICAgICAgICAgICAgICAgIGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpLFxuICAgICAgICAgICAgICAgIHJhdGlvID0gY2FudmFzLndpZHRoIC8gdmlkZW8uZHVyYXRpb24sXG4gICAgICAgICAgICAgICAgcG9zaXRpb24gPSAwLFxuICAgICAgICAgICAgICAgIHNlZ21lbnRXaWR0aCA9IDA7XG4gICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheScpLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgICAgICAgICBwbGF5VmlkZW8sXG4gICAgICAgICAgICAgICAgZmFsc2VcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZXhpdGZ1bGxzJykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICAgICAnY2xpY2snLFxuICAgICAgICAgICAgICAgIGV4aXRGdWxsU2NyZWVuLFxuICAgICAgICAgICAgICAgIGZhbHNlXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Z1bGxzJykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICAgICAnY2xpY2snLFxuICAgICAgICAgICAgICAgIGZ1bGxTY3JlZW4sXG4gICAgICAgICAgICAgICAgZmFsc2VcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndm9sdW1lJykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICAgICAnY2hhbmdlJyxcbiAgICAgICAgICAgICAgICBzZXRWb2x1bWUsXG4gICAgICAgICAgICAgICAgZmFsc2VcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheWJhcicpLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgICAgICAgJ2NoYW5nZScsXG4gICAgICAgICAgICAgICAgc2Vla1ZpZGVvLFxuICAgICAgICAgICAgICAgIGZhbHNlXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjYXB0aXMucGxheWVyLnRpbWVzdGFtcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBzZWdtZW50V2lkdGggPSBNYXRoLmZsb29yKGNhcHRpcy5wbGF5ZXIudGltZXN0YW1wc1tpXSAqIHJhdGlvKSAtIDE7XG4gICAgICAgICAgICAgICAgY3R4LmZpbGxTdHlsZSA9ICcjMTNBRDg3JztcbiAgICAgICAgICAgICAgICBjdHguZmlsbFJlY3QocG9zaXRpb24sIDAsIHNlZ21lbnRXaWR0aCwgY2FudmFzLmhlaWdodCk7XG4gICAgICAgICAgICAgICAgY3R4LmZpbGxTdHlsZSA9ICcjRkZGJztcbiAgICAgICAgICAgICAgICBjdHguZmlsbFJlY3Qoc2VnbWVudFdpZHRoLCAwLCAxLCBjYW52YXMuaGVpZ2h0KTtcbiAgICAgICAgICAgICAgICBwb3NpdGlvbiA9IHNlZ21lbnRXaWR0aCArIDE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdrZXl1cCcsIHdhdGNoaW5nTW9kZSwgZmFsc2UpO1xuICAgICAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLCBmaW5pc2hXYXRjaGluZ01vZGUsIGZhbHNlKTtcbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdpbXByZXNzOnN0ZXBlbnRlcicsIGZ1bmN0aW9uIChlKSB7XG4gICAgY2FwdGlzLmltcHJlc3MuaXNTdGVwID0gdHJ1ZTtcbiAgICBjYXB0aXMuaW1wcmVzcy5zdGVwID0gZS50YXJnZXQuaWQ7XG59LCBmYWxzZSk7XG5cbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleXVwJywgaW5pdGlhbGl6ZVRvb2xiYXIsIGZhbHNlKTtcbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleXVwJywgd2F0Y2hpbmdNb2RlLCBmYWxzZSk7XG5cbmxvYWRWaWRlbygpO1xubG9hZFNlZ21lbnRzKCk7XG4iLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG4oZnVuY3Rpb24gYnJvd3NlcmlmeVNoaW0obW9kdWxlLCBleHBvcnRzLCBkZWZpbmUsIGJyb3dzZXJpZnlfc2hpbV9fZGVmaW5lX19tb2R1bGVfX2V4cG9ydF9fKSB7XG52YXIgaW5pdGlhbGl6ZUVkaXRvciA9IGZ1bmN0aW9uKCkge1xuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYXB0aXMnKS5pbm5lckhUTUwgKz0gKFxuICAgICAgICAnPGRpdiBpZD1cImNhcHRpc19lZGl0b3JcIj4gXFxcbiAgICAgICAgICAgIDxkaXYgaWQ9XCJsb2FkaW5nXCI+PHByb2dyZXNzIGlkPVwibG9hZGluZ19zZWdtZW50c1wiIHZhbHVlPVwiMFwiPjwvcHJvZ3Jlc3M+PC9kaXY+IFxcXG4gICAgICAgICAgICA8dmlkZW8gaWQ9XCJlZGl0X3ZpZGVvXCIgcHJlbG9hZCBhdXRvcGxheSBtdXRlZD48L3ZpZGVvPiBcXFxuICAgICAgICAgICAgPGRpdiBpZD1cInNlZ21lbnRfY29udFwiPjxkaXYgaWQ9XCJjYXB0aXNfZWRpdG9yX3NlZ21lbnRzXCI+PC9kaXY+PC9kaXY+IFxcXG4gICAgICAgICAgICA8Y2FudmFzIGlkPVwic2VnbWVudHNob3RcIj48L2NhbnZhcz4gXFxcbiAgICAgICAgPC9kaXY+J1xuICAgICk7XG4gICAgdmFyIHZpZGVvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2VkaXRfdmlkZW8nKSxcbiAgICAgICAgcGFydHMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FwdGlzX2VkaXRvcl9zZWdtZW50cycpLFxuICAgICAgICBjb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2VnbWVudF9jb250JyksXG4gICAgICAgIGxvYWRlciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2FkaW5nX3NlZ21lbnRzJyksXG4gICAgICAgIGxvYWRpbmcgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9hZGluZycpLFxuICAgICAgICBjYW52YXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2VnbWVudHNob3QnKSxcbiAgICAgICAgY3R4ID0gY2FudmFzLmdldENvbnRleHQoJzJkJyk7XG4gICAgICAgIGNhbnZhcy53aWR0aCA9IDEzMDtcbiAgICAgICAgY2FudmFzLmhlaWdodCA9IDEzMDtcbiAgICBwYXJ0cy5pbm5lckhUTUwgPSAnJztcbiAgICB2aWRlby5zcmMgPSB3aW5kb3cudmlkZW9VUkw7XG4gICAgY29uc29sZS5sb2cod2luZG93LnNlZ21lbnRzKTtcbiAgICBsb2FkZXIuc2V0QXR0cmlidXRlKCdtYXgnLCB3aW5kb3cuc2VnbWVudHMubGVuZ3RoIC0gMSk7XG4gICAgdmlkZW8ub25sb2FkZWRtZXRhZGF0YSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGkgPSAwO1xuICAgICAgICB2YXIgbG9vcCA9IHNldEludGVydmFsKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgLy9jb25zb2xlLmxvZyh3aW5kb3cuc2VnbWVudHNbaV0pO1xuICAgICAgICAgICAgcGFydHMuaW5uZXJIVE1MICs9IChcbiAgICAgICAgICAgICAgICAnPGRpdiBjbGFzcz1cInNlZ21lbnRfYm94XCIgaWQ9XCJzZWdtZW50XycrIGkgKydcIj4gXFxcbiAgICAgICAgICAgICAgICAgICAgPGkgY2xhc3M9XCJzZWdtZW50X3RpbWVcIj4nKyB3aW5kb3cuZm9ybWF0RHVyYXRpb24od2luZG93LnNlZ21lbnRzW2ldLnRpbWVzdGFtcCkgKyc8L2k+IFxcXG4gICAgICAgICAgICAgICAgPC9kaXY+J1xuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHZpZGVvLmN1cnJlbnRUaW1lID0gd2luZG93LnNlZ21lbnRzW2ldLnRpbWVzdGFtcDtcbiAgICAgICAgICAgIGN0eC5kcmF3SW1hZ2UodmlkZW8sIDAsIDAsIDEzMCwgMTMwKTtcbiAgICAgICAgICAgIHZhciBpbWFnZSA9IGNhbnZhcy50b0RhdGFVUkwoKSxcbiAgICAgICAgICAgICAgICBib3ggPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2VnbWVudF8nICsgaSk7XG4gICAgICAgICAgICAvL2NvbnNvbGUubG9nKGltYWdlKTtcbiAgICAgICAgICAgIGJveC5zdHlsZS5iYWNrZ3JvdW5kSW1hZ2UgPSAndXJsKCcgKyBpbWFnZSArICcpJztcbiAgICAgICAgICAgIGxvYWRlci52YWx1ZSA9IGk7XG4gICAgICAgICAgICBpKys7XG4gICAgICAgICAgICBpZiAoaSA9PSB3aW5kb3cuc2VnbWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgLy9wYXJ0cy5zdHlsZS5oZWlnaHQgPSAxMjAgKiB3aW5kb3cuc2VnbWVudHMubGVuZ3RoICsgJ3B4JztcbiAgICAgICAgICAgICAgICBjb250YWluZXIuc3R5bGUud2lkdGggPSAnMTMwcHgnO1xuICAgICAgICAgICAgICAgIGxvYWRpbmcuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICAgICAgICAgICB2aWRlby5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcbiAgICAgICAgICAgICAgICB2aWRlby5wYXVzZSgpO1xuICAgICAgICAgICAgICAgIHZpZGVvLmN1cnJlbnRUaW1lID0gMDtcbiAgICAgICAgICAgICAgICBjbGVhckludGVydmFsKGxvb3ApO1xuICAgICAgICAgICAgICAgIHZhciBlbGVtZW50cyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoJ3NlZ21lbnRfYm94Jyk7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBlbGVtZW50cy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICBlbGVtZW50c1tqXS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGVkaXRvclBsYXlTZWdtZW50LCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vY29uc29sZS5sb2coZWxlbWVudHMpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfSwgMTAwKTtcbiAgICB9O1xuICAgIHdpbmRvdy5yZWxvYWRFdmVudHMoKTtcblxufVxuXG52YXIgZWRpdG9yUGxheVNlZ21lbnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmlkZW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZWRpdF92aWRlbycpO1xuICAgIHZhciBpbmRleCA9IHBhcnNlSW50KHRoaXMuaWQuc3BsaXQoJ18nKVsxXSk7XG4gICAgd2luZG93LnNlZ21lbnQgPSBpbmRleDtcbiAgICB3aW5kb3cuY2FuVXBkYXRlID0gdHJ1ZTtcbiAgICB2aWRlby5jdXJyZW50VGltZSA9IHdpbmRvdy5zZWdtZW50c1tpbmRleF0udGltZXN0YW1wO1xuICAgIHZpZGVvLm11dGVkID0gZmFsc2U7XG4gICAgaW1wcmVzcygpLmdvdG8oJ292ZXJ2aWV3Jyk7XG4gICAgaW1wcmVzcygpLmdvdG8od2luZG93LnNlZ21lbnRzW2luZGV4XS5zdGVwaWQpO1xuICAgIC8vVE9ETzogQWxsIGNhc2VzXG4gICAgaWYgKHdpbmRvdy5zZWdtZW50c1tpbmRleF0ubmV4dCkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHdpbmRvdy5zZWdtZW50c1tpbmRleF0ubmV4dDsgaSsrKSB7XG4gICAgICAgICAgICBpbXByZXNzKCkubmV4dCgpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmICh3aW5kb3cuc2VnbWVudHNbaW5kZXhdLnByZXYpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB3aW5kb3cuc2VnbWVudHNbaW5kZXhdLnByZXY7IGkrKykge1xuICAgICAgICAgICAgaW1wcmVzcygpLnByZXYoKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBjb25zb2xlLmxvZyh3aW5kb3cuc2xpZGVzLCB3aW5kb3cuc2VnbWVudHNbaW5kZXhdKTtcbiAgICB2aWRlby5wbGF5KCk7XG5cbn1cblxuZXhwb3J0cy5pbml0aWFsaXplRWRpdG9yID0gaW5pdGlhbGl6ZUVkaXRvcjtcblxuOyBicm93c2VyaWZ5X3NoaW1fX2RlZmluZV9fbW9kdWxlX19leHBvcnRfXyh0eXBlb2YgRWRpdG9yICE9IFwidW5kZWZpbmVkXCIgPyBFZGl0b3IgOiB3aW5kb3cuRWRpdG9yKTtcblxufSkuY2FsbChnbG9iYWwsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGZ1bmN0aW9uIGRlZmluZUV4cG9ydChleCkgeyBtb2R1bGUuZXhwb3J0cyA9IGV4OyB9KTtcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSkiLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG4oZnVuY3Rpb24gYnJvd3NlcmlmeVNoaW0obW9kdWxlLCBleHBvcnRzLCBkZWZpbmUsIGJyb3dzZXJpZnlfc2hpbV9fZGVmaW5lX19tb2R1bGVfX2V4cG9ydF9fKSB7XG4vKlxuICAgIHZhciB2aWQgPSBuZXcgV2hhbW15LlZpZGVvKCk7XG4gICAgdmlkLmFkZChjYW52YXMgb3IgZGF0YSB1cmwpXG4gICAgdmlkLmNvbXBpbGUoKVxuKi9cblxuXG52YXIgV2hhbW15ID0gKGZ1bmN0aW9uKCl7XG4gICAgLy8gaW4gdGhpcyBjYXNlLCBmcmFtZXMgaGFzIGEgdmVyeSBzcGVjaWZpYyBtZWFuaW5nLCB3aGljaCB3aWxsIGJlXG4gICAgLy8gZGV0YWlsZWQgb25jZSBpIGZpbmlzaCB3cml0aW5nIHRoZSBjb2RlXG5cbiAgICBmdW5jdGlvbiB0b1dlYk0oZnJhbWVzLCBvdXRwdXRBc0FycmF5KXtcbiAgICAgICAgdmFyIGluZm8gPSBjaGVja0ZyYW1lcyhmcmFtZXMpO1xuXG4gICAgICAgIC8vbWF4IGR1cmF0aW9uIGJ5IGNsdXN0ZXIgaW4gbWlsbGlzZWNvbmRzXG4gICAgICAgIHZhciBDTFVTVEVSX01BWF9EVVJBVElPTiA9IDMwMDAwO1xuXG4gICAgICAgIHZhciBFQk1MID0gW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIFwiaWRcIjogMHgxYTQ1ZGZhMywgLy8gRUJNTFxuICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBbXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiAxLFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDQyODYgLy8gRUJNTFZlcnNpb25cbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IDEsXG4gICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4NDJmNyAvLyBFQk1MUmVhZFZlcnNpb25cbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IDQsXG4gICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4NDJmMiAvLyBFQk1MTWF4SURMZW5ndGhcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IDgsXG4gICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4NDJmMyAvLyBFQk1MTWF4U2l6ZUxlbmd0aFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogXCJ3ZWJtXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4NDI4MiAvLyBEb2NUeXBlXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiAyLFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDQyODcgLy8gRG9jVHlwZVZlcnNpb25cbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IDIsXG4gICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4NDI4NSAvLyBEb2NUeXBlUmVhZFZlcnNpb25cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgXCJpZFwiOiAweDE4NTM4MDY3LCAvLyBTZWdtZW50XG4gICAgICAgICAgICAgICAgXCJkYXRhXCI6IFtcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDE1NDlhOTY2LCAvLyBJbmZvXG4gICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IDFlNiwgLy9kbyB0aGluZ3MgaW4gbWlsbGlzZWNzIChudW0gb2YgbmFub3NlY3MgZm9yIGR1cmF0aW9uIHNjYWxlKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4MmFkN2IxIC8vIFRpbWVjb2RlU2NhbGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IFwid2hhbW15XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHg0ZDgwIC8vIE11eGluZ0FwcFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogXCJ3aGFtbXlcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDU3NDEgLy8gV3JpdGluZ0FwcFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogZG91YmxlVG9TdHJpbmcoaW5mby5kdXJhdGlvbiksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHg0NDg5IC8vIER1cmF0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4MTY1NGFlNmIsIC8vIFRyYWNrc1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHhhZSwgLy8gVHJhY2tFbnRyeVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiAxLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHhkNyAvLyBUcmFja051bWJlclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogMSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4NjNjNSAvLyBUcmFja1VJRFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4OWMgLy8gRmxhZ0xhY2luZ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogXCJ1bmRcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4MjJiNTljIC8vIExhbmd1YWdlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBcIlZfVlA4XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDg2IC8vIENvZGVjSURcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IFwiVlA4XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDI1ODY4OCAvLyBDb2RlY05hbWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IDEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDgzIC8vIFRyYWNrVHlwZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4ZTAsICAvLyBWaWRlb1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBpbmZvLndpZHRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweGIwIC8vIFBpeGVsV2lkdGhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IGluZm8uaGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweGJhIC8vIFBpeGVsSGVpZ2h0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgICAgLy9jbHVzdGVyIGluc2VydGlvbiBwb2ludFxuICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgIH1cbiAgICAgICAgIF07XG5cblxuICAgICAgICAvL0dlbmVyYXRlIGNsdXN0ZXJzIChtYXggZHVyYXRpb24pXG4gICAgICAgIHZhciBmcmFtZU51bWJlciA9IDA7XG4gICAgICAgIHZhciBjbHVzdGVyVGltZWNvZGUgPSAwO1xuICAgICAgICB3aGlsZShmcmFtZU51bWJlciA8IGZyYW1lcy5sZW5ndGgpe1xuXG4gICAgICAgICAgICB2YXIgY2x1c3RlckZyYW1lcyA9IFtdO1xuICAgICAgICAgICAgdmFyIGNsdXN0ZXJEdXJhdGlvbiA9IDA7XG4gICAgICAgICAgICBkbyB7XG4gICAgICAgICAgICAgICAgY2x1c3RlckZyYW1lcy5wdXNoKGZyYW1lc1tmcmFtZU51bWJlcl0pO1xuICAgICAgICAgICAgICAgIGNsdXN0ZXJEdXJhdGlvbiArPSBmcmFtZXNbZnJhbWVOdW1iZXJdLmR1cmF0aW9uO1xuICAgICAgICAgICAgICAgIGZyYW1lTnVtYmVyKys7XG4gICAgICAgICAgICB9d2hpbGUoZnJhbWVOdW1iZXIgPCBmcmFtZXMubGVuZ3RoICYmIGNsdXN0ZXJEdXJhdGlvbiA8IENMVVNURVJfTUFYX0RVUkFUSU9OKTtcblxuICAgICAgICAgICAgdmFyIGNsdXN0ZXJDb3VudGVyID0gMDtcbiAgICAgICAgICAgIHZhciBjbHVzdGVyID0ge1xuICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4MWY0M2I2NzUsIC8vIENsdXN0ZXJcbiAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogY2x1c3RlclRpbWVjb2RlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHhlNyAvLyBUaW1lY29kZVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBdLmNvbmNhdChjbHVzdGVyRnJhbWVzLm1hcChmdW5jdGlvbih3ZWJwKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBibG9jayA9IG1ha2VTaW1wbGVCbG9jayh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGlzY2FyZGFibGU6IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJhbWU6IHdlYnAuZGF0YS5zbGljZSg0KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbnZpc2libGU6IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5ZnJhbWU6IDEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFjaW5nOiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyYWNrTnVtOiAxLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVjb2RlOiBNYXRoLnJvdW5kKGNsdXN0ZXJDb3VudGVyKVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjbHVzdGVyQ291bnRlciArPSB3ZWJwLmR1cmF0aW9uO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhOiBibG9jayxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZDogMHhhM1xuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgfSkpXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvL0FkZCBjbHVzdGVyIHRvIHNlZ21lbnRcbiAgICAgICAgICAgIEVCTUxbMV0uZGF0YS5wdXNoKGNsdXN0ZXIpO1xuICAgICAgICAgICAgY2x1c3RlclRpbWVjb2RlICs9IGNsdXN0ZXJEdXJhdGlvbjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBnZW5lcmF0ZUVCTUwoRUJNTCwgb3V0cHV0QXNBcnJheSlcbiAgICB9XG5cbiAgICAvLyBzdW1zIHRoZSBsZW5ndGhzIG9mIGFsbCB0aGUgZnJhbWVzIGFuZCBnZXRzIHRoZSBkdXJhdGlvbiwgd29vXG5cbiAgICBmdW5jdGlvbiBjaGVja0ZyYW1lcyhmcmFtZXMpe1xuICAgICAgICB2YXIgd2lkdGggPSBmcmFtZXNbMF0ud2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQgPSBmcmFtZXNbMF0uaGVpZ2h0LFxuICAgICAgICAgICAgZHVyYXRpb24gPSBmcmFtZXNbMF0uZHVyYXRpb247XG4gICAgICAgIGZvcih2YXIgaSA9IDE7IGkgPCBmcmFtZXMubGVuZ3RoOyBpKyspe1xuICAgICAgICAgICAgaWYoZnJhbWVzW2ldLndpZHRoICE9IHdpZHRoKSB0aHJvdyBcIkZyYW1lIFwiICsgKGkgKyAxKSArIFwiIGhhcyBhIGRpZmZlcmVudCB3aWR0aFwiO1xuICAgICAgICAgICAgaWYoZnJhbWVzW2ldLmhlaWdodCAhPSBoZWlnaHQpIHRocm93IFwiRnJhbWUgXCIgKyAoaSArIDEpICsgXCIgaGFzIGEgZGlmZmVyZW50IGhlaWdodFwiO1xuICAgICAgICAgICAgaWYoZnJhbWVzW2ldLmR1cmF0aW9uIDwgMCB8fCBmcmFtZXNbaV0uZHVyYXRpb24gPiAweDdmZmYpIHRocm93IFwiRnJhbWUgXCIgKyAoaSArIDEpICsgXCIgaGFzIGEgd2VpcmQgZHVyYXRpb24gKG11c3QgYmUgYmV0d2VlbiAwIGFuZCAzMjc2NylcIjtcbiAgICAgICAgICAgIGR1cmF0aW9uICs9IGZyYW1lc1tpXS5kdXJhdGlvbjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZHVyYXRpb246IGR1cmF0aW9uLFxuICAgICAgICAgICAgd2lkdGg6IHdpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiBoZWlnaHRcbiAgICAgICAgfTtcbiAgICB9XG5cblxuICAgIGZ1bmN0aW9uIG51bVRvQnVmZmVyKG51bSl7XG4gICAgICAgIHZhciBwYXJ0cyA9IFtdO1xuICAgICAgICB3aGlsZShudW0gPiAwKXtcbiAgICAgICAgICAgIHBhcnRzLnB1c2gobnVtICYgMHhmZilcbiAgICAgICAgICAgIG51bSA9IG51bSA+PiA4XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ldyBVaW50OEFycmF5KHBhcnRzLnJldmVyc2UoKSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc3RyVG9CdWZmZXIoc3RyKXtcbiAgICAgICAgLy8gcmV0dXJuIG5ldyBCbG9iKFtzdHJdKTtcblxuICAgICAgICB2YXIgYXJyID0gbmV3IFVpbnQ4QXJyYXkoc3RyLmxlbmd0aCk7XG4gICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspe1xuICAgICAgICAgICAgYXJyW2ldID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYXJyO1xuICAgICAgICAvLyB0aGlzIGlzIHNsb3dlclxuICAgICAgICAvLyByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoc3RyLnNwbGl0KCcnKS5tYXAoZnVuY3Rpb24oZSl7XG4gICAgICAgIC8vICByZXR1cm4gZS5jaGFyQ29kZUF0KDApXG4gICAgICAgIC8vIH0pKVxuICAgIH1cblxuXG4gICAgLy9zb3JyeSB0aGlzIGlzIHVnbHksIGFuZCBzb3J0IG9mIGhhcmQgdG8gdW5kZXJzdGFuZCBleGFjdGx5IHdoeSB0aGlzIHdhcyBkb25lXG4gICAgLy8gYXQgYWxsIHJlYWxseSwgYnV0IHRoZSByZWFzb24gaXMgdGhhdCB0aGVyZSdzIHNvbWUgY29kZSBiZWxvdyB0aGF0IGkgZG9udCByZWFsbHlcbiAgICAvLyBmZWVsIGxpa2UgdW5kZXJzdGFuZGluZywgYW5kIHRoaXMgaXMgZWFzaWVyIHRoYW4gdXNpbmcgbXkgYnJhaW4uXG5cbiAgICBmdW5jdGlvbiBiaXRzVG9CdWZmZXIoYml0cyl7XG4gICAgICAgIHZhciBkYXRhID0gW107XG4gICAgICAgIHZhciBwYWQgPSAoYml0cy5sZW5ndGggJSA4KSA/IChuZXcgQXJyYXkoMSArIDggLSAoYml0cy5sZW5ndGggJSA4KSkpLmpvaW4oJzAnKSA6ICcnO1xuICAgICAgICBiaXRzID0gcGFkICsgYml0cztcbiAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IGJpdHMubGVuZ3RoOyBpKz0gOCl7XG4gICAgICAgICAgICBkYXRhLnB1c2gocGFyc2VJbnQoYml0cy5zdWJzdHIoaSw4KSwyKSlcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoZGF0YSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2VuZXJhdGVFQk1MKGpzb24sIG91dHB1dEFzQXJyYXkpe1xuICAgICAgICB2YXIgZWJtbCA9IFtdO1xuICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwganNvbi5sZW5ndGg7IGkrKyl7XG4gICAgICAgICAgICB2YXIgZGF0YSA9IGpzb25baV0uZGF0YTtcbiAgICAgICAgICAgIGlmKHR5cGVvZiBkYXRhID09ICdvYmplY3QnKSBkYXRhID0gZ2VuZXJhdGVFQk1MKGRhdGEsIG91dHB1dEFzQXJyYXkpO1xuICAgICAgICAgICAgaWYodHlwZW9mIGRhdGEgPT0gJ251bWJlcicpIGRhdGEgPSBiaXRzVG9CdWZmZXIoZGF0YS50b1N0cmluZygyKSk7XG4gICAgICAgICAgICBpZih0eXBlb2YgZGF0YSA9PSAnc3RyaW5nJykgZGF0YSA9IHN0clRvQnVmZmVyKGRhdGEpO1xuXG4gICAgICAgICAgICBpZihkYXRhLmxlbmd0aCl7XG4gICAgICAgICAgICAgICAgdmFyIHogPSB6O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgbGVuID0gZGF0YS5zaXplIHx8IGRhdGEuYnl0ZUxlbmd0aCB8fCBkYXRhLmxlbmd0aDtcbiAgICAgICAgICAgIHZhciB6ZXJvZXMgPSBNYXRoLmNlaWwoTWF0aC5jZWlsKE1hdGgubG9nKGxlbikvTWF0aC5sb2coMikpLzgpO1xuICAgICAgICAgICAgdmFyIHNpemVfc3RyID0gbGVuLnRvU3RyaW5nKDIpO1xuICAgICAgICAgICAgdmFyIHBhZGRlZCA9IChuZXcgQXJyYXkoKHplcm9lcyAqIDcgKyA3ICsgMSkgLSBzaXplX3N0ci5sZW5ndGgpKS5qb2luKCcwJykgKyBzaXplX3N0cjtcbiAgICAgICAgICAgIHZhciBzaXplID0gKG5ldyBBcnJheSh6ZXJvZXMpKS5qb2luKCcwJykgKyAnMScgKyBwYWRkZWQ7XG5cbiAgICAgICAgICAgIC8vaSBhY3R1YWxseSBkb250IHF1aXRlIHVuZGVyc3RhbmQgd2hhdCB3ZW50IG9uIHVwIHRoZXJlLCBzbyBJJ20gbm90IHJlYWxseVxuICAgICAgICAgICAgLy9nb2luZyB0byBmaXggdGhpcywgaSdtIHByb2JhYmx5IGp1c3QgZ29pbmcgdG8gd3JpdGUgc29tZSBoYWNreSB0aGluZyB3aGljaFxuICAgICAgICAgICAgLy9jb252ZXJ0cyB0aGF0IHN0cmluZyBpbnRvIGEgYnVmZmVyLWVzcXVlIHRoaW5nXG5cbiAgICAgICAgICAgIGVibWwucHVzaChudW1Ub0J1ZmZlcihqc29uW2ldLmlkKSk7XG4gICAgICAgICAgICBlYm1sLnB1c2goYml0c1RvQnVmZmVyKHNpemUpKTtcbiAgICAgICAgICAgIGVibWwucHVzaChkYXRhKVxuXG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8vb3V0cHV0IGFzIGJsb2Igb3IgYnl0ZUFycmF5XG4gICAgICAgIGlmKG91dHB1dEFzQXJyYXkpe1xuICAgICAgICAgICAgLy9jb252ZXJ0IGVibWwgdG8gYW4gYXJyYXlcbiAgICAgICAgICAgIHZhciBidWZmZXIgPSB0b0ZsYXRBcnJheShlYm1sKVxuICAgICAgICAgICAgcmV0dXJuIG5ldyBVaW50OEFycmF5KGJ1ZmZlcik7XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBCbG9iKGVibWwsIHt0eXBlOiBcInZpZGVvL3dlYm1cIn0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdG9GbGF0QXJyYXkoYXJyLCBvdXRCdWZmZXIpe1xuICAgICAgICBpZihvdXRCdWZmZXIgPT0gbnVsbCl7XG4gICAgICAgICAgICBvdXRCdWZmZXIgPSBbXTtcbiAgICAgICAgfVxuICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgYXJyLmxlbmd0aDsgaSsrKXtcbiAgICAgICAgICAgIGlmKHR5cGVvZiBhcnJbaV0gPT0gJ29iamVjdCcpe1xuICAgICAgICAgICAgICAgIC8vYW4gYXJyYXlcbiAgICAgICAgICAgICAgICB0b0ZsYXRBcnJheShhcnJbaV0sIG91dEJ1ZmZlcilcbiAgICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgICAgIC8vYSBzaW1wbGUgZWxlbWVudFxuICAgICAgICAgICAgICAgIG91dEJ1ZmZlci5wdXNoKGFycltpXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG91dEJ1ZmZlcjtcbiAgICB9XG5cbiAgICAvL3dvb3QsIGEgZnVuY3Rpb24gdGhhdCdzIGFjdHVhbGx5IHdyaXR0ZW4gZm9yIHRoaXMgcHJvamVjdCFcbiAgICAvL3RoaXMgcGFyc2VzIHNvbWUganNvbiBtYXJrdXAgYW5kIG1ha2VzIGl0IGludG8gdGhhdCBiaW5hcnkgbWFnaWNcbiAgICAvL3doaWNoIGNhbiB0aGVuIGdldCBzaG92ZWQgaW50byB0aGUgbWF0cm9za2EgY29tdGFpbmVyIChwZWFjZWFibHkpXG5cbiAgICBmdW5jdGlvbiBtYWtlU2ltcGxlQmxvY2soZGF0YSl7XG4gICAgICAgIHZhciBmbGFncyA9IDA7XG4gICAgICAgIGlmIChkYXRhLmtleWZyYW1lKSBmbGFncyB8PSAxMjg7XG4gICAgICAgIGlmIChkYXRhLmludmlzaWJsZSkgZmxhZ3MgfD0gODtcbiAgICAgICAgaWYgKGRhdGEubGFjaW5nKSBmbGFncyB8PSAoZGF0YS5sYWNpbmcgPDwgMSk7XG4gICAgICAgIGlmIChkYXRhLmRpc2NhcmRhYmxlKSBmbGFncyB8PSAxO1xuICAgICAgICBpZiAoZGF0YS50cmFja051bSA+IDEyNykge1xuICAgICAgICAgICAgdGhyb3cgXCJUcmFja051bWJlciA+IDEyNyBub3Qgc3VwcG9ydGVkXCI7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIG91dCA9IFtkYXRhLnRyYWNrTnVtIHwgMHg4MCwgZGF0YS50aW1lY29kZSA+PiA4LCBkYXRhLnRpbWVjb2RlICYgMHhmZiwgZmxhZ3NdLm1hcChmdW5jdGlvbihlKXtcbiAgICAgICAgICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKGUpXG4gICAgICAgIH0pLmpvaW4oJycpICsgZGF0YS5mcmFtZTtcblxuICAgICAgICByZXR1cm4gb3V0O1xuICAgIH1cblxuICAgIC8vIGhlcmUncyBzb21ldGhpbmcgZWxzZSB0YWtlbiB2ZXJiYXRpbSBmcm9tIHdlcHB5LCBhd2Vzb21lIHJpdGU/XG5cbiAgICBmdW5jdGlvbiBwYXJzZVdlYlAocmlmZil7XG4gICAgICAgIHZhciBWUDggPSByaWZmLlJJRkZbMF0uV0VCUFswXTtcblxuICAgICAgICB2YXIgZnJhbWVfc3RhcnQgPSBWUDguaW5kZXhPZignXFx4OWRcXHgwMVxceDJhJyk7IC8vQSBWUDgga2V5ZnJhbWUgc3RhcnRzIHdpdGggdGhlIDB4OWQwMTJhIGhlYWRlclxuICAgICAgICBmb3IodmFyIGkgPSAwLCBjID0gW107IGkgPCA0OyBpKyspIGNbaV0gPSBWUDguY2hhckNvZGVBdChmcmFtZV9zdGFydCArIDMgKyBpKTtcblxuICAgICAgICB2YXIgd2lkdGgsIGhvcml6b250YWxfc2NhbGUsIGhlaWdodCwgdmVydGljYWxfc2NhbGUsIHRtcDtcblxuICAgICAgICAvL3RoZSBjb2RlIGJlbG93IGlzIGxpdGVyYWxseSBjb3BpZWQgdmVyYmF0aW0gZnJvbSB0aGUgYml0c3RyZWFtIHNwZWNcbiAgICAgICAgdG1wID0gKGNbMV0gPDwgOCkgfCBjWzBdO1xuICAgICAgICB3aWR0aCA9IHRtcCAmIDB4M0ZGRjtcbiAgICAgICAgaG9yaXpvbnRhbF9zY2FsZSA9IHRtcCA+PiAxNDtcbiAgICAgICAgdG1wID0gKGNbM10gPDwgOCkgfCBjWzJdO1xuICAgICAgICBoZWlnaHQgPSB0bXAgJiAweDNGRkY7XG4gICAgICAgIHZlcnRpY2FsX3NjYWxlID0gdG1wID4+IDE0O1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgd2lkdGg6IHdpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiBoZWlnaHQsXG4gICAgICAgICAgICBkYXRhOiBWUDgsXG4gICAgICAgICAgICByaWZmOiByaWZmXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBpIHRoaW5rIGknbSBnb2luZyBvZmYgb24gYSByaWZmIGJ5IHByZXRlbmRpbmcgdGhpcyBpcyBzb21lIGtub3duXG4gICAgLy8gaWRpb20gd2hpY2ggaSdtIG1ha2luZyBhIGNhc3VhbCBhbmQgYnJpbGxpYW50IHB1biBhYm91dCwgYnV0IHNpbmNlXG4gICAgLy8gaSBjYW4ndCBmaW5kIGFueXRoaW5nIG9uIGdvb2dsZSB3aGljaCBjb25mb3JtcyB0byB0aGlzIGlkaW9tYXRpY1xuICAgIC8vIHVzYWdlLCBJJ20gYXNzdW1pbmcgdGhpcyBpcyBqdXN0IGEgY29uc2VxdWVuY2Ugb2Ygc29tZSBwc3ljaG90aWNcbiAgICAvLyBicmVhayB3aGljaCBtYWtlcyBtZSBtYWtlIHVwIHB1bnMuIHdlbGwsIGVub3VnaCByaWZmLXJhZmYgKGFoYSBhXG4gICAgLy8gcmVzY3VlIG9mIHNvcnRzKSwgdGhpcyBmdW5jdGlvbiB3YXMgcmlwcGVkIHdob2xlc2FsZSBmcm9tIHdlcHB5XG5cbiAgICBmdW5jdGlvbiBwYXJzZVJJRkYoc3RyaW5nKXtcbiAgICAgICAgdmFyIG9mZnNldCA9IDA7XG4gICAgICAgIHZhciBjaHVua3MgPSB7fTtcblxuICAgICAgICB3aGlsZSAob2Zmc2V0IDwgc3RyaW5nLmxlbmd0aCkge1xuICAgICAgICAgICAgdmFyIGlkID0gc3RyaW5nLnN1YnN0cihvZmZzZXQsIDQpO1xuICAgICAgICAgICAgdmFyIGxlbiA9IHBhcnNlSW50KHN0cmluZy5zdWJzdHIob2Zmc2V0ICsgNCwgNCkuc3BsaXQoJycpLm1hcChmdW5jdGlvbihpKXtcbiAgICAgICAgICAgICAgICB2YXIgdW5wYWRkZWQgPSBpLmNoYXJDb2RlQXQoMCkudG9TdHJpbmcoMik7XG4gICAgICAgICAgICAgICAgcmV0dXJuIChuZXcgQXJyYXkoOCAtIHVucGFkZGVkLmxlbmd0aCArIDEpKS5qb2luKCcwJykgKyB1bnBhZGRlZFxuICAgICAgICAgICAgfSkuam9pbignJyksMik7XG4gICAgICAgICAgICB2YXIgZGF0YSA9IHN0cmluZy5zdWJzdHIob2Zmc2V0ICsgNCArIDQsIGxlbik7XG4gICAgICAgICAgICBvZmZzZXQgKz0gNCArIDQgKyBsZW47XG4gICAgICAgICAgICBjaHVua3NbaWRdID0gY2h1bmtzW2lkXSB8fCBbXTtcblxuICAgICAgICAgICAgaWYgKGlkID09ICdSSUZGJyB8fCBpZCA9PSAnTElTVCcpIHtcbiAgICAgICAgICAgICAgICBjaHVua3NbaWRdLnB1c2gocGFyc2VSSUZGKGRhdGEpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY2h1bmtzW2lkXS5wdXNoKGRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjaHVua3M7XG4gICAgfVxuXG4gICAgLy8gaGVyZSdzIGEgbGl0dGxlIHV0aWxpdHkgZnVuY3Rpb24gdGhhdCBhY3RzIGFzIGEgdXRpbGl0eSBmb3Igb3RoZXIgZnVuY3Rpb25zXG4gICAgLy8gYmFzaWNhbGx5LCB0aGUgb25seSBwdXJwb3NlIGlzIGZvciBlbmNvZGluZyBcIkR1cmF0aW9uXCIsIHdoaWNoIGlzIGVuY29kZWQgYXNcbiAgICAvLyBhIGRvdWJsZSAoY29uc2lkZXJhYmx5IG1vcmUgZGlmZmljdWx0IHRvIGVuY29kZSB0aGFuIGFuIGludGVnZXIpXG4gICAgZnVuY3Rpb24gZG91YmxlVG9TdHJpbmcobnVtKXtcbiAgICAgICAgcmV0dXJuIFtdLnNsaWNlLmNhbGwoXG4gICAgICAgICAgICBuZXcgVWludDhBcnJheShcbiAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgIG5ldyBGbG9hdDY0QXJyYXkoW251bV0pIC8vY3JlYXRlIGEgZmxvYXQ2NCBhcnJheVxuICAgICAgICAgICAgICAgICkuYnVmZmVyKSAvL2V4dHJhY3QgdGhlIGFycmF5IGJ1ZmZlclxuICAgICAgICAgICAgLCAwKSAvLyBjb252ZXJ0IHRoZSBVaW50OEFycmF5IGludG8gYSByZWd1bGFyIGFycmF5XG4gICAgICAgICAgICAubWFwKGZ1bmN0aW9uKGUpeyAvL3NpbmNlIGl0J3MgYSByZWd1bGFyIGFycmF5LCB3ZSBjYW4gbm93IHVzZSBtYXBcbiAgICAgICAgICAgICAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZShlKSAvLyBlbmNvZGUgYWxsIHRoZSBieXRlcyBpbmRpdmlkdWFsbHlcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAucmV2ZXJzZSgpIC8vY29ycmVjdCB0aGUgYnl0ZSBlbmRpYW5uZXNzIChhc3N1bWUgaXQncyBsaXR0bGUgZW5kaWFuIGZvciBub3cpXG4gICAgICAgICAgICAuam9pbignJykgLy8gam9pbiB0aGUgYnl0ZXMgaW4gaG9seSBtYXRyaW1vbnkgYXMgYSBzdHJpbmdcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBXaGFtbXlWaWRlbyhzcGVlZCwgcXVhbGl0eSl7IC8vIGEgbW9yZSBhYnN0cmFjdC1pc2ggQVBJXG4gICAgICAgIHRoaXMuZnJhbWVzID0gW107XG4gICAgICAgIHRoaXMuZHVyYXRpb24gPSAxMDAwIC8gc3BlZWQ7XG4gICAgICAgIHRoaXMucXVhbGl0eSA9IHF1YWxpdHkgfHwgMC44O1xuICAgIH1cblxuICAgIFdoYW1teVZpZGVvLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbihmcmFtZSwgZHVyYXRpb24pe1xuICAgICAgICBpZih0eXBlb2YgZHVyYXRpb24gIT0gJ3VuZGVmaW5lZCcgJiYgdGhpcy5kdXJhdGlvbikgdGhyb3cgXCJ5b3UgY2FuJ3QgcGFzcyBhIGR1cmF0aW9uIGlmIHRoZSBmcHMgaXMgc2V0XCI7XG4gICAgICAgIGlmKHR5cGVvZiBkdXJhdGlvbiA9PSAndW5kZWZpbmVkJyAmJiAhdGhpcy5kdXJhdGlvbikgdGhyb3cgXCJpZiB5b3UgZG9uJ3QgaGF2ZSB0aGUgZnBzIHNldCwgeW91IG5lZCB0byBoYXZlIGR1cmF0aW9ucyBoZXJlLlwiXG4gICAgICAgIGlmKCdjYW52YXMnIGluIGZyYW1lKXsgLy9DYW52YXNSZW5kZXJpbmdDb250ZXh0MkRcbiAgICAgICAgICAgIGZyYW1lID0gZnJhbWUuY2FudmFzO1xuICAgICAgICB9XG4gICAgICAgIGlmKCd0b0RhdGFVUkwnIGluIGZyYW1lKXtcbiAgICAgICAgICAgIGZyYW1lID0gZnJhbWUudG9EYXRhVVJMKCdpbWFnZS93ZWJwJywgdGhpcy5xdWFsaXR5KVxuICAgICAgICB9ZWxzZSBpZih0eXBlb2YgZnJhbWUgIT0gXCJzdHJpbmdcIil7XG4gICAgICAgICAgICB0aHJvdyBcImZyYW1lIG11c3QgYmUgYSBhIEhUTUxDYW52YXNFbGVtZW50LCBhIENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRCBvciBhIERhdGFVUkkgZm9ybWF0dGVkIHN0cmluZ1wiXG4gICAgICAgIH1cbiAgICAgICAgaWYgKCEoL15kYXRhOmltYWdlXFwvd2VicDtiYXNlNjQsL2lnKS50ZXN0KGZyYW1lKSkge1xuICAgICAgICAgICAgdGhyb3cgXCJJbnB1dCBtdXN0IGJlIGZvcm1hdHRlZCBwcm9wZXJseSBhcyBhIGJhc2U2NCBlbmNvZGVkIERhdGFVUkkgb2YgdHlwZSBpbWFnZS93ZWJwXCI7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5mcmFtZXMucHVzaCh7XG4gICAgICAgICAgICBpbWFnZTogZnJhbWUsXG4gICAgICAgICAgICBkdXJhdGlvbjogZHVyYXRpb24gfHwgdGhpcy5kdXJhdGlvblxuICAgICAgICB9KVxuICAgIH1cblxuICAgIFdoYW1teVZpZGVvLnByb3RvdHlwZS5jb21waWxlID0gZnVuY3Rpb24ob3V0cHV0QXNBcnJheSl7XG4gICAgICAgIHJldHVybiBuZXcgdG9XZWJNKHRoaXMuZnJhbWVzLm1hcChmdW5jdGlvbihmcmFtZSl7XG4gICAgICAgICAgICB2YXIgd2VicCA9IHBhcnNlV2ViUChwYXJzZVJJRkYoYXRvYihmcmFtZS5pbWFnZS5zbGljZSgyMykpKSk7XG4gICAgICAgICAgICB3ZWJwLmR1cmF0aW9uID0gZnJhbWUuZHVyYXRpb247XG4gICAgICAgICAgICByZXR1cm4gd2VicDtcbiAgICAgICAgfSksIG91dHB1dEFzQXJyYXkpXG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgVmlkZW86IFdoYW1teVZpZGVvLFxuICAgICAgICBmcm9tSW1hZ2VBcnJheTogZnVuY3Rpb24oaW1hZ2VzLCBmcHMsIG91dHB1dEFzQXJyYXkpe1xuICAgICAgICAgICAgcmV0dXJuIHRvV2ViTShpbWFnZXMubWFwKGZ1bmN0aW9uKGltYWdlKXtcbiAgICAgICAgICAgICAgICB2YXIgd2VicCA9IHBhcnNlV2ViUChwYXJzZVJJRkYoYXRvYihpbWFnZS5zbGljZSgyMykpKSlcbiAgICAgICAgICAgICAgICB3ZWJwLmR1cmF0aW9uID0gMTAwMCAvIGZwcztcbiAgICAgICAgICAgICAgICByZXR1cm4gd2VicDtcbiAgICAgICAgICAgIH0pLCBvdXRwdXRBc0FycmF5KVxuICAgICAgICB9LFxuICAgICAgICB0b1dlYk06IHRvV2ViTVxuICAgICAgICAvLyBleHBvc2UgbWV0aG9kcyBvZiBtYWRuZXNzXG4gICAgfVxufSkoKVxuXG47IGJyb3dzZXJpZnlfc2hpbV9fZGVmaW5lX19tb2R1bGVfX2V4cG9ydF9fKHR5cGVvZiBXaGFtbXkgIT0gXCJ1bmRlZmluZWRcIiA/IFdoYW1teSA6IHdpbmRvdy5XaGFtbXkpO1xuXG59KS5jYWxsKGdsb2JhbCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgZnVuY3Rpb24gZGVmaW5lRXhwb3J0KGV4KSB7IG1vZHVsZS5leHBvcnRzID0gZXg7IH0pO1xuXG59KS5jYWxsKHRoaXMsdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KSJdfQ==
