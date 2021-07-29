chrome.storage.sync.set({
    isRecording: 'false' // FALSE
});

// chrome.browserAction.setIcon({
//     path: 'images/icon.png'
// });

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
                console.log(`start record!`);
                startScreenRecording();
                break;
            case "stopRecord":
                console.log(`stop record!`)
                stopScreenRecording();
                break;
            default:
                console.log(`unknown action ${request.action}`);
        }
    })
});

function gotStream(stream) {
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
        case 'VP8':
            options.mimeType = 'video/webm\;codecs=vp9';
            break;
        case 'H264':
            options.mimeType = 'video/webm\;codecs=h264';
            break;
        case 'AV1':
            options.mimeType = 'video/x-matroska;codecs=avc1';
            break;
        default:
            console.log("Unknown video codec");
            return;
    }

    recorder = new MediaStreamRecorder(stream, options);
    recorder.streams = [stream];
    recorder.record();
    isRecording = true;

    onRecording();

    addStreamStopListener(recorder.streams[0], function () {
        stopScreenRecording();
    });

    initialTime = Date.now()
    timer = setInterval(checkTime, 100);

    // tell website that recording is started
    startRecordingCallback();
}

function startScreenRecording() {
    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, function (arrayOfTabs) {
        var activeTabId = arrayOfTabs[0].id; // Select tab used for recording
        var constraints = {
            audio: true,
            video: true,
            videoConstraints: {
                mandatory: {
                    chromeMediaSource: 'tab',
                    maxWidth: 1920,
                    maxHeight: 1080
                }
            },
            audioConstraints: {
                mandatory: {
                    echoCancellation: false
                }
            }
        };
        chrome.tabCapture.capture(constraints, function (stream) {
            var newStream = new MediaStream();
            stream.getTracks().forEach(function (track) {
                newStream.addTrack(track);
            });
            gotStream(newStream);
        });
    });
}


function stopScreenRecording() {
    if (!recorder || !isRecording) return;

    if (timer) {
        clearTimeout(timer);
    }
    setBadgeText('');
    isRecording = false;

    chrome.browserAction.setTitle({
        title: 'Record Your Screen, Tab or Camera'
    });
    chrome.browserAction.setIcon({
        path: 'images/icon.png'
    });

    recorder.stop(function onStopRecording(blob, ignoreGetSeekableBlob) {
        if (fixVideoSeekingIssues && recorder && !ignoreGetSeekableBlob) {
            getSeekableBlob(recorder.blob, function (seekableBlob) {
                onStopRecording(seekableBlob, true);
            });
            return;
        }

        var mimeType = '';
        var fileExtension = '';

        switch (videoCodec) {
            case 'VP8':
            case 'VP8':
                mimeType = 'video/webm';
                fileExtension = 'webm'
                break;
            case 'H264':
                mimeType = 'video/mp4';
                fileExtension = 'mp4';
                break;
            case 'AV1':
                mimeType = 'video/mkv';
                fileExtension = 'mkv';
                break;
            default:
                console.log("Unknown video codec");
                return;
        }

        var file = new File([recorder ? recorder.blob : ''], getFileName(fileExtension), {
            type: mimeType
        });

        if (ignoreGetSeekableBlob === true) {
            file = new File([blob], getFileName(fileExtension), {
                type: mimeType
            });
        }

        localStorage.setItem('selected-file', file.name);

        // initialTime = initialTime || Date.now();
        // var timeDifference = Date.now() - initialTime;
        // var formatted = convertTime(timeDifference);
        // file.duration = formatted;

        DiskStorage.StoreFile(file, function (response) {
            try {
                videoPlayers.forEach(function (player) {
                    player.srcObject = null;
                });
                videoPlayers = [];
            } catch (e) {}

            if (false && openPreviewOnStopRecording) {
                chrome.storage.sync.set({
                    isRecording: 'false', // for dropdown.js
                    openPreviewPage: 'true' // for previewing recorded video
                }, function () {
                    // wait 100 milliseconds to make sure DiskStorage finished its job
                    setTimeout(function () {
                        chrome.runtime.reload();
                    }, 100);
                });
                return;
            }

            false && setTimeout(function () {
                chrome.runtime.reload();
            }, 2000);

            // -------------
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
            chrome.browserAction.setIcon({
                path: 'images/icon.png'
            });
            // -------------

            stopRecordingCallback(file);

            chrome.storage.sync.set({
                isRecording: 'false',
                openPreviewPage: 'false'
            });

            openPreviewOnStopRecording && chrome.tabs.query({}, function (tabs) {
                var found = false;
                var url = 'chrome-extension://' + chrome.runtime.id + '/preview.html';
                for (var i = tabs.length - 1; i >= 0; i--) {
                    if (tabs[i].url === url) {
                        found = true;
                        chrome.tabs.update(tabs[i].id, {
                            active: true,
                            url: url
                        });
                        break;
                    }
                }
                if (!found) {
                    chrome.tabs.create({
                        url: 'preview.html'
                    });
                }

            });
        });
    });
}

function setVODRecordingBadgeText(text, title) {
    chrome.browserAction.setBadgeBackgroundColor({
        color: [203, 0, 15, 255]
    });

    chrome.browserAction.setBadgeText({
        text: text
    });

    chrome.browserAction.setTitle({
        title: title && title.length ? title + ' duration' : 'Record Screen'
    });
}

function msToTime(s) {
    function addZ(n) {
        return (n < 10 ? '0' : '') + n;
    }

    var ms = s % 1000;
    s = (s - ms) / 1000;
    var secs = s % 60;
    s = (s - secs) / 60;
    var mins = s % 60;
    var hrs = (s - mins) / 60;

    return addZ(hrs) + ':' + addZ(mins) + ':' + addZ(secs) + '.' + ms;
}

function convertTime(miliseconds) {
    var totalSeconds = Math.floor(miliseconds / 1000);
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds - minutes * 60;

    minutes += '';
    seconds += '';

    if (minutes.length === 1) {
        // minutes = '0' + minutes;
    }

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

    chrome.browserAction.setTitle({
        title: 'Recording duration: ' + formatted
    });
}

function setBadgeText(text) {
    chrome.browserAction.setBadgeBackgroundColor({
        color: [255, 0, 0, 255]
    });

    chrome.browserAction.setBadgeText({
        text: text + ''
    });
}


var images = ['recordRTC-progress-1.png', 'recordRTC-progress-2.png', 'recordRTC-progress-3.png', 'recordRTC-progress-4.png', 'recordRTC-progress-5.png'];
var imgIndex = 0;
var reverse = false;

function onRecording() {
    if (!isRecording) return;

    chrome.browserAction.setIcon({
        path: 'images/' + images[imgIndex]
    });

    if (!reverse) {
        imgIndex++;

        if (imgIndex > images.length - 1) {
            imgIndex = images.length - 1;
            reverse = true;
        }
    } else {
        imgIndex--;

        if (imgIndex < 0) {
            imgIndex = 1;
            reverse = false;
        }
    }

    if (isRecording) {
        setTimeout(onRecording, 800);
        return;
    }

    chrome.browserAction.setIcon({
        path: 'images/icon.png'
    });
}

false && chrome.storage.sync.get('openPreviewPage', function (item) {
    if (item.openPreviewPage !== 'true') return;

    chrome.storage.sync.set({
        isRecording: 'false',
        openPreviewPage: 'false'
    });

    chrome.tabs.query({}, function (tabs) {
        var found = false;
        var url = 'chrome-extension://' + chrome.runtime.id + '/preview.html';
        for (var i = tabs.length - 1; i >= 0; i--) {
            if (tabs[i].url === url) {
                found = true;
                chrome.tabs.update(tabs[i].id, {
                    active: true,
                    url: url
                });
                break;
            }
        }
        if (!found) {
            chrome.tabs.create({
                url: 'preview.html'
            });
        }
    });

    // invokeSaveAsDialog(file, file.name);
});