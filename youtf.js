var cp = require('child_process');
var fs = require('fs');
var watch = require('watch');
var path = require('path');
var Bitmap = require('node-bitmap');
var ansi = require('ansi')
var program = require('commander');

program
    .version('1')
    .option('-i, --input [value]', 'An input video file')
    .option('-l, --location [value]', 'An input directory with numbered still images')
    .option('-w, --webcam', 'Use webcam as input')
    .option('-x, --xwidth <n>', 'Width?',100)
    .option('-s, --screen', 'Use screen as input')
    .option('-f, --framerate <n>', 'The framerate', 4)
    .option('-w, --white', 'Is it white?')
    .option('-C, --chars [value]','A string of chars, from black to white')
    .option('-d, --dontclear', 'Don\'t clear terminal')
    .option('-r, --repeat <n>', 'Repeat the animation n times', 1)
    .option('-o, --output [value]', 'An output video file')
    .parse(process.argv);




var
    framerate = program.framerate || 10,
    start = Date.now(),
    first = true,
    width,
    height,
    pixels,
    q = [],
    index = 0,
    touched = [],
    totalFrames,
    loops = 0,
    charmap=[],
    bgcolor = program.white ? 'white' : 'black',
    chars = (program.chars || '$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/|()1{}[]?-_+~<>i!lI;:,"^`\'. ').split(''),
    brightnessResolution=256,
    hueGroups=8,
    repetitions = chars.length / brightnessResolution,
    stream,
    cursor = ansi(stream = process.stdout),
    lastColor,
    location = program.location || ('./.frames-' + Date.now());

if (!program.white) {
    chars = chars.reverse();
}
if (!program.location) {
    try {
        fs.mkdirSync(location);    
    } catch (e) {

    }
    
}

reset();
cursor['red']().bg[bgcolor]();




watch.createMonitor(location, function(monitor) {

    if (program.location) {
        var n = 0;
        for (var k in monitor.files) {
            if (monitor.files[k].isFile()) {
                n++;
                onFile(k)
            }
        }

        totalFrames = n;
    } else {

        monitor.on('created', onFile)
    }

});



if (program.screen || program.webcam || program.input) {

    var args = ['-vf', 'fps=' + framerate + ',scale=' + program.xwidth + ':-1', path.join(location, '%05d.bmp')];
    if (program.webcam || program.screen) {
        args.unshift('-f', 'avfoundation', '-i', '"' + (program.screen ? 1:0) +':0"');
    } else {
        args.unshift('-i', program.input);
    }
    var cmd = 'ffmpeg ' + args.join(' ');
    var ff = cp.exec(cmd);
}

process.on('uncaughtException', errout);
process.on('SIGINT', cleanExit); // catch ctrl-c
process.on('SIGTERM', cleanExit); // catch kill
process.on('exit', function() {
    ff && ff.kill();
});



setInterval(draw, 1000 / framerate);
















function onFile(f) {

    var index = parseInt(path.basename(f), '.bmp') - 1;

    if (touched[index])
        return;

    touched[index] = true;
    // cp.exec('convert',[f,'-colors','255',f + '.cv'],function(err){
    // errout(err)
    fs.readFile(f, function(err, data) {

            errout(err)
            var bmp = new Bitmap(data);
            try {
                bmp.init();
            } catch (e) {
                return;
            }
            bmp.noPallette = true;
            if (!bmp.isBitmap())
                throw new Error('not bmp');
            var bmpData = bmp.getData();
            if (first) {
                width = bmp.getWidth();
                height = bmp.getHeight();
                pixels = width * height;
                first = false;
            }

            convert(bmpData, index)
                // updateRate();
        })
        // fs.unlink(f,errout);
        // fs.unlink(f + '.cv');
        // })

}

function errout(err) {
    if (err) {
        cursor.red().write('uh oh');
        throw err;
        cleanExit();
    }

}

function convert(data, index) {
    var converted = [];
    var pos = 0;
    for (var i = 0; i < data.length; i++) {

        converted[i] = data[i].map(convertCharacter);
    }

    q[index] = converted;
    return converted

}

function convertCharacter(rgb) {
    var hsv = rgb2hsv(rgb);
    

    var sv = Math.round(hsv.v * brightnessResolution);
    var hue = Math.round(hsv.h * hueGroups);
    var cmap = charmap[hue] = charmap[hue] || []
    var char = cmap[sv] = cmap[sv] || pickChar(sv);

    return {
        color: rgb,
        char: char,
    }
}




function pickChar(sv) {
    var v = Math.round(sv * repetitions);

    var index = Math.min(chars.length - 1, Math.max(0, v));
    
    return chars[index];
}



function draw() {
    if (data = q[index]) {
        reset();

        for (var i = 0; i < data.length; i++) {

            var chunk = data[i];
            var temp = [];
            for (var j = 0; j < chunk.length; j++) {
                var c = chunk[j];

                if (c.color != lastColor) {

                    temp.map(write)
                    temp = [];
                    lastColor = c.color
                    cursor.rgb(lastColor.r, lastColor.g, lastColor.b)
                }
                temp.push(c.char);
            }
            temp.push('\n');
            temp.map(write)
        }

        delete q[index];
        index++;
    }
    if (totalFrames && index == totalFrames) {
        index = 0;
        loops++
        if (program.repeat != 0 && loops >= program.repeat) {
            cleanExit();
        }
    }
}




function reset() {
    if (program.dontclear) {
        stream.write(encode('[0m'));
        stream.write(encode('[2J'));
        stream.write(encode('c'));
    } else {
        stream.write(encode('[2J'));
        stream.write(encode('[3J'));
    }
    cursor.goto(0, 0);
}

function write(c) {
    
    cursor.write(c);
}

function encode(xs) {
    function bytes(s) {
        if (typeof s === 'string') {
            return s.split('').map(ord);
        } else if (Array.isArray(s)) {
            return s.reduce(function(acc, c) {
                return acc.concat(bytes(c));
            }, []);
        }
    }

    return new Buffer([0x1b].concat(bytes(xs)));
}

function ord(c) {
    return c.charCodeAt(0)
}

function rgb2hsv(rgb) {

    var b, diff, g, h, max, min, r, s, v;
    r = rgb.r
    g = rgb.g
    b = rgb.b


    max = Math.max(r, g, b);
    min = Math.min(r, g, b);
    diff = max - min;
    if (r === max) {
        h = 60 * (g - b) / diff;
    } else if (g === max) {
        h = 60 * (b - r) / diff + 120;
    } else {
        h = 60 * (r - g) / diff + 240;
    }
    if (h < 0) h += 360;
    s = diff / max;
    v = max / 255;
    return {
        h: h,
        s: s,
        v: v
    };
};

function cleanExit() {
    ff && ff.kill();
    delete ff;
    cursor.red();
    cursor.write('bye!');
    process.exit();
};
