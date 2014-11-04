exports.initializeEditor = function() {
    event.stopPropagation();
    document.getElementById('captis').innerHTML += (
        '<div id="captis_editor"> \
            <div id="loading"><progress id="loading_segments" max="10" value="5"></progress></div> \
            <video id="edit_video" preload></video> \
            <div id="captis_editor_segments"></div> \
        </div>'
    );
}
