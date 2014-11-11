var http = require('http'),
    url = require('url'),
    path = require('path'),
    fs = require('fs'),
    formidable = require('./libs/formidable');
    util = require('util'),
    slave = require('child_process'),
    exec = slave.exec,
    routes = [],
    dir = __dirname + '/media';

exec('mkdir media', serverLog);

function serverLog(error, stdout, stderr) {
    stdout ? util.print('stdout: ' + stdout) : null;
    stderr ? util.print('stderr: ' + stderr) : null;
    error ? console.log('exec error: ' + error) : null;
}

function mergeCallback(error, stdout, stderr) {
    serverLog(error, stdout, stderr);
    removeTracks();
}

function cutStartCallback(error, stdout, stderr) {
    serverLog(error, stdout, stderr);
}

function concatCallback(error, stdout, stderr) {
    serverLog(error, stdout, stderr);
    removeParts();
}

function cutEndCallback(error, stdout, stderr) {
    serverLog(error, stdout, stderr);
    fs.unlink(dir + '/captis.webm', function (err) {
        if (err) throw err;
        console.log('video track deleted');
        fs.rename(dir + '/captis_new.json', dir + '/captis.json');
        exec('ffmpeg -f concat -i '+dir+'/list.txt -c copy '+dir+'/captis.webm', concatCallback);
    });
}

function updateCallback(error, stdout, stderr) {
    serverLog(error, stdout, stderr);
    removeTracks();
    removeData();
    fs.readFile(dir + '/captis_new.json', 'utf8', function (err, data) {
        if (err) throw err;
        var obj = JSON.parse(data);
        console.log(obj.update, obj.duration);
        exec('ffmpeg -i '+ dir +'/captis.webm -ss 00:00:00 -to ' + obj.update[0] +' -async 1 '+ dir +'/start.webm', cutStartCallback);
        exec('ffmpeg -i '+ dir +'/captis.webm -ss '+ obj.update[1] +' -to ' + obj.duration +' -async 1 '+ dir +'/end.webm', cutEndCallback);
    });
}

function removeTracks () {
    fs.unlink(dir + '/video.webm', function (err) {
        if (err) throw err;
        console.log('video track deleted');
    });
    fs.unlink(dir + '/audio.wav', function (err) {
        if (err) throw err;
        console.log('audio track deleted');
    });
}

function removeParts () {
    fs.unlink(dir + '/start.webm', function (err) {
        if (err) throw err;
        console.log('start track deleted');
    });
    fs.unlink(dir + '/new.webm', function (err) {
        if (err) throw err;
        console.log('new track deleted');
    });
    fs.unlink(dir + '/end.webm', function (err) {
        if (err) throw err;
        console.log('end track deleted');
    });
}

function removeData () {
    fs.unlink(dir + '/captis.json', function (err) {
        if (err) throw err;
        console.log('video track deleted');
    });
}

var merge = function  (request, response) {
    var form = new formidable.IncomingForm();
    form.uploadDir = dir;
    form.on('file', function (field, file) {
        fs.rename(file.path, form.uploadDir + "/" + file.name);
    });
    form.on('end', function () {
        console.log('merging');
        exec('ffmpeg -i '+ form.uploadDir +'/video.webm -i '+ form.uploadDir +'/audio.wav -map 0:0 -map 1:0 '+ form.uploadDir +'/captis.webm', mergeCallback);
        response.writeHead(200);
        response.end();
    });
    form.parse(request, function (error, fields, files) {
        console.log('uploading...');
    });
}

var update = function  (request, response) {
    var form = new formidable.IncomingForm();
    form.uploadDir = dir;
    form.on('file', function (field, file) {
        fs.rename(file.path, form.uploadDir + "/" + file.name);
    });
    form.on('end', function () {
        exec('ffmpeg -i '+ form.uploadDir +'/video.webm -i '+ form.uploadDir +'/audio.wav -map 0:0 -map 1:0 '+ form.uploadDir +'/new.webm', updateCallback);
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
            response.writeHead(204, {'Content-Type': 'text/plain'});
            response.write('Not Found');
            response.end();
        });
    } else {
        path.exists(filename, function (exists) {
            if (!exists) {
                response.writeHead(204, {'Content-Type': 'text/plain'});
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
routes['/update'] = update;

function onRequest (request, response) {
    var path_name = url.parse(request.url).pathname;
    if (typeof routes[path_name] === 'function') {
        routes[path_name](request, response);
    } else{
        serveHTTP(request, response);
    }
}

http.createServer(onRequest).listen(3000);
