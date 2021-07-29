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
            case "preview":
                console.log(`stop record!`)
                openPreviewPage();
                break;
            default:
                console.log(`unknown action ${request.action}`);
        }
    })
});

// Start recording (current tab)
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
                    options.mimeType = 'video/webm\;codecs=h264';
                    break;
                case 'AV1':
                    options.mimeType = 'video/x-matroska;codecs=avc1';
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
    });
}

// Stop recording
function stopScreenRecording() {
    if (!recorder || !isRecording) return;
    if (timer) {
        clearTimeout(timer);
    }
    setBadgeText('');
    isRecording = false;
    recorder.stop(function onStopRecording(blob, ignoreGetSeekableBlob) {
        var mimeType = '';
        var fileExtension = '';
        switch (videoCodec) {
            case 'VP8':
            case 'VP9':
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