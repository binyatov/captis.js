var bindSegment = null;

var createSlideSegments = function () {
    event.stopPropagation();
    document.getElementById('captis').innerHTML += (
        '<div id="captis_add"> \
        <video id="add_video" preload controls></video> \
        <div id="segment_cont"><div id="captis_editor_segments"></div></div> \
        </div>'
    );
    var video = document.getElementById('edit_video'),
        parts = document.getElementById('captis_editor_segments'),
        container = document.getElementById('segment_cont'),
        data = {},
        steps = document.getElementsByClassName('step');
    bindSegment = document.getElementById('bind');
    bindSegment.style.opacity = '1.0';
    parts.innerHTML = '';
    for (var i = 0; i < steps.length; i++) {
        parts.innerHTML += '<div class="impress_step" id="step_'+ steps[i].id +'">step: '+ steps[i].id +'</div>';
        var subs = steps[i].getElementsByClassName('substep');
        if (subs.length > 0) {
            for (var j = 0; j < subs.length; j++) {
                parts.innerHTML += '<div class="impress_step" id="step_'+ steps[i].id +'_sub_'+ (j + 1) +'">step: '+ steps[i].id +', substep: '+ (j + 1) +'</div>';
            }
        }
    }
    container.style.width = '250px';
    document.addEventListener('click', selectSegment, false);
    loadVideo();
}
var past = null;
var selectSegment = function (e) {
    var slide = e.target.id.split('_');
    if (slide[0] == 'step') {
        if (past != null) { past.style.color = '#D5DBD9'; }
        e.target.style.color = '#13AD87';
        bindSegment.style.color = '#13AD87';
        past = e.target;
        if (slide[2]) {
            impress().goto(slide[1]);
            for (var i = 0; i < 20; i++) {
                impress().prev();
            }
            impress().goto(slide[1]);
            for (var i = 0; i < slide[3]; i++) {
                impress().next();
            }
        } else {
            impress().goto(slide[1]);
            for (var i = 0; i < 20; i++) {
                impress().prev();
            }
            impress().goto(slide[1]);
        }
    }
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

exports.createSlideSegments = createSlideSegments;
