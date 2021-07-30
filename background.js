'use strict';

let runtimePort;

// Listen external commands (startRecord / stopRecord)
chrome.runtime.onConnect.addListener(function (port) {
    runtimePort = port;
    runtimePort.onMessage.addListener(function (message, s, senderResponse) {
        if (!message) {
            return;
        }
        switch (message.action) {
            case "startRecord":
                startScreenRecording();
                break;
            case "stopRecord":
                stopScreenRecording();
                break;
            case "pauseRecord":
                pauseScreenRecording();
                break;
            case "resumeRecord":
                resumeScreenRecording();
                break;
            case "preview":
                openPreviewPage();
                break;
            default:
                console.log(`unknown action ${request.action}`);
        }
    })
});

// Start recording (current tab)
function startScreenRecording() {
    var constraints = {
        audio: true,
        video: true,
        audioConstraints: {
            mandatory: {
                echoCancellation: false
            }
        },
        videoConstraints: {
            mandatory: {
                chromeMediaSource: 'tab',
                minWidth: 16,
                minHeight: 9,
                maxWidth: 1920,
                maxHeight: 1080,
                maxFrameRate: 25,
            }
        }
    };
    chrome.tabCapture.capture(constraints, function (stream) {
        var newStream = new MediaStream();
        stream.getTracks().forEach(function (track) {
            newStream.addTrack(track);
        });

        var options = {
            type: 'video',
            disableLogs: false,
            ignoreMutedMedia: false,
            audioBitsPerSecond: audioBitsPerSecond,
            videoBitsPerSecond: videoBitsPerSecond,
        };

        switch (videoCodec) {
            case 'VP8':
                options.mimeType = 'video/webm\;codecs=vp8';
                break;
            case 'VP9':
                options.mimeType = 'video/webm\;codecs=vp9';
                break;
            case 'H264':
                options.mimeType = 'video/x-matroska\;codecs=h264';
                break;
            case 'AVC1':
                options.mimeType = 'video/x-matroska\;codecs=avc1';
                break;
            default:
                console.log("Unknown video codec");
                return;
        }

        recorder = new MediaStreamRecorder(newStream, options);
        recorder.streams = [newStream];
        recorder.record();
        isRecording = true;

        addStreamStopListener(recorder.streams[0], function () {
            stopScreenRecording();
        });

        initialTime = Date.now()
        timer = setInterval(checkTime, 100);
    });
}

function pauseScreenRecording() {
    if (!recorder || !isRecording) return;
    recorder.pause()
}

function resumeScreenRecording() {
    if (!recorder || !isRecording) return;
    recorder.resume()
}

// Stop recording
function stopScreenRecording() {
    if (!recorder || !isRecording) return;
    if (timer) {
        clearTimeout(timer);
    }
    setBadgeText('');
    isRecording = false;
    recorder.stop(function onStopRecording(blob) {
        var mimeType = '';
        var fileExtension = '';
        switch (videoCodec) {
            case 'VP8':
            case 'VP9':
                mimeType = 'video/webm';
                fileExtension = 'webm'
                break;
            case 'H264':
            case 'AVC1':
                mimeType = 'video/x-matroska';
                fileExtension = 'mkv';
                break;
            default:
                console.log("Unknown video codec");
                return;
        }
        var file = new File([recorder ? recorder.blob : ''], getFileName(fileExtension), {
            type: mimeType
        });
        localStorage.setItem('selected-file', file.name);
        DiskStorage.StoreFile(file, function (response) {
            try {
                videoPlayers.forEach(function (player) {
                    player.srcObject = null;
                });
                videoPlayers = [];
            } catch (e) {}
            if (recorder && recorder.streams) {
                recorder.streams.forEach(function (stream, idx) {
                    stream.getTracks().forEach(function (track) {
                        track.stop();
                    });

                    if (idx == 0 && typeof stream.onended === 'function') {
                        stream.onended();
                    }
                });
                recorder.streams = null;
            }
            isRecording = false;
            setBadgeText('');
            openPreviewPage()
        });
    });
}

function convertTime(miliseconds) {
    var totalSeconds = Math.floor(miliseconds / 1000);
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds - minutes * 60;
    minutes += '';
    seconds += '';
    if (seconds.length === 1) {
        seconds = '0' + seconds;
    }
    return minutes + ':' + seconds;
}

var initialTime, timer;

function checkTime() {
    if (!initialTime || !isRecording) return;
    var timeDifference = Date.now() - initialTime;
    var formatted = convertTime(timeDifference);
    setBadgeText(formatted);
}

function setBadgeText(text) {
    chrome.browserAction.setBadgeBackgroundColor({
        color: [255, 0, 0, 255]
    });
    chrome.browserAction.setBadgeText({
        text: text + ''
    });
}

function openPreviewPage() {
    chrome.tabs.query({}, function (tabs) {
        var url = 'chrome-extension://' + chrome.runtime.id + '/preview.html';
        for (var i = tabs.length - 1; i >= 0; i--) {
            if (tabs[i].url === url) {
                chrome.tabs.update(tabs[i].id, {
                    active: true,
                    url: url
                });
                return;
            }
        }
        chrome.tabs.create({
            url: 'preview.html'
        });
    });
};