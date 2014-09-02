var http = require('http'),
    url = require('url'),
    path = require('path'),
    fs = require('fs'),
    formidable = require('./libs/formidable');
    util = require('util'),
    slave = require('child_process'),
    exec = slave.exec,
    routes = [];


function mergeCallback(error, stdout, stderr) {
    stdout ? util.print('stdout: ' + stdout) : null;
    stderr ? util.print('stderr: ' + stderr) : null;
    error ? console.log('exec error: ' + error) : null;
}


var merge = function  (request, response) {
    var form = new formidable.IncomingForm();
    form.uploadDir = __dirname + '/workspace';
    form.on('file', function (field, file) {
        fs.rename(file.path, form.uploadDir + "/" + file.name);
    });
    form.on('end', function () {
        exec('ffmpeg -i '+ form.uploadDir +'/video.webm -i '+ form.uploadDir +'/audio.wav -map 0:0 -map 1:0 '+ form.uploadDir +'/captis.webm', mergeCallback);
        response.writeHead(200);
        response.end();
    });
    form.parse(request, function (error, fields, files) {
        console.log('uploading...');
    });
}


var serveHTTP = function  (request, response) {
    var uri = url.parse(request.url).pathname,
        filename = path.join(process.cwd(), uri),
        captisFile = uri.split('/');
    if ((captisFile[captisFile.length - 1]) == 'captis.webm') {
        var readStream = fs.createReadStream(filename);
        readStream.on('open', function () {
            readStream.pipe(response);
        });
        readStream.on('error', function () {
            response.writeHead(404, {'Content-Type': 'text/plain'});
            response.write('Not Found');
            response.end();
        });
    } else {
        path.exists(filename, function (exists) {
            if (!exists) {
                response.writeHead(404, {'Content-Type': 'text/plain'});
                response.write('Not Found');
                response.end();
                return;
            }
            if (fs.statSync(filename).isDirectory()) filename += '/index.html';
            fs.readFile(filename, 'binary', function (error, file) {
                if (error) {
                    response.writeHead(500, {'Content-Type': 'text/plain'});
                    response.write(error);
                    response.end();
                    return;
                }
                response.writeHead(200);
                response.write(file, 'binary');
                response.end();
            });
        });
    }
}


//Routes
routes['/merge'] = merge;

function onRequest (request, response) {
    var path_name = url.parse(request.url).pathname;
    if (typeof routes[path_name] === 'function') {
        routes[path_name](request, response);
    } else{
        serveHTTP(request, response);
    }
}

http.createServer(onRequest).listen(3000);
