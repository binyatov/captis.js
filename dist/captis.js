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

function startRecording () {
    captis.audio.recording = true;
    event.stopPropagation();
    var video = document.getElementById('live_stream'),
        canvas = document.getElementById('polygon'),
        ctx = canvas.getContext('2d'),
        audioContext = new AudioContext(),
        gainNode = audioContext.createGain(),
        audioInput = audioContext.createMediaStreamSource(captis.stream),
        bufferSize = 1024,
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
        ctx.drawImage(video, 0, 0, frameWidth, frameHeight);
        captis.record.add(ctx, 0);
        //console.log('video');
        var channel = e.inputBuffer.getChannelData(0);
        channelData.push(new Float32Array(channel));
        captis.audio.recordingSize += bufferSize;
        //console.log('audio');
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
    clearInterval(captis.animation);
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
        var vidLen = Math.floor(audio.duration / captis.record.frames.length * 1000);
        var differ = 0;
        var duraTion = 0;
        for (var i = 0; i < captis.record.frames.length; i++) {
            differ += audio.duration / captis.record.frames.length * 1000 - vidLen;
            if (differ > 1) {
                duraTion = vidLen + 1;
                differ = differ - 1;
            } else { duraTion = vidLen }
            captis.record.frames[i].duration = duraTion;
        }
        var encodedFile = captis.record.compile(),
            videoUrl = window.URL.createObjectURL(encodedFile);
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
}






document.addEventListener('keyup', initializeToolbar, false);

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
        this.quality = quality || 1;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvQXBwbGljYXRpb25zL1hBTVBQL3hhbXBwZmlsZXMvaHRkb2NzL2NhcHRpcy9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL0FwcGxpY2F0aW9ucy9YQU1QUC94YW1wcGZpbGVzL2h0ZG9jcy9jYXB0aXMvY2FwdGlzLmpzIiwiL0FwcGxpY2F0aW9ucy9YQU1QUC94YW1wcGZpbGVzL2h0ZG9jcy9jYXB0aXMvdmVuZG9yL3doYW1teS5taW4uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDdFFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qKlxuKiBAYXV0aG9yIFBhc2hhIEJpbnlhdG92IDxwYXNoYUBiaW55YXRvdi5jb20+XG4qIEBjb3B5cmlnaHQgMjAxNCBQYXNoYSBCaW55YXRvdlxuKiBAbGljZW5zZSB7QGxpbmsgaHR0cHM6Ly9naXRodWIuY29tL2JpbnlhdG92L2NhcHRpcy5qcy9ibG9iL21hc3Rlci9MSUNFTlNFfE1JVCBMaWNlbnNlfVxuKi9cblxuLyoqXG4qL1xubmF2aWdhdG9yLmdldFVzZXJNZWRpYSA9IChcbiAgICBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhIHx8XG4gICAgbmF2aWdhdG9yLndlYmtpdEdldFVzZXJNZWRpYSB8fFxuICAgIG5hdmlnYXRvci5tb3pHZXRVc2VyTWVkaWEgfHxcbiAgICBuYXZpZ2F0b3IubXNHZXRVc2VyTWVkaWFcbik7XG5cbndpbmRvdy5VUkwgPSAoXG4gICAgd2luZG93LlVSTCB8fFxuICAgIHdpbmRvdy53ZWJraXRVUkwgfHxcbiAgICB3aW5kb3cubW96VVJMIHx8XG4gICAgd2luZG93Lm1zVVJMXG4pO1xuXG52YXIgQXVkaW9Db250ZXh0ID0gd2luZG93LkF1ZGlvQ29udGV4dCB8fCB3aW5kb3cud2Via2l0QXVkaW9Db250ZXh0LFxuICAgIFdoYW1teSA9IHJlcXVpcmUoJ1doYW1teScpLFxuICAgIGNoYW5uZWxEYXRhID0gW107XG5cbnZhciBjYXB0aXMgPSB7c3RyZWFtOiBudWxsLFxuICAgIGZyYW1lczogW10sXG4gICAgY2FwdHVyaW5nOiBmYWxzZSxcbiAgICBzdHJlYW1pbmc6IGZhbHNlLFxuICAgIHJlY29yZDogbnVsbCxcbiAgICBhdWRpbzoge1xuICAgICAgICByZWNvcmRpbmdTaXplOiAwLFxuICAgICAgICBzYW1wbGVSYXRlOiA0NDEwMCxcbiAgICAgICAgcmVjb3JkaW5nOiBmYWxzZSxcbiAgICAgICAgcHJvY2Vzc29yOiBudWxsXG4gICAgfVxufVxuXG5mdW5jdGlvbiBpbml0aWFsaXplVG9vbGJhciAoZSkge1xuICAgIGlmIChlLmN0cmxLZXkgJiYgZS5rZXlDb2RlID09IDY5KSB7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYXB0aXMnKS5pbm5lckhUTUwgKz0gKFxuICAgICAgICAgICAgJzxkaXYgaWQ9XCJ0b29sYmFyXCI+IFxcXG4gICAgICAgICAgICAgICAgPGkgaWQ9XCJjYW1lcmFcIiBjbGFzcz1cImZhIGZhLXZpZGVvLWNhbWVyYSBjYXB0aXNfaWNvblwiPjwvaT4gXFxcbiAgICAgICAgICAgICAgICA8aSBpZD1cInJlY29yZFwiIGNsYXNzPVwiZmEgZmEtY2lyY2xlXCI+PC9pPiBcXFxuICAgICAgICAgICAgICAgIDxpIGlkPVwic2NyZWVuXCIgY2xhc3M9XCJmYSBmYS1kZXNrdG9wIGNhcHRpc19pY29uXCI+PC9pPiBcXFxuICAgICAgICAgICAgICAgIDxpIGlkPVwic2F2ZVwiIGNsYXNzPVwiZmEgZmEtc2F2ZSBjYXB0aXNfaWNvblwiPjwvaT4gXFxcbiAgICAgICAgICAgICAgICA8aSBpZD1cImVkaXRcIiBjbGFzcz1cImZhIGZhLWVkaXQgY2FwdGlzX2ljb25cIj48L2k+IFxcXG4gICAgICAgICAgICAgICAgPGkgaWQ9XCJ1cGRhdGVcIiBjbGFzcz1cImZhIGZhLXJlZnJlc2ggY2FwdGlzX2ljb25cIj48L2k+IFxcXG4gICAgICAgICAgICAgICAgPGkgaWQ9XCJzd2l0Y2hcIiBjbGFzcz1cImZhIGZhLXBvd2VyLW9mZiBjYXB0aXNfaWNvblwiPjwvaT4gXFxcbiAgICAgICAgICAgIDwvZGl2PidcbiAgICAgICAgKTtcbiAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5dXAnLCBpbml0aWFsaXplVG9vbGJhciwgZmFsc2UpO1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXl1cCcsIGNsb3NlVG9vbGJhciwgZmFsc2UpO1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3dpdGNoJykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICdjbGljaycsXG4gICAgICAgICAgICBjbG9zZVRvb2xiYXIsXG4gICAgICAgICAgICBmYWxzZVxuICAgICAgICApO1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FtZXJhJykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICdjbGljaycsXG4gICAgICAgICAgICBtZWRpYVN0cmVhbSxcbiAgICAgICAgICAgIGZhbHNlXG4gICAgICAgICk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBjbG9zZVRvb2xiYXIgKGUpIHtcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBpZiAoKGUuY3RybEtleSAmJiBlLmtleUNvZGUgPT0gNjkpIHx8IGUudGFyZ2V0LmlkID09ICdzd2l0Y2gnKSB7XG4gICAgICAgIGlmIChjYXB0aXMuc3RyZWFtaW5nKSB7XG4gICAgICAgICAgICBjYXB0aXMuc3RyZWFtLnN0b3AoKTtcbiAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsaXZlX3N0cmVhbScpLm91dGVySFRNTCA9ICcnO1xuICAgICAgICAgICAgY2FwdGlzLnN0cmVhbWluZyA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjYXB0aXMuY2FwdHVyaW5nKSB7XG4gICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncG9seWdvbicpLm91dGVySFRNTCA9ICcnO1xuICAgICAgICAgICAgY2FwdGlzLmNhcHR1cmluZyA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzd2l0Y2gnKS5yZW1vdmVFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgICAgIGNsb3NlVG9vbGJhcixcbiAgICAgICAgICAgIGZhbHNlXG4gICAgICAgICk7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYW1lcmEnKS5yZW1vdmVFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgICAgIGNsb3NlVG9vbGJhcixcbiAgICAgICAgICAgIGZhbHNlXG4gICAgICAgICk7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0b29sYmFyJykub3V0ZXJIVE1MID0gJyc7XG4gICAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2tleXVwJywgY2xvc2VUb29sYmFyLCBmYWxzZSk7XG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleXVwJywgaW5pdGlhbGl6ZVRvb2xiYXIsIGZhbHNlKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlbG9hZEV2ZW50cyAoKSB7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3N3aXRjaCcpLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICdjbGljaycsXG4gICAgICAgIGNsb3NlVG9vbGJhcixcbiAgICAgICAgZmFsc2VcbiAgICApO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzYXZlJykuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgJ2NsaWNrJyxcbiAgICAgICAgc2F2ZU1lZGlhLFxuICAgICAgICBmYWxzZVxuICAgICk7XG59XG5cbmZ1bmN0aW9uIG1lZGlhU3RyZWFtICgpIHtcbiAgICBpZiAobmF2aWdhdG9yLmdldFVzZXJNZWRpYSkge1xuICAgICAgICBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhIChcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB2aWRlbzogdHJ1ZSxcbiAgICAgICAgICAgICAgICBhdWRpbzogdHJ1ZVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZ1bmN0aW9uIChsb2NhbE1lZGlhU3RyZWFtKSB7XG4gICAgICAgICAgICAgICAgY2FwdGlzLnN0cmVhbSA9IGxvY2FsTWVkaWFTdHJlYW07XG4gICAgICAgICAgICAgICAgY2FwdGlzLnN0cmVhbWluZyA9IHRydWU7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcHRpcycpLmlubmVySFRNTCArPSAoXG4gICAgICAgICAgICAgICAgICAgICc8dmlkZW8gaWQ9XCJsaXZlX3N0cmVhbVwiIGF1dG9wbGF5IG11dGVkPjwvdmlkZW8+J1xuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcHRpcycpLmlubmVySFRNTCArPSAoXG4gICAgICAgICAgICAgICAgICAgICc8Y2FudmFzIGlkPVwicG9seWdvblwiPjwvY2FudmFzPidcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsaXZlX3N0cmVhbScpLnNyYyA9IHdpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKGxvY2FsTWVkaWFTdHJlYW0pO1xuICAgICAgICAgICAgICAgIHJlbG9hZEV2ZW50cygpO1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZWNvcmQnKS5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgICAgICAgICAnY2xpY2snLFxuICAgICAgICAgICAgICAgICAgICBzdGFydFJlY29yZGluZyxcbiAgICAgICAgICAgICAgICAgICAgZmFsc2VcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiZ2V0VXNlck1lZGlhIG5vdCBzdXBwb3J0ZWRcIik7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBzdGFydFJlY29yZGluZyAoKSB7XG4gICAgY2FwdGlzLmF1ZGlvLnJlY29yZGluZyA9IHRydWU7XG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgdmFyIHZpZGVvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xpdmVfc3RyZWFtJyksXG4gICAgICAgIGNhbnZhcyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwb2x5Z29uJyksXG4gICAgICAgIGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpLFxuICAgICAgICBhdWRpb0NvbnRleHQgPSBuZXcgQXVkaW9Db250ZXh0KCksXG4gICAgICAgIGdhaW5Ob2RlID0gYXVkaW9Db250ZXh0LmNyZWF0ZUdhaW4oKSxcbiAgICAgICAgYXVkaW9JbnB1dCA9IGF1ZGlvQ29udGV4dC5jcmVhdGVNZWRpYVN0cmVhbVNvdXJjZShjYXB0aXMuc3RyZWFtKSxcbiAgICAgICAgYnVmZmVyU2l6ZSA9IDEwMjQsXG4gICAgICAgIGluZGV4ID0gMDtcbiAgICBhdWRpb0lucHV0LmNvbm5lY3QoZ2Fpbk5vZGUpO1xuICAgIGNhcHRpcy5hdWRpby5wcm9jZXNzb3IgPSBhdWRpb0NvbnRleHQuY3JlYXRlU2NyaXB0UHJvY2Vzc29yKGJ1ZmZlclNpemUsIDEsIDEpO1xuICAgIGNhcHRpcy5jYXB0dXJpbmcgPSB0cnVlO1xuICAgIGNhcHRpcy5yZWNvcmQgPSBuZXcgV2hhbW15LlZpZGVvKCk7XG4gICAgdmFyIGZyYW1lV2lkdGggPSB2aWRlby5vZmZzZXRXaWR0aCAtIDE0LFxuICAgICAgICBmcmFtZUhlaWdodCA9IHZpZGVvLm9mZnNldEhlaWdodCAtIDE0O1xuICAgIGNhbnZhcy53aWR0aCA9IGZyYW1lV2lkdGg7XG4gICAgY2FudmFzLmhlaWdodCA9IGZyYW1lSGVpZ2h0O1xuICAgIGNhcHRpcy5hdWRpby5wcm9jZXNzb3Iub25hdWRpb3Byb2Nlc3MgPSBmdW5jdGlvbiAoZSkge1xuICAgICAgICBpZiAoIWNhcHRpcy5hdWRpby5yZWNvcmRpbmcpIHJldHVybjtcbiAgICAgICAgY3R4LmRyYXdJbWFnZSh2aWRlbywgMCwgMCwgZnJhbWVXaWR0aCwgZnJhbWVIZWlnaHQpO1xuICAgICAgICBjYXB0aXMucmVjb3JkLmFkZChjdHgsIDApO1xuICAgICAgICAvL2NvbnNvbGUubG9nKCd2aWRlbycpO1xuICAgICAgICB2YXIgY2hhbm5lbCA9IGUuaW5wdXRCdWZmZXIuZ2V0Q2hhbm5lbERhdGEoMCk7XG4gICAgICAgIGNoYW5uZWxEYXRhLnB1c2gobmV3IEZsb2F0MzJBcnJheShjaGFubmVsKSk7XG4gICAgICAgIGNhcHRpcy5hdWRpby5yZWNvcmRpbmdTaXplICs9IGJ1ZmZlclNpemU7XG4gICAgICAgIC8vY29uc29sZS5sb2coJ2F1ZGlvJyk7XG4gICAgfVxuICAgIGdhaW5Ob2RlLmNvbm5lY3QoY2FwdGlzLmF1ZGlvLnByb2Nlc3Nvcik7XG4gICAgY2FwdGlzLmF1ZGlvLnByb2Nlc3Nvci5jb25uZWN0KGF1ZGlvQ29udGV4dC5kZXN0aW5hdGlvbik7XG4gICAgcmVsb2FkRXZlbnRzKCk7XG59XG5cbmZ1bmN0aW9uIG1lcmdlQnVmZmVycyAoY2hhbm5lbEJ1ZmZlciwgcmVjb3JkaW5nTGVuZ3RoKSB7XG4gICAgdmFyIHJlc3VsdCA9IG5ldyBGbG9hdDMyQXJyYXkocmVjb3JkaW5nTGVuZ3RoKSxcbiAgICAgICAgb2Zmc2V0ID0gMDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoYW5uZWxCdWZmZXIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGJ1ZmZlciA9IGNoYW5uZWxCdWZmZXJbaV07XG4gICAgICAgIHJlc3VsdC5zZXQoYnVmZmVyLCBvZmZzZXQpO1xuICAgICAgICBvZmZzZXQgKz0gYnVmZmVyLmxlbmd0aDtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gd3JpdGVVVEZCeXRlcyAodmlldywgb2Zmc2V0LCBzdHJpbmcpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHN0cmluZy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2aWV3LnNldFVpbnQ4KG9mZnNldCArIGksIHN0cmluZy5jaGFyQ29kZUF0KGkpKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGZsb2F0VG8xNkJpdFBDTShvdXRwdXQsIG9mZnNldCwgaW5wdXQpe1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGlucHV0Lmxlbmd0aDsgaSsrLCBvZmZzZXQrPTIpe1xuICAgIHZhciBzID0gTWF0aC5tYXgoLTEsIE1hdGgubWluKDEsIGlucHV0W2ldKSk7XG4gICAgb3V0cHV0LnNldEludDE2KG9mZnNldCwgcyA8IDAgPyBzICogMHg4MDAwIDogcyAqIDB4N0ZGRiwgdHJ1ZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gc2F2ZU1lZGlhICgpIHtcbiAgICBjYXB0aXMuYXVkaW8ucmVjb3JkaW5nID0gZmFsc2U7XG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgY2xlYXJJbnRlcnZhbChjYXB0aXMuYW5pbWF0aW9uKTtcbiAgICBjYXB0aXMuc3RyZWFtLnN0b3AoKTtcbiAgICB2YXIgYXVkaW9EYXRhID0gbWVyZ2VCdWZmZXJzKGNoYW5uZWxEYXRhLCBjYXB0aXMuYXVkaW8ucmVjb3JkaW5nU2l6ZSksXG4gICAgICAgIGJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcig0NCArIGF1ZGlvRGF0YS5sZW5ndGggKiAyKSxcbiAgICAgICAgdmlldyA9IG5ldyBEYXRhVmlldyhidWZmZXIpO1xuICAgIHdyaXRlVVRGQnl0ZXModmlldywgMCwgJ1JJRkYnKTtcbiAgICB2aWV3LnNldFVpbnQzMig0LCAzMiArIGF1ZGlvRGF0YS5sZW5ndGggKiAyLCB0cnVlKTtcbiAgICB3cml0ZVVURkJ5dGVzKHZpZXcsIDgsICdXQVZFJyk7XG4gICAgd3JpdGVVVEZCeXRlcyh2aWV3LCAxMiwgJ2ZtdCAnKTtcbiAgICB2aWV3LnNldFVpbnQzMigxNiwgMTYsIHRydWUpO1xuICAgIHZpZXcuc2V0VWludDE2KDIwLCAxLCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQxNigyMiwgMSwgdHJ1ZSk7XG4gICAgdmlldy5zZXRVaW50MzIoMjQsIGNhcHRpcy5hdWRpby5zYW1wbGVSYXRlLCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQzMigyOCwgY2FwdGlzLmF1ZGlvLnNhbXBsZVJhdGUgKiAyLCB0cnVlKTtcbiAgICB2aWV3LnNldFVpbnQxNigzMiwgMiwgdHJ1ZSk7XG4gICAgdmlldy5zZXRVaW50MTYoMzQsIDE2LCB0cnVlKTtcbiAgICB3cml0ZVVURkJ5dGVzKHZpZXcsIDM2LCAnZGF0YScpO1xuICAgIHZpZXcuc2V0VWludDMyKDQwLCBhdWRpb0RhdGEubGVuZ3RoICogMiwgdHJ1ZSk7XG4gICAgZmxvYXRUbzE2Qml0UENNKHZpZXcsIDQ0LCBhdWRpb0RhdGEpO1xuICAgIHZhciBibG9iID0gbmV3IEJsb2IoW3ZpZXddLCB7dHlwZTogJ2F1ZGlvL3dhdid9KSxcbiAgICAgICAgYXVkaW9VcmwgPSB3aW5kb3cuVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FwdGlzJykuaW5uZXJIVE1MICs9IChcbiAgICAgICAgJzxhdWRpbyBpZD1cIm1ldGFkYXRhXCI+PC9hdWRpbz4nXG4gICAgKTtcbiAgICB2YXIgYXVkaW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbWV0YWRhdGEnKTtcbiAgICBhdWRpby5zcmMgPSBhdWRpb1VybDtcbiAgICBhdWRpby5vbmxvYWRlZG1ldGFkYXRhID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgdmlkTGVuID0gTWF0aC5mbG9vcihhdWRpby5kdXJhdGlvbiAvIGNhcHRpcy5yZWNvcmQuZnJhbWVzLmxlbmd0aCAqIDEwMDApO1xuICAgICAgICB2YXIgZGlmZmVyID0gMDtcbiAgICAgICAgdmFyIGR1cmFUaW9uID0gMDtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjYXB0aXMucmVjb3JkLmZyYW1lcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgZGlmZmVyICs9IGF1ZGlvLmR1cmF0aW9uIC8gY2FwdGlzLnJlY29yZC5mcmFtZXMubGVuZ3RoICogMTAwMCAtIHZpZExlbjtcbiAgICAgICAgICAgIGlmIChkaWZmZXIgPiAxKSB7XG4gICAgICAgICAgICAgICAgZHVyYVRpb24gPSB2aWRMZW4gKyAxO1xuICAgICAgICAgICAgICAgIGRpZmZlciA9IGRpZmZlciAtIDE7XG4gICAgICAgICAgICB9IGVsc2UgeyBkdXJhVGlvbiA9IHZpZExlbiB9XG4gICAgICAgICAgICBjYXB0aXMucmVjb3JkLmZyYW1lc1tpXS5kdXJhdGlvbiA9IGR1cmFUaW9uO1xuICAgICAgICB9XG4gICAgICAgIHZhciBlbmNvZGVkRmlsZSA9IGNhcHRpcy5yZWNvcmQuY29tcGlsZSgpLFxuICAgICAgICAgICAgdmlkZW9VcmwgPSB3aW5kb3cuVVJMLmNyZWF0ZU9iamVjdFVSTChlbmNvZGVkRmlsZSk7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0b29sYmFyJykuaW5uZXJIVE1MICs9IChcbiAgICAgICAgICAgICc8YSBocmVmPVwiJysgdmlkZW9VcmwgKydcIiBkb3dubG9hZD1cInZpZGVvLndlYm1cIj4gXFxcbiAgICAgICAgICAgICAgICA8aSBjbGFzcz1cImZhIGZhLWZpbGUtdmlkZW8tb1wiPjwvaT4gXFxcbiAgICAgICAgICAgIDwvYT4gXFxcbiAgICAgICAgICAgIDxhIGhyZWY9XCInKyBhdWRpb1VybCArJ1wiIGRvd25sb2FkPVwiYXVkaW8ud2F2XCI+IFxcXG4gICAgICAgICAgICAgICAgPGkgY2xhc3M9XCJmYSBmYS1maWxlLWF1ZGlvLW9cIj48L2k+IFxcXG4gICAgICAgICAgICA8L2E+IFxcXG4gICAgICAgICAgICA8YSBocmVmPVwiJysgJyAnICsnXCIgZG93bmxvYWQ9XCJjYXB0aXMuanNvblwiPiBcXFxuICAgICAgICAgICAgICAgIDxpIGNsYXNzPVwiZmEgZmEtZmlsZS1jb2RlLW9cIj48L2k+IFxcXG4gICAgICAgICAgICA8L2E+J1xuICAgICAgICApO1xuICAgIH1cbn1cblxuXG5cblxuXG5cbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleXVwJywgaW5pdGlhbGl6ZVRvb2xiYXIsIGZhbHNlKTtcbiIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbihmdW5jdGlvbiBicm93c2VyaWZ5U2hpbShtb2R1bGUsIGV4cG9ydHMsIGRlZmluZSwgYnJvd3NlcmlmeV9zaGltX19kZWZpbmVfX21vZHVsZV9fZXhwb3J0X18pIHtcbi8qXG4gICAgdmFyIHZpZCA9IG5ldyBXaGFtbXkuVmlkZW8oKTtcbiAgICB2aWQuYWRkKGNhbnZhcyBvciBkYXRhIHVybClcbiAgICB2aWQuY29tcGlsZSgpXG4qL1xuXG5cbnZhciBXaGFtbXkgPSAoZnVuY3Rpb24oKXtcbiAgICAvLyBpbiB0aGlzIGNhc2UsIGZyYW1lcyBoYXMgYSB2ZXJ5IHNwZWNpZmljIG1lYW5pbmcsIHdoaWNoIHdpbGwgYmVcbiAgICAvLyBkZXRhaWxlZCBvbmNlIGkgZmluaXNoIHdyaXRpbmcgdGhlIGNvZGVcblxuICAgIGZ1bmN0aW9uIHRvV2ViTShmcmFtZXMsIG91dHB1dEFzQXJyYXkpe1xuICAgICAgICB2YXIgaW5mbyA9IGNoZWNrRnJhbWVzKGZyYW1lcyk7XG5cbiAgICAgICAgLy9tYXggZHVyYXRpb24gYnkgY2x1c3RlciBpbiBtaWxsaXNlY29uZHNcbiAgICAgICAgdmFyIENMVVNURVJfTUFYX0RVUkFUSU9OID0gMzAwMDA7XG5cbiAgICAgICAgdmFyIEVCTUwgPSBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgXCJpZFwiOiAweDFhNDVkZmEzLCAvLyBFQk1MXG4gICAgICAgICAgICAgICAgXCJkYXRhXCI6IFtcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IDEsXG4gICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4NDI4NiAvLyBFQk1MVmVyc2lvblxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogMSxcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHg0MmY3IC8vIEVCTUxSZWFkVmVyc2lvblxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogNCxcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHg0MmYyIC8vIEVCTUxNYXhJRExlbmd0aFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogOCxcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHg0MmYzIC8vIEVCTUxNYXhTaXplTGVuZ3RoXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBcIndlYm1cIixcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHg0MjgyIC8vIERvY1R5cGVcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IDIsXG4gICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4NDI4NyAvLyBEb2NUeXBlVmVyc2lvblxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogMixcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHg0Mjg1IC8vIERvY1R5cGVSZWFkVmVyc2lvblxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBcImlkXCI6IDB4MTg1MzgwNjcsIC8vIFNlZ21lbnRcbiAgICAgICAgICAgICAgICBcImRhdGFcIjogW1xuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4MTU0OWE5NjYsIC8vIEluZm9cbiAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogMWU2LCAvL2RvIHRoaW5ncyBpbiBtaWxsaXNlY3MgKG51bSBvZiBuYW5vc2VjcyBmb3IgZHVyYXRpb24gc2NhbGUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHgyYWQ3YjEgLy8gVGltZWNvZGVTY2FsZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogXCJ3aGFtbXlcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDRkODAgLy8gTXV4aW5nQXBwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBcIndoYW1teVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4NTc0MSAvLyBXcml0aW5nQXBwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBkb3VibGVUb1N0cmluZyhpbmZvLmR1cmF0aW9uKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweDQ0ODkgLy8gRHVyYXRpb25cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHgxNjU0YWU2YiwgLy8gVHJhY2tzXG4gICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweGFlLCAvLyBUcmFja0VudHJ5XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IDEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweGQ3IC8vIFRyYWNrTnVtYmVyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiAxLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHg2M2M1IC8vIFRyYWNrVUlEXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHg5YyAvLyBGbGFnTGFjaW5nXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBcInVuZFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHgyMmI1OWMgLy8gTGFuZ3VhZ2VcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IFwiVl9WUDhcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4ODYgLy8gQ29kZWNJRFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogXCJWUDhcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4MjU4Njg4IC8vIENvZGVjTmFtZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogMSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4ODMgLy8gVHJhY2tUeXBlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHhlMCwgIC8vIFZpZGVvXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IGluZm8ud2lkdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4YjAgLy8gUGl4ZWxXaWR0aFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogaW5mby5oZWlnaHQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IDB4YmEgLy8gUGl4ZWxIZWlnaHRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgICAgICAvL2NsdXN0ZXIgaW5zZXJ0aW9uIHBvaW50XG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgfVxuICAgICAgICAgXTtcblxuXG4gICAgICAgIC8vR2VuZXJhdGUgY2x1c3RlcnMgKG1heCBkdXJhdGlvbilcbiAgICAgICAgdmFyIGZyYW1lTnVtYmVyID0gMDtcbiAgICAgICAgdmFyIGNsdXN0ZXJUaW1lY29kZSA9IDA7XG4gICAgICAgIHdoaWxlKGZyYW1lTnVtYmVyIDwgZnJhbWVzLmxlbmd0aCl7XG5cbiAgICAgICAgICAgIHZhciBjbHVzdGVyRnJhbWVzID0gW107XG4gICAgICAgICAgICB2YXIgY2x1c3RlckR1cmF0aW9uID0gMDtcbiAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgICBjbHVzdGVyRnJhbWVzLnB1c2goZnJhbWVzW2ZyYW1lTnVtYmVyXSk7XG4gICAgICAgICAgICAgICAgY2x1c3RlckR1cmF0aW9uICs9IGZyYW1lc1tmcmFtZU51bWJlcl0uZHVyYXRpb247XG4gICAgICAgICAgICAgICAgZnJhbWVOdW1iZXIrKztcbiAgICAgICAgICAgIH13aGlsZShmcmFtZU51bWJlciA8IGZyYW1lcy5sZW5ndGggJiYgY2x1c3RlckR1cmF0aW9uIDwgQ0xVU1RFUl9NQVhfRFVSQVRJT04pO1xuXG4gICAgICAgICAgICB2YXIgY2x1c3RlckNvdW50ZXIgPSAwO1xuICAgICAgICAgICAgdmFyIGNsdXN0ZXIgPSB7XG4gICAgICAgICAgICAgICAgICAgIFwiaWRcIjogMHgxZjQzYjY3NSwgLy8gQ2x1c3RlclxuICAgICAgICAgICAgICAgICAgICBcImRhdGFcIjogW1xuICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiBjbHVzdGVyVGltZWNvZGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiAweGU3IC8vIFRpbWVjb2RlXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIF0uY29uY2F0KGNsdXN0ZXJGcmFtZXMubWFwKGZ1bmN0aW9uKHdlYnApe1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGJsb2NrID0gbWFrZVNpbXBsZUJsb2NrKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkaXNjYXJkYWJsZTogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcmFtZTogd2VicC5kYXRhLnNsaWNlKDQpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGludmlzaWJsZTogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXlmcmFtZTogMSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWNpbmc6IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJhY2tOdW06IDEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGltZWNvZGU6IE1hdGgucm91bmQoY2x1c3RlckNvdW50ZXIpXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsdXN0ZXJDb3VudGVyICs9IHdlYnAuZHVyYXRpb247XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IGJsb2NrLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlkOiAweGEzXG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICB9KSlcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vQWRkIGNsdXN0ZXIgdG8gc2VnbWVudFxuICAgICAgICAgICAgRUJNTFsxXS5kYXRhLnB1c2goY2x1c3Rlcik7XG4gICAgICAgICAgICBjbHVzdGVyVGltZWNvZGUgKz0gY2x1c3RlckR1cmF0aW9uO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGdlbmVyYXRlRUJNTChFQk1MLCBvdXRwdXRBc0FycmF5KVxuICAgIH1cblxuICAgIC8vIHN1bXMgdGhlIGxlbmd0aHMgb2YgYWxsIHRoZSBmcmFtZXMgYW5kIGdldHMgdGhlIGR1cmF0aW9uLCB3b29cblxuICAgIGZ1bmN0aW9uIGNoZWNrRnJhbWVzKGZyYW1lcyl7XG4gICAgICAgIHZhciB3aWR0aCA9IGZyYW1lc1swXS53aWR0aCxcbiAgICAgICAgICAgIGhlaWdodCA9IGZyYW1lc1swXS5oZWlnaHQsXG4gICAgICAgICAgICBkdXJhdGlvbiA9IGZyYW1lc1swXS5kdXJhdGlvbjtcbiAgICAgICAgZm9yKHZhciBpID0gMTsgaSA8IGZyYW1lcy5sZW5ndGg7IGkrKyl7XG4gICAgICAgICAgICBpZihmcmFtZXNbaV0ud2lkdGggIT0gd2lkdGgpIHRocm93IFwiRnJhbWUgXCIgKyAoaSArIDEpICsgXCIgaGFzIGEgZGlmZmVyZW50IHdpZHRoXCI7XG4gICAgICAgICAgICBpZihmcmFtZXNbaV0uaGVpZ2h0ICE9IGhlaWdodCkgdGhyb3cgXCJGcmFtZSBcIiArIChpICsgMSkgKyBcIiBoYXMgYSBkaWZmZXJlbnQgaGVpZ2h0XCI7XG4gICAgICAgICAgICBpZihmcmFtZXNbaV0uZHVyYXRpb24gPCAwIHx8IGZyYW1lc1tpXS5kdXJhdGlvbiA+IDB4N2ZmZikgdGhyb3cgXCJGcmFtZSBcIiArIChpICsgMSkgKyBcIiBoYXMgYSB3ZWlyZCBkdXJhdGlvbiAobXVzdCBiZSBiZXR3ZWVuIDAgYW5kIDMyNzY3KVwiO1xuICAgICAgICAgICAgZHVyYXRpb24gKz0gZnJhbWVzW2ldLmR1cmF0aW9uO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBkdXJhdGlvbjogZHVyYXRpb24sXG4gICAgICAgICAgICB3aWR0aDogd2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IGhlaWdodFxuICAgICAgICB9O1xuICAgIH1cblxuXG4gICAgZnVuY3Rpb24gbnVtVG9CdWZmZXIobnVtKXtcbiAgICAgICAgdmFyIHBhcnRzID0gW107XG4gICAgICAgIHdoaWxlKG51bSA+IDApe1xuICAgICAgICAgICAgcGFydHMucHVzaChudW0gJiAweGZmKVxuICAgICAgICAgICAgbnVtID0gbnVtID4+IDhcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkocGFydHMucmV2ZXJzZSgpKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzdHJUb0J1ZmZlcihzdHIpe1xuICAgICAgICAvLyByZXR1cm4gbmV3IEJsb2IoW3N0cl0pO1xuXG4gICAgICAgIHZhciBhcnIgPSBuZXcgVWludDhBcnJheShzdHIubGVuZ3RoKTtcbiAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKyl7XG4gICAgICAgICAgICBhcnJbaV0gPSBzdHIuY2hhckNvZGVBdChpKVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhcnI7XG4gICAgICAgIC8vIHRoaXMgaXMgc2xvd2VyXG4gICAgICAgIC8vIHJldHVybiBuZXcgVWludDhBcnJheShzdHIuc3BsaXQoJycpLm1hcChmdW5jdGlvbihlKXtcbiAgICAgICAgLy8gIHJldHVybiBlLmNoYXJDb2RlQXQoMClcbiAgICAgICAgLy8gfSkpXG4gICAgfVxuXG5cbiAgICAvL3NvcnJ5IHRoaXMgaXMgdWdseSwgYW5kIHNvcnQgb2YgaGFyZCB0byB1bmRlcnN0YW5kIGV4YWN0bHkgd2h5IHRoaXMgd2FzIGRvbmVcbiAgICAvLyBhdCBhbGwgcmVhbGx5LCBidXQgdGhlIHJlYXNvbiBpcyB0aGF0IHRoZXJlJ3Mgc29tZSBjb2RlIGJlbG93IHRoYXQgaSBkb250IHJlYWxseVxuICAgIC8vIGZlZWwgbGlrZSB1bmRlcnN0YW5kaW5nLCBhbmQgdGhpcyBpcyBlYXNpZXIgdGhhbiB1c2luZyBteSBicmFpbi5cblxuICAgIGZ1bmN0aW9uIGJpdHNUb0J1ZmZlcihiaXRzKXtcbiAgICAgICAgdmFyIGRhdGEgPSBbXTtcbiAgICAgICAgdmFyIHBhZCA9IChiaXRzLmxlbmd0aCAlIDgpID8gKG5ldyBBcnJheSgxICsgOCAtIChiaXRzLmxlbmd0aCAlIDgpKSkuam9pbignMCcpIDogJyc7XG4gICAgICAgIGJpdHMgPSBwYWQgKyBiaXRzO1xuICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgYml0cy5sZW5ndGg7IGkrPSA4KXtcbiAgICAgICAgICAgIGRhdGEucHVzaChwYXJzZUludChiaXRzLnN1YnN0cihpLDgpLDIpKVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXcgVWludDhBcnJheShkYXRhKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZW5lcmF0ZUVCTUwoanNvbiwgb3V0cHV0QXNBcnJheSl7XG4gICAgICAgIHZhciBlYm1sID0gW107XG4gICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBqc29uLmxlbmd0aDsgaSsrKXtcbiAgICAgICAgICAgIHZhciBkYXRhID0ganNvbltpXS5kYXRhO1xuICAgICAgICAgICAgaWYodHlwZW9mIGRhdGEgPT0gJ29iamVjdCcpIGRhdGEgPSBnZW5lcmF0ZUVCTUwoZGF0YSwgb3V0cHV0QXNBcnJheSk7XG4gICAgICAgICAgICBpZih0eXBlb2YgZGF0YSA9PSAnbnVtYmVyJykgZGF0YSA9IGJpdHNUb0J1ZmZlcihkYXRhLnRvU3RyaW5nKDIpKTtcbiAgICAgICAgICAgIGlmKHR5cGVvZiBkYXRhID09ICdzdHJpbmcnKSBkYXRhID0gc3RyVG9CdWZmZXIoZGF0YSk7XG5cbiAgICAgICAgICAgIGlmKGRhdGEubGVuZ3RoKXtcbiAgICAgICAgICAgICAgICB2YXIgeiA9IHo7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBsZW4gPSBkYXRhLnNpemUgfHwgZGF0YS5ieXRlTGVuZ3RoIHx8IGRhdGEubGVuZ3RoO1xuICAgICAgICAgICAgdmFyIHplcm9lcyA9IE1hdGguY2VpbChNYXRoLmNlaWwoTWF0aC5sb2cobGVuKS9NYXRoLmxvZygyKSkvOCk7XG4gICAgICAgICAgICB2YXIgc2l6ZV9zdHIgPSBsZW4udG9TdHJpbmcoMik7XG4gICAgICAgICAgICB2YXIgcGFkZGVkID0gKG5ldyBBcnJheSgoemVyb2VzICogNyArIDcgKyAxKSAtIHNpemVfc3RyLmxlbmd0aCkpLmpvaW4oJzAnKSArIHNpemVfc3RyO1xuICAgICAgICAgICAgdmFyIHNpemUgPSAobmV3IEFycmF5KHplcm9lcykpLmpvaW4oJzAnKSArICcxJyArIHBhZGRlZDtcblxuICAgICAgICAgICAgLy9pIGFjdHVhbGx5IGRvbnQgcXVpdGUgdW5kZXJzdGFuZCB3aGF0IHdlbnQgb24gdXAgdGhlcmUsIHNvIEknbSBub3QgcmVhbGx5XG4gICAgICAgICAgICAvL2dvaW5nIHRvIGZpeCB0aGlzLCBpJ20gcHJvYmFibHkganVzdCBnb2luZyB0byB3cml0ZSBzb21lIGhhY2t5IHRoaW5nIHdoaWNoXG4gICAgICAgICAgICAvL2NvbnZlcnRzIHRoYXQgc3RyaW5nIGludG8gYSBidWZmZXItZXNxdWUgdGhpbmdcblxuICAgICAgICAgICAgZWJtbC5wdXNoKG51bVRvQnVmZmVyKGpzb25baV0uaWQpKTtcbiAgICAgICAgICAgIGVibWwucHVzaChiaXRzVG9CdWZmZXIoc2l6ZSkpO1xuICAgICAgICAgICAgZWJtbC5wdXNoKGRhdGEpXG5cblxuICAgICAgICB9XG5cbiAgICAgICAgLy9vdXRwdXQgYXMgYmxvYiBvciBieXRlQXJyYXlcbiAgICAgICAgaWYob3V0cHV0QXNBcnJheSl7XG4gICAgICAgICAgICAvL2NvbnZlcnQgZWJtbCB0byBhbiBhcnJheVxuICAgICAgICAgICAgdmFyIGJ1ZmZlciA9IHRvRmxhdEFycmF5KGVibWwpXG4gICAgICAgICAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyKTtcbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICByZXR1cm4gbmV3IEJsb2IoZWJtbCwge3R5cGU6IFwidmlkZW8vd2VibVwifSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiB0b0ZsYXRBcnJheShhcnIsIG91dEJ1ZmZlcil7XG4gICAgICAgIGlmKG91dEJ1ZmZlciA9PSBudWxsKXtcbiAgICAgICAgICAgIG91dEJ1ZmZlciA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBhcnIubGVuZ3RoOyBpKyspe1xuICAgICAgICAgICAgaWYodHlwZW9mIGFycltpXSA9PSAnb2JqZWN0Jyl7XG4gICAgICAgICAgICAgICAgLy9hbiBhcnJheVxuICAgICAgICAgICAgICAgIHRvRmxhdEFycmF5KGFycltpXSwgb3V0QnVmZmVyKVxuICAgICAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICAgICAgLy9hIHNpbXBsZSBlbGVtZW50XG4gICAgICAgICAgICAgICAgb3V0QnVmZmVyLnB1c2goYXJyW2ldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb3V0QnVmZmVyO1xuICAgIH1cblxuICAgIC8vd29vdCwgYSBmdW5jdGlvbiB0aGF0J3MgYWN0dWFsbHkgd3JpdHRlbiBmb3IgdGhpcyBwcm9qZWN0IVxuICAgIC8vdGhpcyBwYXJzZXMgc29tZSBqc29uIG1hcmt1cCBhbmQgbWFrZXMgaXQgaW50byB0aGF0IGJpbmFyeSBtYWdpY1xuICAgIC8vd2hpY2ggY2FuIHRoZW4gZ2V0IHNob3ZlZCBpbnRvIHRoZSBtYXRyb3NrYSBjb210YWluZXIgKHBlYWNlYWJseSlcblxuICAgIGZ1bmN0aW9uIG1ha2VTaW1wbGVCbG9jayhkYXRhKXtcbiAgICAgICAgdmFyIGZsYWdzID0gMDtcbiAgICAgICAgaWYgKGRhdGEua2V5ZnJhbWUpIGZsYWdzIHw9IDEyODtcbiAgICAgICAgaWYgKGRhdGEuaW52aXNpYmxlKSBmbGFncyB8PSA4O1xuICAgICAgICBpZiAoZGF0YS5sYWNpbmcpIGZsYWdzIHw9IChkYXRhLmxhY2luZyA8PCAxKTtcbiAgICAgICAgaWYgKGRhdGEuZGlzY2FyZGFibGUpIGZsYWdzIHw9IDE7XG4gICAgICAgIGlmIChkYXRhLnRyYWNrTnVtID4gMTI3KSB7XG4gICAgICAgICAgICB0aHJvdyBcIlRyYWNrTnVtYmVyID4gMTI3IG5vdCBzdXBwb3J0ZWRcIjtcbiAgICAgICAgfVxuICAgICAgICB2YXIgb3V0ID0gW2RhdGEudHJhY2tOdW0gfCAweDgwLCBkYXRhLnRpbWVjb2RlID4+IDgsIGRhdGEudGltZWNvZGUgJiAweGZmLCBmbGFnc10ubWFwKGZ1bmN0aW9uKGUpe1xuICAgICAgICAgICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUoZSlcbiAgICAgICAgfSkuam9pbignJykgKyBkYXRhLmZyYW1lO1xuXG4gICAgICAgIHJldHVybiBvdXQ7XG4gICAgfVxuXG4gICAgLy8gaGVyZSdzIHNvbWV0aGluZyBlbHNlIHRha2VuIHZlcmJhdGltIGZyb20gd2VwcHksIGF3ZXNvbWUgcml0ZT9cblxuICAgIGZ1bmN0aW9uIHBhcnNlV2ViUChyaWZmKXtcbiAgICAgICAgdmFyIFZQOCA9IHJpZmYuUklGRlswXS5XRUJQWzBdO1xuXG4gICAgICAgIHZhciBmcmFtZV9zdGFydCA9IFZQOC5pbmRleE9mKCdcXHg5ZFxceDAxXFx4MmEnKTsgLy9BIFZQOCBrZXlmcmFtZSBzdGFydHMgd2l0aCB0aGUgMHg5ZDAxMmEgaGVhZGVyXG4gICAgICAgIGZvcih2YXIgaSA9IDAsIGMgPSBbXTsgaSA8IDQ7IGkrKykgY1tpXSA9IFZQOC5jaGFyQ29kZUF0KGZyYW1lX3N0YXJ0ICsgMyArIGkpO1xuXG4gICAgICAgIHZhciB3aWR0aCwgaG9yaXpvbnRhbF9zY2FsZSwgaGVpZ2h0LCB2ZXJ0aWNhbF9zY2FsZSwgdG1wO1xuXG4gICAgICAgIC8vdGhlIGNvZGUgYmVsb3cgaXMgbGl0ZXJhbGx5IGNvcGllZCB2ZXJiYXRpbSBmcm9tIHRoZSBiaXRzdHJlYW0gc3BlY1xuICAgICAgICB0bXAgPSAoY1sxXSA8PCA4KSB8IGNbMF07XG4gICAgICAgIHdpZHRoID0gdG1wICYgMHgzRkZGO1xuICAgICAgICBob3Jpem9udGFsX3NjYWxlID0gdG1wID4+IDE0O1xuICAgICAgICB0bXAgPSAoY1szXSA8PCA4KSB8IGNbMl07XG4gICAgICAgIGhlaWdodCA9IHRtcCAmIDB4M0ZGRjtcbiAgICAgICAgdmVydGljYWxfc2NhbGUgPSB0bXAgPj4gMTQ7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB3aWR0aDogd2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IGhlaWdodCxcbiAgICAgICAgICAgIGRhdGE6IFZQOCxcbiAgICAgICAgICAgIHJpZmY6IHJpZmZcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGkgdGhpbmsgaSdtIGdvaW5nIG9mZiBvbiBhIHJpZmYgYnkgcHJldGVuZGluZyB0aGlzIGlzIHNvbWUga25vd25cbiAgICAvLyBpZGlvbSB3aGljaCBpJ20gbWFraW5nIGEgY2FzdWFsIGFuZCBicmlsbGlhbnQgcHVuIGFib3V0LCBidXQgc2luY2VcbiAgICAvLyBpIGNhbid0IGZpbmQgYW55dGhpbmcgb24gZ29vZ2xlIHdoaWNoIGNvbmZvcm1zIHRvIHRoaXMgaWRpb21hdGljXG4gICAgLy8gdXNhZ2UsIEknbSBhc3N1bWluZyB0aGlzIGlzIGp1c3QgYSBjb25zZXF1ZW5jZSBvZiBzb21lIHBzeWNob3RpY1xuICAgIC8vIGJyZWFrIHdoaWNoIG1ha2VzIG1lIG1ha2UgdXAgcHVucy4gd2VsbCwgZW5vdWdoIHJpZmYtcmFmZiAoYWhhIGFcbiAgICAvLyByZXNjdWUgb2Ygc29ydHMpLCB0aGlzIGZ1bmN0aW9uIHdhcyByaXBwZWQgd2hvbGVzYWxlIGZyb20gd2VwcHlcblxuICAgIGZ1bmN0aW9uIHBhcnNlUklGRihzdHJpbmcpe1xuICAgICAgICB2YXIgb2Zmc2V0ID0gMDtcbiAgICAgICAgdmFyIGNodW5rcyA9IHt9O1xuXG4gICAgICAgIHdoaWxlIChvZmZzZXQgPCBzdHJpbmcubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgaWQgPSBzdHJpbmcuc3Vic3RyKG9mZnNldCwgNCk7XG4gICAgICAgICAgICB2YXIgbGVuID0gcGFyc2VJbnQoc3RyaW5nLnN1YnN0cihvZmZzZXQgKyA0LCA0KS5zcGxpdCgnJykubWFwKGZ1bmN0aW9uKGkpe1xuICAgICAgICAgICAgICAgIHZhciB1bnBhZGRlZCA9IGkuY2hhckNvZGVBdCgwKS50b1N0cmluZygyKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gKG5ldyBBcnJheSg4IC0gdW5wYWRkZWQubGVuZ3RoICsgMSkpLmpvaW4oJzAnKSArIHVucGFkZGVkXG4gICAgICAgICAgICB9KS5qb2luKCcnKSwyKTtcbiAgICAgICAgICAgIHZhciBkYXRhID0gc3RyaW5nLnN1YnN0cihvZmZzZXQgKyA0ICsgNCwgbGVuKTtcbiAgICAgICAgICAgIG9mZnNldCArPSA0ICsgNCArIGxlbjtcbiAgICAgICAgICAgIGNodW5rc1tpZF0gPSBjaHVua3NbaWRdIHx8IFtdO1xuXG4gICAgICAgICAgICBpZiAoaWQgPT0gJ1JJRkYnIHx8IGlkID09ICdMSVNUJykge1xuICAgICAgICAgICAgICAgIGNodW5rc1tpZF0ucHVzaChwYXJzZVJJRkYoZGF0YSkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjaHVua3NbaWRdLnB1c2goZGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNodW5rcztcbiAgICB9XG5cbiAgICAvLyBoZXJlJ3MgYSBsaXR0bGUgdXRpbGl0eSBmdW5jdGlvbiB0aGF0IGFjdHMgYXMgYSB1dGlsaXR5IGZvciBvdGhlciBmdW5jdGlvbnNcbiAgICAvLyBiYXNpY2FsbHksIHRoZSBvbmx5IHB1cnBvc2UgaXMgZm9yIGVuY29kaW5nIFwiRHVyYXRpb25cIiwgd2hpY2ggaXMgZW5jb2RlZCBhc1xuICAgIC8vIGEgZG91YmxlIChjb25zaWRlcmFibHkgbW9yZSBkaWZmaWN1bHQgdG8gZW5jb2RlIHRoYW4gYW4gaW50ZWdlcilcbiAgICBmdW5jdGlvbiBkb3VibGVUb1N0cmluZyhudW0pe1xuICAgICAgICByZXR1cm4gW10uc2xpY2UuY2FsbChcbiAgICAgICAgICAgIG5ldyBVaW50OEFycmF5KFxuICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgbmV3IEZsb2F0NjRBcnJheShbbnVtXSkgLy9jcmVhdGUgYSBmbG9hdDY0IGFycmF5XG4gICAgICAgICAgICAgICAgKS5idWZmZXIpIC8vZXh0cmFjdCB0aGUgYXJyYXkgYnVmZmVyXG4gICAgICAgICAgICAsIDApIC8vIGNvbnZlcnQgdGhlIFVpbnQ4QXJyYXkgaW50byBhIHJlZ3VsYXIgYXJyYXlcbiAgICAgICAgICAgIC5tYXAoZnVuY3Rpb24oZSl7IC8vc2luY2UgaXQncyBhIHJlZ3VsYXIgYXJyYXksIHdlIGNhbiBub3cgdXNlIG1hcFxuICAgICAgICAgICAgICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKGUpIC8vIGVuY29kZSBhbGwgdGhlIGJ5dGVzIGluZGl2aWR1YWxseVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5yZXZlcnNlKCkgLy9jb3JyZWN0IHRoZSBieXRlIGVuZGlhbm5lc3MgKGFzc3VtZSBpdCdzIGxpdHRsZSBlbmRpYW4gZm9yIG5vdylcbiAgICAgICAgICAgIC5qb2luKCcnKSAvLyBqb2luIHRoZSBieXRlcyBpbiBob2x5IG1hdHJpbW9ueSBhcyBhIHN0cmluZ1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIFdoYW1teVZpZGVvKHNwZWVkLCBxdWFsaXR5KXsgLy8gYSBtb3JlIGFic3RyYWN0LWlzaCBBUElcbiAgICAgICAgdGhpcy5mcmFtZXMgPSBbXTtcbiAgICAgICAgdGhpcy5kdXJhdGlvbiA9IDEwMDAgLyBzcGVlZDtcbiAgICAgICAgdGhpcy5xdWFsaXR5ID0gcXVhbGl0eSB8fCAxO1xuICAgIH1cblxuICAgIFdoYW1teVZpZGVvLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbihmcmFtZSwgZHVyYXRpb24pe1xuICAgICAgICBpZih0eXBlb2YgZHVyYXRpb24gIT0gJ3VuZGVmaW5lZCcgJiYgdGhpcy5kdXJhdGlvbikgdGhyb3cgXCJ5b3UgY2FuJ3QgcGFzcyBhIGR1cmF0aW9uIGlmIHRoZSBmcHMgaXMgc2V0XCI7XG4gICAgICAgIGlmKHR5cGVvZiBkdXJhdGlvbiA9PSAndW5kZWZpbmVkJyAmJiAhdGhpcy5kdXJhdGlvbikgdGhyb3cgXCJpZiB5b3UgZG9uJ3QgaGF2ZSB0aGUgZnBzIHNldCwgeW91IG5lZCB0byBoYXZlIGR1cmF0aW9ucyBoZXJlLlwiXG4gICAgICAgIGlmKCdjYW52YXMnIGluIGZyYW1lKXsgLy9DYW52YXNSZW5kZXJpbmdDb250ZXh0MkRcbiAgICAgICAgICAgIGZyYW1lID0gZnJhbWUuY2FudmFzO1xuICAgICAgICB9XG4gICAgICAgIGlmKCd0b0RhdGFVUkwnIGluIGZyYW1lKXtcbiAgICAgICAgICAgIGZyYW1lID0gZnJhbWUudG9EYXRhVVJMKCdpbWFnZS93ZWJwJywgdGhpcy5xdWFsaXR5KVxuICAgICAgICB9ZWxzZSBpZih0eXBlb2YgZnJhbWUgIT0gXCJzdHJpbmdcIil7XG4gICAgICAgICAgICB0aHJvdyBcImZyYW1lIG11c3QgYmUgYSBhIEhUTUxDYW52YXNFbGVtZW50LCBhIENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRCBvciBhIERhdGFVUkkgZm9ybWF0dGVkIHN0cmluZ1wiXG4gICAgICAgIH1cbiAgICAgICAgaWYgKCEoL15kYXRhOmltYWdlXFwvd2VicDtiYXNlNjQsL2lnKS50ZXN0KGZyYW1lKSkge1xuICAgICAgICAgICAgdGhyb3cgXCJJbnB1dCBtdXN0IGJlIGZvcm1hdHRlZCBwcm9wZXJseSBhcyBhIGJhc2U2NCBlbmNvZGVkIERhdGFVUkkgb2YgdHlwZSBpbWFnZS93ZWJwXCI7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5mcmFtZXMucHVzaCh7XG4gICAgICAgICAgICBpbWFnZTogZnJhbWUsXG4gICAgICAgICAgICBkdXJhdGlvbjogZHVyYXRpb24gfHwgdGhpcy5kdXJhdGlvblxuICAgICAgICB9KVxuICAgIH1cblxuICAgIFdoYW1teVZpZGVvLnByb3RvdHlwZS5jb21waWxlID0gZnVuY3Rpb24ob3V0cHV0QXNBcnJheSl7XG4gICAgICAgIHJldHVybiBuZXcgdG9XZWJNKHRoaXMuZnJhbWVzLm1hcChmdW5jdGlvbihmcmFtZSl7XG4gICAgICAgICAgICB2YXIgd2VicCA9IHBhcnNlV2ViUChwYXJzZVJJRkYoYXRvYihmcmFtZS5pbWFnZS5zbGljZSgyMykpKSk7XG4gICAgICAgICAgICB3ZWJwLmR1cmF0aW9uID0gZnJhbWUuZHVyYXRpb247XG4gICAgICAgICAgICByZXR1cm4gd2VicDtcbiAgICAgICAgfSksIG91dHB1dEFzQXJyYXkpXG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgVmlkZW86IFdoYW1teVZpZGVvLFxuICAgICAgICBmcm9tSW1hZ2VBcnJheTogZnVuY3Rpb24oaW1hZ2VzLCBmcHMsIG91dHB1dEFzQXJyYXkpe1xuICAgICAgICAgICAgcmV0dXJuIHRvV2ViTShpbWFnZXMubWFwKGZ1bmN0aW9uKGltYWdlKXtcbiAgICAgICAgICAgICAgICB2YXIgd2VicCA9IHBhcnNlV2ViUChwYXJzZVJJRkYoYXRvYihpbWFnZS5zbGljZSgyMykpKSlcbiAgICAgICAgICAgICAgICB3ZWJwLmR1cmF0aW9uID0gMTAwMCAvIGZwcztcbiAgICAgICAgICAgICAgICByZXR1cm4gd2VicDtcbiAgICAgICAgICAgIH0pLCBvdXRwdXRBc0FycmF5KVxuICAgICAgICB9LFxuICAgICAgICB0b1dlYk06IHRvV2ViTVxuICAgICAgICAvLyBleHBvc2UgbWV0aG9kcyBvZiBtYWRuZXNzXG4gICAgfVxufSkoKVxuXG47IGJyb3dzZXJpZnlfc2hpbV9fZGVmaW5lX19tb2R1bGVfX2V4cG9ydF9fKHR5cGVvZiBXaGFtbXkgIT0gXCJ1bmRlZmluZWRcIiA/IFdoYW1teSA6IHdpbmRvdy5XaGFtbXkpO1xuXG59KS5jYWxsKGdsb2JhbCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgZnVuY3Rpb24gZGVmaW5lRXhwb3J0KGV4KSB7IG1vZHVsZS5leHBvcnRzID0gZXg7IH0pO1xuXG59KS5jYWxsKHRoaXMsdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KSJdfQ==
