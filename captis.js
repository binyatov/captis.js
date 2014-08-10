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
