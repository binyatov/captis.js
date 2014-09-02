require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
        segments: []
    },
    player: {
        objectUrl: null,
        ready: false,
        timeupdate: null,
        json: null,
        timestamps: [],
        isOn: false,
        currentStep: null,
        activeStep: null
    },
    segments: {
        ready: false
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

function clearSpace () {
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
    var subStep = 0;
    window.onkeydown = function (e) {
        setTimeout(function () {
            if (e.keyCode == 39 && captis.impress.isStep) {
                subStep = 0;
                captis.impress.isStep = false;
                captis.impress.segments.push(
                    {
                        timestamp: Math.floor(video.currentTime),
                        stepid: captis.impress.step,
                        substep: subStep,
                    }
                );
                return;
            }
            if (e.keyCode == 39 && !captis.impress.isStep) {
                subStep++;
                captis.impress.segments.push(
                    {
                        timestamp: Math.floor(video.currentTime),
                        stepid: captis.impress.step,
                        substep: subStep,
                    }
                );
                return;
            }
            if (e.keyCode == 37 && captis.impress.isStep) {
                subStep = 0;
                captis.impress.isStep = false;
                captis.impress.segments.push(
                    {
                        timestamp: Math.floor(video.currentTime),
                        stepid: captis.impress.step,
                        substep: subStep,
                    }
                );
                return;
            }
            if (e.keyCode == 37 && !captis.impress.isStep) {
                subStep--;
                captis.impress.segments.push(
                    {
                        timestamp: Math.floor(video.currentTime),
                        stepid: captis.impress.step,
                        substep: subStep,
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
                [JSON.stringify(captis.impress.segments)],
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
            for (var i = 0; i < captis.player.json.length; i++) {
                captis.player.timestamps.push(captis.player.json[i].timestamp);
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
////bug
function seekSegments (time) {
    for (var i = 0; i < captis.player.timestamps.length; i++) {
        if (time < captis.player.timestamps[i]) {
            captis.player.currentStep = i - 1;
            break;
        }
    }
    if (captis.player.currentStep == -1) {
        impress().goTo(captis.player.json[0].stepid);
        impress().prev();
    } else {
        if (captis.player.activeStep != captis.player.currentStep) {
            console.log(captis.player.json[captis.player.currentStep]);

            impress().goTo(captis.player.json[captis.player.currentStep].stepid);
            for (var i = 0; i < step; i++) {
                console.log('next');
                impress().next();
            }
            captis.player.activeStep = captis.player.currentStep;
        }
    }
}

function playVideo (e) {
    e.target.style.display = 'none';
    document.getElementById('pause').style.display = 'inline';
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
        impress().goto(captis.player.json[0].stepid);
        impress().prev();
        captis.player.isOn = true;
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
                position = 0;
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
                var segmentWidth = Math.floor(captis.player.timestamps[i] * ratio) - 1;
                ctx.fillStyle = '#13AD87';
                ctx.fillRect(position, 0, segmentWidth, canvas.height);
                ctx.fillStyle = '#A8EDDD';
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

},{"Whammy":"lZHMST"}],"Whammy":[function(require,module,exports){
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
},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvcGFzaGEvRGVza3RvcC9jYXB0aXMvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9Vc2Vycy9wYXNoYS9EZXNrdG9wL2NhcHRpcy9jYXB0aXMuanMiLCIvVXNlcnMvcGFzaGEvRGVza3RvcC9jYXB0aXMvdmVuZG9yL3doYW1teS5taW4uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM5bkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qKlxuKiBAYXV0aG9yIFBhc2hhIEJpbnlhdG92IDxwYXNoYUBiaW55YXRvdi5jb20+XG4qIEBjb3B5cmlnaHQgMjAxNCBQYXNoYSBCaW55YXRvdlxuKiBAbGljZW5zZSB7QGxpbmsgaHR0cHM6Ly9naXRodWIuY29tL2JpbnlhdG92L2NhcHRpcy5qcy9ibG9iL21hc3Rlci9MSUNFTlNFfE1JVCBMaWNlbnNlfVxuKi9cblxuLyoqXG4qL1xubmF2aWdhdG9yLmdldFVzZXJNZWRpYSA9IChcbiAgICBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhIHx8XG4gICAgbmF2aWdhdG9yLndlYmtpdEdldFVzZXJNZWRpYSB8fFxuICAgIG5hdmlnYXRvci5tb3pHZXRVc2VyTWVkaWEgfHxcbiAgICBuYXZpZ2F0b3IubXNHZXRVc2VyTWVkaWFcbik7XG5cbndpbmRvdy5VUkwgPSAoXG4gICAgd2luZG93LlVSTCB8fFxuICAgIHdpbmRvdy53ZWJraXRVUkwgfHxcbiAgICB3aW5kb3cubW96VVJMIHx8XG4gICAgd2luZG93Lm1zVVJMXG4pO1xuXG52YXIgQXVkaW9Db250ZXh0ID0gd2luZG93LkF1ZGlvQ29udGV4dCB8fCB3aW5kb3cud2Via2l0QXVkaW9Db250ZXh0LFxuICAgIFdoYW1teSA9IHJlcXVpcmUoJ1doYW1teScpLFxuICAgIGNoYW5uZWxEYXRhID0gW107XG5cbnZhciBjYXB0aXMgPSB7c3RyZWFtOiBudWxsLFxuICAgIGZyYW1lczogW10sXG4gICAgY2FwdHVyaW5nOiBmYWxzZSxcbiAgICBzdHJlYW1pbmc6IGZhbHNlLFxuICAgIHJlY29yZDogbnVsbCxcbiAgICBhdWRpbzoge1xuICAgICAgICByZWNvcmRpbmdTaXplOiAwLFxuICAgICAgICBzYW1wbGVSYXRlOiA0NDEwMCxcbiAgICAgICAgcmVjb3JkaW5nOiBmYWxzZSxcbiAgICAgICAgcHJvY2Vzc29yOiBudWxsXG4gICAgfSxcbiAgICBpbXByZXNzOiB7XG4gICAgICAgIHN0ZXA6IG51bGwsXG4gICAgICAgIGlzU3RlcDogZmFsc2UsXG4gICAgICAgIHNlZ21lbnRzOiBbXVxuICAgIH0sXG4gICAgcGxheWVyOiB7XG4gICAgICAgIG9iamVjdFVybDogbnVsbCxcbiAgICAgICAgcmVhZHk6IGZhbHNlLFxuICAgICAgICB0aW1ldXBkYXRlOiBudWxsLFxuICAgICAgICBqc29uOiBudWxsLFxuICAgICAgICB0aW1lc3RhbXBzOiBbXSxcbiAgICAgICAgaXNPbjogZmFsc2UsXG4gICAgICAgIGN1cnJlbnRTdGVwOiBudWxsLFxuICAgICAgICBhY3RpdmVTdGVwOiBudWxsXG4gICAgfSxcbiAgICBzZWdtZW50czoge1xuICAgICAgICByZWFkeTogZmFsc2VcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGluaXRpYWxpemVUb29sYmFyIChlKSB7XG4gICAgaWYgKGUuY3RybEtleSAmJiBlLmtleUNvZGUgPT0gNjkpIHtcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcHRpcycpLmlubmVySFRNTCArPSAoXG4gICAgICAgICAgICAnPGRpdiBpZD1cInRvb2xiYXJcIj4gXFxcbiAgICAgICAgICAgICAgICA8aSBpZD1cImNhbWVyYVwiIGNsYXNzPVwiZmEgZmEtdmlkZW8tY2FtZXJhIGNhcHRpc19pY29uXCI+PC9pPiBcXFxuICAgICAgICAgICAgICAgIDxpIGlkPVwicmVjb3JkXCIgY2xhc3M9XCJmYSBmYS1jaXJjbGVcIj48L2k+IFxcXG4gICAgICAgICAgICAgICAgPGkgaWQ9XCJzY3JlZW5cIiBjbGFzcz1cImZhIGZhLWRlc2t0b3AgY2FwdGlzX2ljb25cIj48L2k+IFxcXG4gICAgICAgICAgICAgICAgPGkgaWQ9XCJzYXZlXCIgY2xhc3M9XCJmYSBmYS1zYXZlIGNhcHRpc19pY29uXCI+PC9pPiBcXFxuICAgICAgICAgICAgICAgIDxpIGlkPVwiZWRpdFwiIGNsYXNzPVwiZmEgZmEtZWRpdCBjYXB0aXNfaWNvblwiPjwvaT4gXFxcbiAgICAgICAgICAgICAgICA8aSBpZD1cInVwZGF0ZVwiIGNsYXNzPVwiZmEgZmEtcmVmcmVzaCBjYXB0aXNfaWNvblwiPjwvaT4gXFxcbiAgICAgICAgICAgICAgICA8aSBpZD1cInN3aXRjaFwiIGNsYXNzPVwiZmEgZmEtcG93ZXItb2ZmIGNhcHRpc19pY29uXCI+PC9pPiBcXFxuICAgICAgICAgICAgPC9kaXY+J1xuICAgICAgICApO1xuICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdrZXl1cCcsIGluaXRpYWxpemVUb29sYmFyLCBmYWxzZSk7XG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleXVwJywgY2xvc2VUb29sYmFyLCBmYWxzZSk7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzd2l0Y2gnKS5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgICAgIGNsb3NlVG9vbGJhcixcbiAgICAgICAgICAgIGZhbHNlXG4gICAgICAgICk7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYW1lcmEnKS5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgICAgIG1lZGlhU3RyZWFtLFxuICAgICAgICAgICAgZmFsc2VcbiAgICAgICAgKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGNsZWFyU3BhY2UgKCkge1xuICAgIGlmIChjYXB0aXMuc3RyZWFtaW5nKSB7XG4gICAgICAgIGNhcHRpcy5zdHJlYW0uc3RvcCgpO1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGl2ZV9zdHJlYW0nKS5vdXRlckhUTUwgPSAnJztcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3RpbWVyJykub3V0ZXJIVE1MID0gJyc7XG4gICAgICAgIGNhcHRpcy5zdHJlYW1pbmcgPSBmYWxzZTtcbiAgICB9XG4gICAgaWYgKGNhcHRpcy5jYXB0dXJpbmcpIHtcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BvbHlnb24nKS5vdXRlckhUTUwgPSAnJztcbiAgICAgICAgY2FwdGlzLmNhcHR1cmluZyA9IGZhbHNlO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gY2xvc2VUb29sYmFyIChlKSB7XG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgaWYgKChlLmN0cmxLZXkgJiYgZS5rZXlDb2RlID09IDY5KSB8fCBlLnRhcmdldC5pZCA9PSAnc3dpdGNoJykge1xuICAgICAgICBjbGVhclNwYWNlKCk7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzd2l0Y2gnKS5yZW1vdmVFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgICAgIGNsb3NlVG9vbGJhcixcbiAgICAgICAgICAgIGZhbHNlXG4gICAgICAgICk7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYW1lcmEnKS5yZW1vdmVFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgICAgIGNsb3NlVG9vbGJhcixcbiAgICAgICAgICAgIGZhbHNlXG4gICAgICAgICk7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0b29sYmFyJykub3V0ZXJIVE1MID0gJyc7XG4gICAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2tleXVwJywgY2xvc2VUb29sYmFyLCBmYWxzZSk7XG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleXVwJywgaW5pdGlhbGl6ZVRvb2xiYXIsIGZhbHNlKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlbG9hZEV2ZW50cyAoKSB7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3N3aXRjaCcpLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICdjbGljaycsXG4gICAgICAgIGNsb3NlVG9vbGJhcixcbiAgICAgICAgZmFsc2VcbiAgICApO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzYXZlJykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgc2F2ZU1lZGlhLFxuICAgICAgICBmYWxzZVxuICAgICk7XG59XG5cbmZ1bmN0aW9uIG1lZGlhU3RyZWFtICgpIHtcbiAgICBpZiAobmF2aWdhdG9yLmdldFVzZXJNZWRpYSkge1xuICAgICAgICBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhIChcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB2aWRlbzogdHJ1ZSxcbiAgICAgICAgICAgICAgICBhdWRpbzogdHJ1ZVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZ1bmN0aW9uIChsb2NhbE1lZGlhU3RyZWFtKSB7XG4gICAgICAgICAgICAgICAgY2FwdGlzLnN0cmVhbSA9IGxvY2FsTWVkaWFTdHJlYW07XG4gICAgICAgICAgICAgICAgY2FwdGlzLnN0cmVhbWluZyA9IHRydWU7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcHRpcycpLmlubmVySFRNTCArPSAoXG4gICAgICAgICAgICAgICAgICAgICc8dmlkZW8gaWQ9XCJsaXZlX3N0cmVhbVwiIGF1dG9wbGF5IG11dGVkPjwvdmlkZW8+IFxcXG4gICAgICAgICAgICAgICAgICAgIDxpIGlkPVwidGltZXJcIj48L2k+J1xuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcHRpcycpLmlubmVySFRNTCArPSAoXG4gICAgICAgICAgICAgICAgICAgICc8Y2FudmFzIGlkPVwicG9seWdvblwiPjwvY2FudmFzPidcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsaXZlX3N0cmVhbScpLnNyYyA9IHdpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKGxvY2FsTWVkaWFTdHJlYW0pO1xuICAgICAgICAgICAgICAgIHJlbG9hZEV2ZW50cygpO1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZWNvcmQnKS5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgICAgICAgICAnY2xpY2snLFxuICAgICAgICAgICAgICAgICAgICBzdGFydFJlY29yZGluZyxcbiAgICAgICAgICAgICAgICAgICAgZmFsc2VcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiZ2V0VXNlck1lZGlhIG5vdCBzdXBwb3J0ZWRcIik7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB0aW1lRm9ybWF0IChzZWNvbmRzKSB7XG5cdHZhciBoID0gTWF0aC5mbG9vcihzZWNvbmRzLzM2MDApO1xuXHR2YXIgbSA9IE1hdGguZmxvb3IoKHNlY29uZHMgLSAoaCAqIDM2MDApKSAvIDYwKTtcblx0dmFyIHMgPSBNYXRoLmZsb29yKHNlY29uZHMgLSAoaCAqIDM2MDApIC0gKG0gKiA2MCkpO1xuXHRoID0gaCA8IDEwID8gXCIwXCIgKyBoIDogaDtcblx0bSA9IG0gPCAxMCA/IFwiMFwiICsgbSA6IG07XG5cdHMgPSBzIDwgMTAgPyBcIjBcIiArIHMgOiBzO1xuXHRyZXR1cm4gaCArIFwiOlwiICsgbSArIFwiOlwiICsgcztcbn1cblxuZnVuY3Rpb24gc3RhcnRSZWNvcmRpbmcgKCkge1xuICAgIGNhcHRpcy5hdWRpby5yZWNvcmRpbmcgPSB0cnVlO1xuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIHZhciB2aWRlbyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsaXZlX3N0cmVhbScpLFxuICAgICAgICBjYW52YXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncG9seWdvbicpLFxuICAgICAgICB0aW1lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0aW1lcicpLFxuICAgICAgICBjdHggPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKSxcbiAgICAgICAgYXVkaW9Db250ZXh0ID0gbmV3IEF1ZGlvQ29udGV4dCgpLFxuICAgICAgICBnYWluTm9kZSA9IGF1ZGlvQ29udGV4dC5jcmVhdGVHYWluKCksXG4gICAgICAgIGF1ZGlvSW5wdXQgPSBhdWRpb0NvbnRleHQuY3JlYXRlTWVkaWFTdHJlYW1Tb3VyY2UoY2FwdGlzLnN0cmVhbSksXG4gICAgICAgIGJ1ZmZlclNpemUgPSAxMDI0LFxuICAgICAgICBjdXJyZW50VGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpLFxuICAgICAgICBpbmRleCA9IDA7XG4gICAgYXVkaW9JbnB1dC5jb25uZWN0KGdhaW5Ob2RlKTtcbiAgICBjYXB0aXMuYXVkaW8ucHJvY2Vzc29yID0gYXVkaW9Db250ZXh0LmNyZWF0ZVNjcmlwdFByb2Nlc3NvcihidWZmZXJTaXplLCAxLCAxKTtcbiAgICBjYXB0aXMuY2FwdHVyaW5nID0gdHJ1ZTtcbiAgICBjYXB0aXMucmVjb3JkID0gbmV3IFdoYW1teS5WaWRlbygpO1xuICAgIHZhciBmcmFtZVdpZHRoID0gdmlkZW8ub2Zmc2V0V2lkdGggLSAxNCxcbiAgICAgICAgZnJhbWVIZWlnaHQgPSB2aWRlby5vZmZzZXRIZWlnaHQgLSAxNDtcbiAgICBjYW52YXMud2lkdGggPSBmcmFtZVdpZHRoO1xuICAgIGNhbnZhcy5oZWlnaHQgPSBmcmFtZUhlaWdodDtcbiAgICBjYXB0aXMuYXVkaW8ucHJvY2Vzc29yLm9uYXVkaW9wcm9jZXNzID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgaWYgKCFjYXB0aXMuYXVkaW8ucmVjb3JkaW5nKSByZXR1cm47XG4gICAgICAgIGlmIChpbmRleCUzID09IDApIHtcbiAgICAgICAgICAgIGN0eC5kcmF3SW1hZ2UodmlkZW8sIDAsIDAsIGZyYW1lV2lkdGgsIGZyYW1lSGVpZ2h0KTtcbiAgICAgICAgICAgIGNhcHRpcy5yZWNvcmQuYWRkKGN0eCwgMCk7XG4gICAgICAgICAgICAvL2NvbnNvbGUubG9nKCd2aWRlbycpO1xuICAgICAgICB9XG4gICAgICAgIGluZGV4Kys7XG4gICAgICAgIHZhciBjaGFubmVsID0gZS5pbnB1dEJ1ZmZlci5nZXRDaGFubmVsRGF0YSgwKTtcbiAgICAgICAgY2hhbm5lbERhdGEucHVzaChuZXcgRmxvYXQzMkFycmF5KGNoYW5uZWwpKTtcbiAgICAgICAgY2FwdGlzLmF1ZGlvLnJlY29yZGluZ1NpemUgKz0gYnVmZmVyU2l6ZTtcbiAgICAgICAgLy9jb25zb2xlLmxvZygnYXVkaW8nKTtcbiAgICB9XG4gICAgdmlkZW8uYWRkRXZlbnRMaXN0ZW5lcigndGltZXVwZGF0ZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGltZXIuaW5uZXJIVE1MID0gdGltZUZvcm1hdCgobmV3IERhdGUoKS5nZXRUaW1lKCkgLSBjdXJyZW50VGltZSkvMTAwMCk7XG4gICAgfSwgZmFsc2UpO1xuICAgIGNhcHR1cmVTZWdtZW50cyh2aWRlbyk7XG4gICAgZ2Fpbk5vZGUuY29ubmVjdChjYXB0aXMuYXVkaW8ucHJvY2Vzc29yKTtcbiAgICBjYXB0aXMuYXVkaW8ucHJvY2Vzc29yLmNvbm5lY3QoYXVkaW9Db250ZXh0LmRlc3RpbmF0aW9uKTtcbiAgICByZWxvYWRFdmVudHMoKTtcbn1cblxuZnVuY3Rpb24gY2FwdHVyZVNlZ21lbnRzICh2aWRlbykge1xuICAgIHZhciBzdWJTdGVwID0gMDtcbiAgICB3aW5kb3cub25rZXlkb3duID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoZS5rZXlDb2RlID09IDM5ICYmIGNhcHRpcy5pbXByZXNzLmlzU3RlcCkge1xuICAgICAgICAgICAgICAgIHN1YlN0ZXAgPSAwO1xuICAgICAgICAgICAgICAgIGNhcHRpcy5pbXByZXNzLmlzU3RlcCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGNhcHRpcy5pbXByZXNzLnNlZ21lbnRzLnB1c2goXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogTWF0aC5mbG9vcih2aWRlby5jdXJyZW50VGltZSksXG4gICAgICAgICAgICAgICAgICAgICAgICBzdGVwaWQ6IGNhcHRpcy5pbXByZXNzLnN0ZXAsXG4gICAgICAgICAgICAgICAgICAgICAgICBzdWJzdGVwOiBzdWJTdGVwLFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZS5rZXlDb2RlID09IDM5ICYmICFjYXB0aXMuaW1wcmVzcy5pc1N0ZXApIHtcbiAgICAgICAgICAgICAgICBzdWJTdGVwKys7XG4gICAgICAgICAgICAgICAgY2FwdGlzLmltcHJlc3Muc2VnbWVudHMucHVzaChcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGltZXN0YW1wOiBNYXRoLmZsb29yKHZpZGVvLmN1cnJlbnRUaW1lKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0ZXBpZDogY2FwdGlzLmltcHJlc3Muc3RlcCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1YnN0ZXA6IHN1YlN0ZXAsXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChlLmtleUNvZGUgPT0gMzcgJiYgY2FwdGlzLmltcHJlc3MuaXNTdGVwKSB7XG4gICAgICAgICAgICAgICAgc3ViU3RlcCA9IDA7XG4gICAgICAgICAgICAgICAgY2FwdGlzLmltcHJlc3MuaXNTdGVwID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgY2FwdGlzLmltcHJlc3Muc2VnbWVudHMucHVzaChcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGltZXN0YW1wOiBNYXRoLmZsb29yKHZpZGVvLmN1cnJlbnRUaW1lKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0ZXBpZDogY2FwdGlzLmltcHJlc3Muc3RlcCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1YnN0ZXA6IHN1YlN0ZXAsXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChlLmtleUNvZGUgPT0gMzcgJiYgIWNhcHRpcy5pbXByZXNzLmlzU3RlcCkge1xuICAgICAgICAgICAgICAgIHN1YlN0ZXAtLTtcbiAgICAgICAgICAgICAgICBjYXB0aXMuaW1wcmVzcy5zZWdtZW50cy5wdXNoKFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1lc3RhbXA6IE1hdGguZmxvb3IodmlkZW8uY3VycmVudFRpbWUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3RlcGlkOiBjYXB0aXMuaW1wcmVzcy5zdGVwLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3Vic3RlcDogc3ViU3RlcCxcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LCAxMDAwKTtcbiAgICB9O1xufVxuXG5mdW5jdGlvbiBtZXJnZUJ1ZmZlcnMgKGNoYW5uZWxCdWZmZXIsIHJlY29yZGluZ0xlbmd0aCkge1xuICAgIHZhciByZXN1bHQgPSBuZXcgRmxvYXQzMkFycmF5KHJlY29yZGluZ0xlbmd0aCksXG4gICAgICAgIG9mZnNldCA9IDA7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGFubmVsQnVmZmVyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBidWZmZXIgPSBjaGFubmVsQnVmZmVyW2ldO1xuICAgICAgICByZXN1bHQuc2V0KGJ1ZmZlciwgb2Zmc2V0KTtcbiAgICAgICAgb2Zmc2V0ICs9IGJ1ZmZlci5sZW5ndGg7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIHdyaXRlVVRGQnl0ZXMgKHZpZXcsIG9mZnNldCwgc3RyaW5nKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHJpbmcubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmlldy5zZXRVaW50OChvZmZzZXQgKyBpLCBzdHJpbmcuY2hhckNvZGVBdChpKSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBmbG9hdFRvMTZCaXRQQ00ob3V0cHV0LCBvZmZzZXQsIGlucHV0KXtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBpbnB1dC5sZW5ndGg7IGkrKywgb2Zmc2V0Kz0yKXtcbiAgICB2YXIgcyA9IE1hdGgubWF4KC0xLCBNYXRoLm1pbigxLCBpbnB1dFtpXSkpO1xuICAgIG91dHB1dC5zZXRJbnQxNihvZmZzZXQsIHMgPCAwID8gcyAqIDB4ODAwMCA6IHMgKiAweDdGRkYsIHRydWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHNhdmVNZWRpYSAoKSB7XG4gICAgY2FwdGlzLmF1ZGlvLnJlY29yZGluZyA9IGZhbHNlO1xuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGNsZWFyU3BhY2UoKTtcbiAgICBjYXB0aXMuc3RyZWFtLnN0b3AoKTtcbiAgICB2YXIgYXVkaW9EYXRhID0gbWVyZ2VCdWZmZXJzKGNoYW5uZWxEYXRhLCBjYXB0aXMuYXVkaW8ucmVjb3JkaW5nU2l6ZSksXG4gICAgICAgIGJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcig0NCArIGF1ZGlvRGF0YS5sZW5ndGggKiAyKSxcbiAgICAgICAgdmlldyA9IG5ldyBEYXRhVmlldyhidWZmZXIpO1xuICAgIHdyaXRlVVRGQnl0ZXModmlldywgMCwgJ1JJRkYnKTtcbiAgICB2aWV3LnNldFVpbnQzMig0LCAzMiArIGF1ZGlvRGF0YS5sZW5ndGggKiAyLCB0cnVlKTtcbiAgICB3cml0ZVVURkJ5dGVzKHZpZXcsIDgsICdXQVZFJyk7XG4gICAgd3JpdGVVVEZCeXRlcyh2aWV3LCAxMiwgJ2ZtdCAnKTtcbiAgICB2aWV3LnNldFVpbnQzMigxNiwgMTYsIHRydWUpO1xuICAgIHZpZXcuc2V0VWludDE2KDIwLCAxLCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQxNigyMiwgMSwgdHJ1ZSk7XG4gICAgdmlldy5zZXRVaW50MzIoMjQsIGNhcHRpcy5hdWRpby5zYW1wbGVSYXRlLCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQzMigyOCwgY2FwdGlzLmF1ZGlvLnNhbXBsZVJhdGUgKiAyLCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQxNigzMiwgMiwgdHJ1ZSk7XG4gICAgdmlldy5zZXRVaW50MTYoMzQsIDE2LCB0cnVlKTtcbiAgICB3cml0ZVVURkJ5dGVzKHZpZXcsIDM2LCAnZGF0YScpO1xuICAgIHZpZXcuc2V0VWludDMyKDQwLCBhdWRpb0RhdGEubGVuZ3RoICogMiwgdHJ1ZSk7XG4gICAgZmxvYXRUbzE2Qml0UENNKHZpZXcsIDQ0LCBhdWRpb0RhdGEpO1xuICAgIHZhciBibG9iID0gbmV3IEJsb2IoW3ZpZXddLCB7dHlwZTogJ2F1ZGlvL3dhdid9KSxcbiAgICAgICAgYXVkaW9VcmwgPSB3aW5kb3cuVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FwdGlzJykuaW5uZXJIVE1MICs9IChcbiAgICAgICAgJzxhdWRpbyBpZD1cIm1ldGFkYXRhXCI+PC9hdWRpbz4nXG4gICAgKTtcbiAgICB2YXIgYXVkaW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbWV0YWRhdGEnKTtcbiAgICBhdWRpby5zcmMgPSBhdWRpb1VybDtcbiAgICBhdWRpby5vbmxvYWRlZG1ldGFkYXRhID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgdmlkTGVuID0gTWF0aC5mbG9vcihhdWRpby5kdXJhdGlvbiAvIGNhcHRpcy5yZWNvcmQuZnJhbWVzLmxlbmd0aCAqIDEwMDApLFxuICAgICAgICAgICAgZGlmZmVyID0gMCxcbiAgICAgICAgICAgIGR1cmFUaW9uID0gMDtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjYXB0aXMucmVjb3JkLmZyYW1lcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgZGlmZmVyICs9IGF1ZGlvLmR1cmF0aW9uIC8gY2FwdGlzLnJlY29yZC5mcmFtZXMubGVuZ3RoICogMTAwMCAtIHZpZExlbjtcbiAgICAgICAgICAgIGlmIChkaWZmZXIgPiAxKSB7XG4gICAgICAgICAgICAgICAgZHVyYVRpb24gPSB2aWRMZW4gKyAxO1xuICAgICAgICAgICAgICAgIGRpZmZlciA9IGRpZmZlciAtIDE7XG4gICAgICAgICAgICB9IGVsc2UgeyBkdXJhVGlvbiA9IHZpZExlbiB9XG4gICAgICAgICAgICBjYXB0aXMucmVjb3JkLmZyYW1lc1tpXS5kdXJhdGlvbiA9IGR1cmFUaW9uO1xuICAgICAgICB9XG4gICAgICAgIHZhciBlbmNvZGVkRmlsZSA9IGNhcHRpcy5yZWNvcmQuY29tcGlsZSgpLFxuICAgICAgICAgICAgLy92aWRlb1VybCA9IHdpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKGVuY29kZWRGaWxlKSxcbiAgICAgICAgICAgIGpzb24gPSBuZXcgQmxvYihcbiAgICAgICAgICAgICAgICBbSlNPTi5zdHJpbmdpZnkoY2FwdGlzLmltcHJlc3Muc2VnbWVudHMpXSxcbiAgICAgICAgICAgICAgICB7dHlwZTogJ2FwcGxpY2F0aW9uL2pzb24nfVxuICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIC8vanNvblVybCA9IHdpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKGpzb24pLFxuICAgICAgICAgICAgZm9ybURhdGEgPSBuZXcgRm9ybURhdGEoKTtcbiAgICAgICAgZm9ybURhdGEuYXBwZW5kKCdhdWRpbycsIGJsb2IsICdhdWRpby53YXYnKTtcbiAgICAgICAgZm9ybURhdGEuYXBwZW5kKCd2aWRlbycsIGVuY29kZWRGaWxlLCAndmlkZW8ud2VibScpO1xuICAgICAgICBmb3JtRGF0YS5hcHBlbmQoJ2RhdGEnLCBqc29uLCAnY2FwdGlzLmpzb24nKTtcbiAgICAgICAgdmFyIHJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICAgICAgcmVxdWVzdC5vcGVuKCdQT1NUJywgJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMC9tZXJnZScsIHRydWUpO1xuICAgICAgICByZXF1ZXN0Lm9ubG9hZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChyZXF1ZXN0LnN0YXR1cyA9PT0gMjAwKSB7XG4gICAgICAgICAgICAgICAgbG9jYXRpb24ucmVsb2FkKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdGYWlsZWQgdG8gdXBsb2FkJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmVxdWVzdC5zZW5kKGZvcm1EYXRhKTtcbiAgICAgICAgLy8gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Rvb2xiYXInKS5pbm5lckhUTUwgKz0gKFxuICAgICAgICAvLyAgICAgJzxhIGlkPVwiY2FwdGlzbGlua1wiIGhyZWY9XCInKyB2aWRlb1VybCArJ1wiIGRvd25sb2FkPVwidmlkZW8ud2VibVwiPiBcXFxuICAgICAgICAvLyAgICAgICAgIDxpIGNsYXNzPVwiZmEgZmEtZmlsZS12aWRlby1vXCI+PC9pPiBcXFxuICAgICAgICAvLyAgICAgPC9hPiBcXFxuICAgICAgICAvLyAgICAgPGEgaWQ9XCJjYXB0aXNsaW5rXCIgaHJlZj1cIicrIGF1ZGlvVXJsICsnXCIgZG93bmxvYWQ9XCJhdWRpby53YXZcIj4gXFxcbiAgICAgICAgLy8gICAgICAgICA8aSBjbGFzcz1cImZhIGZhLWZpbGUtYXVkaW8tb1wiPjwvaT4gXFxcbiAgICAgICAgLy8gICAgIDwvYT4gXFxcbiAgICAgICAgLy8gICAgIDxhIGlkPVwiY2FwdGlzbGlua1wiIGhyZWY9XCInKyBqc29uVXJsICsnXCIgZG93bmxvYWQ9XCJjYXB0aXMuanNvblwiPiBcXFxuICAgICAgICAvLyAgICAgICAgIDxpIGNsYXNzPVwiZmEgZmEtZmlsZS1jb2RlLW9cIj48L2k+IFxcXG4gICAgICAgIC8vICAgICA8L2E+J1xuICAgICAgICAvLyApO1xuICAgICAgICByZWxvYWRFdmVudHMoKTtcbiAgICB9XG59XG5cblxuXG4vL3dhdGNoaW5nIG1vZGVcblxuZnVuY3Rpb24gbG9hZFZpZGVvICgpIHtcbiAgICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIHJlcXVlc3Qub3BlbignR0VUJywgJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMC93b3Jrc3BhY2UvY2FwdGlzLndlYm0nLCB0cnVlKTtcbiAgICByZXF1ZXN0LnJlc3BvbnNlVHlwZSA9IFwiYmxvYlwiO1xuICAgIHJlcXVlc3Qub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAocmVxdWVzdC5zdGF0dXMgPT09IDIwMCAmJiByZXF1ZXN0LnJlYWR5U3RhdGUgPT0gNCkge1xuICAgICAgICAgICAgY2FwdGlzLnBsYXllci5yZWFkeSA9IHRydWU7XG4gICAgICAgICAgICBjYXB0aXMucGxheWVyLm9iamVjdFVybCA9IHdpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKHRoaXMucmVzcG9uc2UpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJlcXVlc3Quc2VuZCgpO1xufVxuXG5mdW5jdGlvbiBsb2FkU2VnbWVudHMgKCkge1xuICAgIHZhciByZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgcmVxdWVzdC5vcGVuKCdHRVQnLCAnaHR0cDovL2xvY2FsaG9zdDozMDAwL3dvcmtzcGFjZS9jYXB0aXMuanNvbicsIHRydWUpO1xuICAgIHJlcXVlc3Qub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAocmVxdWVzdC5zdGF0dXMgPT09IDIwMCAmJiByZXF1ZXN0LnJlYWR5U3RhdGUgPT0gNCkge1xuICAgICAgICAgICAgY2FwdGlzLnNlZ21lbnRzLnJlYWR5ID0gdHJ1ZTtcbiAgICAgICAgICAgIGNhcHRpcy5wbGF5ZXIuanNvbiA9IEpTT04ucGFyc2UodGhpcy5yZXNwb25zZSk7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNhcHRpcy5wbGF5ZXIuanNvbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNhcHRpcy5wbGF5ZXIudGltZXN0YW1wcy5wdXNoKGNhcHRpcy5wbGF5ZXIuanNvbltpXS50aW1lc3RhbXApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIHJlcXVlc3Quc2VuZCgpO1xufVxuXG5mdW5jdGlvbiBmaW5pc2hXYXRjaGluZ01vZGUgKGUpIHtcbiAgICBpZiAoZS5jdHJsS2V5ICYmIGUua2V5Q29kZSA9PSA4NyAmJiBjYXB0aXMucGxheWVyLnJlYWR5KSB7XG4gICAgICAgIGNhcHRpcy5wbGF5ZXIuaXNPbiA9IHRydWU7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGF5ZXInKS5vdXRlckhUTUwgPSAnJztcbiAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5dXAnLCBmaW5pc2hXYXRjaGluZ01vZGUsIGZhbHNlKTtcbiAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLCB3YXRjaGluZ01vZGUsIGZhbHNlKTtcbiAgICAgICAgbG9jYXRpb24ucmVsb2FkKCk7XG4gICAgfVxufVxuLy8vL2J1Z1xuZnVuY3Rpb24gc2Vla1NlZ21lbnRzICh0aW1lKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjYXB0aXMucGxheWVyLnRpbWVzdGFtcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKHRpbWUgPCBjYXB0aXMucGxheWVyLnRpbWVzdGFtcHNbaV0pIHtcbiAgICAgICAgICAgIGNhcHRpcy5wbGF5ZXIuY3VycmVudFN0ZXAgPSBpIC0gMTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChjYXB0aXMucGxheWVyLmN1cnJlbnRTdGVwID09IC0xKSB7XG4gICAgICAgIGltcHJlc3MoKS5nb1RvKGNhcHRpcy5wbGF5ZXIuanNvblswXS5zdGVwaWQpO1xuICAgICAgICBpbXByZXNzKCkucHJldigpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChjYXB0aXMucGxheWVyLmFjdGl2ZVN0ZXAgIT0gY2FwdGlzLnBsYXllci5jdXJyZW50U3RlcCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coY2FwdGlzLnBsYXllci5qc29uW2NhcHRpcy5wbGF5ZXIuY3VycmVudFN0ZXBdKTtcblxuICAgICAgICAgICAgaW1wcmVzcygpLmdvVG8oY2FwdGlzLnBsYXllci5qc29uW2NhcHRpcy5wbGF5ZXIuY3VycmVudFN0ZXBdLnN0ZXBpZCk7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ZXA7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCduZXh0Jyk7XG4gICAgICAgICAgICAgICAgaW1wcmVzcygpLm5leHQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhcHRpcy5wbGF5ZXIuYWN0aXZlU3RlcCA9IGNhcHRpcy5wbGF5ZXIuY3VycmVudFN0ZXA7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIHBsYXlWaWRlbyAoZSkge1xuICAgIGUudGFyZ2V0LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BhdXNlJykuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUnO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwYXVzZScpLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICdjbGljaycsXG4gICAgICAgIHBhdXNlVmlkZW8sXG4gICAgICAgIGZhbHNlXG4gICAgKTtcbiAgICB2YXIgdmlkZW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FwdGlzX21hZGUnKSxcbiAgICAgICAgdGltZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncHRpbWVyJyksXG4gICAgICAgIGJ1ZmYgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGJ1ZmZlcicpLFxuICAgICAgICBwbGF5YmFyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXliYXInKTtcbiAgICB2aWRlby5wbGF5KCk7XG4gICAgY2FwdGlzLnBsYXllci50aW1ldXBkYXRlID0gc2V0SW50ZXJ2YWwoZnVuY3Rpb24gKCkge1xuICAgICAgICBzZWVrU2VnbWVudHMoTWF0aC5mbG9vcih2aWRlby5jdXJyZW50VGltZSkpO1xuICAgICAgICB0aW1lci5pbm5lckhUTUwgPSB0aW1lRm9ybWF0KHZpZGVvLmN1cnJlbnRUaW1lKTtcbiAgICAgICAgYnVmZi52YWx1ZSA9IHZpZGVvLmN1cnJlbnRUaW1lICsgNTtcbiAgICAgICAgcGxheWJhci52YWx1ZSA9IHZpZGVvLmN1cnJlbnRUaW1lO1xuICAgICAgICBpZiAodmlkZW8uZW5kZWQpIHt2aWRlb09uRW5kKCk7fVxuICAgIH0sIDEwMDApO1xufVxuXG5mdW5jdGlvbiBwYXVzZVZpZGVvIChlKSB7XG4gICAgY2xlYXJJbnRlcnZhbChjYXB0aXMucGxheWVyLnRpbWV1cGRhdGUpO1xuICAgIHZhciB2aWRlbyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYXB0aXNfbWFkZScpO1xuICAgIHZpZGVvLnBhdXNlKCk7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXknKS5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZSc7XG4gICAgZS50YXJnZXQuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheScpLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICdjbGljaycsXG4gICAgICAgIHBsYXlWaWRlbyxcbiAgICAgICAgZmFsc2VcbiAgICApO1xufVxuXG5mdW5jdGlvbiB2aWRlb09uRW5kICgpIHtcbiAgICB2YXIgdmlkZW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FwdGlzX21hZGUnKSxcbiAgICAgICAgdGltZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncHRpbWVyJyksXG4gICAgICAgIGJ1ZmYgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGJ1ZmZlcicpLFxuICAgICAgICBwbGF5YmFyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXliYXInKTtcbiAgICB2aWRlby5jdXJyZW50VGltZSA9IDA7XG4gICAgdGltZXIuaW5uZXJIVE1MID0gJzAwOjAwOjAwJztcbiAgICBidWZmLnZhbHVlID0gMDtcbiAgICBwbGF5YmFyLnZhbHVlID0gMDtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheScpLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lJztcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGF1c2UnKS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGF5JykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgcGxheVZpZGVvLFxuICAgICAgICBmYWxzZVxuICAgICk7XG4gICAgY2xlYXJJbnRlcnZhbChjYXB0aXMucGxheWVyLnRpbWV1cGRhdGUpO1xufVxuXG5mdW5jdGlvbiBzZXRWb2x1bWUgKGUpIHtcbiAgICB2YXIgdmlkZW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FwdGlzX21hZGUnKTtcbiAgICB2aWRlby52b2x1bWUgPSBlLnRhcmdldC52YWx1ZTtcbiAgICBpZiAoZS50YXJnZXQudmFsdWUgPT0gMSkge1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGlnaHYnKS5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZSc7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb3d2Jykuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ29mZnYnKS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgIH1cbiAgICBpZiAoZS50YXJnZXQudmFsdWUgPCAxICYmIGUudGFyZ2V0LnZhbHVlID4gMCkge1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGlnaHYnKS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG93dicpLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lJztcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ29mZnYnKS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgIH1cbiAgICBpZiAoZS50YXJnZXQudmFsdWUgPT0gMCkge1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGlnaHYnKS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG93dicpLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdvZmZ2Jykuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUnO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gc2Vla1ZpZGVvIChlKSB7XG4gICAgY2xlYXJJbnRlcnZhbChjYXB0aXMucGxheWVyLnRpbWV1cGRhdGUpO1xuICAgIHZhciB2aWRlbyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYXB0aXNfbWFkZScpLFxuICAgICAgICBidWZmID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BidWZmZXInKSxcbiAgICAgICAgdGltZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncHRpbWVyJyksXG4gICAgICAgIHBsYXliYXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheWJhcicpO1xuICAgIHZpZGVvLnBhdXNlKCk7XG4gICAgdmlkZW8uY3VycmVudFRpbWUgPSBlLnRhcmdldC52YWx1ZTtcbiAgICB2aWRlby5wbGF5KCk7XG4gICAgY2FwdGlzLnBsYXllci50aW1ldXBkYXRlID0gc2V0SW50ZXJ2YWwoZnVuY3Rpb24gKCkge1xuICAgICAgICBzZWVrU2VnbWVudHMoTWF0aC5mbG9vcih2aWRlby5jdXJyZW50VGltZSkpO1xuICAgICAgICB0aW1lci5pbm5lckhUTUwgPSB0aW1lRm9ybWF0KHZpZGVvLmN1cnJlbnRUaW1lKTtcbiAgICAgICAgYnVmZi52YWx1ZSA9IHZpZGVvLmN1cnJlbnRUaW1lICsgNTtcbiAgICAgICAgcGxheWJhci52YWx1ZSA9IHZpZGVvLmN1cnJlbnRUaW1lO1xuICAgICAgICBpZiAodmlkZW8uZW5kZWQpIHt2aWRlb09uRW5kKCk7fVxuICAgIH0sIDEwMDApO1xufVxuXG5mdW5jdGlvbiBmdWxsU2NyZWVuIChlKSB7XG4gICAgdmFyIHZpZGVvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcHRpc19tYWRlJyk7XG4gICAgaWYgKHZpZGVvLndlYmtpdFJlcXVlc3RGdWxsc2NyZWVuKSB7XG4gICAgICAgIGUudGFyZ2V0LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2V4aXRmdWxscycpLnN0eWxlLmRpc3BsYXkgPSBcImlubGluZVwiO1xuICAgICAgICB2aWRlby53ZWJraXRSZXF1ZXN0RnVsbHNjcmVlbigpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZXhpdEZ1bGxTY3JlZW4gKGUpIHtcbiAgICBpZiAoZG9jdW1lbnQud2Via2l0RXhpdEZ1bGxzY3JlZW4pIHtcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Z1bGxzJykuc3R5bGUuZGlzcGxheSA9IFwiaW5saW5lXCI7XG4gICAgICAgIGUudGFyZ2V0LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcbiAgICAgICAgZG9jdW1lbnQud2Via2l0RXhpdEZ1bGxzY3JlZW4oKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHdhdGNoaW5nTW9kZSAoZSkge1xuICAgIGlmIChlLmN0cmxLZXkgJiYgZS5rZXlDb2RlID09IDg3ICYmIGNhcHRpcy5wbGF5ZXIucmVhZHkgJiYgY2FwdGlzLnNlZ21lbnRzLnJlYWR5KSB7XG4gICAgICAgIGltcHJlc3MoKS5nb3RvKGNhcHRpcy5wbGF5ZXIuanNvblswXS5zdGVwaWQpO1xuICAgICAgICBpbXByZXNzKCkucHJldigpO1xuICAgICAgICBjYXB0aXMucGxheWVyLmlzT24gPSB0cnVlO1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FwdGlzJykuaW5uZXJIVE1MICs9IChcbiAgICAgICAgICAgICc8ZGl2IGlkPVwicGxheWVyXCI+IFxcXG4gICAgICAgICAgICAgICAgPHZpZGVvIGlkPVwiY2FwdGlzX21hZGVcIiBwcmVsb2FkPjwvdmlkZW8+IFxcXG4gICAgICAgICAgICAgICAgPGRpdiBpZD1cImNhcHRpc19jb250cm9sc1wiPiBcXFxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGlkPVwiY2FwdGlzX3BsYXllclwiPiBcXFxuICAgICAgICAgICAgICAgICAgICAgICAgPGkgaWQ9XCJwbGF5XCIgY2xhc3M9XCJmYSBmYS1wbGF5IGNhcHRpc19pY29uXCI+PC9pPiBcXFxuICAgICAgICAgICAgICAgICAgICAgICAgPGkgaWQ9XCJwYXVzZVwiIGNsYXNzPVwiZmEgZmEtcGF1c2UgY2FwdGlzX2ljb25cIj48L2k+IFxcXG4gICAgICAgICAgICAgICAgICAgICAgICA8Y2FudmFzIGlkPVwic2VnbWVudHNcIj48L2NhbnZhcz4gXFxcbiAgICAgICAgICAgICAgICAgICAgICAgIDxwcm9ncmVzcyB2YWx1ZT1cIjBcIiBpZD1cInBidWZmZXJcIj48L3Byb2dyZXNzPiBcXFxuICAgICAgICAgICAgICAgICAgICAgICAgPGlucHV0IHR5cGU9XCJyYW5nZVwiIGlkPVwicGxheWJhclwiIHZhbHVlPVwiMFwiPiBcXFxuICAgICAgICAgICAgICAgICAgICAgICAgPGkgaWQ9XCJwdGltZXJcIj4wMDowMDowMDwvaT4gXFxcbiAgICAgICAgICAgICAgICAgICAgICAgIDxpIGlkPVwiaGlnaHZcIiBjbGFzcz1cImZhIGZhLXZvbHVtZS11cCBjYXB0aXNfaWNvblwiPjwvaT4gXFxcbiAgICAgICAgICAgICAgICAgICAgICAgIDxpIGlkPVwibG93dlwiIGNsYXNzPVwiZmEgZmEtdm9sdW1lLWRvd24gY2FwdGlzX2ljb25cIj48L2k+IFxcXG4gICAgICAgICAgICAgICAgICAgICAgICA8aSBpZD1cIm9mZnZcIiBjbGFzcz1cImZhIGZhLXZvbHVtZS1vZmYgY2FwdGlzX2ljb25cIj48L2k+IFxcXG4gICAgICAgICAgICAgICAgICAgICAgICA8aW5wdXQgdHlwZT1cInJhbmdlXCIgaWQ9XCJ2b2x1bWVcIiBtaW49XCIwXCIgbWF4PVwiMVwiIHN0ZXA9XCIwLjFcIiB2YWx1ZT1cIjFcIj4gXFxcbiAgICAgICAgICAgICAgICAgICAgICAgIDxpIGlkPVwiZnVsbHNcIiBjbGFzcz1cImZhIGZhLWV5ZSBjYXB0aXNfaWNvblwiPjwvaT4gXFxcbiAgICAgICAgICAgICAgICAgICAgICAgIDxpIGlkPVwiZXhpdGZ1bGxzXCIgY2xhc3M9XCJmYSBmYS1leWUtc2xhc2ggY2FwdGlzX2ljb25cIj48L2k+IFxcXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PiBcXFxuICAgICAgICAgICAgICAgIDwvZGl2PiBcXFxuICAgICAgICAgICAgPC9kaXY+J1xuICAgICAgICApO1xuICAgICAgICB2YXIgdmlkZW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FwdGlzX21hZGUnKTtcbiAgICAgICAgdmlkZW8uc3JjID0gY2FwdGlzLnBsYXllci5vYmplY3RVcmw7XG4gICAgICAgIHZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRlZG1ldGFkYXRhJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BidWZmZXInKS5zZXRBdHRyaWJ1dGUoXG4gICAgICAgICAgICAgICAgXCJtYXhcIixcbiAgICAgICAgICAgICAgICBNYXRoLmZsb29yKHZpZGVvLmR1cmF0aW9uKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGF5YmFyJykuc2V0QXR0cmlidXRlKFxuICAgICAgICAgICAgICAgIFwibWF4XCIsXG4gICAgICAgICAgICAgICAgTWF0aC5mbG9vcih2aWRlby5kdXJhdGlvbilcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICB2YXIgY2FudmFzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NlZ21lbnRzJyksXG4gICAgICAgICAgICAgICAgY3R4ID0gY2FudmFzLmdldENvbnRleHQoJzJkJyksXG4gICAgICAgICAgICAgICAgcmF0aW8gPSBjYW52YXMud2lkdGggLyB2aWRlby5kdXJhdGlvbixcbiAgICAgICAgICAgICAgICBwb3NpdGlvbiA9IDA7XG4gICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheScpLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgICAgICAgICBwbGF5VmlkZW8sXG4gICAgICAgICAgICAgICAgZmFsc2VcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZXhpdGZ1bGxzJykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICAgICAnY2xpY2snLFxuICAgICAgICAgICAgICAgIGV4aXRGdWxsU2NyZWVuLFxuICAgICAgICAgICAgICAgIGZhbHNlXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Z1bGxzJykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICAgICAnY2xpY2snLFxuICAgICAgICAgICAgICAgIGZ1bGxTY3JlZW4sXG4gICAgICAgICAgICAgICAgZmFsc2VcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndm9sdW1lJykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICAgICAnY2hhbmdlJyxcbiAgICAgICAgICAgICAgICBzZXRWb2x1bWUsXG4gICAgICAgICAgICAgICAgZmFsc2VcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheWJhcicpLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgICAgICAgJ2NoYW5nZScsXG4gICAgICAgICAgICAgICAgc2Vla1ZpZGVvLFxuICAgICAgICAgICAgICAgIGZhbHNlXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjYXB0aXMucGxheWVyLnRpbWVzdGFtcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgc2VnbWVudFdpZHRoID0gTWF0aC5mbG9vcihjYXB0aXMucGxheWVyLnRpbWVzdGFtcHNbaV0gKiByYXRpbykgLSAxO1xuICAgICAgICAgICAgICAgIGN0eC5maWxsU3R5bGUgPSAnIzEzQUQ4Nyc7XG4gICAgICAgICAgICAgICAgY3R4LmZpbGxSZWN0KHBvc2l0aW9uLCAwLCBzZWdtZW50V2lkdGgsIGNhbnZhcy5oZWlnaHQpO1xuICAgICAgICAgICAgICAgIGN0eC5maWxsU3R5bGUgPSAnI0E4RURERCc7XG4gICAgICAgICAgICAgICAgY3R4LmZpbGxSZWN0KHNlZ21lbnRXaWR0aCwgMCwgMSwgY2FudmFzLmhlaWdodCk7XG4gICAgICAgICAgICAgICAgcG9zaXRpb24gPSBzZWdtZW50V2lkdGggKyAxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5dXAnLCB3YXRjaGluZ01vZGUsIGZhbHNlKTtcbiAgICAgICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleXVwJywgZmluaXNoV2F0Y2hpbmdNb2RlLCBmYWxzZSk7XG4gICAgICAgIH0pO1xuICAgIH1cbn1cblxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignaW1wcmVzczpzdGVwZW50ZXInLCBmdW5jdGlvbiAoZSkge1xuICAgIGNhcHRpcy5pbXByZXNzLmlzU3RlcCA9IHRydWU7XG4gICAgY2FwdGlzLmltcHJlc3Muc3RlcCA9IGUudGFyZ2V0LmlkO1xufSwgZmFsc2UpO1xuXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXl1cCcsIGluaXRpYWxpemVUb29sYmFyLCBmYWxzZSk7XG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXl1cCcsIHdhdGNoaW5nTW9kZSwgZmFsc2UpO1xuXG5sb2FkVmlkZW8oKTtcbmxvYWRTZWdtZW50cygpO1xuIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuKGZ1bmN0aW9uIGJyb3dzZXJpZnlTaGltKG1vZHVsZSwgZXhwb3J0cywgZGVmaW5lLCBicm93c2VyaWZ5X3NoaW1fX2RlZmluZV9fbW9kdWxlX19leHBvcnRfXykge1xuLypcbiAgICB2YXIgdmlkID0gbmV3IFdoYW1teS5WaWRlbygpO1xuICAgIHZpZC5hZGQoY2FudmFzIG9yIGRhdGEgdXJsKVxuICAgIHZpZC5jb21waWxlKClcbiovXG5cblxudmFyIFdoYW1teSA9IChmdW5jdGlvbigpe1xuICAgIC8vIGluIHRoaXMgY2FzZSwgZnJhbWVzIGhhcyBhIHZlcnkgc3BlY2lmaWMgbWVhbmluZywgd2hpY2ggd2lsbCBiZVxuICAgIC8vIGRldGFpbGVkIG9uY2UgaSBmaW5pc2ggd3JpdGluZyB0aGUgY29kZVxuXG4gICAgZnVuY3Rpb24gdG9XZWJNKGZyYW1lcywgb3V0cHV0QXNBcnJheSl7XG4gICAgICAgIHZhciBpbmZvID0gY2hlY2tGcmFtZXMoZnJhbWVzKTtcblxuICAgICAgICAvL21heCBkdXJhdGlvbiBieSBjbHVzdGVyIGluIG1pbGxpc2Vjb25kc1xuICAgICAgICB2YXIgQ0xVU1RFUl9NQVhfRFVSQVRJT04gPSAzMDAwMDtcblxuICAgICAgICB2YXIgRUJNTCA9IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBcImlkXCI6IDB4MWE0NWRmYTMsIC8vIEVCTUxcbiAgICAgICAgICAgICAgICBcImRhdGFcIjogW1xuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogMSxcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHg0Mjg2IC8vIEVCTUxWZXJzaW9uXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiAxLFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDQyZjcgLy8gRUJNTFJlYWRWZXJzaW9uXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiA0LFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDQyZjIgLy8gRUJNTE1heElETGVuZ3RoXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiA4LFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDQyZjMgLy8gRUJNTE1heFNpemVMZW5ndGhcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IFwid2VibVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDQyODIgLy8gRG9jVHlwZVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogMixcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHg0Mjg3IC8vIERvY1R5cGVWZXJzaW9uXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiAyLFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDQyODUgLy8gRG9jVHlwZVJlYWRWZXJzaW9uXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIFwiaWRcIjogMHgxODUzODA2NywgLy8gU2VnbWVudFxuICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBbXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHgxNTQ5YTk2NiwgLy8gSW5mb1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiAxZTYsIC8vZG8gdGhpbmdzIGluIG1pbGxpc2VjcyAobnVtIG9mIG5hbm9zZWNzIGZvciBkdXJhdGlvbiBzY2FsZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDJhZDdiMSAvLyBUaW1lY29kZVNjYWxlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBcIndoYW1teVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4NGQ4MCAvLyBNdXhpbmdBcHBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IFwid2hhbW15XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHg1NzQxIC8vIFdyaXRpbmdBcHBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IGRvdWJsZVRvU3RyaW5nKGluZm8uZHVyYXRpb24pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4NDQ4OSAvLyBEdXJhdGlvblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDE2NTRhZTZiLCAvLyBUcmFja3NcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4YWUsIC8vIFRyYWNrRW50cnlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogMSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4ZDcgLy8gVHJhY2tOdW1iZXJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IDEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDYzYzUgLy8gVHJhY2tVSURcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDljIC8vIEZsYWdMYWNpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IFwidW5kXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDIyYjU5YyAvLyBMYW5ndWFnZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogXCJWX1ZQOFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHg4NiAvLyBDb2RlY0lEXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBcIlZQOFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHgyNTg2ODggLy8gQ29kZWNOYW1lXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiAxLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHg4MyAvLyBUcmFja1R5cGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweGUwLCAgLy8gVmlkZW9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogaW5mby53aWR0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHhiMCAvLyBQaXhlbFdpZHRoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBpbmZvLmhlaWdodCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHhiYSAvLyBQaXhlbEhlaWdodFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgICAgICAgIC8vY2x1c3RlciBpbnNlcnRpb24gcG9pbnRcbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9XG4gICAgICAgICBdO1xuXG5cbiAgICAgICAgLy9HZW5lcmF0ZSBjbHVzdGVycyAobWF4IGR1cmF0aW9uKVxuICAgICAgICB2YXIgZnJhbWVOdW1iZXIgPSAwO1xuICAgICAgICB2YXIgY2x1c3RlclRpbWVjb2RlID0gMDtcbiAgICAgICAgd2hpbGUoZnJhbWVOdW1iZXIgPCBmcmFtZXMubGVuZ3RoKXtcblxuICAgICAgICAgICAgdmFyIGNsdXN0ZXJGcmFtZXMgPSBbXTtcbiAgICAgICAgICAgIHZhciBjbHVzdGVyRHVyYXRpb24gPSAwO1xuICAgICAgICAgICAgZG8ge1xuICAgICAgICAgICAgICAgIGNsdXN0ZXJGcmFtZXMucHVzaChmcmFtZXNbZnJhbWVOdW1iZXJdKTtcbiAgICAgICAgICAgICAgICBjbHVzdGVyRHVyYXRpb24gKz0gZnJhbWVzW2ZyYW1lTnVtYmVyXS5kdXJhdGlvbjtcbiAgICAgICAgICAgICAgICBmcmFtZU51bWJlcisrO1xuICAgICAgICAgICAgfXdoaWxlKGZyYW1lTnVtYmVyIDwgZnJhbWVzLmxlbmd0aCAmJiBjbHVzdGVyRHVyYXRpb24gPCBDTFVTVEVSX01BWF9EVVJBVElPTik7XG5cbiAgICAgICAgICAgIHZhciBjbHVzdGVyQ291bnRlciA9IDA7XG4gICAgICAgICAgICB2YXIgY2x1c3RlciA9IHtcbiAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDFmNDNiNjc1LCAvLyBDbHVzdGVyXG4gICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IGNsdXN0ZXJUaW1lY29kZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4ZTcgLy8gVGltZWNvZGVcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgXS5jb25jYXQoY2x1c3RlckZyYW1lcy5tYXAoZnVuY3Rpb24od2VicCl7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgYmxvY2sgPSBtYWtlU2ltcGxlQmxvY2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpc2NhcmRhYmxlOiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lOiB3ZWJwLmRhdGEuc2xpY2UoNCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW52aXNpYmxlOiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleWZyYW1lOiAxLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhY2luZzogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cmFja051bTogMSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aW1lY29kZTogTWF0aC5yb3VuZChjbHVzdGVyQ291bnRlcilcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2x1c3RlckNvdW50ZXIgKz0gd2VicC5kdXJhdGlvbjtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YTogYmxvY2ssXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWQ6IDB4YTNcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIH0pKVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy9BZGQgY2x1c3RlciB0byBzZWdtZW50XG4gICAgICAgICAgICBFQk1MWzFdLmRhdGEucHVzaChjbHVzdGVyKTtcbiAgICAgICAgICAgIGNsdXN0ZXJUaW1lY29kZSArPSBjbHVzdGVyRHVyYXRpb247XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZ2VuZXJhdGVFQk1MKEVCTUwsIG91dHB1dEFzQXJyYXkpXG4gICAgfVxuXG4gICAgLy8gc3VtcyB0aGUgbGVuZ3RocyBvZiBhbGwgdGhlIGZyYW1lcyBhbmQgZ2V0cyB0aGUgZHVyYXRpb24sIHdvb1xuXG4gICAgZnVuY3Rpb24gY2hlY2tGcmFtZXMoZnJhbWVzKXtcbiAgICAgICAgdmFyIHdpZHRoID0gZnJhbWVzWzBdLndpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0ID0gZnJhbWVzWzBdLmhlaWdodCxcbiAgICAgICAgICAgIGR1cmF0aW9uID0gZnJhbWVzWzBdLmR1cmF0aW9uO1xuICAgICAgICBmb3IodmFyIGkgPSAxOyBpIDwgZnJhbWVzLmxlbmd0aDsgaSsrKXtcbiAgICAgICAgICAgIGlmKGZyYW1lc1tpXS53aWR0aCAhPSB3aWR0aCkgdGhyb3cgXCJGcmFtZSBcIiArIChpICsgMSkgKyBcIiBoYXMgYSBkaWZmZXJlbnQgd2lkdGhcIjtcbiAgICAgICAgICAgIGlmKGZyYW1lc1tpXS5oZWlnaHQgIT0gaGVpZ2h0KSB0aHJvdyBcIkZyYW1lIFwiICsgKGkgKyAxKSArIFwiIGhhcyBhIGRpZmZlcmVudCBoZWlnaHRcIjtcbiAgICAgICAgICAgIGlmKGZyYW1lc1tpXS5kdXJhdGlvbiA8IDAgfHwgZnJhbWVzW2ldLmR1cmF0aW9uID4gMHg3ZmZmKSB0aHJvdyBcIkZyYW1lIFwiICsgKGkgKyAxKSArIFwiIGhhcyBhIHdlaXJkIGR1cmF0aW9uIChtdXN0IGJlIGJldHdlZW4gMCBhbmQgMzI3NjcpXCI7XG4gICAgICAgICAgICBkdXJhdGlvbiArPSBmcmFtZXNbaV0uZHVyYXRpb247XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGR1cmF0aW9uOiBkdXJhdGlvbixcbiAgICAgICAgICAgIHdpZHRoOiB3aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogaGVpZ2h0XG4gICAgICAgIH07XG4gICAgfVxuXG5cbiAgICBmdW5jdGlvbiBudW1Ub0J1ZmZlcihudW0pe1xuICAgICAgICB2YXIgcGFydHMgPSBbXTtcbiAgICAgICAgd2hpbGUobnVtID4gMCl7XG4gICAgICAgICAgICBwYXJ0cy5wdXNoKG51bSAmIDB4ZmYpXG4gICAgICAgICAgICBudW0gPSBudW0gPj4gOFxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXcgVWludDhBcnJheShwYXJ0cy5yZXZlcnNlKCkpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHN0clRvQnVmZmVyKHN0cil7XG4gICAgICAgIC8vIHJldHVybiBuZXcgQmxvYihbc3RyXSk7XG5cbiAgICAgICAgdmFyIGFyciA9IG5ldyBVaW50OEFycmF5KHN0ci5sZW5ndGgpO1xuICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKXtcbiAgICAgICAgICAgIGFycltpXSA9IHN0ci5jaGFyQ29kZUF0KGkpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGFycjtcbiAgICAgICAgLy8gdGhpcyBpcyBzbG93ZXJcbiAgICAgICAgLy8gcmV0dXJuIG5ldyBVaW50OEFycmF5KHN0ci5zcGxpdCgnJykubWFwKGZ1bmN0aW9uKGUpe1xuICAgICAgICAvLyAgcmV0dXJuIGUuY2hhckNvZGVBdCgwKVxuICAgICAgICAvLyB9KSlcbiAgICB9XG5cblxuICAgIC8vc29ycnkgdGhpcyBpcyB1Z2x5LCBhbmQgc29ydCBvZiBoYXJkIHRvIHVuZGVyc3RhbmQgZXhhY3RseSB3aHkgdGhpcyB3YXMgZG9uZVxuICAgIC8vIGF0IGFsbCByZWFsbHksIGJ1dCB0aGUgcmVhc29uIGlzIHRoYXQgdGhlcmUncyBzb21lIGNvZGUgYmVsb3cgdGhhdCBpIGRvbnQgcmVhbGx5XG4gICAgLy8gZmVlbCBsaWtlIHVuZGVyc3RhbmRpbmcsIGFuZCB0aGlzIGlzIGVhc2llciB0aGFuIHVzaW5nIG15IGJyYWluLlxuXG4gICAgZnVuY3Rpb24gYml0c1RvQnVmZmVyKGJpdHMpe1xuICAgICAgICB2YXIgZGF0YSA9IFtdO1xuICAgICAgICB2YXIgcGFkID0gKGJpdHMubGVuZ3RoICUgOCkgPyAobmV3IEFycmF5KDEgKyA4IC0gKGJpdHMubGVuZ3RoICUgOCkpKS5qb2luKCcwJykgOiAnJztcbiAgICAgICAgYml0cyA9IHBhZCArIGJpdHM7XG4gICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBiaXRzLmxlbmd0aDsgaSs9IDgpe1xuICAgICAgICAgICAgZGF0YS5wdXNoKHBhcnNlSW50KGJpdHMuc3Vic3RyKGksOCksMikpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ldyBVaW50OEFycmF5KGRhdGEpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdlbmVyYXRlRUJNTChqc29uLCBvdXRwdXRBc0FycmF5KXtcbiAgICAgICAgdmFyIGVibWwgPSBbXTtcbiAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IGpzb24ubGVuZ3RoOyBpKyspe1xuICAgICAgICAgICAgdmFyIGRhdGEgPSBqc29uW2ldLmRhdGE7XG4gICAgICAgICAgICBpZih0eXBlb2YgZGF0YSA9PSAnb2JqZWN0JykgZGF0YSA9IGdlbmVyYXRlRUJNTChkYXRhLCBvdXRwdXRBc0FycmF5KTtcbiAgICAgICAgICAgIGlmKHR5cGVvZiBkYXRhID09ICdudW1iZXInKSBkYXRhID0gYml0c1RvQnVmZmVyKGRhdGEudG9TdHJpbmcoMikpO1xuICAgICAgICAgICAgaWYodHlwZW9mIGRhdGEgPT0gJ3N0cmluZycpIGRhdGEgPSBzdHJUb0J1ZmZlcihkYXRhKTtcblxuICAgICAgICAgICAgaWYoZGF0YS5sZW5ndGgpe1xuICAgICAgICAgICAgICAgIHZhciB6ID0gejtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGxlbiA9IGRhdGEuc2l6ZSB8fCBkYXRhLmJ5dGVMZW5ndGggfHwgZGF0YS5sZW5ndGg7XG4gICAgICAgICAgICB2YXIgemVyb2VzID0gTWF0aC5jZWlsKE1hdGguY2VpbChNYXRoLmxvZyhsZW4pL01hdGgubG9nKDIpKS84KTtcbiAgICAgICAgICAgIHZhciBzaXplX3N0ciA9IGxlbi50b1N0cmluZygyKTtcbiAgICAgICAgICAgIHZhciBwYWRkZWQgPSAobmV3IEFycmF5KCh6ZXJvZXMgKiA3ICsgNyArIDEpIC0gc2l6ZV9zdHIubGVuZ3RoKSkuam9pbignMCcpICsgc2l6ZV9zdHI7XG4gICAgICAgICAgICB2YXIgc2l6ZSA9IChuZXcgQXJyYXkoemVyb2VzKSkuam9pbignMCcpICsgJzEnICsgcGFkZGVkO1xuXG4gICAgICAgICAgICAvL2kgYWN0dWFsbHkgZG9udCBxdWl0ZSB1bmRlcnN0YW5kIHdoYXQgd2VudCBvbiB1cCB0aGVyZSwgc28gSSdtIG5vdCByZWFsbHlcbiAgICAgICAgICAgIC8vZ29pbmcgdG8gZml4IHRoaXMsIGknbSBwcm9iYWJseSBqdXN0IGdvaW5nIHRvIHdyaXRlIHNvbWUgaGFja3kgdGhpbmcgd2hpY2hcbiAgICAgICAgICAgIC8vY29udmVydHMgdGhhdCBzdHJpbmcgaW50byBhIGJ1ZmZlci1lc3F1ZSB0aGluZ1xuXG4gICAgICAgICAgICBlYm1sLnB1c2gobnVtVG9CdWZmZXIoanNvbltpXS5pZCkpO1xuICAgICAgICAgICAgZWJtbC5wdXNoKGJpdHNUb0J1ZmZlcihzaXplKSk7XG4gICAgICAgICAgICBlYm1sLnB1c2goZGF0YSlcblxuXG4gICAgICAgIH1cblxuICAgICAgICAvL291dHB1dCBhcyBibG9iIG9yIGJ5dGVBcnJheVxuICAgICAgICBpZihvdXRwdXRBc0FycmF5KXtcbiAgICAgICAgICAgIC8vY29udmVydCBlYm1sIHRvIGFuIGFycmF5XG4gICAgICAgICAgICB2YXIgYnVmZmVyID0gdG9GbGF0QXJyYXkoZWJtbClcbiAgICAgICAgICAgIHJldHVybiBuZXcgVWludDhBcnJheShidWZmZXIpO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIHJldHVybiBuZXcgQmxvYihlYm1sLCB7dHlwZTogXCJ2aWRlby93ZWJtXCJ9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHRvRmxhdEFycmF5KGFyciwgb3V0QnVmZmVyKXtcbiAgICAgICAgaWYob3V0QnVmZmVyID09IG51bGwpe1xuICAgICAgICAgICAgb3V0QnVmZmVyID0gW107XG4gICAgICAgIH1cbiAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkrKyl7XG4gICAgICAgICAgICBpZih0eXBlb2YgYXJyW2ldID09ICdvYmplY3QnKXtcbiAgICAgICAgICAgICAgICAvL2FuIGFycmF5XG4gICAgICAgICAgICAgICAgdG9GbGF0QXJyYXkoYXJyW2ldLCBvdXRCdWZmZXIpXG4gICAgICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgICAgICAvL2Egc2ltcGxlIGVsZW1lbnRcbiAgICAgICAgICAgICAgICBvdXRCdWZmZXIucHVzaChhcnJbaV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvdXRCdWZmZXI7XG4gICAgfVxuXG4gICAgLy93b290LCBhIGZ1bmN0aW9uIHRoYXQncyBhY3R1YWxseSB3cml0dGVuIGZvciB0aGlzIHByb2plY3QhXG4gICAgLy90aGlzIHBhcnNlcyBzb21lIGpzb24gbWFya3VwIGFuZCBtYWtlcyBpdCBpbnRvIHRoYXQgYmluYXJ5IG1hZ2ljXG4gICAgLy93aGljaCBjYW4gdGhlbiBnZXQgc2hvdmVkIGludG8gdGhlIG1hdHJvc2thIGNvbXRhaW5lciAocGVhY2VhYmx5KVxuXG4gICAgZnVuY3Rpb24gbWFrZVNpbXBsZUJsb2NrKGRhdGEpe1xuICAgICAgICB2YXIgZmxhZ3MgPSAwO1xuICAgICAgICBpZiAoZGF0YS5rZXlmcmFtZSkgZmxhZ3MgfD0gMTI4O1xuICAgICAgICBpZiAoZGF0YS5pbnZpc2libGUpIGZsYWdzIHw9IDg7XG4gICAgICAgIGlmIChkYXRhLmxhY2luZykgZmxhZ3MgfD0gKGRhdGEubGFjaW5nIDw8IDEpO1xuICAgICAgICBpZiAoZGF0YS5kaXNjYXJkYWJsZSkgZmxhZ3MgfD0gMTtcbiAgICAgICAgaWYgKGRhdGEudHJhY2tOdW0gPiAxMjcpIHtcbiAgICAgICAgICAgIHRocm93IFwiVHJhY2tOdW1iZXIgPiAxMjcgbm90IHN1cHBvcnRlZFwiO1xuICAgICAgICB9XG4gICAgICAgIHZhciBvdXQgPSBbZGF0YS50cmFja051bSB8IDB4ODAsIGRhdGEudGltZWNvZGUgPj4gOCwgZGF0YS50aW1lY29kZSAmIDB4ZmYsIGZsYWdzXS5tYXAoZnVuY3Rpb24oZSl7XG4gICAgICAgICAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZShlKVxuICAgICAgICB9KS5qb2luKCcnKSArIGRhdGEuZnJhbWU7XG5cbiAgICAgICAgcmV0dXJuIG91dDtcbiAgICB9XG5cbiAgICAvLyBoZXJlJ3Mgc29tZXRoaW5nIGVsc2UgdGFrZW4gdmVyYmF0aW0gZnJvbSB3ZXBweSwgYXdlc29tZSByaXRlP1xuXG4gICAgZnVuY3Rpb24gcGFyc2VXZWJQKHJpZmYpe1xuICAgICAgICB2YXIgVlA4ID0gcmlmZi5SSUZGWzBdLldFQlBbMF07XG5cbiAgICAgICAgdmFyIGZyYW1lX3N0YXJ0ID0gVlA4LmluZGV4T2YoJ1xceDlkXFx4MDFcXHgyYScpOyAvL0EgVlA4IGtleWZyYW1lIHN0YXJ0cyB3aXRoIHRoZSAweDlkMDEyYSBoZWFkZXJcbiAgICAgICAgZm9yKHZhciBpID0gMCwgYyA9IFtdOyBpIDwgNDsgaSsrKSBjW2ldID0gVlA4LmNoYXJDb2RlQXQoZnJhbWVfc3RhcnQgKyAzICsgaSk7XG5cbiAgICAgICAgdmFyIHdpZHRoLCBob3Jpem9udGFsX3NjYWxlLCBoZWlnaHQsIHZlcnRpY2FsX3NjYWxlLCB0bXA7XG5cbiAgICAgICAgLy90aGUgY29kZSBiZWxvdyBpcyBsaXRlcmFsbHkgY29waWVkIHZlcmJhdGltIGZyb20gdGhlIGJpdHN0cmVhbSBzcGVjXG4gICAgICAgIHRtcCA9IChjWzFdIDw8IDgpIHwgY1swXTtcbiAgICAgICAgd2lkdGggPSB0bXAgJiAweDNGRkY7XG4gICAgICAgIGhvcml6b250YWxfc2NhbGUgPSB0bXAgPj4gMTQ7XG4gICAgICAgIHRtcCA9IChjWzNdIDw8IDgpIHwgY1syXTtcbiAgICAgICAgaGVpZ2h0ID0gdG1wICYgMHgzRkZGO1xuICAgICAgICB2ZXJ0aWNhbF9zY2FsZSA9IHRtcCA+PiAxNDtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHdpZHRoOiB3aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogaGVpZ2h0LFxuICAgICAgICAgICAgZGF0YTogVlA4LFxuICAgICAgICAgICAgcmlmZjogcmlmZlxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gaSB0aGluayBpJ20gZ29pbmcgb2ZmIG9uIGEgcmlmZiBieSBwcmV0ZW5kaW5nIHRoaXMgaXMgc29tZSBrbm93blxuICAgIC8vIGlkaW9tIHdoaWNoIGknbSBtYWtpbmcgYSBjYXN1YWwgYW5kIGJyaWxsaWFudCBwdW4gYWJvdXQsIGJ1dCBzaW5jZVxuICAgIC8vIGkgY2FuJ3QgZmluZCBhbnl0aGluZyBvbiBnb29nbGUgd2hpY2ggY29uZm9ybXMgdG8gdGhpcyBpZGlvbWF0aWNcbiAgICAvLyB1c2FnZSwgSSdtIGFzc3VtaW5nIHRoaXMgaXMganVzdCBhIGNvbnNlcXVlbmNlIG9mIHNvbWUgcHN5Y2hvdGljXG4gICAgLy8gYnJlYWsgd2hpY2ggbWFrZXMgbWUgbWFrZSB1cCBwdW5zLiB3ZWxsLCBlbm91Z2ggcmlmZi1yYWZmIChhaGEgYVxuICAgIC8vIHJlc2N1ZSBvZiBzb3J0cyksIHRoaXMgZnVuY3Rpb24gd2FzIHJpcHBlZCB3aG9sZXNhbGUgZnJvbSB3ZXBweVxuXG4gICAgZnVuY3Rpb24gcGFyc2VSSUZGKHN0cmluZyl7XG4gICAgICAgIHZhciBvZmZzZXQgPSAwO1xuICAgICAgICB2YXIgY2h1bmtzID0ge307XG5cbiAgICAgICAgd2hpbGUgKG9mZnNldCA8IHN0cmluZy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHZhciBpZCA9IHN0cmluZy5zdWJzdHIob2Zmc2V0LCA0KTtcbiAgICAgICAgICAgIHZhciBsZW4gPSBwYXJzZUludChzdHJpbmcuc3Vic3RyKG9mZnNldCArIDQsIDQpLnNwbGl0KCcnKS5tYXAoZnVuY3Rpb24oaSl7XG4gICAgICAgICAgICAgICAgdmFyIHVucGFkZGVkID0gaS5jaGFyQ29kZUF0KDApLnRvU3RyaW5nKDIpO1xuICAgICAgICAgICAgICAgIHJldHVybiAobmV3IEFycmF5KDggLSB1bnBhZGRlZC5sZW5ndGggKyAxKSkuam9pbignMCcpICsgdW5wYWRkZWRcbiAgICAgICAgICAgIH0pLmpvaW4oJycpLDIpO1xuICAgICAgICAgICAgdmFyIGRhdGEgPSBzdHJpbmcuc3Vic3RyKG9mZnNldCArIDQgKyA0LCBsZW4pO1xuICAgICAgICAgICAgb2Zmc2V0ICs9IDQgKyA0ICsgbGVuO1xuICAgICAgICAgICAgY2h1bmtzW2lkXSA9IGNodW5rc1tpZF0gfHwgW107XG5cbiAgICAgICAgICAgIGlmIChpZCA9PSAnUklGRicgfHwgaWQgPT0gJ0xJU1QnKSB7XG4gICAgICAgICAgICAgICAgY2h1bmtzW2lkXS5wdXNoKHBhcnNlUklGRihkYXRhKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNodW5rc1tpZF0ucHVzaChkYXRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY2h1bmtzO1xuICAgIH1cblxuICAgIC8vIGhlcmUncyBhIGxpdHRsZSB1dGlsaXR5IGZ1bmN0aW9uIHRoYXQgYWN0cyBhcyBhIHV0aWxpdHkgZm9yIG90aGVyIGZ1bmN0aW9uc1xuICAgIC8vIGJhc2ljYWxseSwgdGhlIG9ubHkgcHVycG9zZSBpcyBmb3IgZW5jb2RpbmcgXCJEdXJhdGlvblwiLCB3aGljaCBpcyBlbmNvZGVkIGFzXG4gICAgLy8gYSBkb3VibGUgKGNvbnNpZGVyYWJseSBtb3JlIGRpZmZpY3VsdCB0byBlbmNvZGUgdGhhbiBhbiBpbnRlZ2VyKVxuICAgIGZ1bmN0aW9uIGRvdWJsZVRvU3RyaW5nKG51bSl7XG4gICAgICAgIHJldHVybiBbXS5zbGljZS5jYWxsKFxuICAgICAgICAgICAgbmV3IFVpbnQ4QXJyYXkoXG4gICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICBuZXcgRmxvYXQ2NEFycmF5KFtudW1dKSAvL2NyZWF0ZSBhIGZsb2F0NjQgYXJyYXlcbiAgICAgICAgICAgICAgICApLmJ1ZmZlcikgLy9leHRyYWN0IHRoZSBhcnJheSBidWZmZXJcbiAgICAgICAgICAgICwgMCkgLy8gY29udmVydCB0aGUgVWludDhBcnJheSBpbnRvIGEgcmVndWxhciBhcnJheVxuICAgICAgICAgICAgLm1hcChmdW5jdGlvbihlKXsgLy9zaW5jZSBpdCdzIGEgcmVndWxhciBhcnJheSwgd2UgY2FuIG5vdyB1c2UgbWFwXG4gICAgICAgICAgICAgICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUoZSkgLy8gZW5jb2RlIGFsbCB0aGUgYnl0ZXMgaW5kaXZpZHVhbGx5XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLnJldmVyc2UoKSAvL2NvcnJlY3QgdGhlIGJ5dGUgZW5kaWFubmVzcyAoYXNzdW1lIGl0J3MgbGl0dGxlIGVuZGlhbiBmb3Igbm93KVxuICAgICAgICAgICAgLmpvaW4oJycpIC8vIGpvaW4gdGhlIGJ5dGVzIGluIGhvbHkgbWF0cmltb255IGFzIGEgc3RyaW5nXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gV2hhbW15VmlkZW8oc3BlZWQsIHF1YWxpdHkpeyAvLyBhIG1vcmUgYWJzdHJhY3QtaXNoIEFQSVxuICAgICAgICB0aGlzLmZyYW1lcyA9IFtdO1xuICAgICAgICB0aGlzLmR1cmF0aW9uID0gMTAwMCAvIHNwZWVkO1xuICAgICAgICB0aGlzLnF1YWxpdHkgPSBxdWFsaXR5IHx8IDAuODtcbiAgICB9XG5cbiAgICBXaGFtbXlWaWRlby5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oZnJhbWUsIGR1cmF0aW9uKXtcbiAgICAgICAgaWYodHlwZW9mIGR1cmF0aW9uICE9ICd1bmRlZmluZWQnICYmIHRoaXMuZHVyYXRpb24pIHRocm93IFwieW91IGNhbid0IHBhc3MgYSBkdXJhdGlvbiBpZiB0aGUgZnBzIGlzIHNldFwiO1xuICAgICAgICBpZih0eXBlb2YgZHVyYXRpb24gPT0gJ3VuZGVmaW5lZCcgJiYgIXRoaXMuZHVyYXRpb24pIHRocm93IFwiaWYgeW91IGRvbid0IGhhdmUgdGhlIGZwcyBzZXQsIHlvdSBuZWQgdG8gaGF2ZSBkdXJhdGlvbnMgaGVyZS5cIlxuICAgICAgICBpZignY2FudmFzJyBpbiBmcmFtZSl7IC8vQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEXG4gICAgICAgICAgICBmcmFtZSA9IGZyYW1lLmNhbnZhcztcbiAgICAgICAgfVxuICAgICAgICBpZigndG9EYXRhVVJMJyBpbiBmcmFtZSl7XG4gICAgICAgICAgICBmcmFtZSA9IGZyYW1lLnRvRGF0YVVSTCgnaW1hZ2Uvd2VicCcsIHRoaXMucXVhbGl0eSlcbiAgICAgICAgfWVsc2UgaWYodHlwZW9mIGZyYW1lICE9IFwic3RyaW5nXCIpe1xuICAgICAgICAgICAgdGhyb3cgXCJmcmFtZSBtdXN0IGJlIGEgYSBIVE1MQ2FudmFzRWxlbWVudCwgYSBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQgb3IgYSBEYXRhVVJJIGZvcm1hdHRlZCBzdHJpbmdcIlxuICAgICAgICB9XG4gICAgICAgIGlmICghKC9eZGF0YTppbWFnZVxcL3dlYnA7YmFzZTY0LC9pZykudGVzdChmcmFtZSkpIHtcbiAgICAgICAgICAgIHRocm93IFwiSW5wdXQgbXVzdCBiZSBmb3JtYXR0ZWQgcHJvcGVybHkgYXMgYSBiYXNlNjQgZW5jb2RlZCBEYXRhVVJJIG9mIHR5cGUgaW1hZ2Uvd2VicFwiO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZnJhbWVzLnB1c2goe1xuICAgICAgICAgICAgaW1hZ2U6IGZyYW1lLFxuICAgICAgICAgICAgZHVyYXRpb246IGR1cmF0aW9uIHx8IHRoaXMuZHVyYXRpb25cbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICBXaGFtbXlWaWRlby5wcm90b3R5cGUuY29tcGlsZSA9IGZ1bmN0aW9uKG91dHB1dEFzQXJyYXkpe1xuICAgICAgICByZXR1cm4gbmV3IHRvV2ViTSh0aGlzLmZyYW1lcy5tYXAoZnVuY3Rpb24oZnJhbWUpe1xuICAgICAgICAgICAgdmFyIHdlYnAgPSBwYXJzZVdlYlAocGFyc2VSSUZGKGF0b2IoZnJhbWUuaW1hZ2Uuc2xpY2UoMjMpKSkpO1xuICAgICAgICAgICAgd2VicC5kdXJhdGlvbiA9IGZyYW1lLmR1cmF0aW9uO1xuICAgICAgICAgICAgcmV0dXJuIHdlYnA7XG4gICAgICAgIH0pLCBvdXRwdXRBc0FycmF5KVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIFZpZGVvOiBXaGFtbXlWaWRlbyxcbiAgICAgICAgZnJvbUltYWdlQXJyYXk6IGZ1bmN0aW9uKGltYWdlcywgZnBzLCBvdXRwdXRBc0FycmF5KXtcbiAgICAgICAgICAgIHJldHVybiB0b1dlYk0oaW1hZ2VzLm1hcChmdW5jdGlvbihpbWFnZSl7XG4gICAgICAgICAgICAgICAgdmFyIHdlYnAgPSBwYXJzZVdlYlAocGFyc2VSSUZGKGF0b2IoaW1hZ2Uuc2xpY2UoMjMpKSkpXG4gICAgICAgICAgICAgICAgd2VicC5kdXJhdGlvbiA9IDEwMDAgLyBmcHM7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHdlYnA7XG4gICAgICAgICAgICB9KSwgb3V0cHV0QXNBcnJheSlcbiAgICAgICAgfSxcbiAgICAgICAgdG9XZWJNOiB0b1dlYk1cbiAgICAgICAgLy8gZXhwb3NlIG1ldGhvZHMgb2YgbWFkbmVzc1xuICAgIH1cbn0pKClcblxuOyBicm93c2VyaWZ5X3NoaW1fX2RlZmluZV9fbW9kdWxlX19leHBvcnRfXyh0eXBlb2YgV2hhbW15ICE9IFwidW5kZWZpbmVkXCIgPyBXaGFtbXkgOiB3aW5kb3cuV2hhbW15KTtcblxufSkuY2FsbChnbG9iYWwsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGZ1bmN0aW9uIGRlZmluZUV4cG9ydChleCkgeyBtb2R1bGUuZXhwb3J0cyA9IGV4OyB9KTtcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSkiXX0=
