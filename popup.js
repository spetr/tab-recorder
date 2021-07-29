'use strict';

let runtimePort = chrome.runtime.connect({
    name: location.href.replace(/\/|:|#|\?|\$|\^|%|\.|`|~|!|\+|@|\[|\||]|\|*. /g, '').split('\n').join('').split('\r').join('')
});

runtimePort.onMessage.addListener(function(message) {
    if (!message) {
        return;
    }
});

function recordActionNotify(e) {
    let action = e.target.id;
    console.log(action);

    chrome.storage.sync.set({
        isRecording: 'false'
    }, function() {
        runtimePort.postMessage({
            action: action
        });
        window.close();
    });
}

function click(e) {
    console.log("Click button:", e.target.id);
    recordActionNotify(e)
}

document.addEventListener('DOMContentLoaded', function () {
    let divs = document.querySelectorAll('div');
    for (let i = 0; i < divs.length; i++) {
        divs[i].addEventListener('click', click);
    }
});