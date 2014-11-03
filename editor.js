exports.initializeEditor = function() {
    event.stopPropagation();
    document.getElementById('captis').innerHTML += (
        '<div id="captis_editor"> \
            <video id="edit_video" preload></video> \
            <div id="captis_editor_segments"> \
            </div> \
        </div>'
    );
}
