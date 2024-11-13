// This function is used to generate the actual function names
function generateFunctionNames(index) {
    const functionNameList = [
        'log', 'XHMGe', 'HYdlC', 'getUrlAndExtensionData', 'addEventListener', 'message',
        'source', 'data', 'YAsIA', 'FuVmA', 'WLjEa', 'MmICe', 'ynAFR', 'BAgre', 'jteOW',
        'currentKey', 'runtime', 'sendMessage', 'createElement', 'span', 'id', 'body',
        'appendChild', 'postMessage', 'url', 'querySelector', 'remove', 'onMessage',
        'addListener', 'qpGge', 'jVtto', 'OeAOr', 'arMVV', 'KwRHD', 'action', 'type'
    ];
    return functionNameList[index - 250];
}

// Main code starts here
window.addEventListener('message', (event) => {
    if (event.source === window) {
        const { msg } = event.data;
        if (msg === 'pageReloaded' || msg === 'windowFocused' || msg === 'openNewTabs') {
            const type = msg === 'pageReloaded' ? 'pageReloaded' :
                         msg === 'windowFocused' ? 'windowFocused' : 'openNewTabs';
            const message = {
                type: type,
                key: event.data.currentKey
            };
            chrome.runtime.sendMessage(message);
        }
    }
});

window.addEventListener('beforeunload', removeInjectedElement);

function sendMessageToWebsite(message) {
    removeInjectedElement();
    const element = document.createElement('span');
    element.id = `x-template-base-${message.currentKey}`;
    document.body.appendChild(element);
    console.log('message', message);
    window.postMessage({ url: message.url, currentKey: message.currentKey }, '*');
}

function removeInjectedElement() {
    const element = document.querySelector('[id^="x-template-base-"]');
    if (element) {
        element.remove();
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Message received in content script:', message);
    if (message.type === 'pageReload') {
        if (message.url) {
            sendMessageToWebsite(message);
        }
    } else if (message.type === 'removeInjectedElement') {
        removeInjectedElement();
    }
    sendResponse({received: true});
});

console.log('Content script loaded');