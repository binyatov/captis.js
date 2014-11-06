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
        canvas.width = 120;
        canvas.height = 120;
    parts.innerHTML = '';
    video.src = window.videoURL;
    loader.setAttribute('max', window.segments.length - 1);
    video.onloadedmetadata = function () {
        var i = 0;
        var loop = setInterval(function() {
            //console.log(window.segments[i]);
            parts.innerHTML += (
                '<div class="segment_box" id="segment_'+ i +'"> \
                    <i class="segment_time" id="time_'+ i +'">00:00:00</i> \
                </div>'
            );
            video.currentTime = window.segments[i].timestamp;
            ctx.drawImage(video, 0, 0, 120, 120);
            var image = canvas.toDataURL(),
                box = document.getElementById('segment_' + i),
                segmentDuration = document.getElementById('time_' + i);
            //console.log(image);
            box.style.backgroundImage = 'url(' + image + ')';
            segmentDuration.innerHTML = window.formatDuration(window.segments[i].timestamp);
            loader.value = i;
            i++;
            if (i == window.segments.length) {
                //parts.style.height = 120 * window.segments.length + 'px';
                container.style.width = '120px';
                loading.style.display = 'none';
                video.style.display = 'block';
                video.pause();
                video.currentTime = 0;
                clearInterval(loop);
            };
        }, 100);
    };
}

exports.initializeEditor = initializeEditor;
