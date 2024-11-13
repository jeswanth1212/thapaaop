let tabDetails;
const domain_ip_addresses = [
    '35.212.92.196',
    '34.233.30.147',
    '142.250.19.190'
];

const API_KEY = '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';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'UPDATE_API_KEY') {
        API_KEY = message.apiKey;
        sendResponse({success: true});
    }
});

let currentKey = null;
let reloadTabOnNextUrlChange = true;

const urlPatterns = [
    'examly.io/test-comp?c_id=',
    'mycourses/',
    'mycdetails/test?id=',
    'examly.test.app/temp'
];

let isReloading = false;

function fetchExtensionDetails(callback) {
    chrome.management.getAll((extensions) => {
        const neoExamShieldExt = extensions.find(ext => ext.enabled && ext.name === 'NeoExamShield' && ext.type === 'extension');
        const enabledExtensionsCount = extensions.filter(ext => ext.enabled && ext.name !== 'NeoExamShield' && ext.type === 'extension').length;
        callback(neoExamShieldExt, enabledExtensionsCount);
    });
}

const fetchDomainIp = (url) => {
    return new Promise((resolve) => {
        const hostname = new URL(url).hostname;
        fetch(`https://dns.google/resolve?name=${hostname}`)
            .then(response => response.json())
            .then(data => {
                const ip = data.Answer?.find(a => a.type === 1)?.data || null;
                resolve(ip);
            })
            .catch(() => {
                resolve(null);
            });
    });
};

async function handleUrlChange(tabId) {
    if (!tabDetails || !tabDetails.url) return;

    if (urlPatterns.some(pattern => tabDetails.url.includes(pattern))) {
        let ip = await fetchDomainIp(tabDetails.url);
        if (ip && domain_ip_addresses.includes(ip) || 
            tabDetails.url.includes('examly.io') || 
            tabDetails.url.includes('examly.net') || 
            tabDetails.url.includes('examly.test')) {
            fetchExtensionDetails((extensions, enabledExtensionCount) => {
                let message = {
                    type: 'pageReload',
                    url: tabDetails.url,
                    enabledExtensionCount: enabledExtensionCount,
                    extensions: extensions,
                    id: tabDetails.id,
                    currentKey: currentKey
                };
                chrome.tabs.sendMessage(tabId, message, (response) => {
                    if (chrome.runtime.lastError) {
                        chrome.scripting.executeScript({
                            target: { tabId: tabId },
                            files: ['content.js']
                        }, () => {
                            if (!chrome.runtime.lastError) {
                                chrome.tabs.sendMessage(tabId, message);
                            }
                        });
                    }
                });
            });
        }
    }
}

function openNewMinimizedWindowWithUrl(url) {
    chrome.windows.create({ url: url }, (window) => {
        // Window created
    });
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.update(tabs[0].id, { url: tabs[0].url });
    });
});

chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        tabDetails = tab;
    });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        tabDetails = tab;
        handleUrlChange(tabId);
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'Answer' || request.type === 'windowFocus') {
        handleUrlChange(sender.tab.id);
    } else if (request.type === 'openNewTab') {
        openNewMinimizedWindowWithUrl(request.url);
    } else if (request.type === 'processChatMessage') {
        const { message, context } = request;
        chatContext = context;
        processChatMessage(message);
    } else if (request.type === 'resetContext') {
        chatContext = [];
    }
});

const notify = async (tabId, message, badgeText = 'E') => {
    tabId = tabId || (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0].id;
    chrome.action.setBadgeText({ tabId: tabId, text: badgeText });
    chrome.action.setTitle({ tabId: tabId, title: message });
};

const activate = () => {
    if (activate.busy) return;
    activate.busy = true;
    try {
        chrome.scripting.unregisterContentScripts();
        const options = {
            allFrames: true,
            matchOriginAsFallback: true,
            runAt: 'document_start',
            matches: ['*://*/*']
        };
        chrome.scripting.registerContentScripts([
            { ...options, id: 'main', js: ['data/inject/main.js'], world: 'MAIN' },
            { ...options, id: 'isolated', js: ['data/inject/isolated.js'], world: 'ISOLATED' }
        ]);
    } catch (e) {
        notify(undefined, 'Blocker Registration Failed: ' + e.message);
    }
    for (const action of activate.actions) action();
    activate.actions.length = 0;
    activate.busy = false;
};

chrome.runtime.onStartup.addListener(activate);
chrome.runtime.onInstalled.addListener(activate);
activate.actions = [];

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({ id: 'copySelectedText', title: 'Copy', contexts: ['selection'] });
    chrome.contextMenus.create({ id: 'separator1', type: 'separator', contexts: ['editable', 'selection'] });
    chrome.contextMenus.create({ id: 'pasteClipboard', title: 'Paste Clipboard Contents by Swapping', contexts: ['editable'] });
    chrome.contextMenus.create({ id: 'typeClipboard', title: 'Type Clipboard', contexts: ['editable'] });
    chrome.contextMenus.create({ id: 'separator2', type: 'separator', contexts: ['editable', 'selection'] });
    chrome.contextMenus.create({ id: 'searchWithAI', title: 'Search with AI', contexts: ['selection'] });
    chrome.contextMenus.create({ id: 'solveMCQ', title: 'Solve MCQ', contexts: ['selection'] });
});

const overlayHTML = `
  <div id="AI-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;">
      <div style="width: 40%; padding: 20px; background-color: #2c2c2c; border: 1px solid #444; border-radius: 8px;">
          <div id="prompt-suggestions" style="margin-bottom: 10px;">
              <span style="color: #888; cursor: pointer;" onclick="document.getElementById('AI-textbox').value = 'Secret Textbox'">Press [Esc] to exit</span>
          </div>
          <textarea id="AI-textbox" style="width: 100%; height: 100px; padding: 10px 10px; font-size: 16px; background-color: #2c2c2c; color: #ffffff; border: none; border-radius: 8px; resize: vertical; outline: none;"></textarea>
      </div>
  </div>
`;

function showOverlay(tabId) {
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: function(html) {
            if (document.getElementById('AI-overlay')) {
                document.getElementById('AI-overlay').remove();
                return;
            }
            const div = document.createElement('div');
            div.innerHTML = html;
            document.body.appendChild(div);
            const textbox = document.getElementById('AI-textbox');
            textbox.focus();
            textbox.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && e.shiftKey) {
                    document.getElementById('AI-overlay').remove();
                }
            });
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    document.getElementById('AI-overlay').remove();
                }
            });
        },
        args: [overlayHTML]
    });
}

function getSelectedText() {
    return window.getSelection().toString();
}

function handleQueryResponse(response, tabId, isMCQ = false) {
    if (response) {
        if (isMCQ) {
            const answer = response.toUpperCase().charAt(0);
            if (['A', 'B', 'C', 'D'].includes(answer)) {
                showMCQToast(tabId, answer);
            } else {
                showToast(tabId, 'Not a valid MCQ response: ' + response, true);
            }
        } else {
            copyToClipboard(response);
            showToast(tabId, 'Successful!');
        }
    } else {
        showToast(tabId, 'Error. Try again after 30s.', true);
    }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'copySelectedText' && info.selectionText) {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (text) => {
                const textarea = document.createElement('textarea');
                textarea.textContent = text;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            },
            args: [info.selectionText]
        });
    }
    if (info.menuItemId === 'typeClipboard') {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: async () => {
                const text = await navigator.clipboard.readText();
                const activeElement = document.activeElement;
                for (let char of text) {
                    const keydownEvent = new KeyboardEvent('keydown', {
                        key: char,
                        code: 'Key' + char.toUpperCase(),
                        charCode: char.charCodeAt(0),
                        keyCode: char.charCodeAt(0),
                        which: char.charCodeAt(0),
                        bubbles: true
                    });
                    const keypressEvent = new KeyboardEvent('keypress', {
                        key: char,
                        code: 'Key' + char.toUpperCase(),
                        charCode: char.charCodeAt(0),
                        keyCode: char.charCodeAt(0),
                        which: char.charCodeAt(0),
                        bubbles: true
                    });
                    const inputEvent = new InputEvent('input', {
                        data: char,
                        inputType: 'insertText',
                        bubbles: true
                    });
                    activeElement.dispatchEvent(keydownEvent);
                    activeElement.dispatchEvent(keypressEvent);
                    activeElement.value += char;
                    activeElement.dispatchEvent(inputEvent);
                }
            }
        });
    }
    if (info.menuItemId === 'pasteClipboard') {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: async () => {
                const text = await navigator.clipboard.readText();
                document.activeElement.value = text;
                document.activeElement.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
    }
    if (info.menuItemId === 'searchWithAI' && info.selectionText) {
        handleQueryResponse(await queryAI(info.selectionText), tab.id);
    }
    if (info.menuItemId === 'solveMCQ' && info.selectionText) {
        const response = await queryOpenAI(info.selectionText, true);
        if (response) {
            showMCQToast(tab.id, response);
        } else {
            showToast(tab.id, 'Error. Try again.', true);
        }
    }  
});

chrome.commands.onCommand.addListener(function(command) {
    if (command === 'show-overlay') {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                showOverlay(tabs[0].id);
            }
        });
    }
});

chrome.commands.onCommand.addListener((command, tab) => {
    if (command === 'search-mcq') {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: getSelectedText
        }, async (selection) => {
            if (selection[0]) {
                const isMCQ = command === 'search-mcq';
                const response = await queryOpenRouter(selection[0].result, isMCQ);
                handleQueryResponse(response, tab.id, isMCQ);
            }
        });
    }

    if (command === 'append-to-clipboard') {
        chrome.scripting.executeScript({
            target: {tabId: tab.id},
            function: () => {
                const selectedText = window.getSelection().toString();
                if (selectedText) {
                    navigator.clipboard.readText()
                        .then(currentText => {
                            const newText = currentText ? `${currentText} ${selectedText}` : selectedText;
                            return navigator.clipboard.writeText(newText);
                        })
                        .catch(err => {});
                }
                return selectedText;
            }
        }).then((results) => {
            if (results && results[0] && results[0].result) {
                showToast(tab.id, 'Appended');
            }
        });
    }

    if (command === 'send-to-ai') {
        chrome.scripting.executeScript({
            target: {tabId: tab.id},
            function: () => {
                return navigator.clipboard.readText();
            }
        }).then((results) => {
            if (results && results[0] && results[0].result) {
                return queryOpenRouter(results[0].result);
            }
        }).then(aiResponse => {
            if (aiResponse) {
                chrome.scripting.executeScript({
                    target: {tabId: tab.id},
                    function: (response) => {
                        navigator.clipboard.writeText(response)
                            .catch(err => {});
                    },
                    args: [aiResponse]
                });
                showToast(tab.id, 'AI R');
            }
        });
    }

    if (command === 'custom-paste') {
        chrome.scripting.executeScript({
            target: {tabId: tab.id},
            function: () => {
                navigator.clipboard.readText().then(content => {
                    const activeElement = document.activeElement;
                    if (activeElement.isContentEditable || 
                        activeElement.tagName.toLowerCase() === 'textarea' || 
                        (activeElement.tagName.toLowerCase() === 'input' && 
                         activeElement.type === 'text')) {
                        
                        const start = activeElement.selectionStart;
                        const end = activeElement.selectionEnd;
                        const text = activeElement.value || activeElement.textContent;
                        const before = text.substring(0, start);
                        const after = text.substring(end, text.length);
                        
                        if (activeElement.isContentEditable) {
                            activeElement.textContent = before + content + after;
                        } else {
                            activeElement.value = before + content + after;
                        }
                        
                        activeElement.selectionStart = activeElement.selectionEnd = start + content.length;
                        activeElement.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                });
            }
        });
    }
});

let chatContext = [];

async function processChatMessage(message) {
    const response = await queryOpenRouter(message, false, chatContext);
    if (response) {
        chatContext.push({role: "assistant", content: response});
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: "updateChatHistory",
                role: "assistant",
                content: response
            });
        });
    }
}

async function queryOpenRouter(prompt, isMCQ = false) {
    const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

    if (isMCQ) {
        prompt += "\nThis is a MCQ question. The output should be only a single letter (A, B, C, or D) representing the correct answer option. If you think the question is not an MCQ, just respond with 'Not an MCQ'.";
    }

    try {
        console.log('Sending request to OpenRouter with prompt:', prompt);
        
        const requestBody = {
            model: "meta-llama/llama-3.1-405b-instruct:free",
            messages: [
                { role: "system", content: "You are a helpful assistant." },
                { role: "user", content: prompt }
            ]
        };

        console.log('Request body:', requestBody);

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': chrome.runtime.getURL(''), // Required by OpenRouter
                'X-Title': 'Chrome Extension'  // Recommended by OpenRouter
            },
            body: JSON.stringify(requestBody)
        });

        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            console.error('OpenRouter API error:', {
                status: response.status,
                statusText: response.statusText,
                errorData
            });
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('OpenRouter API response:', data);

        if (!data.choices?.[0]?.message?.content) {
            console.error('Invalid response format:', data);
            throw new Error('Invalid response format from API');
        }

        return data.choices[0].message.content.trim();
    } catch (error) {
        console.error('Error in queryOpenRouter:', error);
        showToast(
            (await chrome.tabs.query({active: true, currentWindow: true}))[0].id,
            `API Error: ${error.message}`,
            true
        );
        return null;
    }
}

function copyToClipboard(text) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0]) {
            chrome.scripting.executeScript({
                target: {tabId: tabs[0].id},
                func: function(content) {
                    const textarea = document.createElement('textarea');
                    textarea.textContent = content;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                },
                args: [text]
            });
        }
    });
}

function showToast(tabId, message, isError = false) {
    chrome.scripting.executeScript({
        target: {tabId: tabId},
        func: function(msg, error) {
            const toast = document.createElement('div');
            toast.textContent = msg; // Show the full message
            toast.style.position = 'fixed';
            toast.style.bottom = '10px';
            toast.style.right = '10px';
            toast.style.backgroundColor = 'grey';
            toast.style.color = error ? 'red' : 'white';
            toast.style.padding = '5px';
            toast.style.borderRadius = '3px';
            toast.style.zIndex = 10000;
            toast.style.fontSize = '10px';
            toast.style.opacity = '0.8';

            document.body.appendChild(toast);
            
            setTimeout(() => { toast.remove(); }, 500); // 0.5 seconds duration
        },
        args: [message, isError]
    });
}

function showMCQToast(tabId, answer) {
    chrome.scripting.executeScript({
        target: {tabId: tabId},
        func: function(msg) {
            const toast = document.createElement('div');
            toast.textContent = 'MCQ Answer: ' + msg;
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.right = '20px';
            toast.style.backgroundColor = 'black';
            toast.style.color = 'white';
            toast.style.padding = '10px';
            toast.style.borderRadius = '5px';
            toast.style.zIndex = 10000;
            toast.style.fontSize = '16px';

            document.body.appendChild(toast);
            
            setTimeout(() => {
                toast.remove();
            }, 3000);
        },
        args: [answer]
    });
}

function showAlert(tabId, message) {
    chrome.scripting.executeScript({
        target: {tabId: tabId},
        func: function(msg) {
            alert(msg);
        },
        args: [message]
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'processChatMessage') {
        const { message, context } = request;
        chatContext = context;
        processChatMessage(message);
    } else if (request.action === 'resetContext') {
        chatContext = [];
    }
});