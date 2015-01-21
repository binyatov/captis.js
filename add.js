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
