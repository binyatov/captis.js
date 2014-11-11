## About

Captis.js is an authoring tool for publishing impress.js slides using video commentary. With captis you can record and edit your videos using browser.

**Currently project is fully functional only in webkit specific browsers.**

## Getting Started

1. Install captis front end package using bower through terminal:

        bower install captis

2. Then install captis server using npm:

        npm install captis

3. Drag and drop your impress.js slides inside the root directory and add this lines beetwen head tags:

        <script src="bower_components/captis/dist/captis.min.js"></script>
        <link rel="stylesheet" type="text/css" href="bower_components/captis/css/captis.css">
        <link rel="stylesheet" type="text/css" href="bower_components/captis/libs/fontawesome/css/font-awesome.min.css">

4. Using browser, go to `http://localhost:3000/<html file>` and you'll see your slide.

## Controls

1. To open and close the captis toolbar hit:

        ctr + e

2. To open and close the video hit:

        ctr + w

## License

Ruby on Rails is released under the [MIT License](http://www.opensource.org/licenses/MIT).
