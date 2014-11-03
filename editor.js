exports.initializeEditor = function() {
    event.stopPropagation();
    document.getElementById('captis').innerHTML += (
        '<div id="captis_editor"> \
            <div id="loading"></div> \
            <video id="edit_video" preload></video> \
            <div id="captis_editor_segments"></div> \
        </div>'
    );
    document.body.className += ' blur';
}
