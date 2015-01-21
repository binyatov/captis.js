require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var bindSegment = null,
    meta = {},
    duration = 0,
    active = null,
    next = 0,
    stepElement = null,
    isBinded = false,
    segments = [];

var createSlideSegments = function () {
    event.stopPropagation();
    document.getElementById('captis').innerHTML += (
        '<div id="captis_add"> \
        <video id="add_video" preload controls></video> \
        <div id="segment_cont"><div id="captis_editor_segments"></div></div> \
        </div>'
    );
    var video = document.getElementById('add_video'),
        parts = document.getElementById('captis_editor_segments'),
        container = document.getElementById('segment_cont'),
        steps = document.getElementsByClassName('step');
    loadVideo();
    bindSegment = document.getElementById('bind');
    bindSegment.style.opacity = '1.0';
    parts.innerHTML = '';
    for (var i = 0; i < steps.length; i++) {
        parts.innerHTML += '<div class="impress_step" id="step_'+ steps[i].id +'">step: '+ steps[i].id +'</div>';
        var subs = steps[i].getElementsByClassName('substep');
        if (subs.length > 0) {
            meta[steps[i].id] = subs.length;
            for (var j = 0; j < subs.length; j++) {
                parts.innerHTML += '<div class="impress_step" id="step_'+ steps[i].id +'_sub_'+ (j + 1) +'">step: '+ steps[i].id +', substep: '+ (j + 1) +'</div>';
            }
        }
    }
    video.addEventListener('loadedmetadata', function () {
        duration = timeFormat(video.duration);
    });
    container.style.width = '250px';
    document.addEventListener('click', selectSegment, false);
    document.getElementById('save').addEventListener('click', saveData, false);
}
var past = null;
var selectSegment = function (e) {
    stepElement = e.target;
    var slide = e.target.id.split('_');
    if (slide[0] == 'step') {
        document.getElementById('bind').addEventListener('click', bindMedia, false);
        if (past != null && !isBinded) { past.style.color = '#D5DBD9'; }
        e.target.style.color = '#13AD87';
        bindSegment.style.color = '#13AD87';
        past = e.target;
        active = slide[1];
        if (slide[2]) {
            next = slide[3];
            impress().goto(slide[1]);
            for (var i = 0; i < 20; i++) {
                impress().prev();
            }
            impress().goto(slide[1]);
            for (var i = 0; i < slide[3]; i++) {
                impress().next();
            }
        } else {
            next = 0;
            impress().goto(slide[1]);
            for (var i = 0; i < 20; i++) {
                impress().prev();
            }
            impress().goto(slide[1]);
        }
        isBinded = false;
    }
}

var saveData = function () {
    var data = new Blob(
        [JSON.stringify({
            meta: meta,
            segments: segments,
            duration: duration,
        })],
    {type: 'application/json'});
    var formData = new FormData();
    formData.append('data', data, 'captis.json');
    var request = new XMLHttpRequest();
    request.open('POST', 'http://localhost:3000/save', true);
    request.onload = function () {
        if (request.status === 200) {
            location.reload();
        } else {
            console.log('Failed to upload');
        }
    }
    request.send(formData);
}

var bindMedia = function () {
    isBinded = true;
    var video = document.getElementById('add_video');
    segments.push({
        timestamp: Math.floor(video.currentTime),
        stepid: active,
        next: next,
    });
    stepElement.style.color = '#E6E68A';
}

var loadVideo = function () {
    var request = new XMLHttpRequest(),
        video = document.getElementById('add_video');
    request.open('GET', 'http://localhost:3000/media/captis.webm', true);
    request.responseType = "blob";
    request.onreadystatechange = function () {
        if (request.status === 200 && request.readyState == 4) {
            video.src = window.URL.createObjectURL(this.response);
        }
    }
    request.send();
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

exports.createSlideSegments = createSlideSegments;

},{}],2:[function(require,module,exports){
var initializeEditor = function() {
    event.stopPropagation();
    document.getElementById('captis').innerHTML += (
        '<div id="captis_editor"> \
            <div id="loading"><progress id="loading_segments" value="0"></progress></div> \
            <video id="edit_video" preload muted></video> \
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
    parts.innerHTML = '';
    video.src = window.videoURL;
    //console.log(window.segments);
    loader.setAttribute('max', window.segments.length - 1);
    video.onloadedmetadata = function () {
        canvas.width = 250;
        canvas.height = 187;
        var i = 0;
        var loop = setInterval(function() {
            //console.log(window.segments[i]);
            parts.innerHTML += (
                '<div class="segment_box" id="segment_'+ i +'"> \
                    <i class="segment_time">'+ window.formatDuration(window.segments[i].timestamp) +'</i> \
                </div>'
            );
            video.currentTime = window.segments[i].timestamp;
            ctx.drawImage(video, 0, 0, 250, 187);
            var image = canvas.toDataURL(),
                box = document.getElementById('segment_' + i);
            //console.log(image);
            box.style.backgroundImage = 'url(' + image + ')';
            loader.value = i;
            i++;
            if (i == window.segments.length) {
                //parts.style.height = 120 * window.segments.length + 'px';
                container.style.width = '250px';
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

},{}],"Add":[function(require,module,exports){
module.exports=require('cMRE+B');
},{}],"cMRE+B":[function(require,module,exports){
(function (global){
(function browserifyShim(module, exports, define, browserify_shim__define__module__export__) {
var bindSegment = null,
    meta = {},
    duration = 0,
    active = null,
    next = 0,
    stepElement = null,
    isBinded = false,
    segments = [];

var createSlideSegments = function () {
    event.stopPropagation();
    document.getElementById('captis').innerHTML += (
        '<div id="captis_add"> \
        <video id="add_video" preload controls></video> \
        <div id="segment_cont"><div id="captis_editor_segments"></div></div> \
        </div>'
    );
    var video = document.getElementById('add_video'),
        parts = document.getElementById('captis_editor_segments'),
        container = document.getElementById('segment_cont'),
        steps = document.getElementsByClassName('step');
    loadVideo();
    bindSegment = document.getElementById('bind');
    bindSegment.style.opacity = '1.0';
    parts.innerHTML = '';
    for (var i = 0; i < steps.length; i++) {
        parts.innerHTML += '<div class="impress_step" id="step_'+ steps[i].id +'">step: '+ steps[i].id +'</div>';
        var subs = steps[i].getElementsByClassName('substep');
        if (subs.length > 0) {
            meta[steps[i].id] = subs.length;
            for (var j = 0; j < subs.length; j++) {
                parts.innerHTML += '<div class="impress_step" id="step_'+ steps[i].id +'_sub_'+ (j + 1) +'">step: '+ steps[i].id +', substep: '+ (j + 1) +'</div>';
            }
        }
    }
    video.addEventListener('loadedmetadata', function () {
        duration = timeFormat(video.duration);
    });
    container.style.width = '250px';
    document.addEventListener('click', selectSegment, false);
    document.getElementById('save').addEventListener('click', saveData, false);
}
var past = null;
var selectSegment = function (e) {
    stepElement = e.target;
    var slide = e.target.id.split('_');
    if (slide[0] == 'step') {
        document.getElementById('bind').addEventListener('click', bindMedia, false);
        if (past != null && !isBinded) { past.style.color = '#D5DBD9'; }
        e.target.style.color = '#13AD87';
        bindSegment.style.color = '#13AD87';
        past = e.target;
        active = slide[1];
        if (slide[2]) {
            next = slide[3];
            impress().goto(slide[1]);
            for (var i = 0; i < 20; i++) {
                impress().prev();
            }
            impress().goto(slide[1]);
            for (var i = 0; i < slide[3]; i++) {
                impress().next();
            }
        } else {
            next = 0;
            impress().goto(slide[1]);
            for (var i = 0; i < 20; i++) {
                impress().prev();
            }
            impress().goto(slide[1]);
        }
        isBinded = false;
    }
}

var saveData = function () {
    var data = new Blob(
        [JSON.stringify({
            meta: meta,
            segments: segments,
            duration: duration,
        })],
    {type: 'application/json'});
    var formData = new FormData();
    formData.append('data', data, 'captis.json');
    var request = new XMLHttpRequest();
    request.open('POST', 'http://localhost:3000/save', true);
    request.onload = function () {
        if (request.status === 200) {
            location.reload();
        } else {
            console.log('Failed to upload');
        }
    }
    request.send(formData);
}

var bindMedia = function () {
    isBinded = true;
    var video = document.getElementById('add_video');
    segments.push({
        timestamp: Math.floor(video.currentTime),
        stepid: active,
        next: next,
    });
    stepElement.style.color = '#E6E68A';
}

var loadVideo = function () {
    var request = new XMLHttpRequest(),
        video = document.getElementById('add_video');
    request.open('GET', 'http://localhost:3000/media/captis.webm', true);
    request.responseType = "blob";
    request.onreadystatechange = function () {
        if (request.status === 200 && request.readyState == 4) {
            video.src = window.URL.createObjectURL(this.response);
        }
    }
    request.send();
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

exports.createSlideSegments = createSlideSegments;

; browserify_shim__define__module__export__(typeof Add != "undefined" ? Add : window.Add);

}).call(global, undefined, undefined, undefined, function defineExport(ex) { module.exports = ex; });

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],5:[function(require,module,exports){
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
    Add = require('./Add'),
    channelData = [];

var captis = {stream: null,
    frames: [],
    toolbar: false,
    capturing: false,
    streaming: false,
    record: null,
    paused: false,
    notified: false,
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
                <ul> \
                    <li><i id="camera" class="fa fa-video-camera captis_icon tooltip"><span class="tip-content">Turn on the camera</span></i></li> \
                    <li><i id="record" class="fa fa-circle tooltip"><span class="tip-content">Record video</span></i></li> \
                    <li><i id="pauserec" class="fa fa-pause captis_icon tooltip"><span class="tip-content">Pause video recording</span></i></li> \
                    <li><i id="save" class="fa fa-save captis_icon tooltip"><span class="tip-content">Save video</span></i></li> \
                    <li><i id="update" class="fa fa-plus-square captis_icon tooltip"><span class="tip-content">Add segments to video</span></i></li> \
                    <li><i id="edit" class="fa fa-pencil-square captis_icon tooltip"><span class="tip-content">Edit video segments</span></i></li> \
                    <li><i id="bind" class="fa fa-link captis_icon tooltip"><span class="tip-content">Bind segment</span></i></li> \
                    <li><i id="switch" class="fa fa-power-off captis_icon tooltip"><span class="tip-content">Close toolbar</span></i></li> \
                </ul> \
            </div>'
        );
        notification('Captis toolbar is ready to use.');
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
        document.getElementById('update').addEventListener(
            'click',
            Add.createSlideSegments,
            false
        );
    }
}

function notification (msg) {
    var noti = document.getElementById('notify');
    if (noti) {
        noti.outerHTML = '';
    }
    document.getElementById('captis').innerHTML += (
        '<div id="notify"> \
            '+ msg +' \
            <i id="close_notification" class="fa fa-times"></i> \
        </div>'
    );
    document.getElementById('close_notification').addEventListener(
        'mouseup',
        closeNotification,
        false
    );
    captis.notified = false;
    setTimeout(function () {
        closeNotification();
    }, 5000);
}

function closeNotification () {
    if (captis.notified) return;
    var noti = document.getElementById('notify'),
        index = 1;
    var loop = setInterval(function () {
        noti.style.opacity = '0.' + (10 - index);
        if (index == 10) {
            clearInterval(loop);
            document.getElementById('close_notification').removeEventListener(
                'mouseup',
                closeNotification,
                false
            );
            noti.outerHTML = '';
            captis.notified = true;
        }
        index++;
    }, 60);
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
    document.getElementById('update').removeEventListener(
        'click',
        Add.createSlideSegments,
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
    var editorSegments = document.getElementById('captis_editor'),
        addSegments = document.getElementById('captis_add');
    if (editorSegments) {
        editorSegments.outerHTML = '';
    }
    if (addSegments) {
        addSegments.outerHTML = '';
    }
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
                notification('Camera is on! Captis ready to capture video segments.');
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
                document.getElementById('camera').style.display = 'none';
                document.getElementById('record').style.display = 'block';
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

function continueRecording () {
    captis.paused = false;
    document.getElementById('live_stream').play();
    document.getElementById('record').removeEventListener(
        'click',
        continueRecording,
        false
    );
    document.getElementById('pauserec').addEventListener(
        'click',
        pauseRecording,
        false
    );
    document.getElementById('record').style.display = 'none';
    document.getElementById('pauserec').style.display = 'block';
}

function pauseRecording () {
    captis.paused = true;
    document.getElementById('live_stream').pause();
    document.getElementById('record').removeEventListener(
        'click',
        startRecording,
        false
    );
    document.getElementById('record').addEventListener(
        'click',
        continueRecording,
        false
    );
    document.getElementById('record').style.display = 'block';
    document.getElementById('pauserec').style.display = 'none';
}

function startRecording () {
    captis.audio.recording = true;
    event.stopPropagation();
    document.getElementById('record').style.display = 'none';
    document.getElementById('pauserec').style.display = 'block';
    document.getElementById('pauserec').addEventListener(
        'click',
        pauseRecording,
        false
    );
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
        if(captis.paused) return;
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
    if (duration > timeDiff) {
        shift = duration - timeDiff;
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
            notification('This slide contains video file! Please use ctr+w to load the segments.');
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

},{"./Add":1,"./Editor":2,"Whammy":"lZHMST"}],"Editor":[function(require,module,exports){
module.exports=require('fqJoPW');
},{}],"fqJoPW":[function(require,module,exports){
(function (global){
(function browserifyShim(module, exports, define, browserify_shim__define__module__export__) {
var initializeEditor = function() {
    event.stopPropagation();
    document.getElementById('captis').innerHTML += (
        '<div id="captis_editor"> \
            <div id="loading"><progress id="loading_segments" value="0"></progress></div> \
            <video id="edit_video" preload muted></video> \
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
    parts.innerHTML = '';
    video.src = window.videoURL;
    //console.log(window.segments);
    loader.setAttribute('max', window.segments.length - 1);
    video.onloadedmetadata = function () {
        canvas.width = 250;
        canvas.height = 187;
        var i = 0;
        var loop = setInterval(function() {
            //console.log(window.segments[i]);
            parts.innerHTML += (
                '<div class="segment_box" id="segment_'+ i +'"> \
                    <i class="segment_time">'+ window.formatDuration(window.segments[i].timestamp) +'</i> \
                </div>'
            );
            video.currentTime = window.segments[i].timestamp;
            ctx.drawImage(video, 0, 0, 250, 187);
            var image = canvas.toDataURL(),
                box = document.getElementById('segment_' + i);
            //console.log(image);
            box.style.backgroundImage = 'url(' + image + ')';
            loader.value = i;
            i++;
            if (i == window.segments.length) {
                //parts.style.height = 120 * window.segments.length + 'px';
                container.style.width = '250px';
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
},{}]},{},[5])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvcGFzaGEvRGVza3RvcC9jYXB0aXMvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9Vc2Vycy9wYXNoYS9EZXNrdG9wL2NhcHRpcy9BZGQuanMiLCIvVXNlcnMvcGFzaGEvRGVza3RvcC9jYXB0aXMvRWRpdG9yLmpzIiwiL1VzZXJzL3Bhc2hhL0Rlc2t0b3AvY2FwdGlzL2FkZC5qcyIsIi9Vc2Vycy9wYXNoYS9EZXNrdG9wL2NhcHRpcy9jYXB0aXMuanMiLCIvVXNlcnMvcGFzaGEvRGVza3RvcC9jYXB0aXMvZWRpdG9yLmpzIiwiL1VzZXJzL3Bhc2hhL0Rlc2t0b3AvY2FwdGlzL3ZlbmRvci93aGFtbXkubWluLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3RGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzE0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM3RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIGJpbmRTZWdtZW50ID0gbnVsbCxcbiAgICBtZXRhID0ge30sXG4gICAgZHVyYXRpb24gPSAwLFxuICAgIGFjdGl2ZSA9IG51bGwsXG4gICAgbmV4dCA9IDAsXG4gICAgc3RlcEVsZW1lbnQgPSBudWxsLFxuICAgIGlzQmluZGVkID0gZmFsc2UsXG4gICAgc2VnbWVudHMgPSBbXTtcblxudmFyIGNyZWF0ZVNsaWRlU2VnbWVudHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcHRpcycpLmlubmVySFRNTCArPSAoXG4gICAgICAgICc8ZGl2IGlkPVwiY2FwdGlzX2FkZFwiPiBcXFxuICAgICAgICA8dmlkZW8gaWQ9XCJhZGRfdmlkZW9cIiBwcmVsb2FkIGNvbnRyb2xzPjwvdmlkZW8+IFxcXG4gICAgICAgIDxkaXYgaWQ9XCJzZWdtZW50X2NvbnRcIj48ZGl2IGlkPVwiY2FwdGlzX2VkaXRvcl9zZWdtZW50c1wiPjwvZGl2PjwvZGl2PiBcXFxuICAgICAgICA8L2Rpdj4nXG4gICAgKTtcbiAgICB2YXIgdmlkZW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWRkX3ZpZGVvJyksXG4gICAgICAgIHBhcnRzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcHRpc19lZGl0b3Jfc2VnbWVudHMnKSxcbiAgICAgICAgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NlZ21lbnRfY29udCcpLFxuICAgICAgICBzdGVwcyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoJ3N0ZXAnKTtcbiAgICBsb2FkVmlkZW8oKTtcbiAgICBiaW5kU2VnbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdiaW5kJyk7XG4gICAgYmluZFNlZ21lbnQuc3R5bGUub3BhY2l0eSA9ICcxLjAnO1xuICAgIHBhcnRzLmlubmVySFRNTCA9ICcnO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc3RlcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgcGFydHMuaW5uZXJIVE1MICs9ICc8ZGl2IGNsYXNzPVwiaW1wcmVzc19zdGVwXCIgaWQ9XCJzdGVwXycrIHN0ZXBzW2ldLmlkICsnXCI+c3RlcDogJysgc3RlcHNbaV0uaWQgKyc8L2Rpdj4nO1xuICAgICAgICB2YXIgc3VicyA9IHN0ZXBzW2ldLmdldEVsZW1lbnRzQnlDbGFzc05hbWUoJ3N1YnN0ZXAnKTtcbiAgICAgICAgaWYgKHN1YnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgbWV0YVtzdGVwc1tpXS5pZF0gPSBzdWJzLmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgc3Vicy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgIHBhcnRzLmlubmVySFRNTCArPSAnPGRpdiBjbGFzcz1cImltcHJlc3Nfc3RlcFwiIGlkPVwic3RlcF8nKyBzdGVwc1tpXS5pZCArJ19zdWJfJysgKGogKyAxKSArJ1wiPnN0ZXA6ICcrIHN0ZXBzW2ldLmlkICsnLCBzdWJzdGVwOiAnKyAoaiArIDEpICsnPC9kaXY+JztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICB2aWRlby5hZGRFdmVudExpc3RlbmVyKCdsb2FkZWRtZXRhZGF0YScsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZHVyYXRpb24gPSB0aW1lRm9ybWF0KHZpZGVvLmR1cmF0aW9uKTtcbiAgICB9KTtcbiAgICBjb250YWluZXIuc3R5bGUud2lkdGggPSAnMjUwcHgnO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgc2VsZWN0U2VnbWVudCwgZmFsc2UpO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzYXZlJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBzYXZlRGF0YSwgZmFsc2UpO1xufVxudmFyIHBhc3QgPSBudWxsO1xudmFyIHNlbGVjdFNlZ21lbnQgPSBmdW5jdGlvbiAoZSkge1xuICAgIHN0ZXBFbGVtZW50ID0gZS50YXJnZXQ7XG4gICAgdmFyIHNsaWRlID0gZS50YXJnZXQuaWQuc3BsaXQoJ18nKTtcbiAgICBpZiAoc2xpZGVbMF0gPT0gJ3N0ZXAnKSB7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdiaW5kJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBiaW5kTWVkaWEsIGZhbHNlKTtcbiAgICAgICAgaWYgKHBhc3QgIT0gbnVsbCAmJiAhaXNCaW5kZWQpIHsgcGFzdC5zdHlsZS5jb2xvciA9ICcjRDVEQkQ5JzsgfVxuICAgICAgICBlLnRhcmdldC5zdHlsZS5jb2xvciA9ICcjMTNBRDg3JztcbiAgICAgICAgYmluZFNlZ21lbnQuc3R5bGUuY29sb3IgPSAnIzEzQUQ4Nyc7XG4gICAgICAgIHBhc3QgPSBlLnRhcmdldDtcbiAgICAgICAgYWN0aXZlID0gc2xpZGVbMV07XG4gICAgICAgIGlmIChzbGlkZVsyXSkge1xuICAgICAgICAgICAgbmV4dCA9IHNsaWRlWzNdO1xuICAgICAgICAgICAgaW1wcmVzcygpLmdvdG8oc2xpZGVbMV0pO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCAyMDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaW1wcmVzcygpLnByZXYoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGltcHJlc3MoKS5nb3RvKHNsaWRlWzFdKTtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2xpZGVbM107IGkrKykge1xuICAgICAgICAgICAgICAgIGltcHJlc3MoKS5uZXh0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBuZXh0ID0gMDtcbiAgICAgICAgICAgIGltcHJlc3MoKS5nb3RvKHNsaWRlWzFdKTtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgMjA7IGkrKykge1xuICAgICAgICAgICAgICAgIGltcHJlc3MoKS5wcmV2KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpbXByZXNzKCkuZ290byhzbGlkZVsxXSk7XG4gICAgICAgIH1cbiAgICAgICAgaXNCaW5kZWQgPSBmYWxzZTtcbiAgICB9XG59XG5cbnZhciBzYXZlRGF0YSA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgZGF0YSA9IG5ldyBCbG9iKFxuICAgICAgICBbSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgbWV0YTogbWV0YSxcbiAgICAgICAgICAgIHNlZ21lbnRzOiBzZWdtZW50cyxcbiAgICAgICAgICAgIGR1cmF0aW9uOiBkdXJhdGlvbixcbiAgICAgICAgfSldLFxuICAgIHt0eXBlOiAnYXBwbGljYXRpb24vanNvbid9KTtcbiAgICB2YXIgZm9ybURhdGEgPSBuZXcgRm9ybURhdGEoKTtcbiAgICBmb3JtRGF0YS5hcHBlbmQoJ2RhdGEnLCBkYXRhLCAnY2FwdGlzLmpzb24nKTtcbiAgICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIHJlcXVlc3Qub3BlbignUE9TVCcsICdodHRwOi8vbG9jYWxob3N0OjMwMDAvc2F2ZScsIHRydWUpO1xuICAgIHJlcXVlc3Qub25sb2FkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAocmVxdWVzdC5zdGF0dXMgPT09IDIwMCkge1xuICAgICAgICAgICAgbG9jYXRpb24ucmVsb2FkKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnRmFpbGVkIHRvIHVwbG9hZCcpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJlcXVlc3Quc2VuZChmb3JtRGF0YSk7XG59XG5cbnZhciBiaW5kTWVkaWEgPSBmdW5jdGlvbiAoKSB7XG4gICAgaXNCaW5kZWQgPSB0cnVlO1xuICAgIHZhciB2aWRlbyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhZGRfdmlkZW8nKTtcbiAgICBzZWdtZW50cy5wdXNoKHtcbiAgICAgICAgdGltZXN0YW1wOiBNYXRoLmZsb29yKHZpZGVvLmN1cnJlbnRUaW1lKSxcbiAgICAgICAgc3RlcGlkOiBhY3RpdmUsXG4gICAgICAgIG5leHQ6IG5leHQsXG4gICAgfSk7XG4gICAgc3RlcEVsZW1lbnQuc3R5bGUuY29sb3IgPSAnI0U2RTY4QSc7XG59XG5cbnZhciBsb2FkVmlkZW8gPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKSxcbiAgICAgICAgdmlkZW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWRkX3ZpZGVvJyk7XG4gICAgcmVxdWVzdC5vcGVuKCdHRVQnLCAnaHR0cDovL2xvY2FsaG9zdDozMDAwL21lZGlhL2NhcHRpcy53ZWJtJywgdHJ1ZSk7XG4gICAgcmVxdWVzdC5yZXNwb25zZVR5cGUgPSBcImJsb2JcIjtcbiAgICByZXF1ZXN0Lm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHJlcXVlc3Quc3RhdHVzID09PSAyMDAgJiYgcmVxdWVzdC5yZWFkeVN0YXRlID09IDQpIHtcbiAgICAgICAgICAgIHZpZGVvLnNyYyA9IHdpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKHRoaXMucmVzcG9uc2UpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJlcXVlc3Quc2VuZCgpO1xufVxuXG5mdW5jdGlvbiB0aW1lRm9ybWF0IChzZWNvbmRzKSB7XG4gICAgdmFyIGggPSBNYXRoLmZsb29yKHNlY29uZHMvMzYwMCk7XG4gICAgdmFyIG0gPSBNYXRoLmZsb29yKChzZWNvbmRzIC0gKGggKiAzNjAwKSkgLyA2MCk7XG4gICAgdmFyIHMgPSBNYXRoLmZsb29yKHNlY29uZHMgLSAoaCAqIDM2MDApIC0gKG0gKiA2MCkpO1xuICAgIGggPSBoIDwgMTAgPyBcIjBcIiArIGggOiBoO1xuICAgIG0gPSBtIDwgMTAgPyBcIjBcIiArIG0gOiBtO1xuICAgIHMgPSBzIDwgMTAgPyBcIjBcIiArIHMgOiBzO1xuICAgIHJldHVybiBoICsgXCI6XCIgKyBtICsgXCI6XCIgKyBzO1xufVxuXG5leHBvcnRzLmNyZWF0ZVNsaWRlU2VnbWVudHMgPSBjcmVhdGVTbGlkZVNlZ21lbnRzO1xuIiwidmFyIGluaXRpYWxpemVFZGl0b3IgPSBmdW5jdGlvbigpIHtcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FwdGlzJykuaW5uZXJIVE1MICs9IChcbiAgICAgICAgJzxkaXYgaWQ9XCJjYXB0aXNfZWRpdG9yXCI+IFxcXG4gICAgICAgICAgICA8ZGl2IGlkPVwibG9hZGluZ1wiPjxwcm9ncmVzcyBpZD1cImxvYWRpbmdfc2VnbWVudHNcIiB2YWx1ZT1cIjBcIj48L3Byb2dyZXNzPjwvZGl2PiBcXFxuICAgICAgICAgICAgPHZpZGVvIGlkPVwiZWRpdF92aWRlb1wiIHByZWxvYWQgbXV0ZWQ+PC92aWRlbz4gXFxcbiAgICAgICAgICAgIDxkaXYgaWQ9XCJzZWdtZW50X2NvbnRcIj48ZGl2IGlkPVwiY2FwdGlzX2VkaXRvcl9zZWdtZW50c1wiPjwvZGl2PjwvZGl2PiBcXFxuICAgICAgICAgICAgPGNhbnZhcyBpZD1cInNlZ21lbnRzaG90XCI+PC9jYW52YXM+IFxcXG4gICAgICAgIDwvZGl2PidcbiAgICApO1xuICAgIHZhciB2aWRlbyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdlZGl0X3ZpZGVvJyksXG4gICAgICAgIHBhcnRzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcHRpc19lZGl0b3Jfc2VnbWVudHMnKSxcbiAgICAgICAgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NlZ21lbnRfY29udCcpLFxuICAgICAgICBsb2FkZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9hZGluZ19zZWdtZW50cycpLFxuICAgICAgICBsb2FkaW5nID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvYWRpbmcnKSxcbiAgICAgICAgY2FudmFzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NlZ21lbnRzaG90JyksXG4gICAgICAgIGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuICAgIHBhcnRzLmlubmVySFRNTCA9ICcnO1xuICAgIHZpZGVvLnNyYyA9IHdpbmRvdy52aWRlb1VSTDtcbiAgICAvL2NvbnNvbGUubG9nKHdpbmRvdy5zZWdtZW50cyk7XG4gICAgbG9hZGVyLnNldEF0dHJpYnV0ZSgnbWF4Jywgd2luZG93LnNlZ21lbnRzLmxlbmd0aCAtIDEpO1xuICAgIHZpZGVvLm9ubG9hZGVkbWV0YWRhdGEgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNhbnZhcy53aWR0aCA9IDI1MDtcbiAgICAgICAgY2FudmFzLmhlaWdodCA9IDE4NztcbiAgICAgICAgdmFyIGkgPSAwO1xuICAgICAgICB2YXIgbG9vcCA9IHNldEludGVydmFsKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgLy9jb25zb2xlLmxvZyh3aW5kb3cuc2VnbWVudHNbaV0pO1xuICAgICAgICAgICAgcGFydHMuaW5uZXJIVE1MICs9IChcbiAgICAgICAgICAgICAgICAnPGRpdiBjbGFzcz1cInNlZ21lbnRfYm94XCIgaWQ9XCJzZWdtZW50XycrIGkgKydcIj4gXFxcbiAgICAgICAgICAgICAgICAgICAgPGkgY2xhc3M9XCJzZWdtZW50X3RpbWVcIj4nKyB3aW5kb3cuZm9ybWF0RHVyYXRpb24od2luZG93LnNlZ21lbnRzW2ldLnRpbWVzdGFtcCkgKyc8L2k+IFxcXG4gICAgICAgICAgICAgICAgPC9kaXY+J1xuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHZpZGVvLmN1cnJlbnRUaW1lID0gd2luZG93LnNlZ21lbnRzW2ldLnRpbWVzdGFtcDtcbiAgICAgICAgICAgIGN0eC5kcmF3SW1hZ2UodmlkZW8sIDAsIDAsIDI1MCwgMTg3KTtcbiAgICAgICAgICAgIHZhciBpbWFnZSA9IGNhbnZhcy50b0RhdGFVUkwoKSxcbiAgICAgICAgICAgICAgICBib3ggPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2VnbWVudF8nICsgaSk7XG4gICAgICAgICAgICAvL2NvbnNvbGUubG9nKGltYWdlKTtcbiAgICAgICAgICAgIGJveC5zdHlsZS5iYWNrZ3JvdW5kSW1hZ2UgPSAndXJsKCcgKyBpbWFnZSArICcpJztcbiAgICAgICAgICAgIGxvYWRlci52YWx1ZSA9IGk7XG4gICAgICAgICAgICBpKys7XG4gICAgICAgICAgICBpZiAoaSA9PSB3aW5kb3cuc2VnbWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgLy9wYXJ0cy5zdHlsZS5oZWlnaHQgPSAxMjAgKiB3aW5kb3cuc2VnbWVudHMubGVuZ3RoICsgJ3B4JztcbiAgICAgICAgICAgICAgICBjb250YWluZXIuc3R5bGUud2lkdGggPSAnMjUwcHgnO1xuICAgICAgICAgICAgICAgIGxvYWRpbmcuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICAgICAgICAgICB2aWRlby5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcbiAgICAgICAgICAgICAgICB2aWRlby5wYXVzZSgpO1xuICAgICAgICAgICAgICAgIHZpZGVvLmN1cnJlbnRUaW1lID0gMDtcbiAgICAgICAgICAgICAgICBjbGVhckludGVydmFsKGxvb3ApO1xuICAgICAgICAgICAgICAgIHZhciBlbGVtZW50cyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoJ3NlZ21lbnRfYm94Jyk7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBlbGVtZW50cy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICBlbGVtZW50c1tqXS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGVkaXRvclBsYXlTZWdtZW50LCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vY29uc29sZS5sb2coZWxlbWVudHMpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfSwgMTAwKTtcbiAgICB9O1xuICAgIHdpbmRvdy5yZWxvYWRFdmVudHMoKTtcblxufVxuXG52YXIgZWRpdG9yUGxheVNlZ21lbnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmlkZW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZWRpdF92aWRlbycpO1xuICAgIHZhciBpbmRleCA9IHBhcnNlSW50KHRoaXMuaWQuc3BsaXQoJ18nKVsxXSk7XG4gICAgd2luZG93LnNlZ21lbnQgPSBpbmRleDtcbiAgICB3aW5kb3cuY2FuVXBkYXRlID0gdHJ1ZTtcbiAgICB2aWRlby5jdXJyZW50VGltZSA9IHdpbmRvdy5zZWdtZW50c1tpbmRleF0udGltZXN0YW1wO1xuICAgIHZpZGVvLm11dGVkID0gZmFsc2U7XG4gICAgaW1wcmVzcygpLmdvdG8oJ292ZXJ2aWV3Jyk7XG4gICAgaW1wcmVzcygpLmdvdG8od2luZG93LnNlZ21lbnRzW2luZGV4XS5zdGVwaWQpO1xuICAgIC8vVE9ETzogQWxsIGNhc2VzXG4gICAgaWYgKHdpbmRvdy5zZWdtZW50c1tpbmRleF0ubmV4dCkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHdpbmRvdy5zZWdtZW50c1tpbmRleF0ubmV4dDsgaSsrKSB7XG4gICAgICAgICAgICBpbXByZXNzKCkubmV4dCgpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmICh3aW5kb3cuc2VnbWVudHNbaW5kZXhdLnByZXYpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB3aW5kb3cuc2VnbWVudHNbaW5kZXhdLnByZXY7IGkrKykge1xuICAgICAgICAgICAgaW1wcmVzcygpLnByZXYoKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBjb25zb2xlLmxvZyh3aW5kb3cuc2xpZGVzLCB3aW5kb3cuc2VnbWVudHNbaW5kZXhdKTtcbiAgICB2aWRlby5wbGF5KCk7XG5cbn1cblxuZXhwb3J0cy5pbml0aWFsaXplRWRpdG9yID0gaW5pdGlhbGl6ZUVkaXRvcjtcbiIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbihmdW5jdGlvbiBicm93c2VyaWZ5U2hpbShtb2R1bGUsIGV4cG9ydHMsIGRlZmluZSwgYnJvd3NlcmlmeV9zaGltX19kZWZpbmVfX21vZHVsZV9fZXhwb3J0X18pIHtcbnZhciBiaW5kU2VnbWVudCA9IG51bGwsXG4gICAgbWV0YSA9IHt9LFxuICAgIGR1cmF0aW9uID0gMCxcbiAgICBhY3RpdmUgPSBudWxsLFxuICAgIG5leHQgPSAwLFxuICAgIHN0ZXBFbGVtZW50ID0gbnVsbCxcbiAgICBpc0JpbmRlZCA9IGZhbHNlLFxuICAgIHNlZ21lbnRzID0gW107XG5cbnZhciBjcmVhdGVTbGlkZVNlZ21lbnRzID0gZnVuY3Rpb24gKCkge1xuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYXB0aXMnKS5pbm5lckhUTUwgKz0gKFxuICAgICAgICAnPGRpdiBpZD1cImNhcHRpc19hZGRcIj4gXFxcbiAgICAgICAgPHZpZGVvIGlkPVwiYWRkX3ZpZGVvXCIgcHJlbG9hZCBjb250cm9scz48L3ZpZGVvPiBcXFxuICAgICAgICA8ZGl2IGlkPVwic2VnbWVudF9jb250XCI+PGRpdiBpZD1cImNhcHRpc19lZGl0b3Jfc2VnbWVudHNcIj48L2Rpdj48L2Rpdj4gXFxcbiAgICAgICAgPC9kaXY+J1xuICAgICk7XG4gICAgdmFyIHZpZGVvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FkZF92aWRlbycpLFxuICAgICAgICBwYXJ0cyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYXB0aXNfZWRpdG9yX3NlZ21lbnRzJyksXG4gICAgICAgIGNvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzZWdtZW50X2NvbnQnKSxcbiAgICAgICAgc3RlcHMgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKCdzdGVwJyk7XG4gICAgbG9hZFZpZGVvKCk7XG4gICAgYmluZFNlZ21lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYmluZCcpO1xuICAgIGJpbmRTZWdtZW50LnN0eWxlLm9wYWNpdHkgPSAnMS4wJztcbiAgICBwYXJ0cy5pbm5lckhUTUwgPSAnJztcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ZXBzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHBhcnRzLmlubmVySFRNTCArPSAnPGRpdiBjbGFzcz1cImltcHJlc3Nfc3RlcFwiIGlkPVwic3RlcF8nKyBzdGVwc1tpXS5pZCArJ1wiPnN0ZXA6ICcrIHN0ZXBzW2ldLmlkICsnPC9kaXY+JztcbiAgICAgICAgdmFyIHN1YnMgPSBzdGVwc1tpXS5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKCdzdWJzdGVwJyk7XG4gICAgICAgIGlmIChzdWJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIG1ldGFbc3RlcHNbaV0uaWRdID0gc3Vicy5sZW5ndGg7XG4gICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IHN1YnMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICBwYXJ0cy5pbm5lckhUTUwgKz0gJzxkaXYgY2xhc3M9XCJpbXByZXNzX3N0ZXBcIiBpZD1cInN0ZXBfJysgc3RlcHNbaV0uaWQgKydfc3ViXycrIChqICsgMSkgKydcIj5zdGVwOiAnKyBzdGVwc1tpXS5pZCArJywgc3Vic3RlcDogJysgKGogKyAxKSArJzwvZGl2Pic7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgdmlkZW8uYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGR1cmF0aW9uID0gdGltZUZvcm1hdCh2aWRlby5kdXJhdGlvbik7XG4gICAgfSk7XG4gICAgY29udGFpbmVyLnN0eWxlLndpZHRoID0gJzI1MHB4JztcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHNlbGVjdFNlZ21lbnQsIGZhbHNlKTtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2F2ZScpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgc2F2ZURhdGEsIGZhbHNlKTtcbn1cbnZhciBwYXN0ID0gbnVsbDtcbnZhciBzZWxlY3RTZWdtZW50ID0gZnVuY3Rpb24gKGUpIHtcbiAgICBzdGVwRWxlbWVudCA9IGUudGFyZ2V0O1xuICAgIHZhciBzbGlkZSA9IGUudGFyZ2V0LmlkLnNwbGl0KCdfJyk7XG4gICAgaWYgKHNsaWRlWzBdID09ICdzdGVwJykge1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYmluZCcpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgYmluZE1lZGlhLCBmYWxzZSk7XG4gICAgICAgIGlmIChwYXN0ICE9IG51bGwgJiYgIWlzQmluZGVkKSB7IHBhc3Quc3R5bGUuY29sb3IgPSAnI0Q1REJEOSc7IH1cbiAgICAgICAgZS50YXJnZXQuc3R5bGUuY29sb3IgPSAnIzEzQUQ4Nyc7XG4gICAgICAgIGJpbmRTZWdtZW50LnN0eWxlLmNvbG9yID0gJyMxM0FEODcnO1xuICAgICAgICBwYXN0ID0gZS50YXJnZXQ7XG4gICAgICAgIGFjdGl2ZSA9IHNsaWRlWzFdO1xuICAgICAgICBpZiAoc2xpZGVbMl0pIHtcbiAgICAgICAgICAgIG5leHQgPSBzbGlkZVszXTtcbiAgICAgICAgICAgIGltcHJlc3MoKS5nb3RvKHNsaWRlWzFdKTtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgMjA7IGkrKykge1xuICAgICAgICAgICAgICAgIGltcHJlc3MoKS5wcmV2KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpbXByZXNzKCkuZ290byhzbGlkZVsxXSk7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNsaWRlWzNdOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpbXByZXNzKCkubmV4dCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbmV4dCA9IDA7XG4gICAgICAgICAgICBpbXByZXNzKCkuZ290byhzbGlkZVsxXSk7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IDIwOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpbXByZXNzKCkucHJldigpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaW1wcmVzcygpLmdvdG8oc2xpZGVbMV0pO1xuICAgICAgICB9XG4gICAgICAgIGlzQmluZGVkID0gZmFsc2U7XG4gICAgfVxufVxuXG52YXIgc2F2ZURhdGEgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGRhdGEgPSBuZXcgQmxvYihcbiAgICAgICAgW0pTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIG1ldGE6IG1ldGEsXG4gICAgICAgICAgICBzZWdtZW50czogc2VnbWVudHMsXG4gICAgICAgICAgICBkdXJhdGlvbjogZHVyYXRpb24sXG4gICAgICAgIH0pXSxcbiAgICB7dHlwZTogJ2FwcGxpY2F0aW9uL2pzb24nfSk7XG4gICAgdmFyIGZvcm1EYXRhID0gbmV3IEZvcm1EYXRhKCk7XG4gICAgZm9ybURhdGEuYXBwZW5kKCdkYXRhJywgZGF0YSwgJ2NhcHRpcy5qc29uJyk7XG4gICAgdmFyIHJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICByZXF1ZXN0Lm9wZW4oJ1BPU1QnLCAnaHR0cDovL2xvY2FsaG9zdDozMDAwL3NhdmUnLCB0cnVlKTtcbiAgICByZXF1ZXN0Lm9ubG9hZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHJlcXVlc3Quc3RhdHVzID09PSAyMDApIHtcbiAgICAgICAgICAgIGxvY2F0aW9uLnJlbG9hZCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ0ZhaWxlZCB0byB1cGxvYWQnKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXF1ZXN0LnNlbmQoZm9ybURhdGEpO1xufVxuXG52YXIgYmluZE1lZGlhID0gZnVuY3Rpb24gKCkge1xuICAgIGlzQmluZGVkID0gdHJ1ZTtcbiAgICB2YXIgdmlkZW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWRkX3ZpZGVvJyk7XG4gICAgc2VnbWVudHMucHVzaCh7XG4gICAgICAgIHRpbWVzdGFtcDogTWF0aC5mbG9vcih2aWRlby5jdXJyZW50VGltZSksXG4gICAgICAgIHN0ZXBpZDogYWN0aXZlLFxuICAgICAgICBuZXh0OiBuZXh0LFxuICAgIH0pO1xuICAgIHN0ZXBFbGVtZW50LnN0eWxlLmNvbG9yID0gJyNFNkU2OEEnO1xufVxuXG52YXIgbG9hZFZpZGVvID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciByZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCksXG4gICAgICAgIHZpZGVvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FkZF92aWRlbycpO1xuICAgIHJlcXVlc3Qub3BlbignR0VUJywgJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMC9tZWRpYS9jYXB0aXMud2VibScsIHRydWUpO1xuICAgIHJlcXVlc3QucmVzcG9uc2VUeXBlID0gXCJibG9iXCI7XG4gICAgcmVxdWVzdC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmIChyZXF1ZXN0LnN0YXR1cyA9PT0gMjAwICYmIHJlcXVlc3QucmVhZHlTdGF0ZSA9PSA0KSB7XG4gICAgICAgICAgICB2aWRlby5zcmMgPSB3aW5kb3cuVVJMLmNyZWF0ZU9iamVjdFVSTCh0aGlzLnJlc3BvbnNlKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXF1ZXN0LnNlbmQoKTtcbn1cblxuZnVuY3Rpb24gdGltZUZvcm1hdCAoc2Vjb25kcykge1xuICAgIHZhciBoID0gTWF0aC5mbG9vcihzZWNvbmRzLzM2MDApO1xuICAgIHZhciBtID0gTWF0aC5mbG9vcigoc2Vjb25kcyAtIChoICogMzYwMCkpIC8gNjApO1xuICAgIHZhciBzID0gTWF0aC5mbG9vcihzZWNvbmRzIC0gKGggKiAzNjAwKSAtIChtICogNjApKTtcbiAgICBoID0gaCA8IDEwID8gXCIwXCIgKyBoIDogaDtcbiAgICBtID0gbSA8IDEwID8gXCIwXCIgKyBtIDogbTtcbiAgICBzID0gcyA8IDEwID8gXCIwXCIgKyBzIDogcztcbiAgICByZXR1cm4gaCArIFwiOlwiICsgbSArIFwiOlwiICsgcztcbn1cblxuZXhwb3J0cy5jcmVhdGVTbGlkZVNlZ21lbnRzID0gY3JlYXRlU2xpZGVTZWdtZW50cztcblxuOyBicm93c2VyaWZ5X3NoaW1fX2RlZmluZV9fbW9kdWxlX19leHBvcnRfXyh0eXBlb2YgQWRkICE9IFwidW5kZWZpbmVkXCIgPyBBZGQgOiB3aW5kb3cuQWRkKTtcblxufSkuY2FsbChnbG9iYWwsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGZ1bmN0aW9uIGRlZmluZUV4cG9ydChleCkgeyBtb2R1bGUuZXhwb3J0cyA9IGV4OyB9KTtcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSkiLCIvKipcbiogQGF1dGhvciBQYXNoYSBCaW55YXRvdiA8cGFzaGFAYmlueWF0b3YuY29tPlxuKiBAY29weXJpZ2h0IDIwMTQgUGFzaGEgQmlueWF0b3ZcbiogQGxpY2Vuc2Uge0BsaW5rIGh0dHBzOi8vZ2l0aHViLmNvbS9iaW55YXRvdi9jYXB0aXMuanMvYmxvYi9tYXN0ZXIvTElDRU5TRXxNSVQgTGljZW5zZX1cbiovXG5cbi8qKlxuKi9cbm5hdmlnYXRvci5nZXRVc2VyTWVkaWEgPSAoXG4gICAgbmF2aWdhdG9yLmdldFVzZXJNZWRpYSB8fFxuICAgIG5hdmlnYXRvci53ZWJraXRHZXRVc2VyTWVkaWEgfHxcbiAgICBuYXZpZ2F0b3IubW96R2V0VXNlck1lZGlhIHx8XG4gICAgbmF2aWdhdG9yLm1zR2V0VXNlck1lZGlhXG4pO1xuXG53aW5kb3cuVVJMID0gKFxuICAgIHdpbmRvdy5VUkwgfHxcbiAgICB3aW5kb3cud2Via2l0VVJMIHx8XG4gICAgd2luZG93Lm1velVSTCB8fFxuICAgIHdpbmRvdy5tc1VSTFxuKTtcblxudmFyIEF1ZGlvQ29udGV4dCA9IHdpbmRvdy5BdWRpb0NvbnRleHQgfHwgd2luZG93LndlYmtpdEF1ZGlvQ29udGV4dCxcbiAgICBXaGFtbXkgPSByZXF1aXJlKCdXaGFtbXknKSxcbiAgICBFZGl0b3IgPSByZXF1aXJlKCcuL0VkaXRvcicpLFxuICAgIEFkZCA9IHJlcXVpcmUoJy4vQWRkJyksXG4gICAgY2hhbm5lbERhdGEgPSBbXTtcblxudmFyIGNhcHRpcyA9IHtzdHJlYW06IG51bGwsXG4gICAgZnJhbWVzOiBbXSxcbiAgICB0b29sYmFyOiBmYWxzZSxcbiAgICBjYXB0dXJpbmc6IGZhbHNlLFxuICAgIHN0cmVhbWluZzogZmFsc2UsXG4gICAgcmVjb3JkOiBudWxsLFxuICAgIHBhdXNlZDogZmFsc2UsXG4gICAgbm90aWZpZWQ6IGZhbHNlLFxuICAgIGF1ZGlvOiB7XG4gICAgICAgIHJlY29yZGluZ1NpemU6IDAsXG4gICAgICAgIHNhbXBsZVJhdGU6IDQ0MTAwLFxuICAgICAgICByZWNvcmRpbmc6IGZhbHNlLFxuICAgICAgICBwcm9jZXNzb3I6IG51bGxcbiAgICB9LFxuICAgIGltcHJlc3M6IHtcbiAgICAgICAgc3RlcDogbnVsbCxcbiAgICAgICAgaXNTdGVwOiBmYWxzZSxcbiAgICAgICAgc2VnbWVudHM6IFtdLFxuICAgICAgICBtZXRhOiB7fVxuICAgIH0sXG4gICAgcGxheWVyOiB7XG4gICAgICAgIG9iamVjdFVybDogbnVsbCxcbiAgICAgICAgcmVhZHk6IGZhbHNlLFxuICAgICAgICB0aW1ldXBkYXRlOiBudWxsLFxuICAgICAgICBqc29uOiBudWxsLFxuICAgICAgICB0aW1lc3RhbXBzOiBbXSxcbiAgICAgICAgc2xpZGVzOiBbXSxcbiAgICAgICAgaXNPbjogZmFsc2UsXG4gICAgICAgIGN1cnJlbnRTdGVwOiBudWxsLFxuICAgICAgICBhY3RpdmVTdGVwOiBudWxsLFxuICAgICAgICBrZXlwcmVzc2VkOiBmYWxzZVxuICAgIH0sXG4gICAgc2VnbWVudHM6IHtcbiAgICAgICAgcmVhZHk6IGZhbHNlXG4gICAgfVxufVxuXG5mdW5jdGlvbiBpbml0aWFsaXplVG9vbGJhciAoZSkge1xuICAgIGlmIChlLmN0cmxLZXkgJiYgZS5rZXlDb2RlID09IDY5KSB7XG4gICAgICAgIGNhcHRpcy50b29sYmFyID0gdHJ1ZTtcbiAgICAgICAgd2luZG93LmNhblVwZGF0ZSA9IGZhbHNlO1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FwdGlzJykuaW5uZXJIVE1MICs9IChcbiAgICAgICAgICAgICc8ZGl2IGlkPVwidG9vbGJhclwiPiBcXFxuICAgICAgICAgICAgICAgIDx1bD4gXFxcbiAgICAgICAgICAgICAgICAgICAgPGxpPjxpIGlkPVwiY2FtZXJhXCIgY2xhc3M9XCJmYSBmYS12aWRlby1jYW1lcmEgY2FwdGlzX2ljb24gdG9vbHRpcFwiPjxzcGFuIGNsYXNzPVwidGlwLWNvbnRlbnRcIj5UdXJuIG9uIHRoZSBjYW1lcmE8L3NwYW4+PC9pPjwvbGk+IFxcXG4gICAgICAgICAgICAgICAgICAgIDxsaT48aSBpZD1cInJlY29yZFwiIGNsYXNzPVwiZmEgZmEtY2lyY2xlIHRvb2x0aXBcIj48c3BhbiBjbGFzcz1cInRpcC1jb250ZW50XCI+UmVjb3JkIHZpZGVvPC9zcGFuPjwvaT48L2xpPiBcXFxuICAgICAgICAgICAgICAgICAgICA8bGk+PGkgaWQ9XCJwYXVzZXJlY1wiIGNsYXNzPVwiZmEgZmEtcGF1c2UgY2FwdGlzX2ljb24gdG9vbHRpcFwiPjxzcGFuIGNsYXNzPVwidGlwLWNvbnRlbnRcIj5QYXVzZSB2aWRlbyByZWNvcmRpbmc8L3NwYW4+PC9pPjwvbGk+IFxcXG4gICAgICAgICAgICAgICAgICAgIDxsaT48aSBpZD1cInNhdmVcIiBjbGFzcz1cImZhIGZhLXNhdmUgY2FwdGlzX2ljb24gdG9vbHRpcFwiPjxzcGFuIGNsYXNzPVwidGlwLWNvbnRlbnRcIj5TYXZlIHZpZGVvPC9zcGFuPjwvaT48L2xpPiBcXFxuICAgICAgICAgICAgICAgICAgICA8bGk+PGkgaWQ9XCJ1cGRhdGVcIiBjbGFzcz1cImZhIGZhLXBsdXMtc3F1YXJlIGNhcHRpc19pY29uIHRvb2x0aXBcIj48c3BhbiBjbGFzcz1cInRpcC1jb250ZW50XCI+QWRkIHNlZ21lbnRzIHRvIHZpZGVvPC9zcGFuPjwvaT48L2xpPiBcXFxuICAgICAgICAgICAgICAgICAgICA8bGk+PGkgaWQ9XCJlZGl0XCIgY2xhc3M9XCJmYSBmYS1wZW5jaWwtc3F1YXJlIGNhcHRpc19pY29uIHRvb2x0aXBcIj48c3BhbiBjbGFzcz1cInRpcC1jb250ZW50XCI+RWRpdCB2aWRlbyBzZWdtZW50czwvc3Bhbj48L2k+PC9saT4gXFxcbiAgICAgICAgICAgICAgICAgICAgPGxpPjxpIGlkPVwiYmluZFwiIGNsYXNzPVwiZmEgZmEtbGluayBjYXB0aXNfaWNvbiB0b29sdGlwXCI+PHNwYW4gY2xhc3M9XCJ0aXAtY29udGVudFwiPkJpbmQgc2VnbWVudDwvc3Bhbj48L2k+PC9saT4gXFxcbiAgICAgICAgICAgICAgICAgICAgPGxpPjxpIGlkPVwic3dpdGNoXCIgY2xhc3M9XCJmYSBmYS1wb3dlci1vZmYgY2FwdGlzX2ljb24gdG9vbHRpcFwiPjxzcGFuIGNsYXNzPVwidGlwLWNvbnRlbnRcIj5DbG9zZSB0b29sYmFyPC9zcGFuPjwvaT48L2xpPiBcXFxuICAgICAgICAgICAgICAgIDwvdWw+IFxcXG4gICAgICAgICAgICA8L2Rpdj4nXG4gICAgICAgICk7XG4gICAgICAgIG5vdGlmaWNhdGlvbignQ2FwdGlzIHRvb2xiYXIgaXMgcmVhZHkgdG8gdXNlLicpO1xuICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdrZXl1cCcsIGluaXRpYWxpemVUb29sYmFyLCBmYWxzZSk7XG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleXVwJywgY2xvc2VUb29sYmFyLCBmYWxzZSk7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzd2l0Y2gnKS5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgICAgIGNsb3NlVG9vbGJhcixcbiAgICAgICAgICAgIGZhbHNlXG4gICAgICAgICk7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYW1lcmEnKS5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgICAgIG1lZGlhU3RyZWFtLFxuICAgICAgICAgICAgZmFsc2VcbiAgICAgICAgKTtcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2VkaXQnKS5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgICAgIEVkaXRvci5pbml0aWFsaXplRWRpdG9yLFxuICAgICAgICAgICAgZmFsc2VcbiAgICAgICAgKTtcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3VwZGF0ZScpLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgICAnY2xpY2snLFxuICAgICAgICAgICAgQWRkLmNyZWF0ZVNsaWRlU2VnbWVudHMsXG4gICAgICAgICAgICBmYWxzZVxuICAgICAgICApO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gbm90aWZpY2F0aW9uIChtc2cpIHtcbiAgICB2YXIgbm90aSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdub3RpZnknKTtcbiAgICBpZiAobm90aSkge1xuICAgICAgICBub3RpLm91dGVySFRNTCA9ICcnO1xuICAgIH1cbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FwdGlzJykuaW5uZXJIVE1MICs9IChcbiAgICAgICAgJzxkaXYgaWQ9XCJub3RpZnlcIj4gXFxcbiAgICAgICAgICAgICcrIG1zZyArJyBcXFxuICAgICAgICAgICAgPGkgaWQ9XCJjbG9zZV9ub3RpZmljYXRpb25cIiBjbGFzcz1cImZhIGZhLXRpbWVzXCI+PC9pPiBcXFxuICAgICAgICA8L2Rpdj4nXG4gICAgKTtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2xvc2Vfbm90aWZpY2F0aW9uJykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgJ21vdXNldXAnLFxuICAgICAgICBjbG9zZU5vdGlmaWNhdGlvbixcbiAgICAgICAgZmFsc2VcbiAgICApO1xuICAgIGNhcHRpcy5ub3RpZmllZCA9IGZhbHNlO1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICBjbG9zZU5vdGlmaWNhdGlvbigpO1xuICAgIH0sIDUwMDApO1xufVxuXG5mdW5jdGlvbiBjbG9zZU5vdGlmaWNhdGlvbiAoKSB7XG4gICAgaWYgKGNhcHRpcy5ub3RpZmllZCkgcmV0dXJuO1xuICAgIHZhciBub3RpID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ25vdGlmeScpLFxuICAgICAgICBpbmRleCA9IDE7XG4gICAgdmFyIGxvb3AgPSBzZXRJbnRlcnZhbChmdW5jdGlvbiAoKSB7XG4gICAgICAgIG5vdGkuc3R5bGUub3BhY2l0eSA9ICcwLicgKyAoMTAgLSBpbmRleCk7XG4gICAgICAgIGlmIChpbmRleCA9PSAxMCkge1xuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbChsb29wKTtcbiAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjbG9zZV9ub3RpZmljYXRpb24nKS5yZW1vdmVFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgICAgICdtb3VzZXVwJyxcbiAgICAgICAgICAgICAgICBjbG9zZU5vdGlmaWNhdGlvbixcbiAgICAgICAgICAgICAgICBmYWxzZVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIG5vdGkub3V0ZXJIVE1MID0gJyc7XG4gICAgICAgICAgICBjYXB0aXMubm90aWZpZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGluZGV4Kys7XG4gICAgfSwgNjApO1xufVxuXG5mdW5jdGlvbiBjbGVhclNwYWNlICgpIHtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3dpdGNoJykucmVtb3ZlRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgY2xvc2VUb29sYmFyLFxuICAgICAgICBmYWxzZVxuICAgICk7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2VkaXQnKS5yZW1vdmVFdmVudExpc3RlbmVyKFxuICAgICAgICAnY2xpY2snLFxuICAgICAgICBFZGl0b3IuaW5pdGlhbGl6ZUVkaXRvcixcbiAgICAgICAgZmFsc2VcbiAgICApO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd1cGRhdGUnKS5yZW1vdmVFdmVudExpc3RlbmVyKFxuICAgICAgICAnY2xpY2snLFxuICAgICAgICBBZGQuY3JlYXRlU2xpZGVTZWdtZW50cyxcbiAgICAgICAgZmFsc2VcbiAgICApO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYW1lcmEnKS5yZW1vdmVFdmVudExpc3RlbmVyKFxuICAgICAgICAnY2xpY2snLFxuICAgICAgICBjbG9zZVRvb2xiYXIsXG4gICAgICAgIGZhbHNlXG4gICAgKTtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndG9vbGJhcicpLm91dGVySFRNTCA9ICcnO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2tleXVwJywgY2xvc2VUb29sYmFyLCBmYWxzZSk7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLCBpbml0aWFsaXplVG9vbGJhciwgZmFsc2UpO1xuICAgIHZhciBlZGl0b3JTZWdtZW50cyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYXB0aXNfZWRpdG9yJyksXG4gICAgICAgIGFkZFNlZ21lbnRzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcHRpc19hZGQnKTtcbiAgICBpZiAoZWRpdG9yU2VnbWVudHMpIHtcbiAgICAgICAgZWRpdG9yU2VnbWVudHMub3V0ZXJIVE1MID0gJyc7XG4gICAgfVxuICAgIGlmIChhZGRTZWdtZW50cykge1xuICAgICAgICBhZGRTZWdtZW50cy5vdXRlckhUTUwgPSAnJztcbiAgICB9XG4gICAgaWYgKGNhcHRpcy5zdHJlYW1pbmcpIHtcbiAgICAgICAgY2FwdGlzLnN0cmVhbS5zdG9wKCk7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsaXZlX3N0cmVhbScpLm91dGVySFRNTCA9ICcnO1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndGltZXInKS5vdXRlckhUTUwgPSAnJztcbiAgICAgICAgY2FwdGlzLnN0cmVhbWluZyA9IGZhbHNlO1xuICAgIH1cbiAgICBpZiAoY2FwdGlzLmNhcHR1cmluZykge1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncG9seWdvbicpLm91dGVySFRNTCA9ICcnO1xuICAgICAgICBjYXB0aXMuY2FwdHVyaW5nID0gZmFsc2U7XG4gICAgfVxufVxuXG5cbmZ1bmN0aW9uIGNsb3NlVG9vbGJhciAoZSkge1xuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGlmICgoZS5jdHJsS2V5ICYmIGUua2V5Q29kZSA9PSA2OSkgfHwgZS50YXJnZXQuaWQgPT0gJ3N3aXRjaCcpIHtcbiAgICAgICAgY2xlYXJTcGFjZSgpO1xuICAgICAgICBjYXB0aXMudG9vbGJhciA9IGZhbHNlO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gcmVsb2FkRXZlbnRzICgpIHtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3dpdGNoJykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgY2xvc2VUb29sYmFyLFxuICAgICAgICBmYWxzZVxuICAgICk7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NhdmUnKS5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAnY2xpY2snLFxuICAgICAgICBzYXZlTWVkaWEsXG4gICAgICAgIGZhbHNlXG4gICAgKTtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FtZXJhJykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgbWVkaWFTdHJlYW0sXG4gICAgICAgIGZhbHNlXG4gICAgKTtcbn1cblxud2luZG93LnJlbG9hZEV2ZW50cyA9IHJlbG9hZEV2ZW50cztcblxuZnVuY3Rpb24gbWVkaWFTdHJlYW0gKCkge1xuICAgIGlmIChuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhKSB7XG4gICAgICAgIG5hdmlnYXRvci5nZXRVc2VyTWVkaWEgKFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHZpZGVvOiB0cnVlLFxuICAgICAgICAgICAgICAgIGF1ZGlvOiB0cnVlXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZnVuY3Rpb24gKGxvY2FsTWVkaWFTdHJlYW0pIHtcbiAgICAgICAgICAgICAgICBjYXB0aXMuc3RyZWFtID0gbG9jYWxNZWRpYVN0cmVhbTtcbiAgICAgICAgICAgICAgICBjYXB0aXMuc3RyZWFtaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBub3RpZmljYXRpb24oJ0NhbWVyYSBpcyBvbiEgQ2FwdGlzIHJlYWR5IHRvIGNhcHR1cmUgdmlkZW8gc2VnbWVudHMuJyk7XG4gICAgICAgICAgICAgICAgaWYgKHdpbmRvdy5jYW5VcGRhdGUpIHsgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2VkaXRfdmlkZW8nKS5vdXRlckhUTUwgPSAnJzsgfVxuICAgICAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYXB0aXMnKS5pbm5lckhUTUwgKz0gKFxuICAgICAgICAgICAgICAgICAgICAnPHZpZGVvIGlkPVwibGl2ZV9zdHJlYW1cIiBhdXRvcGxheSBtdXRlZD48L3ZpZGVvPiBcXFxuICAgICAgICAgICAgICAgICAgICA8aSBpZD1cInRpbWVyXCI+PC9pPidcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYXB0aXMnKS5pbm5lckhUTUwgKz0gKFxuICAgICAgICAgICAgICAgICAgICAnPGNhbnZhcyBpZD1cInBvbHlnb25cIj48L2NhbnZhcz4nXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGl2ZV9zdHJlYW0nKS5zcmMgPSB3aW5kb3cuVVJMLmNyZWF0ZU9iamVjdFVSTChsb2NhbE1lZGlhU3RyZWFtKTtcbiAgICAgICAgICAgICAgICByZWxvYWRFdmVudHMoKTtcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FtZXJhJykuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVjb3JkJykuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3JlY29yZCcpLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgICAgICAgICAgICdjbGljaycsXG4gICAgICAgICAgICAgICAgICAgIHN0YXJ0UmVjb3JkaW5nLFxuICAgICAgICAgICAgICAgICAgICBmYWxzZVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJnZXRVc2VyTWVkaWEgbm90IHN1cHBvcnRlZFwiKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHRpbWVGb3JtYXQgKHNlY29uZHMpIHtcblx0dmFyIGggPSBNYXRoLmZsb29yKHNlY29uZHMvMzYwMCk7XG5cdHZhciBtID0gTWF0aC5mbG9vcigoc2Vjb25kcyAtIChoICogMzYwMCkpIC8gNjApO1xuXHR2YXIgcyA9IE1hdGguZmxvb3Ioc2Vjb25kcyAtIChoICogMzYwMCkgLSAobSAqIDYwKSk7XG5cdGggPSBoIDwgMTAgPyBcIjBcIiArIGggOiBoO1xuXHRtID0gbSA8IDEwID8gXCIwXCIgKyBtIDogbTtcblx0cyA9IHMgPCAxMCA/IFwiMFwiICsgcyA6IHM7XG5cdHJldHVybiBoICsgXCI6XCIgKyBtICsgXCI6XCIgKyBzO1xufVxuXG53aW5kb3cuZm9ybWF0RHVyYXRpb24gPSB0aW1lRm9ybWF0O1xuXG5mdW5jdGlvbiBjb250aW51ZVJlY29yZGluZyAoKSB7XG4gICAgY2FwdGlzLnBhdXNlZCA9IGZhbHNlO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsaXZlX3N0cmVhbScpLnBsYXkoKTtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVjb3JkJykucmVtb3ZlRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgY29udGludWVSZWNvcmRpbmcsXG4gICAgICAgIGZhbHNlXG4gICAgKTtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGF1c2VyZWMnKS5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAnY2xpY2snLFxuICAgICAgICBwYXVzZVJlY29yZGluZyxcbiAgICAgICAgZmFsc2VcbiAgICApO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZWNvcmQnKS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwYXVzZXJlYycpLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xufVxuXG5mdW5jdGlvbiBwYXVzZVJlY29yZGluZyAoKSB7XG4gICAgY2FwdGlzLnBhdXNlZCA9IHRydWU7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xpdmVfc3RyZWFtJykucGF1c2UoKTtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVjb3JkJykucmVtb3ZlRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgc3RhcnRSZWNvcmRpbmcsXG4gICAgICAgIGZhbHNlXG4gICAgKTtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVjb3JkJykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgY29udGludWVSZWNvcmRpbmcsXG4gICAgICAgIGZhbHNlXG4gICAgKTtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVjb3JkJykuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BhdXNlcmVjJykuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbn1cblxuZnVuY3Rpb24gc3RhcnRSZWNvcmRpbmcgKCkge1xuICAgIGNhcHRpcy5hdWRpby5yZWNvcmRpbmcgPSB0cnVlO1xuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZWNvcmQnKS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwYXVzZXJlYycpLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwYXVzZXJlYycpLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICdjbGljaycsXG4gICAgICAgIHBhdXNlUmVjb3JkaW5nLFxuICAgICAgICBmYWxzZVxuICAgICk7XG4gICAgdmFyIHZpZGVvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xpdmVfc3RyZWFtJyksXG4gICAgICAgIGNhbnZhcyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwb2x5Z29uJyksXG4gICAgICAgIHRpbWVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3RpbWVyJyksXG4gICAgICAgIGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpLFxuICAgICAgICBhdWRpb0NvbnRleHQgPSBuZXcgQXVkaW9Db250ZXh0KCksXG4gICAgICAgIGdhaW5Ob2RlID0gYXVkaW9Db250ZXh0LmNyZWF0ZUdhaW4oKSxcbiAgICAgICAgYXVkaW9JbnB1dCA9IGF1ZGlvQ29udGV4dC5jcmVhdGVNZWRpYVN0cmVhbVNvdXJjZShjYXB0aXMuc3RyZWFtKSxcbiAgICAgICAgYnVmZmVyU2l6ZSA9IDEwMjQsXG4gICAgICAgIGN1cnJlbnRUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCksXG4gICAgICAgIGluZGV4ID0gMDtcbiAgICBhdWRpb0lucHV0LmNvbm5lY3QoZ2Fpbk5vZGUpO1xuICAgIGNhcHRpcy5hdWRpby5wcm9jZXNzb3IgPSBhdWRpb0NvbnRleHQuY3JlYXRlU2NyaXB0UHJvY2Vzc29yKGJ1ZmZlclNpemUsIDEsIDEpO1xuICAgIGNhcHRpcy5jYXB0dXJpbmcgPSB0cnVlO1xuICAgIGNhcHRpcy5yZWNvcmQgPSBuZXcgV2hhbW15LlZpZGVvKCk7XG4gICAgdmFyIGZyYW1lV2lkdGggPSB2aWRlby5vZmZzZXRXaWR0aCAtIDE0LFxuICAgICAgICBmcmFtZUhlaWdodCA9IHZpZGVvLm9mZnNldEhlaWdodCAtIDE0O1xuICAgIGNhbnZhcy53aWR0aCA9IGZyYW1lV2lkdGg7XG4gICAgY2FudmFzLmhlaWdodCA9IGZyYW1lSGVpZ2h0O1xuICAgIGNhcHRpcy5hdWRpby5wcm9jZXNzb3Iub25hdWRpb3Byb2Nlc3MgPSBmdW5jdGlvbiAoZSkge1xuICAgICAgICBpZihjYXB0aXMucGF1c2VkKSByZXR1cm47XG4gICAgICAgIGlmICghY2FwdGlzLmF1ZGlvLnJlY29yZGluZykgcmV0dXJuO1xuICAgICAgICBpZiAoaW5kZXglMyA9PSAwKSB7XG4gICAgICAgICAgICBjdHguZHJhd0ltYWdlKHZpZGVvLCAwLCAwLCBmcmFtZVdpZHRoLCBmcmFtZUhlaWdodCk7XG4gICAgICAgICAgICBjYXB0aXMucmVjb3JkLmFkZChjdHgsIDApO1xuICAgICAgICAgICAgLy9jb25zb2xlLmxvZygndmlkZW8nKTtcbiAgICAgICAgfVxuICAgICAgICBpbmRleCsrO1xuICAgICAgICB2YXIgY2hhbm5lbCA9IGUuaW5wdXRCdWZmZXIuZ2V0Q2hhbm5lbERhdGEoMCk7XG4gICAgICAgIGNoYW5uZWxEYXRhLnB1c2gobmV3IEZsb2F0MzJBcnJheShjaGFubmVsKSk7XG4gICAgICAgIGNhcHRpcy5hdWRpby5yZWNvcmRpbmdTaXplICs9IGJ1ZmZlclNpemU7XG4gICAgICAgIC8vY29uc29sZS5sb2coJ2F1ZGlvJyk7XG4gICAgfVxuICAgIHZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ3RpbWV1cGRhdGUnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRpbWVyLmlubmVySFRNTCA9IHRpbWVGb3JtYXQoKG5ldyBEYXRlKCkuZ2V0VGltZSgpIC0gY3VycmVudFRpbWUpLzEwMDApO1xuICAgIH0sIGZhbHNlKTtcbiAgICBjYXB0dXJlU2VnbWVudHModmlkZW8pO1xuICAgIGdhaW5Ob2RlLmNvbm5lY3QoY2FwdGlzLmF1ZGlvLnByb2Nlc3Nvcik7XG4gICAgY2FwdGlzLmF1ZGlvLnByb2Nlc3Nvci5jb25uZWN0KGF1ZGlvQ29udGV4dC5kZXN0aW5hdGlvbik7XG4gICAgcmVsb2FkRXZlbnRzKCk7XG59XG5cbmZ1bmN0aW9uIGNhcHR1cmVTZWdtZW50cyAodmlkZW8pIHtcbiAgICB2YXIgbmV4dFN0ZXAgPSAwLFxuICAgICAgICBwcmV2U3RlcCA9IDAsXG4gICAgICAgIHN0ZXBJZCA9IG51bGw7XG4gICAgd2luZG93Lm9ua2V5ZG93biA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgLy9uZXh0IHNsaWRlXG4gICAgICAgICAgICBpZiAoZS5rZXlDb2RlID09IDM5ICYmIGNhcHRpcy5pbXByZXNzLmlzU3RlcCkge1xuICAgICAgICAgICAgICAgIGlmIChuZXh0U3RlcCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgY2FwdGlzLmltcHJlc3MubWV0YVtzdGVwSWRdID0gbmV4dFN0ZXA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG5leHRTdGVwID0gMDtcbiAgICAgICAgICAgICAgICBwcmV2U3RlcCA9IDA7XG4gICAgICAgICAgICAgICAgY2FwdGlzLmltcHJlc3MuaXNTdGVwID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgY2FwdGlzLmltcHJlc3Muc2VnbWVudHMucHVzaChcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGltZXN0YW1wOiBNYXRoLmZsb29yKHZpZGVvLmN1cnJlbnRUaW1lKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0ZXBpZDogY2FwdGlzLmltcHJlc3Muc3RlcCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5leHQ6IG5leHRTdGVwLFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvL25leHQgc3RlcFxuICAgICAgICAgICAgaWYgKGUua2V5Q29kZSA9PSAzOSAmJiAhY2FwdGlzLmltcHJlc3MuaXNTdGVwKSB7XG4gICAgICAgICAgICAgICAgbmV4dFN0ZXArKztcbiAgICAgICAgICAgICAgICBwcmV2U3RlcCA9IDA7XG4gICAgICAgICAgICAgICAgc3RlcElkID0gY2FwdGlzLmltcHJlc3Muc3RlcDtcbiAgICAgICAgICAgICAgICBjYXB0aXMuaW1wcmVzcy5zZWdtZW50cy5wdXNoKFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1lc3RhbXA6IE1hdGguZmxvb3IodmlkZW8uY3VycmVudFRpbWUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3RlcGlkOiBjYXB0aXMuaW1wcmVzcy5zdGVwLFxuICAgICAgICAgICAgICAgICAgICAgICAgbmV4dDogbmV4dFN0ZXAsXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vcHJldiBzbGlkZVxuICAgICAgICAgICAgaWYgKGUua2V5Q29kZSA9PSAzNyAmJiBjYXB0aXMuaW1wcmVzcy5pc1N0ZXApIHtcbiAgICAgICAgICAgICAgICBwcmV2U3RlcCA9IDA7XG4gICAgICAgICAgICAgICAgbmV4dFN0ZXAgPSAwO1xuICAgICAgICAgICAgICAgIGNhcHRpcy5pbXByZXNzLmlzU3RlcCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGNhcHRpcy5pbXByZXNzLnNlZ21lbnRzLnB1c2goXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogTWF0aC5mbG9vcih2aWRlby5jdXJyZW50VGltZSksXG4gICAgICAgICAgICAgICAgICAgICAgICBzdGVwaWQ6IGNhcHRpcy5pbXByZXNzLnN0ZXAsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcmV2OiBwcmV2U3RlcCxcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy9wcmV2IHN0ZXBcbiAgICAgICAgICAgIGlmIChlLmtleUNvZGUgPT0gMzcgJiYgIWNhcHRpcy5pbXByZXNzLmlzU3RlcCkge1xuICAgICAgICAgICAgICAgIHByZXZTdGVwKys7XG4gICAgICAgICAgICAgICAgbmV4dFN0ZXAgPSAwO1xuICAgICAgICAgICAgICAgIGNhcHRpcy5pbXByZXNzLnNlZ21lbnRzLnB1c2goXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogTWF0aC5mbG9vcih2aWRlby5jdXJyZW50VGltZSksXG4gICAgICAgICAgICAgICAgICAgICAgICBzdGVwaWQ6IGNhcHRpcy5pbXByZXNzLnN0ZXAsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcmV2OiBwcmV2U3RlcCxcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LCAxMDAwKTtcbiAgICB9O1xufVxuXG5mdW5jdGlvbiBtZXJnZUJ1ZmZlcnMgKGNoYW5uZWxCdWZmZXIsIHJlY29yZGluZ0xlbmd0aCkge1xuICAgIHZhciByZXN1bHQgPSBuZXcgRmxvYXQzMkFycmF5KHJlY29yZGluZ0xlbmd0aCksXG4gICAgICAgIG9mZnNldCA9IDA7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGFubmVsQnVmZmVyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBidWZmZXIgPSBjaGFubmVsQnVmZmVyW2ldO1xuICAgICAgICByZXN1bHQuc2V0KGJ1ZmZlciwgb2Zmc2V0KTtcbiAgICAgICAgb2Zmc2V0ICs9IGJ1ZmZlci5sZW5ndGg7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIHdyaXRlVVRGQnl0ZXMgKHZpZXcsIG9mZnNldCwgc3RyaW5nKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHJpbmcubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmlldy5zZXRVaW50OChvZmZzZXQgKyBpLCBzdHJpbmcuY2hhckNvZGVBdChpKSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBmbG9hdFRvMTZCaXRQQ00ob3V0cHV0LCBvZmZzZXQsIGlucHV0KXtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBpbnB1dC5sZW5ndGg7IGkrKywgb2Zmc2V0Kz0yKXtcbiAgICB2YXIgcyA9IE1hdGgubWF4KC0xLCBNYXRoLm1pbigxLCBpbnB1dFtpXSkpO1xuICAgIG91dHB1dC5zZXRJbnQxNihvZmZzZXQsIHMgPCAwID8gcyAqIDB4ODAwMCA6IHMgKiAweDdGRkYsIHRydWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHNhdmVNZWRpYSAoKSB7XG4gICAgY2FwdGlzLmF1ZGlvLnJlY29yZGluZyA9IGZhbHNlO1xuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGNsZWFyU3BhY2UoKTtcbiAgICBjYXB0aXMuc3RyZWFtLnN0b3AoKTtcbiAgICB2YXIgYXVkaW9EYXRhID0gbWVyZ2VCdWZmZXJzKGNoYW5uZWxEYXRhLCBjYXB0aXMuYXVkaW8ucmVjb3JkaW5nU2l6ZSksXG4gICAgICAgIGJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcig0NCArIGF1ZGlvRGF0YS5sZW5ndGggKiAyKSxcbiAgICAgICAgdmlldyA9IG5ldyBEYXRhVmlldyhidWZmZXIpO1xuICAgIHdyaXRlVVRGQnl0ZXModmlldywgMCwgJ1JJRkYnKTtcbiAgICB2aWV3LnNldFVpbnQzMig0LCAzMiArIGF1ZGlvRGF0YS5sZW5ndGggKiAyLCB0cnVlKTtcbiAgICB3cml0ZVVURkJ5dGVzKHZpZXcsIDgsICdXQVZFJyk7XG4gICAgd3JpdGVVVEZCeXRlcyh2aWV3LCAxMiwgJ2ZtdCAnKTtcbiAgICB2aWV3LnNldFVpbnQzMigxNiwgMTYsIHRydWUpO1xuICAgIHZpZXcuc2V0VWludDE2KDIwLCAxLCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQxNigyMiwgMSwgdHJ1ZSk7XG4gICAgdmlldy5zZXRVaW50MzIoMjQsIGNhcHRpcy5hdWRpby5zYW1wbGVSYXRlLCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQzMigyOCwgY2FwdGlzLmF1ZGlvLnNhbXBsZVJhdGUgKiAyLCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQxNigzMiwgMiwgdHJ1ZSk7XG4gICAgdmlldy5zZXRVaW50MTYoMzQsIDE2LCB0cnVlKTtcbiAgICB3cml0ZVVURkJ5dGVzKHZpZXcsIDM2LCAnZGF0YScpO1xuICAgIHZpZXcuc2V0VWludDMyKDQwLCBhdWRpb0RhdGEubGVuZ3RoICogMiwgdHJ1ZSk7XG4gICAgZmxvYXRUbzE2Qml0UENNKHZpZXcsIDQ0LCBhdWRpb0RhdGEpO1xuICAgIHZhciBibG9iID0gbmV3IEJsb2IoW3ZpZXddLCB7dHlwZTogJ2F1ZGlvL3dhdid9KSxcbiAgICAgICAgYXVkaW9VcmwgPSB3aW5kb3cuVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FwdGlzJykuaW5uZXJIVE1MICs9IChcbiAgICAgICAgJzxhdWRpbyBpZD1cIm1ldGFkYXRhXCI+PC9hdWRpbz4nXG4gICAgKTtcbiAgICB2YXIgYXVkaW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbWV0YWRhdGEnKTtcbiAgICBhdWRpby5zcmMgPSBhdWRpb1VybDtcbiAgICBhdWRpby5vbmxvYWRlZG1ldGFkYXRhID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgdmlkTGVuID0gTWF0aC5mbG9vcihhdWRpby5kdXJhdGlvbiAvIGNhcHRpcy5yZWNvcmQuZnJhbWVzLmxlbmd0aCAqIDEwMDApLFxuICAgICAgICAgICAgZGlmZmVyID0gMCxcbiAgICAgICAgICAgIGR1cmFUaW9uID0gMDtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjYXB0aXMucmVjb3JkLmZyYW1lcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgZGlmZmVyICs9IGF1ZGlvLmR1cmF0aW9uIC8gY2FwdGlzLnJlY29yZC5mcmFtZXMubGVuZ3RoICogMTAwMCAtIHZpZExlbjtcbiAgICAgICAgICAgIGlmIChkaWZmZXIgPiAxKSB7XG4gICAgICAgICAgICAgICAgZHVyYVRpb24gPSB2aWRMZW4gKyAxO1xuICAgICAgICAgICAgICAgIGRpZmZlciA9IGRpZmZlciAtIDE7XG4gICAgICAgICAgICB9IGVsc2UgeyBkdXJhVGlvbiA9IHZpZExlbiB9XG4gICAgICAgICAgICBjYXB0aXMucmVjb3JkLmZyYW1lc1tpXS5kdXJhdGlvbiA9IGR1cmFUaW9uO1xuICAgICAgICB9XG4gICAgICAgIHZhciBlbmNvZGVkRmlsZSA9IGNhcHRpcy5yZWNvcmQuY29tcGlsZSgpLFxuICAgICAgICAgICAgLy92aWRlb1VybCA9IHdpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKGVuY29kZWRGaWxlKSxcbiAgICAgICAgICAgIGpzb24gPSBuZXcgQmxvYihcbiAgICAgICAgICAgICAgICBbSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICBtZXRhOiBjYXB0aXMuaW1wcmVzcy5tZXRhLFxuICAgICAgICAgICAgICAgICAgICBzZWdtZW50czogY2FwdGlzLmltcHJlc3Muc2VnbWVudHMsXG4gICAgICAgICAgICAgICAgICAgIGR1cmF0aW9uOiB0aW1lRm9ybWF0KGF1ZGlvLmR1cmF0aW9uKSxcbiAgICAgICAgICAgICAgICB9KV0sXG4gICAgICAgICAgICAgICAge3R5cGU6ICdhcHBsaWNhdGlvbi9qc29uJ31cbiAgICAgICAgICAgICksXG4gICAgICAgICAgICAvL2pzb25VcmwgPSB3aW5kb3cuVVJMLmNyZWF0ZU9iamVjdFVSTChqc29uKSxcbiAgICAgICAgICAgIGZvcm1EYXRhID0gbmV3IEZvcm1EYXRhKCk7XG4gICAgICAgIGlmICh3aW5kb3cuY2FuVXBkYXRlKSB7XG4gICAgICAgICAgICBqc29uID0gbmV3IEJsb2IoXG4gICAgICAgICAgICAgICAgW0pTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgbWV0YTogY2FwdGlzLnBsYXllci5qc29uLm1ldGEsXG4gICAgICAgICAgICAgICAgICAgIHNlZ21lbnRzOiBkZWZpbmVTaGlmdChNYXRoLmZsb29yKGF1ZGlvLmR1cmF0aW9uKSksXG4gICAgICAgICAgICAgICAgICAgIGR1cmF0aW9uOiBjYXB0aXMucGxheWVyLmpzb24uZHVyYXRpb24sXG4gICAgICAgICAgICAgICAgICAgIHVwZGF0ZTogW3RpbWVGb3JtYXQoY2FwdGlzLnBsYXllci5qc29uLnNlZ21lbnRzW3dpbmRvdy5zZWdtZW50XS50aW1lc3RhbXApLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGltZUZvcm1hdChjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHNbd2luZG93LnNlZ21lbnQgKyAxXS50aW1lc3RhbXApXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICB9KV0sXG4gICAgICAgICAgICAgICAge3R5cGU6ICdhcHBsaWNhdGlvbi9qc29uJ31cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBmb3JtRGF0YS5hcHBlbmQoJ2F1ZGlvJywgYmxvYiwgJ2F1ZGlvLndhdicpO1xuICAgICAgICAgICAgZm9ybURhdGEuYXBwZW5kKCd2aWRlbycsIGVuY29kZWRGaWxlLCAndmlkZW8ud2VibScpO1xuICAgICAgICAgICAgZm9ybURhdGEuYXBwZW5kKCdkYXRhJywganNvbiwgJ2NhcHRpc19uZXcuanNvbicpO1xuICAgICAgICAgICAgdmFyIHJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICAgICAgICAgIHJlcXVlc3Qub3BlbignUE9TVCcsICdodHRwOi8vbG9jYWxob3N0OjMwMDAvdXBkYXRlJywgdHJ1ZSk7XG4gICAgICAgICAgICByZXF1ZXN0Lm9ubG9hZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBpZiAocmVxdWVzdC5zdGF0dXMgPT09IDIwMCkge1xuICAgICAgICAgICAgICAgICAgICBsb2NhdGlvbi5yZWxvYWQoKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnRmFpbGVkIHRvIHVwbG9hZCcpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlcXVlc3Quc2VuZChmb3JtRGF0YSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmb3JtRGF0YS5hcHBlbmQoJ2F1ZGlvJywgYmxvYiwgJ2F1ZGlvLndhdicpO1xuICAgICAgICAgICAgZm9ybURhdGEuYXBwZW5kKCd2aWRlbycsIGVuY29kZWRGaWxlLCAndmlkZW8ud2VibScpO1xuICAgICAgICAgICAgZm9ybURhdGEuYXBwZW5kKCdkYXRhJywganNvbiwgJ2NhcHRpcy5qc29uJyk7XG4gICAgICAgICAgICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgICAgICAgcmVxdWVzdC5vcGVuKCdQT1NUJywgJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMC9tZXJnZScsIHRydWUpO1xuICAgICAgICAgICAgcmVxdWVzdC5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgaWYgKHJlcXVlc3Quc3RhdHVzID09PSAyMDApIHtcbiAgICAgICAgICAgICAgICAgICAgbG9jYXRpb24ucmVsb2FkKCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0ZhaWxlZCB0byB1cGxvYWQnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXF1ZXN0LnNlbmQoZm9ybURhdGEpO1xuICAgICAgICB9XG4gICAgICAgIC8vIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0b29sYmFyJykuaW5uZXJIVE1MICs9IChcbiAgICAgICAgLy8gICAgICc8YSBpZD1cImNhcHRpc2xpbmtcIiBocmVmPVwiJysgdmlkZW9VcmwgKydcIiBkb3dubG9hZD1cInZpZGVvLndlYm1cIj4gXFxcbiAgICAgICAgLy8gICAgICAgICA8aSBjbGFzcz1cImZhIGZhLWZpbGUtdmlkZW8tb1wiPjwvaT4gXFxcbiAgICAgICAgLy8gICAgIDwvYT4gXFxcbiAgICAgICAgLy8gICAgIDxhIGlkPVwiY2FwdGlzbGlua1wiIGhyZWY9XCInKyBhdWRpb1VybCArJ1wiIGRvd25sb2FkPVwiYXVkaW8ud2F2XCI+IFxcXG4gICAgICAgIC8vICAgICAgICAgPGkgY2xhc3M9XCJmYSBmYS1maWxlLWF1ZGlvLW9cIj48L2k+IFxcXG4gICAgICAgIC8vICAgICA8L2E+IFxcXG4gICAgICAgIC8vICAgICA8YSBpZD1cImNhcHRpc2xpbmtcIiBocmVmPVwiJysganNvblVybCArJ1wiIGRvd25sb2FkPVwiY2FwdGlzLmpzb25cIj4gXFxcbiAgICAgICAgLy8gICAgICAgICA8aSBjbGFzcz1cImZhIGZhLWZpbGUtY29kZS1vXCI+PC9pPiBcXFxuICAgICAgICAvLyAgICAgPC9hPidcbiAgICAgICAgLy8gKTtcbiAgICAgICAgLy9yZWxvYWRFdmVudHMoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRlZmluZVNoaWZ0IChkdXJhdGlvbikge1xuICAgIGNvbnNvbGUubG9nKGR1cmF0aW9uKTtcbiAgICB2YXIgdGltZURpZmYgPSBjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHNbd2luZG93LnNlZ21lbnQgKyAxXS50aW1lc3RhbXAgLVxuICAgICAgICBjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHNbd2luZG93LnNlZ21lbnRdLnRpbWVzdGFtcCxcbiAgICAgICAgc2hpZnQgPSAwO1xuICAgIGlmIChkdXJhdGlvbiA8IHRpbWVEaWZmKSB7XG4gICAgICAgIHNoaWZ0ID0gdGltZURpZmYgLSBkdXJhdGlvbjtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChpIDw9IHdpbmRvdy5zZWdtZW50KSB7IGNvbnRpbnVlOyB9XG4gICAgICAgICAgICBjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHNbaV0udGltZXN0YW1wID1cbiAgICAgICAgICAgICAgICBjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHNbaV0udGltZXN0YW1wIC0gc2hpZnQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNhcHRpcy5wbGF5ZXIuanNvbi5zZWdtZW50cztcbiAgICB9XG4gICAgaWYgKGR1cmF0aW9uID4gdGltZURpZmYpIHtcbiAgICAgICAgc2hpZnQgPSBkdXJhdGlvbiAtIHRpbWVEaWZmO1xuICAgICAgICByZXR1cm4gc2hpZnQ7XG4gICAgfVxuICAgIHJldHVybiBzaGlmdDtcbn1cblxuLy93YXRjaGluZyBtb2RlXG5cbmZ1bmN0aW9uIGxvYWRWaWRlbyAoKSB7XG4gICAgdmFyIHJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICByZXF1ZXN0Lm9wZW4oJ0dFVCcsICdodHRwOi8vbG9jYWxob3N0OjMwMDAvbWVkaWEvY2FwdGlzLndlYm0nLCB0cnVlKTtcbiAgICByZXF1ZXN0LnJlc3BvbnNlVHlwZSA9IFwiYmxvYlwiO1xuICAgIHJlcXVlc3Qub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAocmVxdWVzdC5zdGF0dXMgPT09IDIwMCAmJiByZXF1ZXN0LnJlYWR5U3RhdGUgPT0gNCkge1xuICAgICAgICAgICAgY2FwdGlzLnBsYXllci5yZWFkeSA9IHRydWU7XG4gICAgICAgICAgICBjYXB0aXMucGxheWVyLm9iamVjdFVybCA9IHdpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKHRoaXMucmVzcG9uc2UpO1xuICAgICAgICAgICAgd2luZG93LnZpZGVvVVJMID0gY2FwdGlzLnBsYXllci5vYmplY3RVcmw7XG4gICAgICAgICAgICBub3RpZmljYXRpb24oJ1RoaXMgc2xpZGUgY29udGFpbnMgdmlkZW8gZmlsZSEgUGxlYXNlIHVzZSBjdHIrdyB0byBsb2FkIHRoZSBzZWdtZW50cy4nKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXF1ZXN0LnNlbmQoKTtcbn1cblxuZnVuY3Rpb24gbG9hZFNlZ21lbnRzICgpIHtcbiAgICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIHJlcXVlc3Qub3BlbignR0VUJywgJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMC9tZWRpYS9jYXB0aXMuanNvbicsIHRydWUpO1xuICAgIHJlcXVlc3Qub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAocmVxdWVzdC5zdGF0dXMgPT09IDIwMCAmJiByZXF1ZXN0LnJlYWR5U3RhdGUgPT0gNCkge1xuICAgICAgICAgICAgY2FwdGlzLnNlZ21lbnRzLnJlYWR5ID0gdHJ1ZTtcbiAgICAgICAgICAgIGNhcHRpcy5wbGF5ZXIuanNvbiA9IEpTT04ucGFyc2UodGhpcy5yZXNwb25zZSk7XG4gICAgICAgICAgICB3aW5kb3cuc2VnbWVudHMgPSBjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHM7XG4gICAgICAgICAgICB3aW5kb3cuc2xpZGVzID0gY2FwdGlzLnBsYXllci5qc29uLm1ldGE7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNhcHRpcy5wbGF5ZXIuanNvbi5zZWdtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmIChjYXB0aXMucGxheWVyLnNsaWRlcy5pbmRleE9mKGNhcHRpcy5wbGF5ZXIuanNvbi5zZWdtZW50c1tpXS5zdGVwaWQpID09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhcHRpcy5wbGF5ZXIuc2xpZGVzLnB1c2goY2FwdGlzLnBsYXllci5qc29uLnNlZ21lbnRzW2ldLnN0ZXBpZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhcHRpcy5wbGF5ZXIudGltZXN0YW1wcy5wdXNoKGNhcHRpcy5wbGF5ZXIuanNvbi5zZWdtZW50c1tpXS50aW1lc3RhbXApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIHJlcXVlc3Quc2VuZCgpO1xufVxuXG5mdW5jdGlvbiBmaW5pc2hXYXRjaGluZ01vZGUgKGUpIHtcbiAgICBpZiAoZS5jdHJsS2V5ICYmIGUua2V5Q29kZSA9PSA4NyAmJiBjYXB0aXMucGxheWVyLnJlYWR5KSB7XG4gICAgICAgIGNhcHRpcy5wbGF5ZXIuaXNPbiA9IHRydWU7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGF5ZXInKS5vdXRlckhUTUwgPSAnJztcbiAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5dXAnLCBmaW5pc2hXYXRjaGluZ01vZGUsIGZhbHNlKTtcbiAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLCB3YXRjaGluZ01vZGUsIGZhbHNlKTtcbiAgICAgICAgbG9jYXRpb24ucmVsb2FkKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBzZWVrU2VnbWVudHMgKHRpbWUpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNhcHRpcy5wbGF5ZXIudGltZXN0YW1wcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAodGltZSA8IGNhcHRpcy5wbGF5ZXIudGltZXN0YW1wc1tpXSkge1xuICAgICAgICAgICAgY2FwdGlzLnBsYXllci5jdXJyZW50U3RlcCA9IGkgLSAxO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRpbWUgPiBjYXB0aXMucGxheWVyLnRpbWVzdGFtcHNbaV0gJiYgKGNhcHRpcy5wbGF5ZXIudGltZXN0YW1wcy5sZW5ndGggLSAxKSA9PSBpKSB7XG4gICAgICAgICAgICBjYXB0aXMucGxheWVyLmN1cnJlbnRTdGVwID0gaTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChjYXB0aXMucGxheWVyLmN1cnJlbnRTdGVwID09IC0xKSB7XG4gICAgICAgIGltcHJlc3MoKS5nb3RvKCdvdmVydmlldycpO1xuICAgICAgICBpbXByZXNzKCkubmV4dCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChjYXB0aXMucGxheWVyLmFjdGl2ZVN0ZXAgIT0gY2FwdGlzLnBsYXllci5jdXJyZW50U3RlcCkge1xuICAgICAgICAgICAgdmFyIHNsaWRlID0gY2FwdGlzLnBsYXllci5zbGlkZXMuaW5kZXhPZihcbiAgICAgICAgICAgICAgICBjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHNbY2FwdGlzLnBsYXllci5jdXJyZW50U3RlcF0uc3RlcGlkXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgaWYgKHNsaWRlID4gMCkge1xuICAgICAgICAgICAgICAgIGltcHJlc3MoKS5nb3RvKGNhcHRpcy5wbGF5ZXIuc2xpZGVzW3NsaWRlIC0gMV0pO1xuICAgICAgICAgICAgICAgIGltcHJlc3MoKS5uZXh0KCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGltcHJlc3MoKS5nb3RvKCdvdmVydmlldycpO1xuICAgICAgICAgICAgICAgIGltcHJlc3MoKS5uZXh0KCk7XG4gICAgICAgICAgICAgICAgaW1wcmVzcygpLm5leHQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHNbY2FwdGlzLnBsYXllci5jdXJyZW50U3RlcF0ubmV4dCA+IDApIHtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNhcHRpcy5wbGF5ZXIuanNvbi5zZWdtZW50c1tjYXB0aXMucGxheWVyLmN1cnJlbnRTdGVwXS5uZXh0OyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaW1wcmVzcygpLm5leHQoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoY2FwdGlzLnBsYXllci5qc29uLnNlZ21lbnRzW2NhcHRpcy5wbGF5ZXIuY3VycmVudFN0ZXBdLnByZXYgPj0gMCkge1xuICAgICAgICAgICAgICAgIHZhciBzdGVwID0gY2FwdGlzLnBsYXllci5qc29uLm1ldGFbXG4gICAgICAgICAgICAgICAgICAgIGNhcHRpcy5wbGF5ZXIuanNvbi5zZWdtZW50c1tjYXB0aXMucGxheWVyLmN1cnJlbnRTdGVwXS5zdGVwaWRcbiAgICAgICAgICAgICAgICBdIC0gY2FwdGlzLnBsYXllci5qc29uLnNlZ21lbnRzW2NhcHRpcy5wbGF5ZXIuY3VycmVudFN0ZXBdLnByZXY7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdGVwOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaW1wcmVzcygpLm5leHQoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXB0aXMucGxheWVyLmFjdGl2ZVN0ZXAgPSBjYXB0aXMucGxheWVyLmN1cnJlbnRTdGVwO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiBjb250cm9sU2VnbWVudHMgKGUpIHtcbiAgICB2YXIgdmlkZW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FwdGlzX21hZGUnKSxcbiAgICAgICAgdGltZSA9IDA7XG4gICAgaWYgKGUua2V5Q29kZSA9PSAzOSkge1xuICAgICAgICBjYXB0aXMucGxheWVyLmtleXByZXNzZWQgPSB0cnVlO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNhcHRpcy5wbGF5ZXIudGltZXN0YW1wcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHZpZGVvLmN1cnJlbnRUaW1lIDwgY2FwdGlzLnBsYXllci50aW1lc3RhbXBzW2ldKSB7XG4gICAgICAgICAgICAgICAgdGltZSA9IGNhcHRpcy5wbGF5ZXIudGltZXN0YW1wc1tpXTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB2aWRlby5jdXJyZW50VGltZSA9IHRpbWU7XG4gICAgfVxuICAgIGlmIChlLmtleUNvZGUgPT0gMzcpIHtcbiAgICAgICAgY2FwdGlzLnBsYXllci5rZXlwcmVzc2VkID0gdHJ1ZTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjYXB0aXMucGxheWVyLnRpbWVzdGFtcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh2aWRlby5jdXJyZW50VGltZSA8IGNhcHRpcy5wbGF5ZXIudGltZXN0YW1wc1tpXSkge1xuICAgICAgICAgICAgICAgIGlmIChpLTIgPCAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHRpbWUgPSAwO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aW1lID0gY2FwdGlzLnBsYXllci50aW1lc3RhbXBzW2kgLSAyXTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHZpZGVvLmN1cnJlbnRUaW1lID0gdGltZTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHBsYXlWaWRlbyAoZSkge1xuICAgIGUudGFyZ2V0LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BhdXNlJykuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUnO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBjb250cm9sU2VnbWVudHMsIGZhbHNlKTtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGF1c2UnKS5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAnY2xpY2snLFxuICAgICAgICBwYXVzZVZpZGVvLFxuICAgICAgICBmYWxzZVxuICAgICk7XG4gICAgdmFyIHZpZGVvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcHRpc19tYWRlJyksXG4gICAgICAgIHRpbWVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3B0aW1lcicpLFxuICAgICAgICBidWZmID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BidWZmZXInKSxcbiAgICAgICAgcGxheWJhciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGF5YmFyJyk7XG4gICAgdmlkZW8ucGxheSgpO1xuICAgIGNhcHRpcy5wbGF5ZXIudGltZXVwZGF0ZSA9IHNldEludGVydmFsKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc2Vla1NlZ21lbnRzKE1hdGguZmxvb3IodmlkZW8uY3VycmVudFRpbWUpKTtcbiAgICAgICAgdGltZXIuaW5uZXJIVE1MID0gdGltZUZvcm1hdCh2aWRlby5jdXJyZW50VGltZSk7XG4gICAgICAgIGJ1ZmYudmFsdWUgPSB2aWRlby5jdXJyZW50VGltZSArIDU7XG4gICAgICAgIHBsYXliYXIudmFsdWUgPSB2aWRlby5jdXJyZW50VGltZTtcbiAgICAgICAgaWYgKHZpZGVvLmVuZGVkKSB7dmlkZW9PbkVuZCgpO31cbiAgICB9LCAxMDAwKTtcbn1cblxuZnVuY3Rpb24gcGF1c2VWaWRlbyAoZSkge1xuICAgIGNsZWFySW50ZXJ2YWwoY2FwdGlzLnBsYXllci50aW1ldXBkYXRlKTtcbiAgICB2YXIgdmlkZW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FwdGlzX21hZGUnKTtcbiAgICB2aWRlby5wYXVzZSgpO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGF5Jykuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUnO1xuICAgIGUudGFyZ2V0LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXknKS5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAnY2xpY2snLFxuICAgICAgICBwbGF5VmlkZW8sXG4gICAgICAgIGZhbHNlXG4gICAgKTtcbn1cblxuZnVuY3Rpb24gdmlkZW9PbkVuZCAoKSB7XG4gICAgdmFyIHZpZGVvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcHRpc19tYWRlJyksXG4gICAgICAgIHRpbWVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3B0aW1lcicpLFxuICAgICAgICBidWZmID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BidWZmZXInKSxcbiAgICAgICAgcGxheWJhciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGF5YmFyJyk7XG4gICAgdmlkZW8uY3VycmVudFRpbWUgPSAwO1xuICAgIHRpbWVyLmlubmVySFRNTCA9ICcwMDowMDowMCc7XG4gICAgYnVmZi52YWx1ZSA9IDA7XG4gICAgcGxheWJhci52YWx1ZSA9IDA7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXknKS5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZSc7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BhdXNlJykuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheScpLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICdjbGljaycsXG4gICAgICAgIHBsYXlWaWRlbyxcbiAgICAgICAgZmFsc2VcbiAgICApO1xuICAgIGNsZWFySW50ZXJ2YWwoY2FwdGlzLnBsYXllci50aW1ldXBkYXRlKTtcbn1cblxuZnVuY3Rpb24gc2V0Vm9sdW1lIChlKSB7XG4gICAgdmFyIHZpZGVvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcHRpc19tYWRlJyk7XG4gICAgdmlkZW8udm9sdW1lID0gZS50YXJnZXQudmFsdWU7XG4gICAgaWYgKGUudGFyZ2V0LnZhbHVlID09IDEpIHtcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hpZ2h2Jykuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUnO1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG93dicpLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdvZmZ2Jykuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICB9XG4gICAgaWYgKGUudGFyZ2V0LnZhbHVlIDwgMSAmJiBlLnRhcmdldC52YWx1ZSA+IDApIHtcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hpZ2h2Jykuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvd3YnKS5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZSc7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdvZmZ2Jykuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICB9XG4gICAgaWYgKGUudGFyZ2V0LnZhbHVlID09IDApIHtcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hpZ2h2Jykuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvd3YnKS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnb2ZmdicpLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lJztcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHNlZWtWaWRlbyAoZSkge1xuICAgIGNsZWFySW50ZXJ2YWwoY2FwdGlzLnBsYXllci50aW1ldXBkYXRlKTtcbiAgICB2YXIgdmlkZW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FwdGlzX21hZGUnKSxcbiAgICAgICAgYnVmZiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwYnVmZmVyJyksXG4gICAgICAgIHRpbWVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3B0aW1lcicpLFxuICAgICAgICBwbGF5YmFyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXliYXInKTtcbiAgICB2aWRlby5wYXVzZSgpO1xuICAgIHZpZGVvLmN1cnJlbnRUaW1lID0gZS50YXJnZXQudmFsdWU7XG4gICAgdmlkZW8ucGxheSgpO1xuICAgIGNhcHRpcy5wbGF5ZXIudGltZXVwZGF0ZSA9IHNldEludGVydmFsKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc2Vla1NlZ21lbnRzKE1hdGguZmxvb3IodmlkZW8uY3VycmVudFRpbWUpKTtcbiAgICAgICAgdGltZXIuaW5uZXJIVE1MID0gdGltZUZvcm1hdCh2aWRlby5jdXJyZW50VGltZSk7XG4gICAgICAgIGJ1ZmYudmFsdWUgPSB2aWRlby5jdXJyZW50VGltZSArIDU7XG4gICAgICAgIHBsYXliYXIudmFsdWUgPSB2aWRlby5jdXJyZW50VGltZTtcbiAgICAgICAgaWYgKHZpZGVvLmVuZGVkKSB7dmlkZW9PbkVuZCgpO31cbiAgICB9LCAxMDAwKTtcbn1cblxuZnVuY3Rpb24gZnVsbFNjcmVlbiAoZSkge1xuICAgIHZhciB2aWRlbyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYXB0aXNfbWFkZScpO1xuICAgIGlmICh2aWRlby53ZWJraXRSZXF1ZXN0RnVsbHNjcmVlbikge1xuICAgICAgICBlLnRhcmdldC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdleGl0ZnVsbHMnKS5zdHlsZS5kaXNwbGF5ID0gXCJpbmxpbmVcIjtcbiAgICAgICAgdmlkZW8ud2Via2l0UmVxdWVzdEZ1bGxzY3JlZW4oKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGV4aXRGdWxsU2NyZWVuIChlKSB7XG4gICAgaWYgKGRvY3VtZW50LndlYmtpdEV4aXRGdWxsc2NyZWVuKSB7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmdWxscycpLnN0eWxlLmRpc3BsYXkgPSBcImlubGluZVwiO1xuICAgICAgICBlLnRhcmdldC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgICAgIGRvY3VtZW50LndlYmtpdEV4aXRGdWxsc2NyZWVuKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB3YXRjaGluZ01vZGUgKGUpIHtcbiAgICBpZiAoZS5jdHJsS2V5ICYmIGUua2V5Q29kZSA9PSA4NyAmJiBjYXB0aXMucGxheWVyLnJlYWR5ICYmIGNhcHRpcy5zZWdtZW50cy5yZWFkeSkge1xuICAgICAgICBpbXByZXNzKCkuZ290byhjYXB0aXMucGxheWVyLmpzb24uc2VnbWVudHNbMF0uc3RlcGlkKTtcbiAgICAgICAgaW1wcmVzcygpLnByZXYoKTtcbiAgICAgICAgY2FwdGlzLnBsYXllci5pc09uID0gdHJ1ZTtcbiAgICAgICAgaWYgKGNhcHRpcy50b29sYmFyKSB7XG4gICAgICAgICAgICBjbGVhclNwYWNlKCk7XG4gICAgICAgIH1cbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcHRpcycpLmlubmVySFRNTCArPSAoXG4gICAgICAgICAgICAnPGRpdiBpZD1cInBsYXllclwiPiBcXFxuICAgICAgICAgICAgICAgIDx2aWRlbyBpZD1cImNhcHRpc19tYWRlXCIgcHJlbG9hZD48L3ZpZGVvPiBcXFxuICAgICAgICAgICAgICAgIDxkaXYgaWQ9XCJjYXB0aXNfY29udHJvbHNcIj4gXFxcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBpZD1cImNhcHRpc19wbGF5ZXJcIj4gXFxcbiAgICAgICAgICAgICAgICAgICAgICAgIDxpIGlkPVwicGxheVwiIGNsYXNzPVwiZmEgZmEtcGxheSBjYXB0aXNfaWNvblwiPjwvaT4gXFxcbiAgICAgICAgICAgICAgICAgICAgICAgIDxpIGlkPVwicGF1c2VcIiBjbGFzcz1cImZhIGZhLXBhdXNlIGNhcHRpc19pY29uXCI+PC9pPiBcXFxuICAgICAgICAgICAgICAgICAgICAgICAgPGNhbnZhcyBpZD1cInNlZ21lbnRzXCI+PC9jYW52YXM+IFxcXG4gICAgICAgICAgICAgICAgICAgICAgICA8cHJvZ3Jlc3MgdmFsdWU9XCIwXCIgaWQ9XCJwYnVmZmVyXCI+PC9wcm9ncmVzcz4gXFxcbiAgICAgICAgICAgICAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwicmFuZ2VcIiBpZD1cInBsYXliYXJcIiB2YWx1ZT1cIjBcIj4gXFxcbiAgICAgICAgICAgICAgICAgICAgICAgIDxpIGlkPVwicHRpbWVyXCI+MDA6MDA6MDA8L2k+IFxcXG4gICAgICAgICAgICAgICAgICAgICAgICA8aSBpZD1cImhpZ2h2XCIgY2xhc3M9XCJmYSBmYS12b2x1bWUtdXAgY2FwdGlzX2ljb25cIj48L2k+IFxcXG4gICAgICAgICAgICAgICAgICAgICAgICA8aSBpZD1cImxvd3ZcIiBjbGFzcz1cImZhIGZhLXZvbHVtZS1kb3duIGNhcHRpc19pY29uXCI+PC9pPiBcXFxuICAgICAgICAgICAgICAgICAgICAgICAgPGkgaWQ9XCJvZmZ2XCIgY2xhc3M9XCJmYSBmYS12b2x1bWUtb2ZmIGNhcHRpc19pY29uXCI+PC9pPiBcXFxuICAgICAgICAgICAgICAgICAgICAgICAgPGlucHV0IHR5cGU9XCJyYW5nZVwiIGlkPVwidm9sdW1lXCIgbWluPVwiMFwiIG1heD1cIjFcIiBzdGVwPVwiMC4xXCIgdmFsdWU9XCIxXCI+IFxcXG4gICAgICAgICAgICAgICAgICAgICAgICA8aSBpZD1cImZ1bGxzXCIgY2xhc3M9XCJmYSBmYS1leWUgY2FwdGlzX2ljb25cIj48L2k+IFxcXG4gICAgICAgICAgICAgICAgICAgICAgICA8aSBpZD1cImV4aXRmdWxsc1wiIGNsYXNzPVwiZmEgZmEtZXllLXNsYXNoIGNhcHRpc19pY29uXCI+PC9pPiBcXFxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj4gXFxcbiAgICAgICAgICAgICAgICA8L2Rpdj4gXFxcbiAgICAgICAgICAgIDwvZGl2PidcbiAgICAgICAgKTtcbiAgICAgICAgdmFyIHZpZGVvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcHRpc19tYWRlJyk7XG4gICAgICAgIHZpZGVvLnNyYyA9IGNhcHRpcy5wbGF5ZXIub2JqZWN0VXJsO1xuICAgICAgICB2aWRlby5hZGRFdmVudExpc3RlbmVyKCdsb2FkZWRtZXRhZGF0YScsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwYnVmZmVyJykuc2V0QXR0cmlidXRlKFxuICAgICAgICAgICAgICAgIFwibWF4XCIsXG4gICAgICAgICAgICAgICAgTWF0aC5mbG9vcih2aWRlby5kdXJhdGlvbilcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheWJhcicpLnNldEF0dHJpYnV0ZShcbiAgICAgICAgICAgICAgICBcIm1heFwiLFxuICAgICAgICAgICAgICAgIE1hdGguZmxvb3IodmlkZW8uZHVyYXRpb24pXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgdmFyIGNhbnZhcyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzZWdtZW50cycpLFxuICAgICAgICAgICAgICAgIGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpLFxuICAgICAgICAgICAgICAgIHJhdGlvID0gY2FudmFzLndpZHRoIC8gdmlkZW8uZHVyYXRpb24sXG4gICAgICAgICAgICAgICAgcG9zaXRpb24gPSAwLFxuICAgICAgICAgICAgICAgIHNlZ21lbnRXaWR0aCA9IDA7XG4gICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheScpLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgICAgICAgICBwbGF5VmlkZW8sXG4gICAgICAgICAgICAgICAgZmFsc2VcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZXhpdGZ1bGxzJykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICAgICAnY2xpY2snLFxuICAgICAgICAgICAgICAgIGV4aXRGdWxsU2NyZWVuLFxuICAgICAgICAgICAgICAgIGZhbHNlXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Z1bGxzJykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICAgICAnY2xpY2snLFxuICAgICAgICAgICAgICAgIGZ1bGxTY3JlZW4sXG4gICAgICAgICAgICAgICAgZmFsc2VcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndm9sdW1lJykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICAgICAnY2hhbmdlJyxcbiAgICAgICAgICAgICAgICBzZXRWb2x1bWUsXG4gICAgICAgICAgICAgICAgZmFsc2VcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheWJhcicpLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgICAgICAgJ2NoYW5nZScsXG4gICAgICAgICAgICAgICAgc2Vla1ZpZGVvLFxuICAgICAgICAgICAgICAgIGZhbHNlXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjYXB0aXMucGxheWVyLnRpbWVzdGFtcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBzZWdtZW50V2lkdGggPSBNYXRoLmZsb29yKGNhcHRpcy5wbGF5ZXIudGltZXN0YW1wc1tpXSAqIHJhdGlvKSAtIDE7XG4gICAgICAgICAgICAgICAgY3R4LmZpbGxTdHlsZSA9ICcjMTNBRDg3JztcbiAgICAgICAgICAgICAgICBjdHguZmlsbFJlY3QocG9zaXRpb24sIDAsIHNlZ21lbnRXaWR0aCwgY2FudmFzLmhlaWdodCk7XG4gICAgICAgICAgICAgICAgY3R4LmZpbGxTdHlsZSA9ICcjRkZGJztcbiAgICAgICAgICAgICAgICBjdHguZmlsbFJlY3Qoc2VnbWVudFdpZHRoLCAwLCAxLCBjYW52YXMuaGVpZ2h0KTtcbiAgICAgICAgICAgICAgICBwb3NpdGlvbiA9IHNlZ21lbnRXaWR0aCArIDE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdrZXl1cCcsIHdhdGNoaW5nTW9kZSwgZmFsc2UpO1xuICAgICAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLCBmaW5pc2hXYXRjaGluZ01vZGUsIGZhbHNlKTtcbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdpbXByZXNzOnN0ZXBlbnRlcicsIGZ1bmN0aW9uIChlKSB7XG4gICAgY2FwdGlzLmltcHJlc3MuaXNTdGVwID0gdHJ1ZTtcbiAgICBjYXB0aXMuaW1wcmVzcy5zdGVwID0gZS50YXJnZXQuaWQ7XG59LCBmYWxzZSk7XG5cbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleXVwJywgaW5pdGlhbGl6ZVRvb2xiYXIsIGZhbHNlKTtcbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleXVwJywgd2F0Y2hpbmdNb2RlLCBmYWxzZSk7XG5cbmxvYWRWaWRlbygpO1xubG9hZFNlZ21lbnRzKCk7XG4iLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG4oZnVuY3Rpb24gYnJvd3NlcmlmeVNoaW0obW9kdWxlLCBleHBvcnRzLCBkZWZpbmUsIGJyb3dzZXJpZnlfc2hpbV9fZGVmaW5lX19tb2R1bGVfX2V4cG9ydF9fKSB7XG52YXIgaW5pdGlhbGl6ZUVkaXRvciA9IGZ1bmN0aW9uKCkge1xuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYXB0aXMnKS5pbm5lckhUTUwgKz0gKFxuICAgICAgICAnPGRpdiBpZD1cImNhcHRpc19lZGl0b3JcIj4gXFxcbiAgICAgICAgICAgIDxkaXYgaWQ9XCJsb2FkaW5nXCI+PHByb2dyZXNzIGlkPVwibG9hZGluZ19zZWdtZW50c1wiIHZhbHVlPVwiMFwiPjwvcHJvZ3Jlc3M+PC9kaXY+IFxcXG4gICAgICAgICAgICA8dmlkZW8gaWQ9XCJlZGl0X3ZpZGVvXCIgcHJlbG9hZCBtdXRlZD48L3ZpZGVvPiBcXFxuICAgICAgICAgICAgPGRpdiBpZD1cInNlZ21lbnRfY29udFwiPjxkaXYgaWQ9XCJjYXB0aXNfZWRpdG9yX3NlZ21lbnRzXCI+PC9kaXY+PC9kaXY+IFxcXG4gICAgICAgICAgICA8Y2FudmFzIGlkPVwic2VnbWVudHNob3RcIj48L2NhbnZhcz4gXFxcbiAgICAgICAgPC9kaXY+J1xuICAgICk7XG4gICAgdmFyIHZpZGVvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2VkaXRfdmlkZW8nKSxcbiAgICAgICAgcGFydHMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FwdGlzX2VkaXRvcl9zZWdtZW50cycpLFxuICAgICAgICBjb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2VnbWVudF9jb250JyksXG4gICAgICAgIGxvYWRlciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2FkaW5nX3NlZ21lbnRzJyksXG4gICAgICAgIGxvYWRpbmcgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9hZGluZycpLFxuICAgICAgICBjYW52YXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2VnbWVudHNob3QnKSxcbiAgICAgICAgY3R4ID0gY2FudmFzLmdldENvbnRleHQoJzJkJyk7XG4gICAgcGFydHMuaW5uZXJIVE1MID0gJyc7XG4gICAgdmlkZW8uc3JjID0gd2luZG93LnZpZGVvVVJMO1xuICAgIC8vY29uc29sZS5sb2cod2luZG93LnNlZ21lbnRzKTtcbiAgICBsb2FkZXIuc2V0QXR0cmlidXRlKCdtYXgnLCB3aW5kb3cuc2VnbWVudHMubGVuZ3RoIC0gMSk7XG4gICAgdmlkZW8ub25sb2FkZWRtZXRhZGF0YSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY2FudmFzLndpZHRoID0gMjUwO1xuICAgICAgICBjYW52YXMuaGVpZ2h0ID0gMTg3O1xuICAgICAgICB2YXIgaSA9IDA7XG4gICAgICAgIHZhciBsb29wID0gc2V0SW50ZXJ2YWwoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAvL2NvbnNvbGUubG9nKHdpbmRvdy5zZWdtZW50c1tpXSk7XG4gICAgICAgICAgICBwYXJ0cy5pbm5lckhUTUwgKz0gKFxuICAgICAgICAgICAgICAgICc8ZGl2IGNsYXNzPVwic2VnbWVudF9ib3hcIiBpZD1cInNlZ21lbnRfJysgaSArJ1wiPiBcXFxuICAgICAgICAgICAgICAgICAgICA8aSBjbGFzcz1cInNlZ21lbnRfdGltZVwiPicrIHdpbmRvdy5mb3JtYXREdXJhdGlvbih3aW5kb3cuc2VnbWVudHNbaV0udGltZXN0YW1wKSArJzwvaT4gXFxcbiAgICAgICAgICAgICAgICA8L2Rpdj4nXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgdmlkZW8uY3VycmVudFRpbWUgPSB3aW5kb3cuc2VnbWVudHNbaV0udGltZXN0YW1wO1xuICAgICAgICAgICAgY3R4LmRyYXdJbWFnZSh2aWRlbywgMCwgMCwgMjUwLCAxODcpO1xuICAgICAgICAgICAgdmFyIGltYWdlID0gY2FudmFzLnRvRGF0YVVSTCgpLFxuICAgICAgICAgICAgICAgIGJveCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzZWdtZW50XycgKyBpKTtcbiAgICAgICAgICAgIC8vY29uc29sZS5sb2coaW1hZ2UpO1xuICAgICAgICAgICAgYm94LnN0eWxlLmJhY2tncm91bmRJbWFnZSA9ICd1cmwoJyArIGltYWdlICsgJyknO1xuICAgICAgICAgICAgbG9hZGVyLnZhbHVlID0gaTtcbiAgICAgICAgICAgIGkrKztcbiAgICAgICAgICAgIGlmIChpID09IHdpbmRvdy5zZWdtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAvL3BhcnRzLnN0eWxlLmhlaWdodCA9IDEyMCAqIHdpbmRvdy5zZWdtZW50cy5sZW5ndGggKyAncHgnO1xuICAgICAgICAgICAgICAgIGNvbnRhaW5lci5zdHlsZS53aWR0aCA9ICcyNTBweCc7XG4gICAgICAgICAgICAgICAgbG9hZGluZy5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICAgICAgICAgIHZpZGVvLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICAgICAgICAgICAgICAgIHZpZGVvLnBhdXNlKCk7XG4gICAgICAgICAgICAgICAgdmlkZW8uY3VycmVudFRpbWUgPSAwO1xuICAgICAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwobG9vcCk7XG4gICAgICAgICAgICAgICAgdmFyIGVsZW1lbnRzID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSgnc2VnbWVudF9ib3gnKTtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IGVsZW1lbnRzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzW2pdLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZWRpdG9yUGxheVNlZ21lbnQsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZyhlbGVtZW50cyk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9LCAxMDApO1xuICAgIH07XG4gICAgd2luZG93LnJlbG9hZEV2ZW50cygpO1xuXG59XG5cbnZhciBlZGl0b3JQbGF5U2VnbWVudCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2aWRlbyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdlZGl0X3ZpZGVvJyk7XG4gICAgdmFyIGluZGV4ID0gcGFyc2VJbnQodGhpcy5pZC5zcGxpdCgnXycpWzFdKTtcbiAgICB3aW5kb3cuc2VnbWVudCA9IGluZGV4O1xuICAgIHdpbmRvdy5jYW5VcGRhdGUgPSB0cnVlO1xuICAgIHZpZGVvLmN1cnJlbnRUaW1lID0gd2luZG93LnNlZ21lbnRzW2luZGV4XS50aW1lc3RhbXA7XG4gICAgdmlkZW8ubXV0ZWQgPSBmYWxzZTtcbiAgICBpbXByZXNzKCkuZ290bygnb3ZlcnZpZXcnKTtcbiAgICBpbXByZXNzKCkuZ290byh3aW5kb3cuc2VnbWVudHNbaW5kZXhdLnN0ZXBpZCk7XG4gICAgLy9UT0RPOiBBbGwgY2FzZXNcbiAgICBpZiAod2luZG93LnNlZ21lbnRzW2luZGV4XS5uZXh0KSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgd2luZG93LnNlZ21lbnRzW2luZGV4XS5uZXh0OyBpKyspIHtcbiAgICAgICAgICAgIGltcHJlc3MoKS5uZXh0KCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKHdpbmRvdy5zZWdtZW50c1tpbmRleF0ucHJldikge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHdpbmRvdy5zZWdtZW50c1tpbmRleF0ucHJldjsgaSsrKSB7XG4gICAgICAgICAgICBpbXByZXNzKCkucHJldigpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGNvbnNvbGUubG9nKHdpbmRvdy5zbGlkZXMsIHdpbmRvdy5zZWdtZW50c1tpbmRleF0pO1xuICAgIHZpZGVvLnBsYXkoKTtcblxufVxuXG5leHBvcnRzLmluaXRpYWxpemVFZGl0b3IgPSBpbml0aWFsaXplRWRpdG9yO1xuXG47IGJyb3dzZXJpZnlfc2hpbV9fZGVmaW5lX19tb2R1bGVfX2V4cG9ydF9fKHR5cGVvZiBFZGl0b3IgIT0gXCJ1bmRlZmluZWRcIiA/IEVkaXRvciA6IHdpbmRvdy5FZGl0b3IpO1xuXG59KS5jYWxsKGdsb2JhbCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgZnVuY3Rpb24gZGVmaW5lRXhwb3J0KGV4KSB7IG1vZHVsZS5leHBvcnRzID0gZXg7IH0pO1xuXG59KS5jYWxsKHRoaXMsdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KSIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbihmdW5jdGlvbiBicm93c2VyaWZ5U2hpbShtb2R1bGUsIGV4cG9ydHMsIGRlZmluZSwgYnJvd3NlcmlmeV9zaGltX19kZWZpbmVfX21vZHVsZV9fZXhwb3J0X18pIHtcbi8qXG4gICAgdmFyIHZpZCA9IG5ldyBXaGFtbXkuVmlkZW8oKTtcbiAgICB2aWQuYWRkKGNhbnZhcyBvciBkYXRhIHVybClcbiAgICB2aWQuY29tcGlsZSgpXG4qL1xuXG5cbnZhciBXaGFtbXkgPSAoZnVuY3Rpb24oKXtcbiAgICAvLyBpbiB0aGlzIGNhc2UsIGZyYW1lcyBoYXMgYSB2ZXJ5IHNwZWNpZmljIG1lYW5pbmcsIHdoaWNoIHdpbGwgYmVcbiAgICAvLyBkZXRhaWxlZCBvbmNlIGkgZmluaXNoIHdyaXRpbmcgdGhlIGNvZGVcblxuICAgIGZ1bmN0aW9uIHRvV2ViTShmcmFtZXMsIG91dHB1dEFzQXJyYXkpe1xuICAgICAgICB2YXIgaW5mbyA9IGNoZWNrRnJhbWVzKGZyYW1lcyk7XG5cbiAgICAgICAgLy9tYXggZHVyYXRpb24gYnkgY2x1c3RlciBpbiBtaWxsaXNlY29uZHNcbiAgICAgICAgdmFyIENMVVNURVJfTUFYX0RVUkFUSU9OID0gMzAwMDA7XG5cbiAgICAgICAgdmFyIEVCTUwgPSBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgXCJpZFwiOiAweDFhNDVkZmEzLCAvLyBFQk1MXG4gICAgICAgICAgICAgICAgXCJkYXRhXCI6IFtcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IDEsXG4gICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4NDI4NiAvLyBFQk1MVmVyc2lvblxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogMSxcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHg0MmY3IC8vIEVCTUxSZWFkVmVyc2lvblxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogNCxcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHg0MmYyIC8vIEVCTUxNYXhJRExlbmd0aFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogOCxcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHg0MmYzIC8vIEVCTUxNYXhTaXplTGVuZ3RoXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBcIndlYm1cIixcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHg0MjgyIC8vIERvY1R5cGVcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IDIsXG4gICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4NDI4NyAvLyBEb2NUeXBlVmVyc2lvblxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogMixcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHg0Mjg1IC8vIERvY1R5cGVSZWFkVmVyc2lvblxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBcImlkXCI6IDB4MTg1MzgwNjcsIC8vIFNlZ21lbnRcbiAgICAgICAgICAgICAgICBcImRhdGFcIjogW1xuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4MTU0OWE5NjYsIC8vIEluZm9cbiAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogMWU2LCAvL2RvIHRoaW5ncyBpbiBtaWxsaXNlY3MgKG51bSBvZiBuYW5vc2VjcyBmb3IgZHVyYXRpb24gc2NhbGUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHgyYWQ3YjEgLy8gVGltZWNvZGVTY2FsZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogXCJ3aGFtbXlcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDRkODAgLy8gTXV4aW5nQXBwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBcIndoYW1teVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4NTc0MSAvLyBXcml0aW5nQXBwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBkb3VibGVUb1N0cmluZyhpbmZvLmR1cmF0aW9uKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDQ0ODkgLy8gRHVyYXRpb25cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHgxNjU0YWU2YiwgLy8gVHJhY2tzXG4gICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweGFlLCAvLyBUcmFja0VudHJ5XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IDEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweGQ3IC8vIFRyYWNrTnVtYmVyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiAxLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHg2M2M1IC8vIFRyYWNrVUlEXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHg5YyAvLyBGbGFnTGFjaW5nXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBcInVuZFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHgyMmI1OWMgLy8gTGFuZ3VhZ2VcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IFwiVl9WUDhcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4ODYgLy8gQ29kZWNJRFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogXCJWUDhcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4MjU4Njg4IC8vIENvZGVjTmFtZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogMSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4ODMgLy8gVHJhY2tUeXBlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHhlMCwgIC8vIFZpZGVvXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IGluZm8ud2lkdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4YjAgLy8gUGl4ZWxXaWR0aFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogaW5mby5oZWlnaHQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4YmEgLy8gUGl4ZWxIZWlnaHRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgICAgICAvL2NsdXN0ZXIgaW5zZXJ0aW9uIHBvaW50XG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgfVxuICAgICAgICAgXTtcblxuXG4gICAgICAgIC8vR2VuZXJhdGUgY2x1c3RlcnMgKG1heCBkdXJhdGlvbilcbiAgICAgICAgdmFyIGZyYW1lTnVtYmVyID0gMDtcbiAgICAgICAgdmFyIGNsdXN0ZXJUaW1lY29kZSA9IDA7XG4gICAgICAgIHdoaWxlKGZyYW1lTnVtYmVyIDwgZnJhbWVzLmxlbmd0aCl7XG5cbiAgICAgICAgICAgIHZhciBjbHVzdGVyRnJhbWVzID0gW107XG4gICAgICAgICAgICB2YXIgY2x1c3RlckR1cmF0aW9uID0gMDtcbiAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgICBjbHVzdGVyRnJhbWVzLnB1c2goZnJhbWVzW2ZyYW1lTnVtYmVyXSk7XG4gICAgICAgICAgICAgICAgY2x1c3RlckR1cmF0aW9uICs9IGZyYW1lc1tmcmFtZU51bWJlcl0uZHVyYXRpb247XG4gICAgICAgICAgICAgICAgZnJhbWVOdW1iZXIrKztcbiAgICAgICAgICAgIH13aGlsZShmcmFtZU51bWJlciA8IGZyYW1lcy5sZW5ndGggJiYgY2x1c3RlckR1cmF0aW9uIDwgQ0xVU1RFUl9NQVhfRFVSQVRJT04pO1xuXG4gICAgICAgICAgICB2YXIgY2x1c3RlckNvdW50ZXIgPSAwO1xuICAgICAgICAgICAgdmFyIGNsdXN0ZXIgPSB7XG4gICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHgxZjQzYjY3NSwgLy8gQ2x1c3RlclxuICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogW1xuICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBjbHVzdGVyVGltZWNvZGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweGU3IC8vIFRpbWVjb2RlXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIF0uY29uY2F0KGNsdXN0ZXJGcmFtZXMubWFwKGZ1bmN0aW9uKHdlYnApe1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGJsb2NrID0gbWFrZVNpbXBsZUJsb2NrKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkaXNjYXJkYWJsZTogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcmFtZTogd2VicC5kYXRhLnNsaWNlKDQpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGludmlzaWJsZTogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXlmcmFtZTogMSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWNpbmc6IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJhY2tOdW06IDEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGltZWNvZGU6IE1hdGgucm91bmQoY2x1c3RlckNvdW50ZXIpXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsdXN0ZXJDb3VudGVyICs9IHdlYnAuZHVyYXRpb247XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IGJsb2NrLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlkOiAweGEzXG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICB9KSlcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vQWRkIGNsdXN0ZXIgdG8gc2VnbWVudFxuICAgICAgICAgICAgRUJNTFsxXS5kYXRhLnB1c2goY2x1c3Rlcik7XG4gICAgICAgICAgICBjbHVzdGVyVGltZWNvZGUgKz0gY2x1c3RlckR1cmF0aW9uO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGdlbmVyYXRlRUJNTChFQk1MLCBvdXRwdXRBc0FycmF5KVxuICAgIH1cblxuICAgIC8vIHN1bXMgdGhlIGxlbmd0aHMgb2YgYWxsIHRoZSBmcmFtZXMgYW5kIGdldHMgdGhlIGR1cmF0aW9uLCB3b29cblxuICAgIGZ1bmN0aW9uIGNoZWNrRnJhbWVzKGZyYW1lcyl7XG4gICAgICAgIHZhciB3aWR0aCA9IGZyYW1lc1swXS53aWR0aCxcbiAgICAgICAgICAgIGhlaWdodCA9IGZyYW1lc1swXS5oZWlnaHQsXG4gICAgICAgICAgICBkdXJhdGlvbiA9IGZyYW1lc1swXS5kdXJhdGlvbjtcbiAgICAgICAgZm9yKHZhciBpID0gMTsgaSA8IGZyYW1lcy5sZW5ndGg7IGkrKyl7XG4gICAgICAgICAgICBpZihmcmFtZXNbaV0ud2lkdGggIT0gd2lkdGgpIHRocm93IFwiRnJhbWUgXCIgKyAoaSArIDEpICsgXCIgaGFzIGEgZGlmZmVyZW50IHdpZHRoXCI7XG4gICAgICAgICAgICBpZihmcmFtZXNbaV0uaGVpZ2h0ICE9IGhlaWdodCkgdGhyb3cgXCJGcmFtZSBcIiArIChpICsgMSkgKyBcIiBoYXMgYSBkaWZmZXJlbnQgaGVpZ2h0XCI7XG4gICAgICAgICAgICBpZihmcmFtZXNbaV0uZHVyYXRpb24gPCAwIHx8IGZyYW1lc1tpXS5kdXJhdGlvbiA+IDB4N2ZmZikgdGhyb3cgXCJGcmFtZSBcIiArIChpICsgMSkgKyBcIiBoYXMgYSB3ZWlyZCBkdXJhdGlvbiAobXVzdCBiZSBiZXR3ZWVuIDAgYW5kIDMyNzY3KVwiO1xuICAgICAgICAgICAgZHVyYXRpb24gKz0gZnJhbWVzW2ldLmR1cmF0aW9uO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBkdXJhdGlvbjogZHVyYXRpb24sXG4gICAgICAgICAgICB3aWR0aDogd2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IGhlaWdodFxuICAgICAgICB9O1xuICAgIH1cblxuXG4gICAgZnVuY3Rpb24gbnVtVG9CdWZmZXIobnVtKXtcbiAgICAgICAgdmFyIHBhcnRzID0gW107XG4gICAgICAgIHdoaWxlKG51bSA+IDApe1xuICAgICAgICAgICAgcGFydHMucHVzaChudW0gJiAweGZmKVxuICAgICAgICAgICAgbnVtID0gbnVtID4+IDhcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkocGFydHMucmV2ZXJzZSgpKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzdHJUb0J1ZmZlcihzdHIpe1xuICAgICAgICAvLyByZXR1cm4gbmV3IEJsb2IoW3N0cl0pO1xuXG4gICAgICAgIHZhciBhcnIgPSBuZXcgVWludDhBcnJheShzdHIubGVuZ3RoKTtcbiAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKyl7XG4gICAgICAgICAgICBhcnJbaV0gPSBzdHIuY2hhckNvZGVBdChpKVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhcnI7XG4gICAgICAgIC8vIHRoaXMgaXMgc2xvd2VyXG4gICAgICAgIC8vIHJldHVybiBuZXcgVWludDhBcnJheShzdHIuc3BsaXQoJycpLm1hcChmdW5jdGlvbihlKXtcbiAgICAgICAgLy8gIHJldHVybiBlLmNoYXJDb2RlQXQoMClcbiAgICAgICAgLy8gfSkpXG4gICAgfVxuXG5cbiAgICAvL3NvcnJ5IHRoaXMgaXMgdWdseSwgYW5kIHNvcnQgb2YgaGFyZCB0byB1bmRlcnN0YW5kIGV4YWN0bHkgd2h5IHRoaXMgd2FzIGRvbmVcbiAgICAvLyBhdCBhbGwgcmVhbGx5LCBidXQgdGhlIHJlYXNvbiBpcyB0aGF0IHRoZXJlJ3Mgc29tZSBjb2RlIGJlbG93IHRoYXQgaSBkb250IHJlYWxseVxuICAgIC8vIGZlZWwgbGlrZSB1bmRlcnN0YW5kaW5nLCBhbmQgdGhpcyBpcyBlYXNpZXIgdGhhbiB1c2luZyBteSBicmFpbi5cblxuICAgIGZ1bmN0aW9uIGJpdHNUb0J1ZmZlcihiaXRzKXtcbiAgICAgICAgdmFyIGRhdGEgPSBbXTtcbiAgICAgICAgdmFyIHBhZCA9IChiaXRzLmxlbmd0aCAlIDgpID8gKG5ldyBBcnJheSgxICsgOCAtIChiaXRzLmxlbmd0aCAlIDgpKSkuam9pbignMCcpIDogJyc7XG4gICAgICAgIGJpdHMgPSBwYWQgKyBiaXRzO1xuICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgYml0cy5sZW5ndGg7IGkrPSA4KXtcbiAgICAgICAgICAgIGRhdGEucHVzaChwYXJzZUludChiaXRzLnN1YnN0cihpLDgpLDIpKVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXcgVWludDhBcnJheShkYXRhKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZW5lcmF0ZUVCTUwoanNvbiwgb3V0cHV0QXNBcnJheSl7XG4gICAgICAgIHZhciBlYm1sID0gW107XG4gICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBqc29uLmxlbmd0aDsgaSsrKXtcbiAgICAgICAgICAgIHZhciBkYXRhID0ganNvbltpXS5kYXRhO1xuICAgICAgICAgICAgaWYodHlwZW9mIGRhdGEgPT0gJ29iamVjdCcpIGRhdGEgPSBnZW5lcmF0ZUVCTUwoZGF0YSwgb3V0cHV0QXNBcnJheSk7XG4gICAgICAgICAgICBpZih0eXBlb2YgZGF0YSA9PSAnbnVtYmVyJykgZGF0YSA9IGJpdHNUb0J1ZmZlcihkYXRhLnRvU3RyaW5nKDIpKTtcbiAgICAgICAgICAgIGlmKHR5cGVvZiBkYXRhID09ICdzdHJpbmcnKSBkYXRhID0gc3RyVG9CdWZmZXIoZGF0YSk7XG5cbiAgICAgICAgICAgIGlmKGRhdGEubGVuZ3RoKXtcbiAgICAgICAgICAgICAgICB2YXIgeiA9IHo7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBsZW4gPSBkYXRhLnNpemUgfHwgZGF0YS5ieXRlTGVuZ3RoIHx8IGRhdGEubGVuZ3RoO1xuICAgICAgICAgICAgdmFyIHplcm9lcyA9IE1hdGguY2VpbChNYXRoLmNlaWwoTWF0aC5sb2cobGVuKS9NYXRoLmxvZygyKSkvOCk7XG4gICAgICAgICAgICB2YXIgc2l6ZV9zdHIgPSBsZW4udG9TdHJpbmcoMik7XG4gICAgICAgICAgICB2YXIgcGFkZGVkID0gKG5ldyBBcnJheSgoemVyb2VzICogNyArIDcgKyAxKSAtIHNpemVfc3RyLmxlbmd0aCkpLmpvaW4oJzAnKSArIHNpemVfc3RyO1xuICAgICAgICAgICAgdmFyIHNpemUgPSAobmV3IEFycmF5KHplcm9lcykpLmpvaW4oJzAnKSArICcxJyArIHBhZGRlZDtcblxuICAgICAgICAgICAgLy9pIGFjdHVhbGx5IGRvbnQgcXVpdGUgdW5kZXJzdGFuZCB3aGF0IHdlbnQgb24gdXAgdGhlcmUsIHNvIEknbSBub3QgcmVhbGx5XG4gICAgICAgICAgICAvL2dvaW5nIHRvIGZpeCB0aGlzLCBpJ20gcHJvYmFibHkganVzdCBnb2luZyB0byB3cml0ZSBzb21lIGhhY2t5IHRoaW5nIHdoaWNoXG4gICAgICAgICAgICAvL2NvbnZlcnRzIHRoYXQgc3RyaW5nIGludG8gYSBidWZmZXItZXNxdWUgdGhpbmdcblxuICAgICAgICAgICAgZWJtbC5wdXNoKG51bVRvQnVmZmVyKGpzb25baV0uaWQpKTtcbiAgICAgICAgICAgIGVibWwucHVzaChiaXRzVG9CdWZmZXIoc2l6ZSkpO1xuICAgICAgICAgICAgZWJtbC5wdXNoKGRhdGEpXG5cblxuICAgICAgICB9XG5cbiAgICAgICAgLy9vdXRwdXQgYXMgYmxvYiBvciBieXRlQXJyYXlcbiAgICAgICAgaWYob3V0cHV0QXNBcnJheSl7XG4gICAgICAgICAgICAvL2NvbnZlcnQgZWJtbCB0byBhbiBhcnJheVxuICAgICAgICAgICAgdmFyIGJ1ZmZlciA9IHRvRmxhdEFycmF5KGVibWwpXG4gICAgICAgICAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyKTtcbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICByZXR1cm4gbmV3IEJsb2IoZWJtbCwge3R5cGU6IFwidmlkZW8vd2VibVwifSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiB0b0ZsYXRBcnJheShhcnIsIG91dEJ1ZmZlcil7XG4gICAgICAgIGlmKG91dEJ1ZmZlciA9PSBudWxsKXtcbiAgICAgICAgICAgIG91dEJ1ZmZlciA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBhcnIubGVuZ3RoOyBpKyspe1xuICAgICAgICAgICAgaWYodHlwZW9mIGFycltpXSA9PSAnb2JqZWN0Jyl7XG4gICAgICAgICAgICAgICAgLy9hbiBhcnJheVxuICAgICAgICAgICAgICAgIHRvRmxhdEFycmF5KGFycltpXSwgb3V0QnVmZmVyKVxuICAgICAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICAgICAgLy9hIHNpbXBsZSBlbGVtZW50XG4gICAgICAgICAgICAgICAgb3V0QnVmZmVyLnB1c2goYXJyW2ldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb3V0QnVmZmVyO1xuICAgIH1cblxuICAgIC8vd29vdCwgYSBmdW5jdGlvbiB0aGF0J3MgYWN0dWFsbHkgd3JpdHRlbiBmb3IgdGhpcyBwcm9qZWN0IVxuICAgIC8vdGhpcyBwYXJzZXMgc29tZSBqc29uIG1hcmt1cCBhbmQgbWFrZXMgaXQgaW50byB0aGF0IGJpbmFyeSBtYWdpY1xuICAgIC8vd2hpY2ggY2FuIHRoZW4gZ2V0IHNob3ZlZCBpbnRvIHRoZSBtYXRyb3NrYSBjb210YWluZXIgKHBlYWNlYWJseSlcblxuICAgIGZ1bmN0aW9uIG1ha2VTaW1wbGVCbG9jayhkYXRhKXtcbiAgICAgICAgdmFyIGZsYWdzID0gMDtcbiAgICAgICAgaWYgKGRhdGEua2V5ZnJhbWUpIGZsYWdzIHw9IDEyODtcbiAgICAgICAgaWYgKGRhdGEuaW52aXNpYmxlKSBmbGFncyB8PSA4O1xuICAgICAgICBpZiAoZGF0YS5sYWNpbmcpIGZsYWdzIHw9IChkYXRhLmxhY2luZyA8PCAxKTtcbiAgICAgICAgaWYgKGRhdGEuZGlzY2FyZGFibGUpIGZsYWdzIHw9IDE7XG4gICAgICAgIGlmIChkYXRhLnRyYWNrTnVtID4gMTI3KSB7XG4gICAgICAgICAgICB0aHJvdyBcIlRyYWNrTnVtYmVyID4gMTI3IG5vdCBzdXBwb3J0ZWRcIjtcbiAgICAgICAgfVxuICAgICAgICB2YXIgb3V0ID0gW2RhdGEudHJhY2tOdW0gfCAweDgwLCBkYXRhLnRpbWVjb2RlID4+IDgsIGRhdGEudGltZWNvZGUgJiAweGZmLCBmbGFnc10ubWFwKGZ1bmN0aW9uKGUpe1xuICAgICAgICAgICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUoZSlcbiAgICAgICAgfSkuam9pbignJykgKyBkYXRhLmZyYW1lO1xuXG4gICAgICAgIHJldHVybiBvdXQ7XG4gICAgfVxuXG4gICAgLy8gaGVyZSdzIHNvbWV0aGluZyBlbHNlIHRha2VuIHZlcmJhdGltIGZyb20gd2VwcHksIGF3ZXNvbWUgcml0ZT9cblxuICAgIGZ1bmN0aW9uIHBhcnNlV2ViUChyaWZmKXtcbiAgICAgICAgdmFyIFZQOCA9IHJpZmYuUklGRlswXS5XRUJQWzBdO1xuXG4gICAgICAgIHZhciBmcmFtZV9zdGFydCA9IFZQOC5pbmRleE9mKCdcXHg5ZFxceDAxXFx4MmEnKTsgLy9BIFZQOCBrZXlmcmFtZSBzdGFydHMgd2l0aCB0aGUgMHg5ZDAxMmEgaGVhZGVyXG4gICAgICAgIGZvcih2YXIgaSA9IDAsIGMgPSBbXTsgaSA8IDQ7IGkrKykgY1tpXSA9IFZQOC5jaGFyQ29kZUF0KGZyYW1lX3N0YXJ0ICsgMyArIGkpO1xuXG4gICAgICAgIHZhciB3aWR0aCwgaG9yaXpvbnRhbF9zY2FsZSwgaGVpZ2h0LCB2ZXJ0aWNhbF9zY2FsZSwgdG1wO1xuXG4gICAgICAgIC8vdGhlIGNvZGUgYmVsb3cgaXMgbGl0ZXJhbGx5IGNvcGllZCB2ZXJiYXRpbSBmcm9tIHRoZSBiaXRzdHJlYW0gc3BlY1xuICAgICAgICB0bXAgPSAoY1sxXSA8PCA4KSB8IGNbMF07XG4gICAgICAgIHdpZHRoID0gdG1wICYgMHgzRkZGO1xuICAgICAgICBob3Jpem9udGFsX3NjYWxlID0gdG1wID4+IDE0O1xuICAgICAgICB0bXAgPSAoY1szXSA8PCA4KSB8IGNbMl07XG4gICAgICAgIGhlaWdodCA9IHRtcCAmIDB4M0ZGRjtcbiAgICAgICAgdmVydGljYWxfc2NhbGUgPSB0bXAgPj4gMTQ7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB3aWR0aDogd2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IGhlaWdodCxcbiAgICAgICAgICAgIGRhdGE6IFZQOCxcbiAgICAgICAgICAgIHJpZmY6IHJpZmZcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGkgdGhpbmsgaSdtIGdvaW5nIG9mZiBvbiBhIHJpZmYgYnkgcHJldGVuZGluZyB0aGlzIGlzIHNvbWUga25vd25cbiAgICAvLyBpZGlvbSB3aGljaCBpJ20gbWFraW5nIGEgY2FzdWFsIGFuZCBicmlsbGlhbnQgcHVuIGFib3V0LCBidXQgc2luY2VcbiAgICAvLyBpIGNhbid0IGZpbmQgYW55dGhpbmcgb24gZ29vZ2xlIHdoaWNoIGNvbmZvcm1zIHRvIHRoaXMgaWRpb21hdGljXG4gICAgLy8gdXNhZ2UsIEknbSBhc3N1bWluZyB0aGlzIGlzIGp1c3QgYSBjb25zZXF1ZW5jZSBvZiBzb21lIHBzeWNob3RpY1xuICAgIC8vIGJyZWFrIHdoaWNoIG1ha2VzIG1lIG1ha2UgdXAgcHVucy4gd2VsbCwgZW5vdWdoIHJpZmYtcmFmZiAoYWhhIGFcbiAgICAvLyByZXNjdWUgb2Ygc29ydHMpLCB0aGlzIGZ1bmN0aW9uIHdhcyByaXBwZWQgd2hvbGVzYWxlIGZyb20gd2VwcHlcblxuICAgIGZ1bmN0aW9uIHBhcnNlUklGRihzdHJpbmcpe1xuICAgICAgICB2YXIgb2Zmc2V0ID0gMDtcbiAgICAgICAgdmFyIGNodW5rcyA9IHt9O1xuXG4gICAgICAgIHdoaWxlIChvZmZzZXQgPCBzdHJpbmcubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgaWQgPSBzdHJpbmcuc3Vic3RyKG9mZnNldCwgNCk7XG4gICAgICAgICAgICB2YXIgbGVuID0gcGFyc2VJbnQoc3RyaW5nLnN1YnN0cihvZmZzZXQgKyA0LCA0KS5zcGxpdCgnJykubWFwKGZ1bmN0aW9uKGkpe1xuICAgICAgICAgICAgICAgIHZhciB1bnBhZGRlZCA9IGkuY2hhckNvZGVBdCgwKS50b1N0cmluZygyKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gKG5ldyBBcnJheSg4IC0gdW5wYWRkZWQubGVuZ3RoICsgMSkpLmpvaW4oJzAnKSArIHVucGFkZGVkXG4gICAgICAgICAgICB9KS5qb2luKCcnKSwyKTtcbiAgICAgICAgICAgIHZhciBkYXRhID0gc3RyaW5nLnN1YnN0cihvZmZzZXQgKyA0ICsgNCwgbGVuKTtcbiAgICAgICAgICAgIG9mZnNldCArPSA0ICsgNCArIGxlbjtcbiAgICAgICAgICAgIGNodW5rc1tpZF0gPSBjaHVua3NbaWRdIHx8IFtdO1xuXG4gICAgICAgICAgICBpZiAoaWQgPT0gJ1JJRkYnIHx8IGlkID09ICdMSVNUJykge1xuICAgICAgICAgICAgICAgIGNodW5rc1tpZF0ucHVzaChwYXJzZVJJRkYoZGF0YSkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjaHVua3NbaWRdLnB1c2goZGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNodW5rcztcbiAgICB9XG5cbiAgICAvLyBoZXJlJ3MgYSBsaXR0bGUgdXRpbGl0eSBmdW5jdGlvbiB0aGF0IGFjdHMgYXMgYSB1dGlsaXR5IGZvciBvdGhlciBmdW5jdGlvbnNcbiAgICAvLyBiYXNpY2FsbHksIHRoZSBvbmx5IHB1cnBvc2UgaXMgZm9yIGVuY29kaW5nIFwiRHVyYXRpb25cIiwgd2hpY2ggaXMgZW5jb2RlZCBhc1xuICAgIC8vIGEgZG91YmxlIChjb25zaWRlcmFibHkgbW9yZSBkaWZmaWN1bHQgdG8gZW5jb2RlIHRoYW4gYW4gaW50ZWdlcilcbiAgICBmdW5jdGlvbiBkb3VibGVUb1N0cmluZyhudW0pe1xuICAgICAgICByZXR1cm4gW10uc2xpY2UuY2FsbChcbiAgICAgICAgICAgIG5ldyBVaW50OEFycmF5KFxuICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgbmV3IEZsb2F0NjRBcnJheShbbnVtXSkgLy9jcmVhdGUgYSBmbG9hdDY0IGFycmF5XG4gICAgICAgICAgICAgICAgKS5idWZmZXIpIC8vZXh0cmFjdCB0aGUgYXJyYXkgYnVmZmVyXG4gICAgICAgICAgICAsIDApIC8vIGNvbnZlcnQgdGhlIFVpbnQ4QXJyYXkgaW50byBhIHJlZ3VsYXIgYXJyYXlcbiAgICAgICAgICAgIC5tYXAoZnVuY3Rpb24oZSl7IC8vc2luY2UgaXQncyBhIHJlZ3VsYXIgYXJyYXksIHdlIGNhbiBub3cgdXNlIG1hcFxuICAgICAgICAgICAgICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKGUpIC8vIGVuY29kZSBhbGwgdGhlIGJ5dGVzIGluZGl2aWR1YWxseVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5yZXZlcnNlKCkgLy9jb3JyZWN0IHRoZSBieXRlIGVuZGlhbm5lc3MgKGFzc3VtZSBpdCdzIGxpdHRsZSBlbmRpYW4gZm9yIG5vdylcbiAgICAgICAgICAgIC5qb2luKCcnKSAvLyBqb2luIHRoZSBieXRlcyBpbiBob2x5IG1hdHJpbW9ueSBhcyBhIHN0cmluZ1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIFdoYW1teVZpZGVvKHNwZWVkLCBxdWFsaXR5KXsgLy8gYSBtb3JlIGFic3RyYWN0LWlzaCBBUElcbiAgICAgICAgdGhpcy5mcmFtZXMgPSBbXTtcbiAgICAgICAgdGhpcy5kdXJhdGlvbiA9IDEwMDAgLyBzcGVlZDtcbiAgICAgICAgdGhpcy5xdWFsaXR5ID0gcXVhbGl0eSB8fCAwLjg7XG4gICAgfVxuXG4gICAgV2hhbW15VmlkZW8ucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKGZyYW1lLCBkdXJhdGlvbil7XG4gICAgICAgIGlmKHR5cGVvZiBkdXJhdGlvbiAhPSAndW5kZWZpbmVkJyAmJiB0aGlzLmR1cmF0aW9uKSB0aHJvdyBcInlvdSBjYW4ndCBwYXNzIGEgZHVyYXRpb24gaWYgdGhlIGZwcyBpcyBzZXRcIjtcbiAgICAgICAgaWYodHlwZW9mIGR1cmF0aW9uID09ICd1bmRlZmluZWQnICYmICF0aGlzLmR1cmF0aW9uKSB0aHJvdyBcImlmIHlvdSBkb24ndCBoYXZlIHRoZSBmcHMgc2V0LCB5b3UgbmVkIHRvIGhhdmUgZHVyYXRpb25zIGhlcmUuXCJcbiAgICAgICAgaWYoJ2NhbnZhcycgaW4gZnJhbWUpeyAvL0NhbnZhc1JlbmRlcmluZ0NvbnRleHQyRFxuICAgICAgICAgICAgZnJhbWUgPSBmcmFtZS5jYW52YXM7XG4gICAgICAgIH1cbiAgICAgICAgaWYoJ3RvRGF0YVVSTCcgaW4gZnJhbWUpe1xuICAgICAgICAgICAgZnJhbWUgPSBmcmFtZS50b0RhdGFVUkwoJ2ltYWdlL3dlYnAnLCB0aGlzLnF1YWxpdHkpXG4gICAgICAgIH1lbHNlIGlmKHR5cGVvZiBmcmFtZSAhPSBcInN0cmluZ1wiKXtcbiAgICAgICAgICAgIHRocm93IFwiZnJhbWUgbXVzdCBiZSBhIGEgSFRNTENhbnZhc0VsZW1lbnQsIGEgQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEIG9yIGEgRGF0YVVSSSBmb3JtYXR0ZWQgc3RyaW5nXCJcbiAgICAgICAgfVxuICAgICAgICBpZiAoISgvXmRhdGE6aW1hZ2VcXC93ZWJwO2Jhc2U2NCwvaWcpLnRlc3QoZnJhbWUpKSB7XG4gICAgICAgICAgICB0aHJvdyBcIklucHV0IG11c3QgYmUgZm9ybWF0dGVkIHByb3Blcmx5IGFzIGEgYmFzZTY0IGVuY29kZWQgRGF0YVVSSSBvZiB0eXBlIGltYWdlL3dlYnBcIjtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmZyYW1lcy5wdXNoKHtcbiAgICAgICAgICAgIGltYWdlOiBmcmFtZSxcbiAgICAgICAgICAgIGR1cmF0aW9uOiBkdXJhdGlvbiB8fCB0aGlzLmR1cmF0aW9uXG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgV2hhbW15VmlkZW8ucHJvdG90eXBlLmNvbXBpbGUgPSBmdW5jdGlvbihvdXRwdXRBc0FycmF5KXtcbiAgICAgICAgcmV0dXJuIG5ldyB0b1dlYk0odGhpcy5mcmFtZXMubWFwKGZ1bmN0aW9uKGZyYW1lKXtcbiAgICAgICAgICAgIHZhciB3ZWJwID0gcGFyc2VXZWJQKHBhcnNlUklGRihhdG9iKGZyYW1lLmltYWdlLnNsaWNlKDIzKSkpKTtcbiAgICAgICAgICAgIHdlYnAuZHVyYXRpb24gPSBmcmFtZS5kdXJhdGlvbjtcbiAgICAgICAgICAgIHJldHVybiB3ZWJwO1xuICAgICAgICB9KSwgb3V0cHV0QXNBcnJheSlcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBWaWRlbzogV2hhbW15VmlkZW8sXG4gICAgICAgIGZyb21JbWFnZUFycmF5OiBmdW5jdGlvbihpbWFnZXMsIGZwcywgb3V0cHV0QXNBcnJheSl7XG4gICAgICAgICAgICByZXR1cm4gdG9XZWJNKGltYWdlcy5tYXAoZnVuY3Rpb24oaW1hZ2Upe1xuICAgICAgICAgICAgICAgIHZhciB3ZWJwID0gcGFyc2VXZWJQKHBhcnNlUklGRihhdG9iKGltYWdlLnNsaWNlKDIzKSkpKVxuICAgICAgICAgICAgICAgIHdlYnAuZHVyYXRpb24gPSAxMDAwIC8gZnBzO1xuICAgICAgICAgICAgICAgIHJldHVybiB3ZWJwO1xuICAgICAgICAgICAgfSksIG91dHB1dEFzQXJyYXkpXG4gICAgICAgIH0sXG4gICAgICAgIHRvV2ViTTogdG9XZWJNXG4gICAgICAgIC8vIGV4cG9zZSBtZXRob2RzIG9mIG1hZG5lc3NcbiAgICB9XG59KSgpXG5cbjsgYnJvd3NlcmlmeV9zaGltX19kZWZpbmVfX21vZHVsZV9fZXhwb3J0X18odHlwZW9mIFdoYW1teSAhPSBcInVuZGVmaW5lZFwiID8gV2hhbW15IDogd2luZG93LldoYW1teSk7XG5cbn0pLmNhbGwoZ2xvYmFsLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBmdW5jdGlvbiBkZWZpbmVFeHBvcnQoZXgpIHsgbW9kdWxlLmV4cG9ydHMgPSBleDsgfSk7XG5cbn0pLmNhbGwodGhpcyx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pIl19
