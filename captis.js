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

function initializeToolbar (e) {
    if (e.ctrlKey && e.keyCode == 69) {
        document.body.innerHTML += (
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
        var close = document.getElementById('switch');
        document.removeEventListener('keyup', initializeToolbar, false);
        document.addEventListener('keyup', closeToolbar, false);
        close.addEventListener('click', closeToolbar, false);
    }
}

function closeToolbar (e) {
    if ((e.ctrlKey && e.keyCode == 69) || e.target.id == 'switch') {
        var toolbar = document.getElementById('toolbar'),
            close = document.getElementById('switch');
        close.removeEventListener('click', closeToolbar, false);
        toolbar.outerHTML = '';
        document.removeEventListener('keyup', closeToolbar, false);
        document.addEventListener('keyup', initializeToolbar, false);
    }
}

function mediaStream () {
    if (navigator.getUserMedia) {
        navigator.getUserMedia (
            {
                video: true,
                audio: true
            },
            function (localMediaStream) {
                var video = document.getElementById('video');
                var blob = window.URL.createObjectURL(localMediaStream);
                console.log(blob);
                video.src = blob;
            },
            function (err) {
                console.log(err);
            }
        );
    } else {
        console.log("getUserMedia not supported");
    }
}

document.addEventListener('keyup', initializeToolbar, false);
