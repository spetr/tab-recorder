'use strict';

var recorder;
var isRecording = false;

var audioBitsPerSecond = 128000;
var videoBitsPerSecond = 2610000;
var videoCodec = 'H264'; // Default, VP8, VP9, H264, AV1,

// used by RecordRTC
var isChrome = true;

// used by RecordRTC
function isMediaRecorderCompatible() {
    return true;
}

function bytesToSize(bytes) {
    var k = 1000;
    var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) {
        return '0 Bytes';
    }
    var i = parseInt(Math.floor(Math.log(bytes) / Math.log(k)), 10);
    return (bytes / Math.pow(k, i)).toPrecision(3) + ' ' + sizes[i];
}

var Storage = {};

if (typeof AudioContext !== 'undefined') {
    Storage.AudioContext = AudioContext;
} else if (typeof webkitAudioContext !== 'undefined') {
    Storage.AudioContext = webkitAudioContext;
}

MediaStream.prototype.stop = function() {
    this.getTracks().forEach(function(track) {
        track.stop();
    });
};

function getRandomString() {
    if (window.crypto && window.crypto.getRandomValues && navigator.userAgent.indexOf('Safari') === -1) {
        var a = window.crypto.getRandomValues(new Uint32Array(3)),
            token = '';
        for (var i = 0, l = a.length; i < l; i++) {
            token += a[i].toString(36);
        }
        return token;
    } else {
        return (Math.random() * new Date().getTime()).toString(36).replace(/\./g, '');
    }
}

function getFileName(fileExtension) {
    var d = new Date();
    var year = d.getUTCFullYear() + '';
    var month = d.getUTCMonth() + '';
    var date = d.getUTCDate() + '';

    if(month.length === 1) {
        month = '0' + month;
    }

    if(date.length === 1) {
        date = '0' + date;
    }
    return year + '-' + month + '-' + date + '-' + getRandomString() + '.' + fileExtension;
}

function addStreamStopListener(stream, callback) {
    var streamEndedEvent = 'ended';
    if ('oninactive' in stream && !('onended' in stream)) {
        streamEndedEvent = 'inactive';
    }
    stream.addEventListener(streamEndedEvent, function() {
        callback();
        callback = function() {};
    });
    getTracks(stream, 'audio').forEach(function(track) {
        track.addEventListener(streamEndedEvent, function() {
            callback();
            callback = function() {};
        });
    });
    getTracks(stream, 'video').forEach(function(track) {
        track.addEventListener(streamEndedEvent, function() {
            callback();
            callback = function() {};
        });
    });
}

function getTracks(stream, kind) {
    if (!stream || !stream.getTracks) {
        return [];
    }

    return stream.getTracks().filter(function(t) {
        return t.kind === (kind || 'audio');
    });
}

