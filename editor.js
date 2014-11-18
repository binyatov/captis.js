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
