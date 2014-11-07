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
