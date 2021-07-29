'use strict';

let runtimePort = chrome.runtime.connect({
    name: location.href.replace(/\/|:|#|\?|\$|\^|%|\.|`|~|!|\+|@|\[|\||]|\|*. /g, '').split('\n').join('').split('\r').join('')
});

runtimePort.onMessage.addListener(function (message) {
    if (!message) {
        return;
    }
});

function click(e) {
    runtimePort.postMessage({
        action: e.target.id
    });
    window.close();
}

document.addEventListener('DOMContentLoaded', function () {
    let divs = document.querySelectorAll('div');
    for (let i = 0; i < divs.length; i++) {
        divs[i].addEventListener('click', click);
    }
});