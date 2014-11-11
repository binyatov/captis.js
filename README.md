## About

Captis.js is an authoring tool for publishing impress.js slides using video commentary. With captis you can record and edit your videos using browser.

**Currently the project is fully functional only in webkit browsers.**

## Prerequisites
The server part has only be tested in `OS X`.
`ffmpeg` is needed to 'stitch' the audio and video files together. For a reading on the problem and how to install ffmpeg have a look here: [http://stackoverflow.com/questions/20263131/merge-wav-audio-and-webm-video](http://stackoverflow.com/questions/20263131/merge-wav-audio-and-webm-video)


## Getting Started
Captis has a client-side and a server-side component

1. To install the client-side through bower:

        bower install captis

2. To install the server-side using npm:

        npm install captis

3. Drag and drop your impress.js slides inside the root directory and add this lines between head tags:

        <script src="bower_components/captis/dist/captis.min.js"></script>
        <link rel="stylesheet" type="text/css" href="bower_components/captis/css/captis.css">
        <link rel="stylesheet" type="text/css" href="bower_components/captis/libs/fontawesome/css/font-awesome.min.css">

4. Using browser, go to `http://localhost:3000/<html file>` and you'll see your slide.

## Using captis
Captis features a toolbar with all the necessary controls.

1. To open and close the captis toolbar hit:

        ctr + e

2. Once the toolbar is open you need to click the camera icon to allow the use of the camera and microphone.
3. Clicking the `REC` button allows you to start recording
4. Clicking the `Save` button stops the recording. __NOTE__: When you click stop, the audio and video streams are going to be merged (server-side) into one file which will be injected to your presentation.

##Playback
1. Refresh your presentation.
2. To open and close the video hit:

        ctr + w

## License

Captis.js is released under the [MIT License](http://www.opensource.org/licenses/MIT).
